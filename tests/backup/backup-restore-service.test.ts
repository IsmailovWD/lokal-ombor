import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { BackupRestoreService } from '../../src/main/backup/backup-restore-service'
import { BackupRestoreServiceError } from '../../src/main/backup/backup-errors'
import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { createUnits } from '../../src/main/db/migrations/definitions/001-create-units'
import { productService } from '../../src/main/products/product-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): { readonly directory: string; readonly databasePath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-backup-test-'))
  temporaryDirectories.push(directory)
  const databasePath = getDatabasePath(directory)
  databaseManager.initialize({ databasePath })
  return { directory, databasePath }
}

function allProductsCount(): number {
  return productService.list({ search: '', status: 'all', unitId: null, sort: 'name', direction: 'asc', page: 1, pageSize: 50 }).total
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('BackupRestoreService', () => {
  it('backup yaratadi, restore oldidan safety backup saqlaydi va current database’ni qayta ulaydi', async () => {
    const { directory, databasePath } = initializeDatabase()
    const unit = unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    productService.create({ name: 'Sement', sku: '', unitId: unit.id, minimumStockMilli: null })
    const service = new BackupRestoreService(databasePath)
    const backupPath = join(directory, 'manual.sqlite')

    const backup = await service.createBackup(backupPath)
    expect(backup.fileName).toBe('manual.sqlite')
    expect(existsSync(backupPath)).toBe(true)

    productService.create({ name: 'Un', sku: '', unitId: unit.id, minimumStockMilli: null })
    expect(allProductsCount()).toBe(2)

    const restore = await service.restoreFrom(backupPath)
    expect(restore.safetyBackupFileName).toMatch(/^ombor_lokal_pre_restore_.+\.sqlite$/)
    expect(existsSync(join(directory, 'backups', restore.safetyBackupFileName))).toBe(true)
    expect(allProductsCount()).toBe(1)
    expect(databaseManager.verifyHealth().isHealthy).toBe(true)
  })

  it('valid eski schema backup’ini current migrationlarga forward migrate qiladi', async () => {
    const { directory, databasePath } = initializeDatabase()
    const legacyPath = join(directory, 'legacy.sqlite')
    const legacy = new Database(legacyPath)
    createUnits.up(legacy)
    legacy.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at_utc TEXT NOT NULL);
      INSERT INTO schema_migrations (version, name, applied_at_utc) VALUES (1, 'create_units', '2026-01-01T00:00:00.000Z');
    `)
    legacy.close()

    await new BackupRestoreService(databasePath).restoreFrom(legacyPath)

    const productsTable = databaseManager.getConnection().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").get()
    const latestMigration = databaseManager.getConnection().prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { readonly version: number }
    expect(productsTable).toBeTruthy()
    expect(latestMigration.version).toBe(4)
  })

  it('noto‘g‘ri, buzilgan yoki yangi schema backup’larini current database’ga tegmasdan rad etadi', async () => {
    const { directory, databasePath } = initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    productService.create({ name: 'Bolt', sku: '', unitId: unit.id, minimumStockMilli: null })
    const service = new BackupRestoreService(databasePath)
    const corruptPath = join(directory, 'corrupt.sqlite')
    writeFileSync(corruptPath, 'SQLite emas')

    await expect(service.restoreFrom(corruptPath)).rejects.toBeInstanceOf(BackupRestoreServiceError)
    expect(allProductsCount()).toBe(1)

    const newerPath = join(directory, 'newer.sqlite')
    await service.createBackup(newerPath)
    const newer = new Database(newerPath)
    newer.prepare("INSERT INTO schema_migrations (version, name, applied_at_utc) VALUES (999, 'future', '2026-01-01T00:00:00.000Z')").run()
    newer.close()

    await expect(service.restoreFrom(newerPath)).rejects.toThrow('yangiroq')
    expect(allProductsCount()).toBe(1)
  })
})
