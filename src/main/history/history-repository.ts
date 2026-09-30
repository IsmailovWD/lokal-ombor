import type Database from 'better-sqlite3'

import type { HistoryFilterOptions, HistoryListQuery, HistoryListResult, StockMovement } from '@shared/contracts/app.contract'

interface HistoryRow {
  readonly id: number
  readonly product_id: number
  readonly product_name: string
  readonly unit_name: string
  readonly unit_short_name: string
  readonly type: 'IN' | 'OUT'
  readonly quantity_milli: number
  readonly occurred_at_utc: string
  readonly note: string | null
  readonly balance_after_milli: number
  readonly created_at_utc: string
  readonly updated_at_utc: string
}

interface CountRow { readonly count: number }

const selectHistory = `
  SELECT stock_movements.id, stock_movements.product_id,
         products.name AS product_name, units.name AS unit_name, units.short_name AS unit_short_name,
         stock_movements.type, stock_movements.quantity_milli, stock_movements.occurred_at_utc,
         stock_movements.note, stock_movements.balance_after_milli,
         stock_movements.created_at_utc, stock_movements.updated_at_utc
  FROM stock_movements
  INNER JOIN products ON products.id = stock_movements.product_id
  INNER JOIN units ON units.id = products.unit_id
`

const orderColumns = {
  occurredAtUtc: 'stock_movements.occurred_at_utc',
  productName: 'products.name_normalized',
  type: 'stock_movements.type',
  quantity: 'stock_movements.quantity_milli',
  createdAtUtc: 'stock_movements.created_at_utc'
} as const

function toStockMovement(row: HistoryRow): StockMovement {
  return {
    id: row.id, productId: row.product_id, productName: row.product_name,
    unitName: row.unit_name, unitShortName: row.unit_short_name, type: row.type,
    quantityMilli: row.quantity_milli, occurredAtUtc: row.occurred_at_utc, note: row.note,
    balanceAfterMilli: row.balance_after_milli, createdAtUtc: row.created_at_utc, updatedAtUtc: row.updated_at_utc
  }
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export class HistoryRepository {
  public constructor(private readonly database: Database.Database) {}

  public getFilterOptions(): HistoryFilterOptions {
    const products = this.database.prepare(`
      SELECT products.id, products.name, products.unit_id, units.name AS unit_name, units.short_name AS unit_short_name
      FROM products INNER JOIN units ON units.id = products.unit_id
      ORDER BY products.name_normalized ASC, products.id ASC
    `).all() as Array<{ readonly id: number; readonly name: string; readonly unit_id: number; readonly unit_name: string; readonly unit_short_name: string }>
    const units = this.database.prepare('SELECT id, name, short_name FROM units ORDER BY name_normalized ASC, id ASC').all() as Array<{ readonly id: number; readonly name: string; readonly short_name: string }>

    return {
      products: products.map((product) => ({ id: product.id, name: product.name, unitId: product.unit_id, unitName: product.unit_name, unitShortName: product.unit_short_name })),
      units: units.map((unit) => ({ id: unit.id, name: unit.name, shortName: unit.short_name }))
    }
  }

  public list(query: HistoryListQuery): HistoryListResult {
    const conditions: string[] = []
    const parameters: unknown[] = []
    const search = query.search.trim().normalize('NFC').toLowerCase()

    if (search.length > 0) {
      const pattern = `%${escapeLike(search)}%`
      conditions.push("(products.name_normalized LIKE ? ESCAPE '\\' OR products.sku_normalized LIKE ? ESCAPE '\\' OR units.name_normalized LIKE ? ESCAPE '\\' OR units.short_name_normalized LIKE ? ESCAPE '\\' OR LOWER(COALESCE(stock_movements.note, '')) LIKE ? ESCAPE '\\')")
      parameters.push(pattern, pattern, pattern, pattern, pattern)
    }
    if (query.type !== 'all') { conditions.push('stock_movements.type = ?'); parameters.push(query.type) }
    if (query.productId !== null) { conditions.push('stock_movements.product_id = ?'); parameters.push(query.productId) }
    if (query.unitId !== null) { conditions.push('products.unit_id = ?'); parameters.push(query.unitId) }
    if (query.fromUtc !== null) { conditions.push('stock_movements.occurred_at_utc >= ?'); parameters.push(query.fromUtc) }
    if (query.toUtcExclusive !== null) { conditions.push('stock_movements.occurred_at_utc < ?'); parameters.push(query.toUtcExclusive) }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const total = (this.database.prepare(`SELECT COUNT(*) AS count FROM stock_movements INNER JOIN products ON products.id = stock_movements.product_id INNER JOIN units ON units.id = products.unit_id ${whereClause}`).get(...parameters) as CountRow).count
    const orderColumn = orderColumns[query.sort]
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
    const offset = (query.page - 1) * query.pageSize
    const rows = this.database.prepare(`
      ${selectHistory}
      ${whereClause}
      ORDER BY ${orderColumn} ${direction}, stock_movements.id DESC
      LIMIT ? OFFSET ?
    `).all(...parameters, query.pageSize, offset) as HistoryRow[]

    return { items: rows.map(toStockMovement), total, page: query.page, pageSize: query.pageSize }
  }
}
