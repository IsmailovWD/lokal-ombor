import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { productService } from '../../src/main/products/product-service'
import { StockMovementServiceError } from '../../src/main/stock/stock-errors'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-stock-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

function currentBalance(productId: number): number {
  return (databaseManager.getConnection().prepare('SELECT current_balance_milli AS value FROM products WHERE id = ?').get(productId) as { readonly value: number }).value
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('StockInService', () => {
  it('backdate qilingan kirimlarni replay qilib cached va per-movement qoldiqni yangilaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Sement', sku: '', unitId: unit.id, minimumStockMilli: null })
    const later = stockInService.create({ productId: product.id, quantityMilli: 2000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: 'Keyingi kirim' })
    const earlier = stockInService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: 'Oldingi kirim' })

    expect(currentBalance(product.id)).toBe(3000)
    expect(stockInService.list({ page: 1, pageSize: 10 }).items.find((movement) => movement.id === earlier.id)?.balanceAfterMilli).toBe(1000)
    expect(stockInService.list({ page: 1, pageSize: 10 }).items.find((movement) => movement.id === later.id)?.balanceAfterMilli).toBe(3000)

    const updated = stockInService.update({ id: earlier.id, productId: product.id, quantityMilli: 500, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: 'Tahrirlandi' })
    expect(updated.balanceAfterMilli).toBe(500)
    expect(currentBalance(product.id)).toBe(2500)

    stockInService.delete({ id: earlier.id })
    expect(currentBalance(product.id)).toBe(2000)
    expect(stockInService.list({ page: 1, pageSize: 10 }).total).toBe(1)
  })

  it('product almashganda ikki product qoldig‘ini bitta transactionda replay qiladi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const first = productService.create({ name: 'Birinchi', sku: '', unitId: unit.id, minimumStockMilli: null })
    const second = productService.create({ name: 'Ikkinchi', sku: '', unitId: unit.id, minimumStockMilli: null })
    const movement = stockInService.create({ productId: first.id, quantityMilli: 1250, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })

    const updated = stockInService.update({ id: movement.id, productId: second.id, quantityMilli: 1500, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })

    expect(updated.productId).toBe(second.id)
    expect(currentBalance(first.id)).toBe(0)
    expect(currentBalance(second.id)).toBe(1500)
  })

  it('nofaol product yoki nofaol unitda yangi kirimni bloklaydi va OUT type’ni tahrirlamaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Sement', sku: '', unitId: unit.id, minimumStockMilli: null })
    productService.setActive({ id: product.id, isActive: false })

    expect(() => stockInService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })).toThrow(StockMovementServiceError)
    productService.setActive({ id: product.id, isActive: true })
    databaseManager.getConnection().prepare('UPDATE units SET is_active = 0 WHERE id = ?').run(unit.id)
    expect(() => stockInService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })).toThrow('Nofaol birlikdagi mahsulot uchun yangi operatsiya yaratib bo‘lmaydi.')

    const database = databaseManager.getConnection()
    database.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity_milli, occurred_at_utc, note, balance_after_milli, created_at_utc, updated_at_utc)
      VALUES (?, 'OUT', 1, '2026-01-01T10:00:00.000Z', NULL, 0, '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')
    `).run(product.id)
    const outMovement = (database.prepare("SELECT id FROM stock_movements WHERE type = 'OUT'").get() as { readonly id: number }).id

    expect(() => stockInService.delete({ id: outMovement })).toThrow('Chiqim operatsiyasini kirim orqali o‘chirib bo‘lmaydi.')
  })
})
