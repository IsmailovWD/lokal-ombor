import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { DatabaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'

const temporaryDirectories: string[] = []
const managers: DatabaseManager[] = []

function createTemporaryDatabase(): { readonly manager: DatabaseManager; readonly databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-database-test-'))
  const manager = new DatabaseManager()

  temporaryDirectories.push(directory)
  managers.push(manager)

  return {
    manager,
    databasePath: getDatabasePath(directory)
  }
}

afterEach(() => {
  for (const manager of managers.splice(0)) {
    manager.close()
  }

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('DatabaseManager', () => {
  it('userData ichida WAL va foreign key qoidasiga ega database yaratadi', () => {
    const { manager, databasePath } = createTemporaryDatabase()

    const result = manager.initialize({ databasePath })
    const database = manager.getConnection()

    expect(existsSync(databasePath)).toBe(true)
    expect(result.health.isHealthy).toBe(true)
    expect(database.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get()).toBeDefined()
  })
})
