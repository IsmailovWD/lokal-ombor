import { contextBridge, ipcRenderer } from 'electron'

import { appIpcChannels, type OmborApi } from '@shared/contracts/app.contract'

const omborApi: OmborApi = {
  app: {
    getRuntimeInfo: () => ipcRenderer.invoke(appIpcChannels.getRuntimeInfo)
  },
  units: {
    list: (query) => ipcRenderer.invoke(appIpcChannels.listUnits, query),
    create: (input) => ipcRenderer.invoke(appIpcChannels.createUnit, input),
    update: (input) => ipcRenderer.invoke(appIpcChannels.updateUnit, input),
    setActive: (input) => ipcRenderer.invoke(appIpcChannels.setUnitActive, input),
    delete: (input) => ipcRenderer.invoke(appIpcChannels.deleteUnit, input),
    listActiveOptions: () => ipcRenderer.invoke(appIpcChannels.listActiveUnitOptions)
  },
  products: {
    list: (query) => ipcRenderer.invoke(appIpcChannels.listProducts, query),
    create: (input) => ipcRenderer.invoke(appIpcChannels.createProduct, input),
    update: (input) => ipcRenderer.invoke(appIpcChannels.updateProduct, input),
    setActive: (input) => ipcRenderer.invoke(appIpcChannels.setProductActive, input),
    delete: (input) => ipcRenderer.invoke(appIpcChannels.deleteProduct, input),
    listActiveStockOptions: () => ipcRenderer.invoke(appIpcChannels.listActiveStockProductOptions)
  },
  stockIn: {
    list: (query) => ipcRenderer.invoke(appIpcChannels.listStockInMovements, query),
    create: (input) => ipcRenderer.invoke(appIpcChannels.createStockInMovement, input),
    update: (input) => ipcRenderer.invoke(appIpcChannels.updateStockInMovement, input),
    delete: (input) => ipcRenderer.invoke(appIpcChannels.deleteStockInMovement, input)
  },
  stockOut: {
    list: (query) => ipcRenderer.invoke(appIpcChannels.listStockOutMovements, query),
    create: (input) => ipcRenderer.invoke(appIpcChannels.createStockOutMovement, input),
    update: (input) => ipcRenderer.invoke(appIpcChannels.updateStockOutMovement, input),
    delete: (input) => ipcRenderer.invoke(appIpcChannels.deleteStockOutMovement, input)
  },
  history: {
    list: (query) => ipcRenderer.invoke(appIpcChannels.listHistory, query),
    getFilterOptions: () => ipcRenderer.invoke(appIpcChannels.getHistoryFilterOptions)
  },
  dashboard: {
    getOverview: (query) => ipcRenderer.invoke(appIpcChannels.getDashboardOverview, query)
  },
  backup: {
    create: () => ipcRenderer.invoke(appIpcChannels.createDatabaseBackup),
    restore: () => ipcRenderer.invoke(appIpcChannels.restoreDatabaseBackup)
  },
  integrity: {
    check: () => ipcRenderer.invoke(appIpcChannels.checkDatabaseIntegrity),
    rebuildStockBalances: () => ipcRenderer.invoke(appIpcChannels.rebuildStockBalances)
  }
}

if (!process.contextIsolated) {
  throw new Error('Context isolation Ombor uchun majburiy.')
}

contextBridge.exposeInMainWorld('omborApi', omborApi)
