import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { historyService } from '../../src/main/history/history-service'
import { productService } from '../../src/main/products/product-service'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { stockOutService } from '../../src/main/stock/stock-out-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-history-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('HistoryService', () => {
  it('IN/OUT ledgerni filter, sort, pagination va UTC date chegarasi bilan query qiladi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Sement', sku: 'CEM-1', unitId: unit.id, minimumStockMilli: null })
    stockInService.create({ productId: product.id, quantityMilli: 5000, occurredAtUtc: '2026-01-01T20:00:00.000Z', note: 'Kirim izohi' })
    stockOutService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-02T02:00:00.000Z', note: 'Chiqim izohi' })
    stockInService.create({ productId: product.id, quantityMilli: 2000, occurredAtUtc: '2026-01-03T10:00:00.000Z', note: '' })

    const onlyOut = historyService.list({ search: '', type: 'OUT', productId: null, unitId: null, fromUtc: null, toUtcExclusive: null, sort: 'occurredAtUtc', direction: 'asc', page: 1, pageSize: 25 })
    const janSecond = historyService.list({ search: '', type: 'all', productId: product.id, unitId: unit.id, fromUtc: '2026-01-02T00:00:00.000Z', toUtcExclusive: '2026-01-03T00:00:00.000Z', sort: 'occurredAtUtc', direction: 'asc', page: 1, pageSize: 25 })
    const paged = historyService.list({ search: 'cem-1', type: 'all', productId: null, unitId: null, fromUtc: null, toUtcExclusive: null, sort: 'occurredAtUtc', direction: 'desc', page: 1, pageSize: 2 })

    expect(onlyOut.items).toHaveLength(1)
    expect(onlyOut.items[0]).toMatchObject({ type: 'OUT', quantityMilli: 1000, balanceAfterMilli: 4000 })
    expect(janSecond.items.map((movement) => movement.type)).toEqual(['OUT'])
    expect(paged).toMatchObject({ total: 3, page: 1, pageSize: 2 })
    expect(paged.items.map((movement) => movement.occurredAtUtc)).toEqual(['2026-01-03T10:00:00.000Z', '2026-01-02T02:00:00.000Z'])
  })

  it('nofaol product va unit tarix hamda filter optionlarida ko‘rinishda davom etadi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    const product = productService.create({ name: 'Un', sku: '', unitId: unit.id, minimumStockMilli: null })
    stockInService.create({ productId: product.id, quantityMilli: 1000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })
    productService.setActive({ id: product.id, isActive: false })
    unitService.setActive({ id: unit.id, isActive: false })

    const options = historyService.getFilterOptions()
    const history = historyService.list({ search: 'un', type: 'all', productId: null, unitId: unit.id, fromUtc: null, toUtcExclusive: null, sort: 'occurredAtUtc', direction: 'desc', page: 1, pageSize: 25 })

    expect(options.products).toContainEqual(expect.objectContaining({ id: product.id, name: 'Un' }))
    expect(options.units).toContainEqual(expect.objectContaining({ id: unit.id, name: 'Kilogramm' }))
    expect(history.items).toHaveLength(1)
    expect(history.items[0]?.productName).toBe('Un')
  })
})
