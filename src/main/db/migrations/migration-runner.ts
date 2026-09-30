import type Database from 'better-sqlite3'

import { DatabaseError } from '../database-errors'
import { runInTransaction } from '../transactions'
import type { AppliedMigration, MigrationDefinition } from './migration.types'

interface StoredMigrationRow {
  readonly version: number
  readonly name: string
  readonly applied_at_utc: string
}

function sortAndValidateDefinitions(definitions: readonly MigrationDefinition[]): MigrationDefinition[] {
  const sortedDefinitions = [...definitions].sort((left, right) => left.version - right.version)
  const knownVersions = new Set<number>()

  for (const definition of sortedDefinitions) {
    if (!Number.isInteger(definition.version) || definition.version <= 0) {
      throw new DatabaseError('MIGRATION_CONFLICT', 'Migration versioni musbat butun son bo‘lishi kerak.')
    }

    if (definition.name.trim().length === 0) {
      throw new DatabaseError('MIGRATION_CONFLICT', 'Migration nomi bo‘sh bo‘lishi mumkin emas.')
    }

    if (knownVersions.has(definition.version)) {
      throw new DatabaseError('MIGRATION_CONFLICT', `Takrorlangan migration versioni: ${definition.version}.`)
    }

    knownVersions.add(definition.version)
  }

  return sortedDefinitions
}

export class MigrationRunner {
  public constructor(
    private readonly database: Database.Database,
    private readonly definitions: readonly MigrationDefinition[]
  ) {}

  public migrate(): readonly AppliedMigration[] {
    this.ensureMigrationTable()

    const definitions = sortAndValidateDefinitions(this.definitions)
    const definitionsByVersion = new Map(definitions.map((definition) => [definition.version, definition]))
    const appliedMigrations = this.getAppliedMigrations()
    const appliedVersions = new Set(appliedMigrations.map((migration) => migration.version))
    const latestAppliedVersion = appliedMigrations.at(-1)?.version ?? 0

    for (const appliedMigration of appliedMigrations) {
      const definition = definitionsByVersion.get(appliedMigration.version)

      if (!definition || definition.name !== appliedMigration.name) {
        throw new DatabaseError(
          'MIGRATION_CONFLICT',
          `Database migration tarixi source migrationlar bilan mos emas: ${appliedMigration.version}.`
        )
      }
    }

    for (const definition of definitions) {
      if (appliedVersions.has(definition.version)) {
        continue
      }

      if (definition.version < latestAppliedVersion) {
        throw new DatabaseError(
          'MIGRATION_CONFLICT',
          `O‘tkazib yuborilgan tarixiy migration topildi: ${definition.version}.`
        )
      }

      this.applyMigration(definition)
    }

    return this.getAppliedMigrations()
  }

  private ensureMigrationTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at_utc TEXT NOT NULL
      )
    `)
  }

  private getAppliedMigrations(): AppliedMigration[] {
    const rows = this.database
      .prepare('SELECT version, name, applied_at_utc FROM schema_migrations ORDER BY version ASC')
      .all() as StoredMigrationRow[]

    return rows.map((row) => ({
      version: row.version,
      name: row.name,
      appliedAtUtc: row.applied_at_utc
    }))
  }

  private applyMigration(definition: MigrationDefinition): void {
    try {
      runInTransaction(this.database, () => {
        definition.up(this.database)
        this.database
          .prepare('INSERT INTO schema_migrations (version, name, applied_at_utc) VALUES (?, ?, ?)')
          .run(definition.version, definition.name, new Date().toISOString())
      })
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }

      throw new DatabaseError('MIGRATION_FAILED', `Migration bajarilmadi: ${definition.version} — ${definition.name}.`, {
        cause: error
      })
    }
  }
}
