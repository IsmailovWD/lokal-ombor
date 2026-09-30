import type {
  CreateProductInput,
  DeleteProductInput,
  Product,
  ProductListQuery,
  ProductListResult,
  SetProductActiveInput,
  StockProductOption,
  UpdateProductInput
} from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'
import { runInTransaction } from '../db/transactions'
import { UnitRepository } from '../units/unit-repository'

import { ProductServiceError } from './product-errors'
import { normalizeProductInput } from './product-normalization'
import { ProductRepository } from './product-repository'

function assertValidId(id: number, fieldLabel = 'Mahsulot identifikatori'): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ProductServiceError('PRODUCT_VALIDATION', `${fieldLabel} noto‘g‘ri.`)
  }
}

function assertValidMinimumStock(value: number | null): void {
  if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
    throw new ProductServiceError('PRODUCT_VALIDATION', 'Minimal qoldiq manfiy bo‘lmagan milli-unit butun son bo‘lishi kerak.')
  }
}

function assertValidQuery(query: ProductListQuery): void {
  const validStatuses = new Set(['all', 'active', 'inactive'])
  const validSorts = new Set(['name', 'sku', 'unitName', 'minimumStock', 'status', 'createdAtUtc'])
  const validDirections = new Set(['asc', 'desc'])
  const validStockLevels = new Set(['all', 'low'])

  if (
    typeof query.search !== 'string'
    || !validStatuses.has(query.status)
    || !validSorts.has(query.sort)
    || !validDirections.has(query.direction)
    || (query.stockLevel !== undefined && !validStockLevels.has(query.stockLevel))
    || (query.unitId !== null && (!Number.isSafeInteger(query.unitId) || query.unitId <= 0))
    || !Number.isSafeInteger(query.page)
    || query.page < 1
    || !Number.isSafeInteger(query.pageSize)
    || query.pageSize < 1
    || query.pageSize > 100
  ) {
    throw new ProductServiceError('PRODUCT_VALIDATION', 'Ro‘yxat parametrlari noto‘g‘ri.')
  }
}

function hasProductMovements(productId: number): boolean {
  const database = databaseManager.getConnection()
  const movementsTable = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'stock_movements'")
    .get() as { readonly present: number } | undefined

  if (!movementsTable) {
    return false
  }

  const result = database
    .prepare('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id = ?')
    .get(productId) as { readonly count: number }

  return result.count > 0
}

export class ProductService {
  public list(query: ProductListQuery): ProductListResult {
    assertValidQuery(query)
    return new ProductRepository(databaseManager.getConnection()).list(query)
  }

  public listActiveStockOptions(): readonly StockProductOption[] {
    return new ProductRepository(databaseManager.getConnection()).listActiveStockOptions()
  }

  public create(input: CreateProductInput): Product {
    assertValidId(input.unitId, 'Birlik identifikatori')
    assertValidMinimumStock(input.minimumStockMilli)
    const normalized = normalizeProductInput(input)
    const database = databaseManager.getConnection()
    const products = new ProductRepository(database)
    const units = new UnitRepository(database)

    return runInTransaction(database, () => {
      this.assertUnitCanBeAssigned(units, input.unitId)
      this.assertUnique(products, normalized.nameNormalized, normalized.skuNormalized)
      return products.create({ ...normalized, unitId: input.unitId, minimumStockMilli: input.minimumStockMilli, now: new Date().toISOString() })
    })
  }

  public update(input: UpdateProductInput): Product {
    assertValidId(input.id)
    assertValidId(input.unitId, 'Birlik identifikatori')
    assertValidMinimumStock(input.minimumStockMilli)
    const normalized = normalizeProductInput(input)
    const database = databaseManager.getConnection()
    const products = new ProductRepository(database)
    const units = new UnitRepository(database)

    return runInTransaction(database, () => {
      const existing = products.findById(input.id)

      if (!existing) {
        throw new ProductServiceError('PRODUCT_NOT_FOUND', 'Mahsulot topilmadi.')
      }

      if (existing.unitId !== input.unitId) {
        if (hasProductMovements(input.id)) {
          throw new ProductServiceError('PRODUCT_UNIT_CHANGE_FORBIDDEN', 'Harakati mavjud mahsulotning birligini o‘zgartirib bo‘lmaydi.')
        }

        this.assertUnitCanBeAssigned(units, input.unitId)
      }

      this.assertUnique(products, normalized.nameNormalized, normalized.skuNormalized, input.id)
      return products.update({ id: input.id, ...normalized, unitId: input.unitId, minimumStockMilli: input.minimumStockMilli, now: new Date().toISOString() })!
    })
  }

  public setActive(input: SetProductActiveInput): Product {
    assertValidId(input.id)

    if (typeof input.isActive !== 'boolean') {
      throw new ProductServiceError('PRODUCT_VALIDATION', 'Faollik qiymati noto‘g‘ri.')
    }

    const database = databaseManager.getConnection()
    const products = new ProductRepository(database)

    return runInTransaction(database, () => {
      if (!products.findById(input.id)) {
        throw new ProductServiceError('PRODUCT_NOT_FOUND', 'Mahsulot topilmadi.')
      }

      return products.setActive(input.id, input.isActive, new Date().toISOString())!
    })
  }

  public delete(input: DeleteProductInput): void {
    assertValidId(input.id)
    const database = databaseManager.getConnection()
    const products = new ProductRepository(database)

    runInTransaction(database, () => {
      if (!products.findById(input.id)) {
        throw new ProductServiceError('PRODUCT_NOT_FOUND', 'Mahsulot topilmadi.')
      }

      if (hasProductMovements(input.id)) {
        throw new ProductServiceError('PRODUCT_HAS_MOVEMENTS', 'Harakati mavjud mahsulotni o‘chirib bo‘lmaydi.')
      }

      products.delete(input.id)
    })
  }

  private assertUnitCanBeAssigned(units: UnitRepository, unitId: number): void {
    const unit = units.findById(unitId)

    if (!unit) {
      throw new ProductServiceError('PRODUCT_UNIT_NOT_FOUND', 'Tanlangan birlik topilmadi.')
    }

    if (!unit.isActive) {
      throw new ProductServiceError('PRODUCT_UNIT_INACTIVE', 'Nofaol birlik bilan yangi mahsulot yaratib bo‘lmaydi.')
    }
  }

  private assertUnique(products: ProductRepository, nameNormalized: string, skuNormalized: string | null, excludedId?: number): void {
    if (products.existsByNameNormalized(nameNormalized, excludedId)) {
      throw new ProductServiceError('PRODUCT_DUPLICATE_NAME', 'Bu nomli mahsulot allaqachon mavjud.')
    }

    if (skuNormalized !== null && products.existsBySkuNormalized(skuNormalized, excludedId)) {
      throw new ProductServiceError('PRODUCT_DUPLICATE_SKU', 'Bu SKU allaqachon mavjud.')
    }
  }
}

export const productService = new ProductService()
