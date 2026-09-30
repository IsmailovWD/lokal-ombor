import type { CreateUnitInput, SetUnitActiveInput, Unit, UnitListQuery, UnitListResult, UnitOption, UpdateUnitInput } from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'
import { runInTransaction } from '../db/transactions'

import { UnitServiceError } from './unit-errors'
import { normalizeUnitInput } from './unit-normalization'
import { UnitRepository } from './unit-repository'

export interface UnitUsageGuard {
  countActiveProducts(unitId: number): number
}

const databaseProductUsage: UnitUsageGuard = {
  countActiveProducts: (unitId) => {
    const database = databaseManager.getConnection()
    const productsTable = database
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'products'")
      .get() as { readonly present: number } | undefined

    if (!productsTable) {
      return 0
    }

    const result = database
      .prepare('SELECT COUNT(*) AS count FROM products WHERE unit_id = ? AND is_active = 1')
      .get(unitId) as { readonly count: number }

    return result.count
  }
}

function assertValidId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new UnitServiceError('UNIT_VALIDATION', 'Birlik identifikatori noto‘g‘ri.')
  }
}

function assertValidQuery(query: UnitListQuery): void {
  const validStatuses = new Set(['all', 'active', 'inactive'])
  const validSorts = new Set(['name', 'shortName', 'status', 'createdAtUtc'])
  const validDirections = new Set(['asc', 'desc'])

  if (
    typeof query.search !== 'string'
    || !validStatuses.has(query.status)
    || !validSorts.has(query.sort)
    || !validDirections.has(query.direction)
    || !Number.isSafeInteger(query.page)
    || query.page < 1
    || !Number.isSafeInteger(query.pageSize)
    || query.pageSize < 1
    || query.pageSize > 100
  ) {
    throw new UnitServiceError('UNIT_VALIDATION', 'Sahifalash parametrlari noto‘g‘ri.')
  }
}

export class UnitService {
  public constructor(private readonly usageGuard: UnitUsageGuard = databaseProductUsage) {}

  public list(query: UnitListQuery): UnitListResult {
    assertValidQuery(query)
    return new UnitRepository(databaseManager.getConnection()).list(query)
  }

  public listActiveOptions(): readonly UnitOption[] {
    return new UnitRepository(databaseManager.getConnection()).listActiveOptions()
  }

  public create(input: CreateUnitInput): Unit {
    const normalized = normalizeUnitInput(input)
    const database = databaseManager.getConnection()
    const repository = new UnitRepository(database)

    return runInTransaction(database, () => {
      this.assertUnique(repository, normalized.nameNormalized, normalized.shortNameNormalized)
      return repository.create({ ...normalized, now: new Date().toISOString() })
    })
  }

  public update(input: UpdateUnitInput): Unit {
    assertValidId(input.id)
    const normalized = normalizeUnitInput(input)
    const database = databaseManager.getConnection()
    const repository = new UnitRepository(database)

    return runInTransaction(database, () => {
      this.assertUnitExists(repository, input.id)
      this.assertUnique(repository, normalized.nameNormalized, normalized.shortNameNormalized, input.id)
      return repository.update({ id: input.id, ...normalized, now: new Date().toISOString() })!
    })
  }

  public setActive(input: SetUnitActiveInput): Unit {
    assertValidId(input.id)

    if (typeof input.isActive !== 'boolean') {
      throw new UnitServiceError('UNIT_VALIDATION', 'Faollik qiymati noto‘g‘ri.')
    }

    const database = databaseManager.getConnection()
    const repository = new UnitRepository(database)

    return runInTransaction(database, () => {
      this.assertUnitExists(repository, input.id)

      if (!input.isActive && this.usageGuard.countActiveProducts(input.id) > 0) {
        throw new UnitServiceError('UNIT_HAS_ACTIVE_PRODUCTS', 'Bu birlikdan foydalanayotgan faol mahsulotlar mavjud.')
      }

      return repository.setActive(input.id, input.isActive, new Date().toISOString())!
    })
  }

  public delete(id: number): void {
    assertValidId(id)
    const database = databaseManager.getConnection()
    const repository = new UnitRepository(database)

    runInTransaction(database, () => {
      this.assertUnitExists(repository, id)

      if (this.countProducts(id) > 0) {
        throw new UnitServiceError('UNIT_HAS_PRODUCTS', 'Bu birlikga bog‘langan mahsulotlar mavjud.')
      }

      repository.delete(id)
    })
  }

  private countProducts(unitId: number): number {
    const database = databaseManager.getConnection()
    const productsTable = database
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'products'")
      .get() as { readonly present: number } | undefined

    if (!productsTable) {
      return 0
    }

    const result = database
      .prepare('SELECT COUNT(*) AS count FROM products WHERE unit_id = ?')
      .get(unitId) as { readonly count: number }

    return result.count
  }

  private assertUnitExists(repository: UnitRepository, id: number): void {
    if (!repository.findById(id)) {
      throw new UnitServiceError('UNIT_NOT_FOUND', 'Birlik topilmadi.')
    }
  }

  private assertUnique(repository: UnitRepository, nameNormalized: string, shortNameNormalized: string, excludedId?: number): void {
    if (repository.existsByNameNormalized(nameNormalized, excludedId)) {
      throw new UnitServiceError('UNIT_DUPLICATE_NAME', 'Bu nomli birlik allaqachon mavjud.')
    }

    if (repository.existsByShortNameNormalized(shortNameNormalized, excludedId)) {
      throw new UnitServiceError('UNIT_DUPLICATE_SHORT_NAME', 'Bu qisqartmali birlik allaqachon mavjud.')
    }
  }
}

export const unitService = new UnitService()
