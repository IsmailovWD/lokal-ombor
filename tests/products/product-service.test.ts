import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { ProductServiceError } from '../../src/main/products/product-errors'
import { productService } from '../../src/main/products/product-service'
import { parseNonNegativeMilli } from '../../src/shared/quantity'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { UnitServiceError } from '../../src/main/units/unit-errors'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-products-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('ProductService', () => {
  it('nom/SKU unique qoidasi, trim va nullable yoki nol minimal qoldiqni saqlaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const sement = productService.create({ name: '  Sement  ', sku: ' CEM-01 ', note: '  Qurilish uchun  ', unitId: unit.id, minimumStockMilli: null })
    const qum = productService.create({ name: 'Qum', sku: '', unitId: unit.id, minimumStockMilli: 0 })

    expect(sement).toMatchObject({ name: 'Sement', sku: 'CEM-01', note: 'Qurilish uchun', minimumStockMilli: null, currentBalanceMilli: 0, isActive: true })
    expect(qum.minimumStockMilli).toBe(0)
    expect(() => productService.create({ name: 'sement', sku: '', unitId: unit.id, minimumStockMilli: null })).toThrow(ProductServiceError)
    expect(() => productService.create({ name: 'Shag‘al', sku: 'cem-01', unitId: unit.id, minimumStockMilli: null })).toThrow('Bu SKU allaqachon mavjud.')
    expect(() => productService.create({ name: 'G‘isht', sku: '', note: 'x'.repeat(1001), unitId: unit.id, minimumStockMilli: null })).toThrow('Izoh 1000 belgidan oshmasligi kerak.')
    expect(databaseManager.getConnection().prepare('PRAGMA table_info(products)').all()).toContainEqual(expect.objectContaining({ name: 'note' }))
  })

  it('faol unitni talab qiladi hamda qidiruv, filter va paginationni database’da bajaradi', () => {
    initializeDatabase()
    const dona = unitService.create({ name: 'Dona', shortName: 'dona' })
    const litr = unitService.create({ name: 'Litr', shortName: 'l' })
    const metr = unitService.create({ name: 'Metr', shortName: 'm' })
    const sement = productService.create({ name: 'Sement', sku: 'CEM', unitId: dona.id, minimumStockMilli: 1000 })
    productService.create({ name: 'Suv', sku: '', unitId: litr.id, minimumStockMilli: null })
    productService.setActive({ id: sement.id, isActive: false })
    unitService.setActive({ id: metr.id, isActive: false })

    const filtered = productService.list({ search: 'cem', status: 'inactive', unitId: dona.id, sort: 'name', direction: 'asc', page: 1, pageSize: 10 })
    const firstPage = productService.list({ search: '', status: 'all', unitId: null, sort: 'name', direction: 'asc', page: 1, pageSize: 1 })

    expect(filtered.items.map((product) => product.name)).toEqual(['Sement'])
    expect(firstPage).toMatchObject({ total: 2, page: 1, pageSize: 1 })
    expect(() => productService.create({ name: 'Yog‘', sku: '', unitId: metr.id, minimumStockMilli: null })).toThrow('Nofaol birlik bilan yangi mahsulot yaratib bo‘lmaydi.')
  })

  it('unit almashishi va hard delete’ni future movementlar uchun bloklaydi, unit deletionni referential tekshiradi', () => {
    initializeDatabase()
    const dona = unitService.create({ name: 'Dona', shortName: 'dona' })
    const kilogramm = unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    const product = productService.create({ name: 'Un', sku: 'UN-1', unitId: dona.id, minimumStockMilli: 2500 })

    expect(productService.update({ id: product.id, name: 'Un oliy nav', sku: 'UN-1', unitId: kilogramm.id, minimumStockMilli: 3000 })).toMatchObject({ unitId: kilogramm.id, minimumStockMilli: 3000 })
    expect(() => unitService.delete(kilogramm.id)).toThrow(UnitServiceError)

    databaseManager.getConnection().prepare(`
      INSERT INTO stock_movements (product_id, type, quantity_milli, occurred_at_utc, note, balance_after_milli, created_at_utc, updated_at_utc)
      VALUES (?, 'IN', 1, '2026-01-01T10:00:00.000Z', NULL, 1, '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')
    `).run(product.id)

    expect(() => productService.update({ id: product.id, name: 'Un oliy nav', sku: 'UN-1', unitId: dona.id, minimumStockMilli: 3000 })).toThrow('Harakati mavjud mahsulotning birligini o‘zgartirib bo‘lmaydi.')
    expect(() => productService.delete({ id: product.id })).toThrow('Harakati mavjud mahsulotni o‘chirib bo‘lmaydi.')
  })

  it('minimal qoldiq filterida faqat faol, nullable bo‘lmagan va limitga teng yoki past mahsulotlarni qaytaradi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const nullLimit = productService.create({ name: 'Limit yo‘q', sku: '', unitId: unit.id, minimumStockMilli: null })
    const zeroLimit = productService.create({ name: 'Nol limit', sku: '', unitId: unit.id, minimumStockMilli: 0 })
    const threshold = productService.create({ name: 'Chegara', sku: '', unitId: unit.id, minimumStockMilli: 1_000 })
    const inactive = productService.create({ name: 'Nofaol', sku: '', unitId: unit.id, minimumStockMilli: 1_000 })
    stockInService.create({ productId: threshold.id, quantityMilli: 1_000, occurredAtUtc: '2026-01-01T10:00:00.000Z', note: '' })
    productService.setActive({ id: inactive.id, isActive: false })

    const lowStock = productService.list({ search: '', status: 'all', unitId: null, stockLevel: 'low', sort: 'name', direction: 'asc', page: 1, pageSize: 10 })
    const allProducts = productService.list({ search: '', status: 'all', unitId: null, stockLevel: 'all', sort: 'name', direction: 'asc', page: 1, pageSize: 10 })

    expect(lowStock.items.map((product) => product.name)).toEqual(['Chegara', 'Nol limit'])
    expect(lowStock.items.every((product) => product.isLowStock)).toBe(true)
    expect(lowStock.items.find((product) => product.id === zeroLimit.id)?.isLowStock).toBe(true)
    expect(allProducts.items.find((product) => product.id === nullLimit.id)?.isLowStock).toBe(false)
    expect(allProducts.items.find((product) => product.id === inactive.id)?.isLowStock).toBe(false)
  })

  it('ixtiyoriy izohni tahrirlaydi va bo‘sh izohni NULL sifatida saqlaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Litr', shortName: 'l' })
    const product = productService.create({ name: 'Bo‘yoq', sku: '', note: 'Ichki devor uchun', unitId: unit.id, minimumStockMilli: null })

    const updated = productService.update({ id: product.id, name: 'Bo‘yoq', sku: '', note: '   ', unitId: unit.id, minimumStockMilli: null })

    expect(updated.note).toBeNull()
  })
})

describe('parseNonNegativeMilli', () => {
  it('decimal qiymatni float ishlatmasdan milli-unitga o‘giradi', () => {
    expect(parseNonNegativeMilli('')).toBeNull()
    expect(parseNonNegativeMilli('0')).toBe(0)
    expect(parseNonNegativeMilli('10.5')).toBe(10500)
    expect(parseNonNegativeMilli('10,125')).toBe(10125)
    expect(parseNonNegativeMilli('-1')).toBeNull()
    expect(parseNonNegativeMilli('1.2345')).toBeNull()
  })
})
