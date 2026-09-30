import type { DashboardOverview, DashboardQuery } from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'

import { getLocalPeriodRanges, listLocalDateKeys } from './dashboard-date-range'
import { DashboardServiceError } from './dashboard-errors'
import { DashboardRepository } from './dashboard-repository'

function assertValidQuery(query: DashboardQuery): readonly string[] {
  const isOptionalIdValid = query.unitId === null || (Number.isSafeInteger(query.unitId) && query.unitId > 0)
  const stockPage = query.stockPage ?? 1
  const stockPageSize = query.stockPageSize ?? 10
  const from = new Date(query.fromUtc)
  const to = new Date(query.toUtcExclusive)

  if (!isOptionalIdValid || !Number.isSafeInteger(stockPage) || stockPage < 1 || !Number.isSafeInteger(stockPageSize) || stockPageSize < 1 || stockPageSize > 100 || typeof query.fromUtc !== 'string' || typeof query.toUtcExclusive !== 'string' || Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from >= to) {
    throw new DashboardServiceError('DASHBOARD_VALIDATION', 'Dashboard so‘rovi parametrlari noto‘g‘ri.')
  }

  const dateKeys = listLocalDateKeys(query.fromUtc, query.toUtcExclusive)
  if (dateKeys.length !== 30) {
    throw new DashboardServiceError('DASHBOARD_VALIDATION', 'Dashboard faqat ketma-ket 30 kunlik davrni qabul qiladi.')
  }

  return dateKeys
}

export class DashboardService {
  public getOverview(query: DashboardQuery): DashboardOverview {
    const dateKeys = assertValidQuery(query)
    const repository = new DashboardRepository(databaseManager.getConnection())
    const selectedUnit = query.unitId === null ? null : repository.findUnit(query.unitId)

    if (query.unitId !== null && selectedUnit === null) {
      throw new DashboardServiceError('DASHBOARD_UNIT_NOT_FOUND', 'Tanlangan birlik topilmadi.')
    }

    return repository.getOverview(query, dateKeys, selectedUnit, getLocalPeriodRanges(query.toUtcExclusive))
  }
}

export const dashboardService = new DashboardService()
