import Database from 'better-sqlite3'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import type { DatabaseBackupCreated, DatabaseRestoreCompleted } from '@shared/contracts/app.contract'

import { checkDatabaseHealth } from '../db/integrity/database-health'
import { migrations } from '../db/migrations/definitions'
import { MigrationRunner } from '../db/migrations/migration-runner'
import { databaseManager } from '../db/database'

import { BackupRestoreServiceError } from './backup-errors'

interface MigrationVersionRow { readonly version: number }

function timestampForFileName(date = new Date()): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function removeIfExists(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { force: true })
  }
}

function moveIfExists(source: string, destination: string): void {
  if (existsSync(source)) {
    renameSync(source, destination)
  }
}

function assertSqliteFilePath(filePath: string, errorCode: 'BACKUP_VALIDATION' | 'RESTORE_VALIDATION'): void {
  if (typeof filePath !== 'string' || extname(filePath).toLowerCase() !== '.sqlite') {
    throw new BackupRestoreServiceError(errorCode, 'Faqat .sqlite kengaytmali backup faylidan foydalaning.')
  }
}

export class BackupRestoreService {
  public constructor(private readonly databasePath: string) {}

  public async createBackup(destinationPath: string): Promise<DatabaseBackupCreated> {
    assertSqliteFilePath(destinationPath, 'BACKUP_VALIDATION')
    if (resolve(destinationPath) === resolve(this.databasePath)) {
      throw new BackupRestoreServiceError('BACKUP_VALIDATION', 'Ishlayotgan database faylini backup manzili sifatida tanlab bo‘lmaydi.')
    }

    try {
      await databaseManager.getConnection().backup(destinationPath)
      return { fileName: basename(destinationPath), createdAtUtc: new Date().toISOString() }
    } catch (error) {
      throw new BackupRestoreServiceError('BACKUP_FAILED', 'Backup yaratib bo‘lmadi. Fayl manzilini va disk bo‘sh joyini tekshiring.', { cause: error })
    }
  }

  public async restoreFrom(sourcePath: string): Promise<DatabaseRestoreCompleted> {
    assertSqliteFilePath(sourcePath, 'RESTORE_VALIDATION')
    if (!existsSync(sourcePath)) {
      throw new BackupRestoreServiceError('RESTORE_VALIDATION', 'Tanlangan backup fayli topilmadi.')
    }

    const workId = randomUUID()
    const databaseDirectory = dirname(this.databasePath)
    const stagingPath = join(databaseDirectory, `.ombor-restore-stage-${workId}.sqlite`)
    const previousPath = join(databaseDirectory, `.ombor-restore-previous-${workId}.sqlite`)
    const safetyDirectory = join(databaseDirectory, 'backups')
    const safetyBackupPath = join(safetyDirectory, `ombor_lokal_pre_restore_${timestampForFileName()}.sqlite`)

    try {
      await this.createStagedAndValidatedDatabase(sourcePath, stagingPath)
      mkdirSync(safetyDirectory, { recursive: true })
      await databaseManager.getConnection().backup(safetyBackupPath)
      this.replaceDatabaseWithStagedCopy(stagingPath, previousPath)
      return { safetyBackupFileName: basename(safetyBackupPath), restoredAtUtc: new Date().toISOString() }
    } catch (error) {
      if (error instanceof BackupRestoreServiceError) {
        throw error
      }

      throw new BackupRestoreServiceError('RESTORE_FAILED', 'Backup’dan tiklash bajarilmadi. Joriy database saqlab qolindi.', { cause: error })
    } finally {
      removeIfExists(stagingPath)
    }
  }

  private async createStagedAndValidatedDatabase(sourcePath: string, stagingPath: string): Promise<void> {
    let sourceDatabase: Database.Database | undefined
    let stagingDatabase: Database.Database | undefined

    try {
      sourceDatabase = new Database(sourcePath, { readonly: true, fileMustExist: true })
      const sourceHealth = checkDatabaseHealth(sourceDatabase)
      if (!sourceHealth.isHealthy) {
        throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Backup database integrity tekshiruvidan o‘tmadi.')
      }
      this.assertSupportedMigrationHistory(sourceDatabase)
      await sourceDatabase.backup(stagingPath)
      sourceDatabase.close()
      sourceDatabase = undefined

      stagingDatabase = new Database(stagingPath)
      stagingDatabase.pragma('foreign_keys = ON')
      stagingDatabase.pragma('journal_mode = DELETE')
      new MigrationRunner(stagingDatabase, migrations).migrate()
      const stagedHealth = checkDatabaseHealth(stagingDatabase)
      if (!stagedHealth.isHealthy) {
        throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Backup migrationdan keyin integrity tekshiruvidan o‘tmadi.')
      }
    } catch (error) {
      if (error instanceof BackupRestoreServiceError) throw error
      throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Tanlangan fayl Obmor backup’i emas yoki schema bilan mos emas.', { cause: error })
    } finally {
      if (sourceDatabase?.open) sourceDatabase.close()
      if (stagingDatabase?.open) stagingDatabase.close()
    }
  }

  private assertSupportedMigrationHistory(database: Database.Database): void {
    const migrationTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get() as { readonly name: string } | undefined
    if (!migrationTable) {
      throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Tanlangan faylda Obmor migration tarixi topilmadi.')
    }

    const row = database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as MigrationVersionRow | undefined
    const latestVersion = row?.version ?? 0
    const supportedVersion = Math.max(...migrations.map((migration) => migration.version))
    if (latestVersion < 1) {
      throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Tanlangan fayl Obmor backup’i sifatida tanilmadi.')
    }
    if (latestVersion > supportedVersion) {
      throw new BackupRestoreServiceError('RESTORE_INCOMPATIBLE', 'Backup ilovaning ushbu versiyasidan yangiroq. Avval yangi ilova versiyasidan foydalaning.')
    }
  }

  private replaceDatabaseWithStagedCopy(stagingPath: string, previousPath: string): void {
    const currentWalPath = `${this.databasePath}-wal`
    const currentShmPath = `${this.databasePath}-shm`
    const previousWalPath = `${previousPath}-wal`
    const previousShmPath = `${previousPath}-shm`
    let previousMoved = false

    try {
      databaseManager.close()
      renameSync(this.databasePath, previousPath)
      previousMoved = true
      moveIfExists(currentWalPath, previousWalPath)
      moveIfExists(currentShmPath, previousShmPath)
      renameSync(stagingPath, this.databasePath)
      databaseManager.initialize({ databasePath: this.databasePath })
      removeIfExists(previousPath)
      removeIfExists(previousWalPath)
      removeIfExists(previousShmPath)
    } catch (error) {
      databaseManager.close()

      if (previousMoved) {
        removeIfExists(this.databasePath)
        removeIfExists(currentWalPath)
        removeIfExists(currentShmPath)
        renameSync(previousPath, this.databasePath)
        moveIfExists(previousWalPath, currentWalPath)
        moveIfExists(previousShmPath, currentShmPath)
        databaseManager.initialize({ databasePath: this.databasePath })
      } else {
        databaseManager.initialize({ databasePath: this.databasePath })
      }

      throw error
    }
  }
}
