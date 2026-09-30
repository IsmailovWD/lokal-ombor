import type Database from 'better-sqlite3'

export interface DatabaseHealthReport {
  readonly isHealthy: boolean
  readonly integrityCheckResult: string
  readonly foreignKeyViolationCount: number
}

interface IntegrityCheckRow {
  readonly integrity_check: string
}

export function checkDatabaseHealth(database: Database.Database): DatabaseHealthReport {
  const integrityRows = database.prepare('PRAGMA integrity_check').all() as IntegrityCheckRow[]
  const integrityCheckResult = integrityRows.map((row) => row.integrity_check).join('; ')
  const foreignKeyViolationCount = database.prepare('PRAGMA foreign_key_check').all().length

  return {
    isHealthy: integrityCheckResult === 'ok' && foreignKeyViolationCount === 0,
    integrityCheckResult,
    foreignKeyViolationCount
  }
}
