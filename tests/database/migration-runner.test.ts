import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { MigrationRunner } from '../../src/main/db/migrations/migration-runner'
import type { MigrationDefinition } from '../../src/main/db/migrations/migration.types'

const databases: Database.Database[] = []

function createDatabase(): Database.Database {
  const database = new Database(':memory:')
  databases.push(database)
  return database
}

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

describe('MigrationRunner', () => {
  it('migrationni transaction ichida qo‘llab, tarixini saqlaydi', () => {
    const database = createDatabase()
    const definitions: readonly MigrationDefinition[] = [
      {
        version: 1,
        name: 'create_test_table',
        up: (connection) => {
          connection.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)')
        }
      }
    ]

    const applied = new MigrationRunner(database, definitions).migrate()

    expect(applied).toHaveLength(1)
    expect(applied[0]).toMatchObject({ version: 1, name: 'create_test_table' })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'test_table'").get()).toBeDefined()
  })

  it('xato bergan migrationning schema o‘zgarishini rollback qiladi', () => {
    const database = createDatabase()
    const definitions: readonly MigrationDefinition[] = [
      {
        version: 1,
        name: 'failing_migration',
        up: (connection) => {
          connection.exec('CREATE TABLE must_not_survive (id INTEGER PRIMARY KEY)')
          throw new Error('Qasddan test xatosi')
        }
      }
    ]

    expect(() => new MigrationRunner(database, definitions).migrate()).toThrow('Migration bajarilmadi')
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'must_not_survive'").get()).toBeUndefined()
    expect(database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()).toMatchObject({ count: 0 })
  })
})
