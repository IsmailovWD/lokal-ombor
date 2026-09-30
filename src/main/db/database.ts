import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { DatabaseError } from './database-errors'
import { checkDatabaseHealth, type DatabaseHealthReport } from './integrity/database-health'
import { migrations } from './migrations/definitions'
import { MigrationRunner } from './migrations/migration-runner'
import type { AppliedMigration, MigrationDefinition } from './migrations/migration.types'

export interface InitializeDatabaseOptions {
  readonly databasePath: string
  readonly migrations?: readonly MigrationDefinition[]
}

export interface DatabaseInitializationResult {
  readonly appliedMigrations: readonly AppliedMigration[]
  readonly health: DatabaseHealthReport
}

export class DatabaseManager {
  private database: Database.Database | undefined
  private currentPath: string | undefined

  public initialize(options: InitializeDatabaseOptions): DatabaseInitializationResult {
    if (this.database) {
      if (this.currentPath !== options.databasePath) {
        throw new DatabaseError('DATABASE_INITIALIZATION_FAILED', 'Database boshqa path bilan allaqachon ochilgan.')
      }

      return {
        appliedMigrations: [],
        health: checkDatabaseHealth(this.database)
      }
    }

    try {
      mkdirSync(dirname(options.databasePath), { recursive: true })

      const database = new Database(options.databasePath)
      database.pragma('foreign_keys = ON')
      database.pragma('journal_mode = WAL')
      database.pragma('busy_timeout = 5000')

      const appliedMigrations = new MigrationRunner(database, options.migrations ?? migrations).migrate()
      const health = checkDatabaseHealth(database)

      if (!health.isHealthy) {
        database.close()
        throw new DatabaseError('DATABASE_INTEGRITY_FAILED', 'SQLite database integrity tekshiruvidan o‘tmadi.')
      }

      this.database = database
      this.currentPath = options.databasePath

      return { appliedMigrations, health }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }

      throw new DatabaseError('DATABASE_INITIALIZATION_FAILED', 'Lokal SQLite database ishga tushmadi.', {
        cause: error
      })
    }
  }

  public getConnection(): Database.Database {
    if (!this.database) {
      throw new DatabaseError('DATABASE_NOT_INITIALIZED', 'Database hali ishga tushirilmagan.')
    }

    return this.database
  }

  public getCurrentPath(): string {
    if (!this.currentPath) {
      throw new DatabaseError('DATABASE_NOT_INITIALIZED', 'Database hali ishga tushirilmagan.')
    }

    return this.currentPath
  }

  public verifyHealth(): DatabaseHealthReport {
    return checkDatabaseHealth(this.getConnection())
  }

  public close(): void {
    if (this.database?.open) {
      this.database.close()
    }

    this.database = undefined
    this.currentPath = undefined
  }
}

export const databaseManager = new DatabaseManager()
