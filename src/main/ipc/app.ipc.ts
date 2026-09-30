import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { join } from 'node:path'

import {
  appIpcChannels,
  type AppRuntimeInfo,
  type BackupOperationResult,
  type CreateProductInput,
  type CreateStockInInput,
  type CreateStockOutInput,
  type CreateUnitInput,
  type DashboardOperationResult,
  type DashboardQuery,
  type DeleteProductInput,
  type DeleteStockInInput,
  type DeleteStockOutInput,
  type DeleteUnitInput,
  type HistoryListQuery,
  type HistoryOperationResult,
  type IntegrityOperationResult,
  type ProductListQuery,
  type ProductOperationResult,
  type SetProductActiveInput,
  type SetUnitActiveInput,
  type StockInListQuery,
  type StockOutListQuery,
  type StockMovementOperationResult,
  type UnitOperationResult,
  type UnitListQuery,
  type UpdateStockInInput,
  type UpdateStockOutInput,
  type UpdateProductInput,
  type UpdateUnitInput
} from '@shared/contracts/app.contract'

import { ProductServiceError } from '../products/product-errors'
import { productService } from '../products/product-service'
import { BackupRestoreServiceError } from '../backup/backup-errors'
import { BackupRestoreService } from '../backup/backup-restore-service'
import { databaseManager } from '../db/database'
import { DashboardServiceError } from '../dashboard/dashboard-errors'
import { dashboardService } from '../dashboard/dashboard-service'
import { HistoryServiceError } from '../history/history-errors'
import { historyService } from '../history/history-service'
import { IntegrityServiceError } from '../integrity/integrity-errors'
import { stockIntegrityService } from '../integrity/stock-integrity-service'
import { assertTrustedRenderer } from '../security/session-security'
import { StockMovementServiceError } from '../stock/stock-errors'
import { stockInService } from '../stock/stock-in-service'
import { stockOutService } from '../stock/stock-out-service'
import { UnitServiceError } from '../units/unit-errors'
import { unitService } from '../units/unit-service'

function executeUnitOperation<T>(work: () => T): UnitOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof UnitServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Units IPC xatosi.', error)
    return {
      ok: false,
      error: {
        code: 'UNIT_OPERATION_FAILED',
        message: 'Birlik operatsiyasini bajarib bo‘lmadi. Qayta urinib ko‘ring.'
      }
    }
  }
}

function executeStockMovementOperation<T>(work: () => T): StockMovementOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof StockMovementServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Stock movement IPC xatosi.', error)
    return {
      ok: false,
      error: {
        code: 'STOCK_MOVEMENT_OPERATION_FAILED',
        message: 'Ombor operatsiyasini bajarib bo‘lmadi. Qayta urinib ko‘ring.'
      }
    }
  }
}

function executeProductOperation<T>(work: () => T): ProductOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Products IPC xatosi.', error)
    return {
      ok: false,
      error: {
        code: 'PRODUCT_OPERATION_FAILED',
        message: 'Mahsulot operatsiyasini bajarib bo‘lmadi. Qayta urinib ko‘ring.'
      }
    }
  }
}

function executeHistoryOperation<T>(work: () => T): HistoryOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('History IPC xatosi.', error)
    return { ok: false, error: { code: 'HISTORY_OPERATION_FAILED', message: 'Tarix ma’lumotlarini yuklab bo‘lmadi. Qayta urinib ko‘ring.' } }
  }
}

function executeDashboardOperation<T>(work: () => T): DashboardOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof DashboardServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Dashboard IPC xatosi.', error)
    return { ok: false, error: { code: 'DASHBOARD_OPERATION_FAILED', message: 'Dashboard ma’lumotlarini yuklab bo‘lmadi. Qayta urinib ko‘ring.' } }
  }
}

function executeIntegrityOperation<T>(work: () => T): IntegrityOperationResult<T> {
  try {
    return { ok: true, data: work() }
  } catch (error) {
    if (error instanceof IntegrityServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Integrity IPC xatosi.', error)
    return { ok: false, error: { code: 'INTEGRITY_OPERATION_FAILED', message: 'Database integrity tekshiruvini bajarib bo‘lmadi. Qayta urinib ko‘ring.' } }
  }
}

async function executeBackupOperation<T>(work: () => Promise<T>): Promise<BackupOperationResult<T>> {
  try {
    return { ok: true, data: await work() }
  } catch (error) {
    if (error instanceof BackupRestoreServiceError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }

    console.error('Backup/restore IPC xatosi.', error)
    return { ok: false, error: { code: 'RESTORE_FAILED', message: 'Backup yoki restore operatsiyasini bajarib bo‘lmadi. Qayta urinib ko‘ring.' } }
  }
}

function createBackupFileName(): string {
  return `ombor_lokal_${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.sqlite`
}

export function registerAppIpcHandlers(): void {
  ipcMain.handle(appIpcChannels.getRuntimeInfo, (event): AppRuntimeInfo => {
    assertTrustedRenderer(event.sender)

    return {
      name: app.getName(),
      version: app.getVersion(),
      environment: app.isPackaged ? 'production' : 'development'
    }
  })

  ipcMain.handle(appIpcChannels.listUnits, (event, query: UnitListQuery) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => unitService.list(query))
  })

  ipcMain.handle(appIpcChannels.createUnit, (event, input: CreateUnitInput) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => unitService.create(input))
  })

  ipcMain.handle(appIpcChannels.updateUnit, (event, input: UpdateUnitInput) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => unitService.update(input))
  })

  ipcMain.handle(appIpcChannels.setUnitActive, (event, input: SetUnitActiveInput) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => unitService.setActive(input))
  })

  ipcMain.handle(appIpcChannels.deleteUnit, (event, input: DeleteUnitInput) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => {
      unitService.delete(input.id)
      return { id: input.id }
    })
  })

  ipcMain.handle(appIpcChannels.listActiveUnitOptions, (event) => {
    assertTrustedRenderer(event.sender)
    return executeUnitOperation(() => unitService.listActiveOptions())
  })

  ipcMain.handle(appIpcChannels.listProducts, (event, query: ProductListQuery) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => productService.list(query))
  })

  ipcMain.handle(appIpcChannels.createProduct, (event, input: CreateProductInput) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => productService.create(input))
  })

  ipcMain.handle(appIpcChannels.updateProduct, (event, input: UpdateProductInput) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => productService.update(input))
  })

  ipcMain.handle(appIpcChannels.setProductActive, (event, input: SetProductActiveInput) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => productService.setActive(input))
  })

  ipcMain.handle(appIpcChannels.deleteProduct, (event, input: DeleteProductInput) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => {
      productService.delete(input)
      return { id: input.id }
    })
  })

  ipcMain.handle(appIpcChannels.listActiveStockProductOptions, (event) => {
    assertTrustedRenderer(event.sender)
    return executeProductOperation(() => productService.listActiveStockOptions())
  })

  ipcMain.handle(appIpcChannels.listStockInMovements, (event, query: StockInListQuery) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockInService.list(query))
  })

  ipcMain.handle(appIpcChannels.createStockInMovement, (event, input: CreateStockInInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockInService.create(input))
  })

  ipcMain.handle(appIpcChannels.updateStockInMovement, (event, input: UpdateStockInInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockInService.update(input))
  })

  ipcMain.handle(appIpcChannels.deleteStockInMovement, (event, input: DeleteStockInInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => {
      stockInService.delete(input)
      return { id: input.id }
    })
  })

  ipcMain.handle(appIpcChannels.listStockOutMovements, (event, query: StockOutListQuery) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockOutService.list(query))
  })

  ipcMain.handle(appIpcChannels.createStockOutMovement, (event, input: CreateStockOutInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockOutService.create(input))
  })

  ipcMain.handle(appIpcChannels.updateStockOutMovement, (event, input: UpdateStockOutInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => stockOutService.update(input))
  })

  ipcMain.handle(appIpcChannels.deleteStockOutMovement, (event, input: DeleteStockOutInput) => {
    assertTrustedRenderer(event.sender)
    return executeStockMovementOperation(() => {
      stockOutService.delete(input)
      return { id: input.id }
    })
  })

  ipcMain.handle(appIpcChannels.listHistory, (event, query: HistoryListQuery) => {
    assertTrustedRenderer(event.sender)
    return executeHistoryOperation(() => historyService.list(query))
  })

  ipcMain.handle(appIpcChannels.getHistoryFilterOptions, (event) => {
    assertTrustedRenderer(event.sender)
    return executeHistoryOperation(() => historyService.getFilterOptions())
  })

  ipcMain.handle(appIpcChannels.getDashboardOverview, (event, query: DashboardQuery) => {
    assertTrustedRenderer(event.sender)
    return executeDashboardOperation(() => dashboardService.getOverview(query))
  })

  ipcMain.handle(appIpcChannels.createDatabaseBackup, async (event) => {
    assertTrustedRenderer(event.sender)
    const options: SaveDialogOptions = {
      title: 'Backup saqlash',
      defaultPath: join(app.getPath('documents'), createBackupFileName()),
      buttonLabel: 'Backup saqlash',
      filters: [{ name: 'SQLite backup', extensions: ['sqlite'] }]
    }
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const result = parentWindow ? await dialog.showSaveDialog(parentWindow, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: true, data: null }

    return executeBackupOperation(() => new BackupRestoreService(databaseManager.getCurrentPath()).createBackup(result.filePath))
  })

  ipcMain.handle(appIpcChannels.restoreDatabaseBackup, async (event) => {
    assertTrustedRenderer(event.sender)
    const options: OpenDialogOptions = {
      title: 'Backup faylini tanlang',
      buttonLabel: 'Tiklash',
      filters: [{ name: 'SQLite backup', extensions: ['sqlite'] }],
      properties: ['openFile']
    }
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const result = parentWindow ? await dialog.showOpenDialog(parentWindow, options) : await dialog.showOpenDialog(options)
    const sourcePath = result.filePaths[0]
    if (result.canceled || !sourcePath) return { ok: true, data: null }

    return executeBackupOperation(() => new BackupRestoreService(databaseManager.getCurrentPath()).restoreFrom(sourcePath))
  })

  ipcMain.handle(appIpcChannels.checkDatabaseIntegrity, (event) => {
    assertTrustedRenderer(event.sender)
    return executeIntegrityOperation(() => stockIntegrityService.check())
  })

  ipcMain.handle(appIpcChannels.rebuildStockBalances, (event) => {
    assertTrustedRenderer(event.sender)
    return executeIntegrityOperation(() => stockIntegrityService.rebuildStockBalances())
  })
}
