import type Database from 'better-sqlite3'

export function runInTransaction<T>(database: Database.Database, work: () => T): T {
  return database.transaction(work)()
}
