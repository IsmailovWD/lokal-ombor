export const appIpcChannels = {
  getRuntimeInfo: 'app:get-runtime-info',
  listUnits: 'units:list',
  createUnit: 'units:create',
  updateUnit: 'units:update',
  setUnitActive: 'units:set-active',
  deleteUnit: 'units:delete',
  listActiveUnitOptions: 'units:list-active-options',
  listProducts: 'products:list',
  createProduct: 'products:create',
  updateProduct: 'products:update',
  setProductActive: 'products:set-active',
  deleteProduct: 'products:delete',
  listActiveStockProductOptions: 'products:list-active-stock-options',
  listStockInMovements: 'stock-in:list',
  createStockInMovement: 'stock-in:create',
  updateStockInMovement: 'stock-in:update',
  deleteStockInMovement: 'stock-in:delete',
  listStockOutMovements: 'stock-out:list',
  createStockOutMovement: 'stock-out:create',
  updateStockOutMovement: 'stock-out:update',
  deleteStockOutMovement: 'stock-out:delete',
  listHistory: 'history:list',
  getHistoryFilterOptions: 'history:filter-options',
  getDashboardOverview: 'dashboard:get-overview',
  createDatabaseBackup: 'backup:create',
  restoreDatabaseBackup: 'backup:restore',
  checkDatabaseIntegrity: 'integrity:check',
  rebuildStockBalances: 'integrity:rebuild-stock-balances'
} as const

export interface AppRuntimeInfo {
  readonly name: string
  readonly version: string
  readonly environment: 'development' | 'production'
}

export type UnitStatusFilter = 'all' | 'active' | 'inactive'
export type UnitSortField = 'name' | 'shortName' | 'status' | 'createdAtUtc'
export type SortDirection = 'asc' | 'desc'

export interface Unit {
  readonly id: number
  readonly name: string
  readonly shortName: string
  readonly isActive: boolean
  readonly createdAtUtc: string
  readonly updatedAtUtc: string
}

export interface UnitOption {
  readonly id: number
  readonly name: string
  readonly shortName: string
}

export interface UnitListQuery {
  readonly search: string
  readonly status: UnitStatusFilter
  readonly sort: UnitSortField
  readonly direction: SortDirection
  readonly page: number
  readonly pageSize: number
}

export interface UnitListResult {
  readonly items: readonly Unit[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export interface CreateUnitInput {
  readonly name: string
  readonly shortName: string
}

export interface UpdateUnitInput extends CreateUnitInput {
  readonly id: number
}

export interface SetUnitActiveInput {
  readonly id: number
  readonly isActive: boolean
}

export interface DeleteUnitInput {
  readonly id: number
}

export type UnitErrorCode =
  | 'UNIT_VALIDATION'
  | 'UNIT_NOT_FOUND'
  | 'UNIT_DUPLICATE_NAME'
  | 'UNIT_DUPLICATE_SHORT_NAME'
  | 'UNIT_HAS_ACTIVE_PRODUCTS'
  | 'UNIT_HAS_PRODUCTS'
  | 'UNIT_OPERATION_FAILED'

export interface UnitOperationError {
  readonly code: UnitErrorCode
  readonly message: string
}

export type UnitOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: UnitOperationError }

export type ProductStatusFilter = UnitStatusFilter
export type ProductStockLevelFilter = 'all' | 'low'
export type ProductSortField = 'name' | 'sku' | 'unitName' | 'minimumStock' | 'status' | 'createdAtUtc'

export interface Product {
  readonly id: number
  readonly name: string
  readonly sku: string | null
  readonly note: string | null
  readonly unitId: number
  readonly unitName: string
  readonly unitShortName: string
  readonly minimumStockMilli: number | null
  readonly currentBalanceMilli: number
  readonly isLowStock: boolean
  readonly isActive: boolean
  readonly createdAtUtc: string
  readonly updatedAtUtc: string
}

export interface StockProductOption {
  readonly id: number
  readonly name: string
  readonly unitName: string
  readonly unitShortName: string
}

export interface ProductListQuery {
  readonly search: string
  readonly status: ProductStatusFilter
  readonly unitId: number | null
  readonly stockLevel?: ProductStockLevelFilter
  readonly sort: ProductSortField
  readonly direction: SortDirection
  readonly page: number
  readonly pageSize: number
}

export interface ProductListResult {
  readonly items: readonly Product[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export interface CreateProductInput {
  readonly name: string
  readonly sku: string
  readonly note?: string
  readonly unitId: number
  readonly minimumStockMilli: number | null
}

export interface UpdateProductInput extends CreateProductInput {
  readonly id: number
}

export interface SetProductActiveInput {
  readonly id: number
  readonly isActive: boolean
}

export interface DeleteProductInput {
  readonly id: number
}

export type ProductErrorCode =
  | 'PRODUCT_VALIDATION'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_DUPLICATE_NAME'
  | 'PRODUCT_DUPLICATE_SKU'
  | 'PRODUCT_UNIT_NOT_FOUND'
  | 'PRODUCT_UNIT_INACTIVE'
  | 'PRODUCT_UNIT_CHANGE_FORBIDDEN'
  | 'PRODUCT_HAS_MOVEMENTS'
  | 'PRODUCT_OPERATION_FAILED'

export interface ProductOperationError {
  readonly code: ProductErrorCode
  readonly message: string
}

export type ProductOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ProductOperationError }

export interface StockMovement {
  readonly id: number
  readonly productId: number
  readonly productName: string
  readonly unitName: string
  readonly unitShortName: string
  readonly type: 'IN' | 'OUT'
  readonly quantityMilli: number
  readonly occurredAtUtc: string
  readonly note: string | null
  readonly balanceAfterMilli: number
  readonly createdAtUtc: string
  readonly updatedAtUtc: string
}

export interface StockInListQuery {
  readonly page: number
  readonly pageSize: number
}

export interface StockInListResult {
  readonly items: readonly StockMovement[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export interface CreateStockInInput {
  readonly productId: number
  readonly quantityMilli: number
  readonly occurredAtUtc: string
  readonly note: string
}

export interface UpdateStockInInput extends CreateStockInInput {
  readonly id: number
}

export interface DeleteStockInInput {
  readonly id: number
}

export type StockOutListQuery = StockInListQuery
export type StockOutListResult = StockInListResult
export type CreateStockOutInput = CreateStockInInput
export interface UpdateStockOutInput extends CreateStockOutInput {
  readonly id: number
}
export interface DeleteStockOutInput {
  readonly id: number
}

export type StockMovementErrorCode =
  | 'STOCK_MOVEMENT_VALIDATION'
  | 'STOCK_MOVEMENT_NOT_FOUND'
  | 'STOCK_MOVEMENT_PRODUCT_NOT_FOUND'
  | 'STOCK_MOVEMENT_PRODUCT_INACTIVE'
  | 'STOCK_MOVEMENT_UNIT_INACTIVE'
  | 'STOCK_MOVEMENT_TYPE_IMMUTABLE'
  | 'STOCK_NEGATIVE_BALANCE'
  | 'STOCK_MOVEMENT_OPERATION_FAILED'

export interface StockMovementOperationError {
  readonly code: StockMovementErrorCode
  readonly message: string
}

export type StockMovementOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: StockMovementOperationError }

export type HistoryMovementTypeFilter = 'all' | 'IN' | 'OUT'
export type HistorySortField = 'occurredAtUtc' | 'productName' | 'type' | 'quantity' | 'createdAtUtc'

export interface HistoryProductOption {
  readonly id: number
  readonly name: string
  readonly unitId: number
  readonly unitName: string
  readonly unitShortName: string
}

export interface HistoryUnitOption {
  readonly id: number
  readonly name: string
  readonly shortName: string
}

export interface HistoryFilterOptions {
  readonly products: readonly HistoryProductOption[]
  readonly units: readonly HistoryUnitOption[]
}

export interface HistoryListQuery {
  readonly search: string
  readonly type: HistoryMovementTypeFilter
  readonly productId: number | null
  readonly unitId: number | null
  readonly fromUtc: string | null
  readonly toUtcExclusive: string | null
  readonly sort: HistorySortField
  readonly direction: SortDirection
  readonly page: number
  readonly pageSize: number
}

export interface HistoryListResult {
  readonly items: readonly StockMovement[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export type HistoryErrorCode = 'HISTORY_VALIDATION' | 'HISTORY_OPERATION_FAILED'
export interface HistoryOperationError { readonly code: HistoryErrorCode; readonly message: string }
export type HistoryOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: HistoryOperationError }

export interface DashboardQuery {
  readonly unitId: number | null
  readonly fromUtc: string
  readonly toUtcExclusive: string
  readonly stockPage?: number
  readonly stockPageSize?: number
}

export interface DashboardUnitOption {
  readonly id: number
  readonly name: string
  readonly shortName: string
}

export interface DashboardDailyVolume {
  readonly dateLocal: string
  readonly inMilli: number
  readonly outMilli: number
}

export interface DashboardUnitMetrics {
  readonly currentBalanceMilli: number
  readonly periodInMilli: number
  readonly periodOutMilli: number
  readonly todayInMilli: number
  readonly todayOutMilli: number
  readonly monthInMilli: number
  readonly monthOutMilli: number
}

export interface LowStockProduct {
  readonly id: number
  readonly name: string
  readonly unitShortName: string
  readonly currentBalanceMilli: number
  readonly minimumStockMilli: number
}

export interface DashboardOverview {
  readonly activeProductCount: number
  readonly activeUnitCount: number
  readonly lowStockProductCount: number
  readonly lowStockProducts: readonly LowStockProduct[]
  readonly periodInMovementCount: number
  readonly periodOutMovementCount: number
  readonly todayInMovementCount: number
  readonly todayOutMovementCount: number
  readonly monthInMovementCount: number
  readonly monthOutMovementCount: number
  readonly currentStock: ProductListResult
  readonly recentMovements: readonly StockMovement[]
  readonly unitOptions: readonly DashboardUnitOption[]
  readonly selectedUnit: DashboardUnitOption | null
  readonly selectedUnitMetrics: DashboardUnitMetrics | null
  readonly dailyVolumes: readonly DashboardDailyVolume[]
}

export type DashboardErrorCode = 'DASHBOARD_VALIDATION' | 'DASHBOARD_UNIT_NOT_FOUND' | 'DASHBOARD_OPERATION_FAILED'
export interface DashboardOperationError { readonly code: DashboardErrorCode; readonly message: string }
export type DashboardOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: DashboardOperationError }

export interface DatabaseBackupCreated {
  readonly fileName: string
  readonly createdAtUtc: string
}

export interface DatabaseRestoreCompleted {
  readonly safetyBackupFileName: string
  readonly restoredAtUtc: string
}

export type BackupErrorCode =
  | 'BACKUP_VALIDATION'
  | 'BACKUP_FAILED'
  | 'RESTORE_VALIDATION'
  | 'RESTORE_INCOMPATIBLE'
  | 'RESTORE_FAILED'

export interface BackupOperationError { readonly code: BackupErrorCode; readonly message: string }
export type BackupOperationResult<T> =
  | { readonly ok: true; readonly data: T | null }
  | { readonly ok: false; readonly error: BackupOperationError }

export type IntegrityIssueCode = 'SQLITE_INTEGRITY' | 'FOREIGN_KEY' | 'BALANCE_AFTER_MISMATCH' | 'CURRENT_BALANCE_MISMATCH' | 'NEGATIVE_LEDGER_BALANCE'
export interface IntegrityIssue {
  readonly code: IntegrityIssueCode
  readonly message: string
  readonly productId?: number
  readonly movementId?: number
  readonly expectedMilli?: number
  readonly actualMilli?: number
}

export interface IntegrityReport {
  readonly isHealthy: boolean
  readonly checkedAtUtc: string
  readonly productCount: number
  readonly movementCount: number
  readonly issues: readonly IntegrityIssue[]
}

export type IntegrityErrorCode = 'INTEGRITY_OPERATION_FAILED' | 'INTEGRITY_REBUILD_REJECTED'
export interface IntegrityOperationError { readonly code: IntegrityErrorCode; readonly message: string }
export type IntegrityOperationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: IntegrityOperationError }

export interface OmborApi {
  readonly app: {
    getRuntimeInfo: () => Promise<AppRuntimeInfo>
  }
  readonly units: {
    list: (query: UnitListQuery) => Promise<UnitOperationResult<UnitListResult>>
    create: (input: CreateUnitInput) => Promise<UnitOperationResult<Unit>>
    update: (input: UpdateUnitInput) => Promise<UnitOperationResult<Unit>>
    setActive: (input: SetUnitActiveInput) => Promise<UnitOperationResult<Unit>>
    delete: (input: DeleteUnitInput) => Promise<UnitOperationResult<{ readonly id: number }>>
    listActiveOptions: () => Promise<UnitOperationResult<readonly UnitOption[]>>
  }
  readonly products: {
    list: (query: ProductListQuery) => Promise<ProductOperationResult<ProductListResult>>
    create: (input: CreateProductInput) => Promise<ProductOperationResult<Product>>
    update: (input: UpdateProductInput) => Promise<ProductOperationResult<Product>>
    setActive: (input: SetProductActiveInput) => Promise<ProductOperationResult<Product>>
    delete: (input: DeleteProductInput) => Promise<ProductOperationResult<{ readonly id: number }>>
    listActiveStockOptions: () => Promise<ProductOperationResult<readonly StockProductOption[]>>
  }
  readonly stockIn: {
    list: (query: StockInListQuery) => Promise<StockMovementOperationResult<StockInListResult>>
    create: (input: CreateStockInInput) => Promise<StockMovementOperationResult<StockMovement>>
    update: (input: UpdateStockInInput) => Promise<StockMovementOperationResult<StockMovement>>
    delete: (input: DeleteStockInInput) => Promise<StockMovementOperationResult<{ readonly id: number }>>
  }
  readonly stockOut: {
    list: (query: StockOutListQuery) => Promise<StockMovementOperationResult<StockOutListResult>>
    create: (input: CreateStockOutInput) => Promise<StockMovementOperationResult<StockMovement>>
    update: (input: UpdateStockOutInput) => Promise<StockMovementOperationResult<StockMovement>>
    delete: (input: DeleteStockOutInput) => Promise<StockMovementOperationResult<{ readonly id: number }>>
  }
  readonly history: {
    list: (query: HistoryListQuery) => Promise<HistoryOperationResult<HistoryListResult>>
    getFilterOptions: () => Promise<HistoryOperationResult<HistoryFilterOptions>>
  }
  readonly dashboard: {
    getOverview: (query: DashboardQuery) => Promise<DashboardOperationResult<DashboardOverview>>
  }
  readonly backup: {
    create: () => Promise<BackupOperationResult<DatabaseBackupCreated>>
    restore: () => Promise<BackupOperationResult<DatabaseRestoreCompleted>>
  }
  readonly integrity: {
    check: () => Promise<IntegrityOperationResult<IntegrityReport>>
    rebuildStockBalances: () => Promise<IntegrityOperationResult<IntegrityReport>>
  }
}
