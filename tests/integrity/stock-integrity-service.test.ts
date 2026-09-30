import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { IntegrityServiceError } from '../../src/main/integrity/integrity-errors'
import { stockIntegrityService } from '../../src/main/integrity/stock-integrity-service'
import { productService } from '../../src/main/products/product-service'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { stockOutService } from '../../src/main/stock/stock-out-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-integrity-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('StockIntegrityService', () => {
  it('sog‘lom ledgerni read-only tekshiradi va mismatchlarni rebuild bilan tuzatadi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Bolt', sku: '', unitId: unit.id, minimumStockMilli: null })
    const incoming = stockInService.create({ productId: product.id, quantityMilli: 5_000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })
    const outgoing = stockOutService.create({ productId: product.id, quantityMilli: 2_000, occurredAtUtc: '2026-01-02T10:00:00.000Z', note: '' })

    expect(stockIntegrityService.check()).toMatchObject({ isHealthy: true, productCount: 1, movementCount: 2, issues: [] })

    const database = databaseManager.getConnection()
    database.prepare('UPDATE products SET current_balance_milli = ? WHERE id = ?').run(999, product.id)
    database.prepare('UPDATE stock_movements SET balance_after_milli = ? WHERE id = ?').run(123, outgoing.id)
    const brokenReport = stockIntegrityService.check()

    expect(brokenReport.isHealthy).toBe(false)
    expect(brokenReport.issues.map((issue) => issue.code)).toContain('CURRENT_BALANCE_MISMATCH')
    expect(brokenReport.issues.map((issue) => issue.code)).toContain('BALANCE_AFTER_MISMATCH')
    expect((database.prepare('SELECT current_balance_milli AS value FROM products WHERE id = ?').get(product.id) as { readonly value: number }).value).toBe(999)

    const rebuiltReport = stockIntegrityService.rebuildStockBalances()
    expect(rebuiltReport).toMatchObject({ isHealthy: true, issues: [] })
    expect((database.prepare('SELECT current_balance_milli AS value FROM products WHERE id = ?').get(product.id) as { readonly value: number }).value).toBe(3_000)
    expect((database.prepare('SELECT balance_after_milli AS value FROM stock_movements WHERE id = ?').get(incoming.id) as { readonly value: number }).value).toBe(5_000)
    expect((database.prepare('SELECT balance_after_milli AS value FROM stock_movements WHERE id = ?').get(outgoing.id) as { readonly value: number }).value).toBe(3_000)
  })

  it('negative historyni aniqlaydi va rebuildni transaction rollback bilan rad etadi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    const product = productService.create({ name: 'Un', sku: '', unitId: unit.id, minimumStockMilli: null })
    const database = databaseManager.getConnection()
    const movementId = Number(database.prepare(`
      INSERT INTO stock_movements (product_id, type, quantity_milli, occurred_at_utc, note, balance_after_milli, created_at_utc, updated_at_utc)
      VALUES (?, 'OUT', 1_000, '2026-01-01T10:00:00.000Z', NULL, 0, '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')
    `).run(product.id).lastInsertRowid)

    const report = stockIntegrityService.check()
    expect(report.issues).toContainEqual(expect.objectContaining({ code: 'NEGATIVE_LEDGER_BALANCE', movementId }))
    expect(() => stockIntegrityService.rebuildStockBalances()).toThrow(IntegrityServiceError)
    expect((database.prepare('SELECT current_balance_milli AS value FROM products WHERE id = ?').get(product.id) as { readonly value: number }).value).toBe(0)
    expect((database.prepare('SELECT balance_after_milli AS value FROM stock_movements WHERE id = ?').get(movementId) as { readonly value: number }).value).toBe(0)
  })
})
