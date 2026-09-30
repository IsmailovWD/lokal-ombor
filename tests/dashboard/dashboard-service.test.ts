import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { dashboardService } from '../../src/main/dashboard/dashboard-service'
import { productService } from '../../src/main/products/product-service'
import { stockInService } from '../../src/main/stock/stock-in-service'
import { stockOutService } from '../../src/main/stock/stock-out-service'
import { unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-dashboard-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function thirtyDayRange(): { readonly fromUtc: string; readonly toUtcExclusive: string } {
  return {
    fromUtc: new Date(2026, 0, 1, 0, 0, 0, 0).toISOString(),
    toUtcExclusive: new Date(2026, 0, 31, 0, 0, 0, 0).toISOString()
  }
}

afterEach(() => {
  databaseManager.close()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('DashboardService', () => {
  it('30 kunlik umumiy sonlar va bitta birlikning milli miqdorlarini alohida qaytaradi', () => {
    initializeDatabase()
    const kilogram = unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    const dona = unitService.create({ name: 'Dona', shortName: 'dona' })
    const sement = productService.create({ name: 'Sement', sku: '', unitId: kilogram.id, minimumStockMilli: 10_000 })
    const bolt = productService.create({ name: 'Bolt', sku: '', unitId: dona.id, minimumStockMilli: null })
    const janFifth = new Date(2026, 0, 5, 12, 0, 0, 0)
    const janSixth = new Date(2026, 0, 6, 12, 0, 0, 0)

    stockInService.create({ productId: sement.id, quantityMilli: 12_500, occurredAtUtc: janFifth.toISOString(), note: '' })
    stockOutService.create({ productId: sement.id, quantityMilli: 2_500, occurredAtUtc: janSixth.toISOString(), note: '' })
    stockInService.create({ productId: bolt.id, quantityMilli: 4_000, occurredAtUtc: janFifth.toISOString(), note: '' })

    const range = thirtyDayRange()
    const allUnits = dashboardService.getOverview({ ...range, unitId: null })
    const kilogramOverview = dashboardService.getOverview({ ...range, unitId: kilogram.id, stockPage: 2, stockPageSize: 1 })

    expect(allUnits).toMatchObject({
      activeProductCount: 2,
      activeUnitCount: 2,
      lowStockProductCount: 1,
      periodInMovementCount: 2,
      periodOutMovementCount: 1,
      selectedUnit: null,
      selectedUnitMetrics: null,
      dailyVolumes: []
    })
    expect(allUnits.lowStockProducts).toEqual([
      expect.objectContaining({ id: sement.id, currentBalanceMilli: 10_000, minimumStockMilli: 10_000, unitShortName: 'kg' })
    ])
    expect(kilogramOverview.selectedUnit).toMatchObject({ id: kilogram.id, shortName: 'kg' })
    expect(kilogramOverview.selectedUnitMetrics).toEqual({
      currentBalanceMilli: 10_000,
      periodInMilli: 12_500,
      periodOutMilli: 2_500,
      todayInMilli: 0,
      todayOutMilli: 0,
      monthInMilli: 12_500,
      monthOutMilli: 2_500
    })
    expect(kilogramOverview.currentStock).toMatchObject({ total: 2, page: 2, pageSize: 1 })
    expect(kilogramOverview.currentStock.items.map((product) => product.name)).toEqual(['Sement'])
    expect(kilogramOverview.recentMovements.map((movement) => movement.type)).toEqual(['OUT', 'IN', 'IN'])
    expect(kilogramOverview.dailyVolumes).toHaveLength(30)
    expect(kilogramOverview.dailyVolumes.find((day) => day.dateLocal === localDateKey(janFifth))).toMatchObject({ inMilli: 12_500, outMilli: 0 })
    expect(kilogramOverview.dailyVolumes.find((day) => day.dateLocal === localDateKey(janSixth))).toMatchObject({ inMilli: 0, outMilli: 2_500 })
  })

  it('nofaol birlikni tarixiy chart filtri sifatida qoldiradi, ammo faol qoldiqqa qo‘shmaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Litr', shortName: 'l' })
    const product = productService.create({ name: 'Suv', sku: '', unitId: unit.id, minimumStockMilli: null })
    stockInService.create({ productId: product.id, quantityMilli: 3_000, occurredAtUtc: new Date(2026, 0, 10, 12).toISOString(), note: '' })
    productService.setActive({ id: product.id, isActive: false })
    unitService.setActive({ id: unit.id, isActive: false })

    const overview = dashboardService.getOverview({ ...thirtyDayRange(), unitId: unit.id })

    expect(overview.unitOptions).toContainEqual(expect.objectContaining({ id: unit.id, name: 'Litr' }))
    expect(overview.selectedUnitMetrics).toEqual({ currentBalanceMilli: 0, periodInMilli: 3_000, periodOutMilli: 0, todayInMilli: 0, todayOutMilli: 0, monthInMilli: 3_000, monthOutMilli: 0 })
    expect(overview.dailyVolumes.some((day) => day.inMilli === 3_000)).toBe(true)
  })

  it('30 kundan boshqa davr va mavjud bo‘lmagan birlikni rad etadi', () => {
    initializeDatabase()

    expect(() => dashboardService.getOverview({ unitId: null, fromUtc: '2026-01-01T00:00:00.000Z', toUtcExclusive: '2026-01-30T00:00:00.000Z' })).toThrow('Dashboard faqat ketma-ket 30 kunlik davrni qabul qiladi.')
    expect(() => dashboardService.getOverview({ ...thirtyDayRange(), unitId: 999 })).toThrow('Tanlangan birlik topilmadi.')
    expect(() => dashboardService.getOverview({ ...thirtyDayRange(), unitId: null, stockPage: 0 })).toThrow('Dashboard so‘rovi parametrlari noto‘g‘ri.')
  })

  it('bugungi va oylik miqdorlarni local calendar chegaralari bilan tanlangan unit uchun alohida hisoblaydi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Dona', shortName: 'dona' })
    const product = productService.create({ name: 'Bolt', sku: '', unitId: unit.id, minimumStockMilli: null })
    stockInService.create({ productId: product.id, quantityMilli: 3_000, occurredAtUtc: new Date(2026, 0, 1, 10).toISOString(), note: '' })
    stockInService.create({ productId: product.id, quantityMilli: 2_000, occurredAtUtc: new Date(2026, 0, 30, 10).toISOString(), note: '' })
    stockOutService.create({ productId: product.id, quantityMilli: 1_000, occurredAtUtc: new Date(2026, 0, 30, 11).toISOString(), note: '' })

    const overview = dashboardService.getOverview({ ...thirtyDayRange(), unitId: unit.id })

    expect(overview).toMatchObject({ todayInMovementCount: 1, todayOutMovementCount: 1, monthInMovementCount: 2, monthOutMovementCount: 1 })
    expect(overview.selectedUnitMetrics).toMatchObject({ todayInMilli: 2_000, todayOutMilli: 1_000, monthInMilli: 5_000, monthOutMilli: 1_000 })
  })
})
