import type Database from 'better-sqlite3'

import type {
  DashboardDailyVolume,
  DashboardOverview,
  DashboardQuery,
  DashboardUnitMetrics,
  DashboardUnitOption,
  LowStockProduct,
  ProductListResult,
  StockMovement
} from '@shared/contracts/app.contract'

import { HistoryRepository } from '../history/history-repository'
import { ProductRepository } from '../products/product-repository'

import type { LocalPeriodRanges } from './dashboard-date-range'

interface CountRow { readonly count: number }
interface PeriodCountRow { readonly in_count: number; readonly out_count: number }
interface AmountRow { readonly in_milli: number; readonly out_milli: number }
interface DailyAmountRow { readonly date_local: string; readonly type: 'IN' | 'OUT'; readonly quantity_milli: number }
interface BalanceRow { readonly balance_milli: number }
interface LowStockProductRow { readonly id: number; readonly name: string; readonly unit_short_name: string; readonly current_balance_milli: number; readonly minimum_stock_milli: number }

function toUnitOption(row: { readonly id: number; readonly name: string; readonly short_name: string }): DashboardUnitOption {
  return { id: row.id, name: row.name, shortName: row.short_name }
}

export class DashboardRepository {
  public constructor(private readonly database: Database.Database) {}

  public getUnitOptions(): readonly DashboardUnitOption[] {
    const rows = this.database.prepare('SELECT id, name, short_name FROM units ORDER BY name_normalized ASC, id ASC').all() as Array<{ readonly id: number; readonly name: string; readonly short_name: string }>
    return rows.map(toUnitOption)
  }

  public findUnit(unitId: number): DashboardUnitOption | null {
    const row = this.database.prepare('SELECT id, name, short_name FROM units WHERE id = ?').get(unitId) as { readonly id: number; readonly name: string; readonly short_name: string } | undefined
    return row ? toUnitOption(row) : null
  }

  public getOverview(query: DashboardQuery, dateKeys: readonly string[], selectedUnit: DashboardUnitOption | null, periodRanges: LocalPeriodRanges): DashboardOverview {
    const activeProductCount = (this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active = 1').get() as CountRow).count
    const activeUnitCount = (this.database.prepare('SELECT COUNT(*) AS count FROM units WHERE is_active = 1').get() as CountRow).count
    const lowStockProductCount = (this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active = 1 AND minimum_stock_milli IS NOT NULL AND current_balance_milli <= minimum_stock_milli').get() as CountRow).count
    const periodCounts = this.getMovementCounts(query.fromUtc, query.toUtcExclusive)
    const todayCounts = this.getMovementCounts(periodRanges.todayFromUtc, periodRanges.todayToUtcExclusive)
    const monthCounts = this.getMovementCounts(periodRanges.monthFromUtc, periodRanges.monthToUtcExclusive)

    return {
      activeProductCount,
      activeUnitCount,
      lowStockProductCount,
      lowStockProducts: this.getLowStockProducts(),
      periodInMovementCount: periodCounts.in_count,
      periodOutMovementCount: periodCounts.out_count,
      todayInMovementCount: todayCounts.in_count,
      todayOutMovementCount: todayCounts.out_count,
      monthInMovementCount: monthCounts.in_count,
      monthOutMovementCount: monthCounts.out_count,
      currentStock: this.getCurrentStock(query),
      recentMovements: this.getRecentMovements(),
      unitOptions: this.getUnitOptions(),
      selectedUnit,
      selectedUnitMetrics: selectedUnit ? this.getUnitMetrics(selectedUnit.id, query, periodRanges) : null,
      dailyVolumes: selectedUnit ? this.getDailyVolumes(selectedUnit.id, query, dateKeys) : []
    }
  }

  private getMovementCounts(fromUtc: string, toUtcExclusive: string): PeriodCountRow {
    return this.database.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'IN' THEN 1 ELSE 0 END), 0) AS in_count,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN 1 ELSE 0 END), 0) AS out_count
      FROM stock_movements
      WHERE occurred_at_utc >= ? AND occurred_at_utc < ?
    `).get(fromUtc, toUtcExclusive) as PeriodCountRow
  }

  private getCurrentStock(query: DashboardQuery): ProductListResult {
    return new ProductRepository(this.database).list({
      search: '',
      status: 'active',
      unitId: null,
      stockLevel: 'all',
      sort: 'name',
      direction: 'asc',
      page: query.stockPage ?? 1,
      pageSize: query.stockPageSize ?? 10
    })
  }

  private getRecentMovements(): readonly StockMovement[] {
    return new HistoryRepository(this.database).list({
      search: '',
      type: 'all',
      productId: null,
      unitId: null,
      fromUtc: null,
      toUtcExclusive: null,
      sort: 'occurredAtUtc',
      direction: 'desc',
      page: 1,
      pageSize: 5
    }).items
  }

  private getLowStockProducts(): readonly LowStockProduct[] {
    const rows = this.database.prepare(`
      SELECT products.id, products.name, units.short_name AS unit_short_name,
             products.current_balance_milli, products.minimum_stock_milli
      FROM products
      INNER JOIN units ON units.id = products.unit_id
      WHERE products.is_active = 1
        AND products.minimum_stock_milli IS NOT NULL
        AND products.current_balance_milli <= products.minimum_stock_milli
      ORDER BY CASE WHEN products.minimum_stock_milli = 0 THEN 0
                    ELSE CAST(products.current_balance_milli AS REAL) / products.minimum_stock_milli END ASC,
               products.name_normalized ASC,
               products.id ASC
      LIMIT 5
    `).all() as LowStockProductRow[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      unitShortName: row.unit_short_name,
      currentBalanceMilli: row.current_balance_milli,
      minimumStockMilli: row.minimum_stock_milli
    }))
  }

  private getUnitMetrics(unitId: number, query: DashboardQuery, periodRanges: LocalPeriodRanges): DashboardUnitMetrics {
    const balance = this.database.prepare(`
      SELECT COALESCE(SUM(current_balance_milli), 0) AS balance_milli
      FROM products
      WHERE unit_id = ? AND is_active = 1
    `).get(unitId) as BalanceRow
    const periodAmounts = this.getUnitAmounts(unitId, query.fromUtc, query.toUtcExclusive)
    const todayAmounts = this.getUnitAmounts(unitId, periodRanges.todayFromUtc, periodRanges.todayToUtcExclusive)
    const monthAmounts = this.getUnitAmounts(unitId, periodRanges.monthFromUtc, periodRanges.monthToUtcExclusive)

    return {
      currentBalanceMilli: balance.balance_milli,
      periodInMilli: periodAmounts.in_milli,
      periodOutMilli: periodAmounts.out_milli,
      todayInMilli: todayAmounts.in_milli,
      todayOutMilli: todayAmounts.out_milli,
      monthInMilli: monthAmounts.in_milli,
      monthOutMilli: monthAmounts.out_milli
    }
  }

  private getUnitAmounts(unitId: number, fromUtc: string, toUtcExclusive: string): AmountRow {
    return this.database.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN stock_movements.type = 'IN' THEN stock_movements.quantity_milli ELSE 0 END), 0) AS in_milli,
        COALESCE(SUM(CASE WHEN stock_movements.type = 'OUT' THEN stock_movements.quantity_milli ELSE 0 END), 0) AS out_milli
      FROM stock_movements
      INNER JOIN products ON products.id = stock_movements.product_id
      WHERE products.unit_id = ? AND stock_movements.occurred_at_utc >= ? AND stock_movements.occurred_at_utc < ?
    `).get(unitId, fromUtc, toUtcExclusive) as AmountRow
  }

  private getDailyVolumes(unitId: number, query: DashboardQuery, dateKeys: readonly string[]): readonly DashboardDailyVolume[] {
    const rows = this.database.prepare(`
      SELECT strftime('%Y-%m-%d', stock_movements.occurred_at_utc, 'localtime') AS date_local,
             stock_movements.type,
             SUM(stock_movements.quantity_milli) AS quantity_milli
      FROM stock_movements
      INNER JOIN products ON products.id = stock_movements.product_id
      WHERE products.unit_id = ? AND stock_movements.occurred_at_utc >= ? AND stock_movements.occurred_at_utc < ?
      GROUP BY date_local, stock_movements.type
    `).all(unitId, query.fromUtc, query.toUtcExclusive) as DailyAmountRow[]
    const amounts = new Map<string, { inMilli: number; outMilli: number }>()

    for (const row of rows) {
      const value = amounts.get(row.date_local) ?? { inMilli: 0, outMilli: 0 }
      if (row.type === 'IN') value.inMilli = row.quantity_milli
      else value.outMilli = row.quantity_milli
      amounts.set(row.date_local, value)
    }

    return dateKeys.map((dateLocal) => ({ dateLocal, ...(amounts.get(dateLocal) ?? { inMilli: 0, outMilli: 0 }) }))
  }
}
