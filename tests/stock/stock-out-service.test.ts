import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { productService } from '../../src/main/products/product-service'
import { StockMovementServiceError } from '../../src/main/stock/stock-errors'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { stockOutService } from '../../src/main/stock/stock-out-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-stock-out-test-'))
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

describe('StockOutService', () => {
  it('chiqimni saqlaydi, tahrirlaydi va o‘chirganda qoldiqni replay qiladi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Sement', sku: '', unitId: unit.id, minimumStockMilli: null })
    const incoming = stockInService.create({ productId: product.id, quantityMilli: 5000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })
    const outgoing = stockOutService.create({ productId: product.id, quantityMilli: 2000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: 'Sotildi' })

    expect(outgoing).toMatchObject({ type: 'OUT', balanceAfterMilli: 3000 })
    expect(currentBalance(product.id)).toBe(3000)

    const updated = stockOutService.update({ id: outgoing.id, productId: product.id, quantityMilli: 4000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: 'Tahrirlandi' })
    expect(updated.balanceAfterMilli).toBe(1000)
    expect(currentBalance(product.id)).toBe(1000)

    stockOutService.delete({ id: outgoing.id })
    expect(currentBalance(product.id)).toBe(5000)
    expect(stockOutService.list({ page: 1, pageSize: 10 }).total).toBe(0)
    expect(incoming.type).toBe('IN')
  })

  it('qoldiq manfiy bo‘ladigan create yoki editni to‘liq rollback qiladi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Qum', sku: '', unitId: unit.id, minimumStockMilli: null })
    stockInService.create({ productId: product.id, quantityMilli: 3000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: '' })
    const outgoing = stockOutService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-03T10:00:00.000Z', note: '' })

    expect(() => stockOutService.create({ productId: product.id, quantityMilli: 4000, occurredAtUtc: '2026-01-04T10:00:00.000Z', note: '' })).toThrow(StockMovementServiceError)
    expect(stockOutService.list({ page: 1, pageSize: 10 }).total).toBe(1)
    expect(currentBalance(product.id)).toBe(2000)

    expect(() => stockOutService.update({ id: outgoing.id, productId: product.id, quantityMilli: 3500, occurredAtUtc: '2026-01-03T10:00:00.000Z', note: '' })).toThrow('Bu o‘zgarish natijasida mahsulot qoldig‘i manfiy bo‘lib qoladi.')
    expect(stockOutService.list({ page: 1, pageSize: 10 }).items[0]).toMatchObject({ id: outgoing.id, quantityMilli: 1000, balanceAfterMilli: 2000 })
    expect(currentBalance(product.id)).toBe(2000)
  })

  it('backdate chiqim keyingi kirim bo‘lsa ham manfiy qoldiq qoidasini buzmaydi va IN type’ni o‘zgartirmaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'G‘isht', sku: '', unitId: unit.id, minimumStockMilli: null })
    const incoming = stockInService.create({ productId: product.id, quantityMilli: 5000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: '' })

    expect(() => stockOutService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })).toThrow('Bu o‘zgarish natijasida mahsulot qoldig‘i manfiy bo‘lib qoladi.')
    expect(currentBalance(product.id)).toBe(5000)
    expect(() => stockOutService.update({ id: incoming.id, productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: '' })).toThrow('Kirim operatsiyasini chiqim sifatida tahrirlab bo‘lmaydi.')
  })
})
