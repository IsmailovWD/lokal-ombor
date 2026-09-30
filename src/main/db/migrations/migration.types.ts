import type Database from 'better-sqlite3'

export interface MigrationDefinition {
  readonly version: number
  readonly name: string
  readonly up: (database: Database.Database) => void
}

export interface AppliedMigration {
  readonly version: number
  readonly name: string
  readonly appliedAtUtc: string
}
