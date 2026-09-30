import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { databaseManager } from '../../src/main/db/database'
import { getDatabasePath } from '../../src/main/db/database-path'
import { UnitServiceError } from '../../src/main/units/unit-errors'
import { UnitService, unitService } from '../../src/main/units/unit-service'

const temporaryDirectories: string[] = []

function initializeDatabase(): void {
  const directory = mkdtempSync(join(tmpdir(), 'ombor-units-test-'))
  temporaryDirectories.push(directory)
  databaseManager.initialize({ databasePath: getDatabasePath(directory) })
}

afterEach(() => {
  databaseManager.close()

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('UnitService', () => {
  it('qiymatlarni trim qiladi, faol yaratadi va Unicode/case-insensitive takrorlanishni bloklaydi', () => {
    initializeDatabase()

    const kilogramm = unitService.create({ name: '  Kílogramm  ', shortName: ' KG ' })

    expect(kilogramm).toMatchObject({ name: 'Kílogramm', shortName: 'KG', isActive: true })
    expect(() => unitService.create({ name: 'kílogramm', shortName: 'kil' })).toThrow(UnitServiceError)
    expect(() => unitService.create({ name: 'Dona', shortName: 'kg' })).toThrow('Bu qisqartmali birlik allaqachon mavjud.')
  })

  it('qidiruv, status filtri, tartiblash va paginationni SQLite qatlamida bajaradi', () => {
    initializeDatabase()
    const dona = unitService.create({ name: 'Dona', shortName: 'dona' })
    unitService.create({ name: 'Kilogramm', shortName: 'kg' })
    unitService.create({ name: 'Litr', shortName: 'l' })
    unitService.setActive({ id: dona.id, isActive: false })

    const filtered = unitService.list({ search: 'k', status: 'active', sort: 'name', direction: 'asc', page: 1, pageSize: 10 })
    const firstPage = unitService.list({ search: '', status: 'all', sort: 'name', direction: 'asc', page: 1, pageSize: 2 })

    expect(filtered.items.map((unit) => unit.name)).toEqual(['Kilogramm'])
    expect(firstPage.total).toBe(3)
    expect(firstPage.items.map((unit) => unit.name)).toEqual(['Dona', 'Kilogramm'])
  })

  it('tahrirlash, faollik guardi va hard delete qoidalarini bajaradi', () => {
    initializeDatabase()
    const unit = unitService.create({ name: 'Metr', shortName: 'm' })
    const guardedService = new UnitService({ countActiveProducts: () => 1 })

    const updated = unitService.update({ id: unit.id, name: '  Metr uzunlik  ', shortName: ' M ' })
    expect(updated).toMatchObject({ name: 'Metr uzunlik', shortName: 'M' })

    expect(() => guardedService.setActive({ id: unit.id, isActive: false })).toThrow('Bu birlikdan foydalanayotgan faol mahsulotlar mavjud.')
    expect(unitService.setActive({ id: unit.id, isActive: false }).isActive).toBe(false)

    unitService.delete(unit.id)
    expect(unitService.list({ search: '', status: 'all', sort: 'name', direction: 'asc', page: 1, pageSize: 10 }).total).toBe(0)
  })
})
