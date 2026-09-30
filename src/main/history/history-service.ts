import type { HistoryFilterOptions, HistoryListQuery, HistoryListResult } from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'

import { HistoryServiceError } from './history-errors'
import { HistoryRepository } from './history-repository'

function assertValidDate(value: string | null, fieldLabel: string): void {
  if (value !== null && (typeof value !== 'string' || Number.isNaN(new Date(value).valueOf()))) {
    throw new HistoryServiceError('HISTORY_VALIDATION', `${fieldLabel} noto‘g‘ri.`)
  }
}

function assertValidQuery(query: HistoryListQuery): void {
  const types = new Set(['all', 'IN', 'OUT'])
  const sorts = new Set(['occurredAtUtc', 'productName', 'type', 'quantity', 'createdAtUtc'])
  const directions = new Set(['asc', 'desc'])
  const isOptionalIdValid = (value: number | null): boolean => value === null || (Number.isSafeInteger(value) && value > 0)

  if (typeof query.search !== 'string' || !types.has(query.type) || !sorts.has(query.sort) || !directions.has(query.direction) || !isOptionalIdValid(query.productId) || !isOptionalIdValid(query.unitId) || !Number.isSafeInteger(query.page) || query.page < 1 || !Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new HistoryServiceError('HISTORY_VALIDATION', 'Tarix so‘rovi parametrlari noto‘g‘ri.')
  }
  assertValidDate(query.fromUtc, 'Boshlanish vaqti')
  assertValidDate(query.toUtcExclusive, 'Tugash vaqti')
  if (query.fromUtc !== null && query.toUtcExclusive !== null && new Date(query.fromUtc) >= new Date(query.toUtcExclusive)) {
    throw new HistoryServiceError('HISTORY_VALIDATION', 'Sana oralig‘i noto‘g‘ri.')
  }
}

export class HistoryService {
  public list(query: HistoryListQuery): HistoryListResult {
    assertValidQuery(query)
    return new HistoryRepository(databaseManager.getConnection()).list(query)
  }

  public getFilterOptions(): HistoryFilterOptions {
    return new HistoryRepository(databaseManager.getConnection()).getFilterOptions()
  }
}

export const historyService = new HistoryService()
