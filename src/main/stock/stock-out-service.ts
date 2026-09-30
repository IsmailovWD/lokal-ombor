import type { CreateStockOutInput, DeleteStockOutInput, StockMovement, StockOutListQuery, StockOutListResult, UpdateStockOutInput } from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'
import { runInTransaction } from '../db/transactions'
import { ProductRepository } from '../products/product-repository'
import { UnitRepository } from '../units/unit-repository'

import { StockMovementServiceError } from './stock-errors'
import { StockMovementRepository } from './stock-movement-repository'
import { replayProductBalances } from './stock-replay-service'

interface NormalizedStockOutInput {
  readonly productId: number
  readonly quantityMilli: number
  readonly occurredAtUtc: string
  readonly note: string | null
}

function assertValidId(id: number, fieldLabel: string): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', `${fieldLabel} noto‘g‘ri.`)
  }
}

function normalizeInput(input: CreateStockOutInput): NormalizedStockOutInput {
  assertValidId(input.productId, 'Mahsulot identifikatori')

  if (!Number.isSafeInteger(input.quantityMilli) || input.quantityMilli <= 0) {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', 'Miqdor musbat milli-unit butun son bo‘lishi kerak.')
  }

  if (typeof input.occurredAtUtc !== 'string') {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', 'Operatsiya vaqti noto‘g‘ri.')
  }

  const occurredAt = new Date(input.occurredAtUtc)
  if (Number.isNaN(occurredAt.valueOf())) {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', 'Operatsiya vaqti noto‘g‘ri.')
  }

  if (typeof input.note !== 'string') {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', 'Izoh matn bo‘lishi kerak.')
  }

  const note = input.note.trim()
  return { productId: input.productId, quantityMilli: input.quantityMilli, occurredAtUtc: occurredAt.toISOString(), note: note.length > 0 ? note : null }
}

function assertValidListQuery(query: StockOutListQuery): void {
  if (!Number.isSafeInteger(query.page) || query.page < 1 || !Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new StockMovementServiceError('STOCK_MOVEMENT_VALIDATION', 'Sahifalash parametrlari noto‘g‘ri.')
  }
}

export class StockOutService {
  public list(query: StockOutListQuery): StockOutListResult {
    assertValidListQuery(query)
    return new StockMovementRepository(databaseManager.getConnection()).listOut(query)
  }

  public create(input: CreateStockOutInput): StockMovement {
    const normalized = normalizeInput(input)
    const database = databaseManager.getConnection()
    const movements = new StockMovementRepository(database)

    return runInTransaction(database, () => {
      this.assertProductEligible(normalized.productId)
      const movement = movements.createOut({ ...normalized, now: new Date().toISOString() })
      replayProductBalances(database, [normalized.productId])
      return movements.findById(movement.id)!
    })
  }

  public update(input: UpdateStockOutInput): StockMovement {
    assertValidId(input.id, 'Chiqim identifikatori')
    const normalized = normalizeInput(input)
    const database = databaseManager.getConnection()
    const movements = new StockMovementRepository(database)

    return runInTransaction(database, () => {
      const existing = movements.findById(input.id)
      if (!existing) {
        throw new StockMovementServiceError('STOCK_MOVEMENT_NOT_FOUND', 'Chiqim topilmadi.')
      }
      if (existing.type !== 'OUT') {
        throw new StockMovementServiceError('STOCK_MOVEMENT_TYPE_IMMUTABLE', 'Kirim operatsiyasini chiqim sifatida tahrirlab bo‘lmaydi.')
      }

      if (existing.productId !== normalized.productId) {
        this.assertProductEligible(normalized.productId)
      }
      movements.updateOut({ id: input.id, ...normalized, now: new Date().toISOString() })
      replayProductBalances(database, [existing.productId, normalized.productId])
      return movements.findById(input.id)!
    })
  }

  public delete(input: DeleteStockOutInput): void {
    assertValidId(input.id, 'Chiqim identifikatori')
    const database = databaseManager.getConnection()
    const movements = new StockMovementRepository(database)

    runInTransaction(database, () => {
      const existing = movements.findById(input.id)
      if (!existing) {
        throw new StockMovementServiceError('STOCK_MOVEMENT_NOT_FOUND', 'Chiqim topilmadi.')
      }
      if (existing.type !== 'OUT') {
        throw new StockMovementServiceError('STOCK_MOVEMENT_TYPE_IMMUTABLE', 'Kirim operatsiyasini chiqim orqali o‘chirib bo‘lmaydi.')
      }

      movements.deleteOutMovement(input.id)
      replayProductBalances(database, [existing.productId])
    })
  }

  private assertProductEligible(productId: number): void {
    const database = databaseManager.getConnection()
    const product = new ProductRepository(database).findById(productId)
    if (!product) {
      throw new StockMovementServiceError('STOCK_MOVEMENT_PRODUCT_NOT_FOUND', 'Mahsulot topilmadi.')
    }
    if (!product.isActive) {
      throw new StockMovementServiceError('STOCK_MOVEMENT_PRODUCT_INACTIVE', 'Nofaol mahsulot uchun yangi operatsiya yaratib bo‘lmaydi.')
    }

    const unit = new UnitRepository(database).findById(product.unitId)
    if (!unit?.isActive) {
      throw new StockMovementServiceError('STOCK_MOVEMENT_UNIT_INACTIVE', 'Nofaol birlikdagi mahsulot uchun yangi operatsiya yaratib bo‘lmaydi.')
    }
  }
}

export const stockOutService = new StockOutService()
