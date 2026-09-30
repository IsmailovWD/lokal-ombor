import type Database from 'better-sqlite3'

import type { StockInListQuery, StockInListResult, StockMovement, StockOutListQuery, StockOutListResult } from '@shared/contracts/app.contract'

interface StockMovementRow {
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

interface ReplayRow {
  readonly id: number
  readonly product_id: number
  readonly type: 'IN' | 'OUT'
  readonly quantity_milli: number
  readonly balance_after_milli: number
}

interface CountRow {
  readonly count: number
}

const selectMovement = `
  SELECT stock_movements.id, stock_movements.product_id,
         products.name AS product_name, units.name AS unit_name, units.short_name AS unit_short_name,
         stock_movements.type, stock_movements.quantity_milli, stock_movements.occurred_at_utc,
         stock_movements.note, stock_movements.balance_after_milli,
         stock_movements.created_at_utc, stock_movements.updated_at_utc
  FROM stock_movements
  INNER JOIN products ON products.id = stock_movements.product_id
  INNER JOIN units ON units.id = products.unit_id
`

function toStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    unitName: row.unit_name,
    unitShortName: row.unit_short_name,
    type: row.type,
    quantityMilli: row.quantity_milli,
    occurredAtUtc: row.occurred_at_utc,
    note: row.note,
    balanceAfterMilli: row.balance_after_milli,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc
  }
}

export class StockMovementRepository {
  public constructor(private readonly database: Database.Database) {}

  public findById(id: number): StockMovement | undefined {
    const row = this.database.prepare(`${selectMovement} WHERE stock_movements.id = ?`).get(id) as StockMovementRow | undefined
    return row ? toStockMovement(row) : undefined
  }

  public create(input: { readonly productId: number; readonly quantityMilli: number; readonly occurredAtUtc: string; readonly note: string | null; readonly now: string }): StockMovement {
    const result = this.database
      .prepare(`
        INSERT INTO stock_movements (
          product_id, type, quantity_milli, occurred_at_utc, note,
          balance_after_milli, created_at_utc, updated_at_utc
        ) VALUES (@productId, 'IN', @quantityMilli, @occurredAtUtc, @note, 0, @now, @now)
      `)
      .run(input)

    return this.findById(Number(result.lastInsertRowid))!
  }

  public createOut(input: { readonly productId: number; readonly quantityMilli: number; readonly occurredAtUtc: string; readonly note: string | null; readonly now: string }): StockMovement {
    const result = this.database
      .prepare(`
        INSERT INTO stock_movements (
          product_id, type, quantity_milli, occurred_at_utc, note,
          balance_after_milli, created_at_utc, updated_at_utc
        ) VALUES (@productId, 'OUT', @quantityMilli, @occurredAtUtc, @note, 0, @now, @now)
      `)
      .run(input)

    return this.findById(Number(result.lastInsertRowid))!
  }

  public update(input: { readonly id: number; readonly productId: number; readonly quantityMilli: number; readonly occurredAtUtc: string; readonly note: string | null; readonly now: string }): StockMovement | undefined {
    const result = this.database
      .prepare(`
        UPDATE stock_movements
        SET product_id = @productId,
            quantity_milli = @quantityMilli,
            occurred_at_utc = @occurredAtUtc,
            note = @note,
            updated_at_utc = @now
        WHERE id = @id AND type = 'IN'
      `)
      .run(input)

    return result.changes === 1 ? this.findById(input.id) : undefined
  }

  public deleteInMovement(id: number): boolean {
    return this.database.prepare("DELETE FROM stock_movements WHERE id = ? AND type = 'IN'").run(id).changes === 1
  }

  public updateOut(input: { readonly id: number; readonly productId: number; readonly quantityMilli: number; readonly occurredAtUtc: string; readonly note: string | null; readonly now: string }): StockMovement | undefined {
    const result = this.database
      .prepare(`
        UPDATE stock_movements
        SET product_id = @productId,
            quantity_milli = @quantityMilli,
            occurred_at_utc = @occurredAtUtc,
            note = @note,
            updated_at_utc = @now
        WHERE id = @id AND type = 'OUT'
      `)
      .run(input)

    return result.changes === 1 ? this.findById(input.id) : undefined
  }

  public deleteOutMovement(id: number): boolean {
    return this.database.prepare("DELETE FROM stock_movements WHERE id = ? AND type = 'OUT'").run(id).changes === 1
  }

  public listIn(query: StockInListQuery): StockInListResult {
    const total = (this.database.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE type = 'IN'").get() as CountRow).count
    const offset = (query.page - 1) * query.pageSize
    const rows = this.database
      .prepare(`
        ${selectMovement}
        WHERE stock_movements.type = 'IN'
        ORDER BY stock_movements.occurred_at_utc DESC, stock_movements.created_at_utc DESC, stock_movements.id DESC
        LIMIT ? OFFSET ?
      `)
      .all(query.pageSize, offset) as StockMovementRow[]

    return { items: rows.map(toStockMovement), total, page: query.page, pageSize: query.pageSize }
  }

  public listOut(query: StockOutListQuery): StockOutListResult {
    const total = (this.database.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE type = 'OUT'").get() as CountRow).count
    const offset = (query.page - 1) * query.pageSize
    const rows = this.database
      .prepare(`
        ${selectMovement}
        WHERE stock_movements.type = 'OUT'
        ORDER BY stock_movements.occurred_at_utc DESC, stock_movements.created_at_utc DESC, stock_movements.id DESC
        LIMIT ? OFFSET ?
      `)
      .all(query.pageSize, offset) as StockMovementRow[]

    return { items: rows.map(toStockMovement), total, page: query.page, pageSize: query.pageSize }
  }

  public listForReplay(productIds: readonly number[]): readonly ReplayRow[] {
    if (productIds.length === 0) {
      return []
    }

    const placeholders = productIds.map(() => '?').join(', ')
    const rows = this.database
      .prepare(`
        SELECT id, product_id, type, quantity_milli, balance_after_milli
        FROM stock_movements
        WHERE product_id IN (${placeholders})
        ORDER BY product_id ASC, occurred_at_utc ASC, created_at_utc ASC, id ASC
      `)
      .all(...productIds) as ReplayRow[]

    return rows
  }

  public setBalanceAfter(id: number, balanceAfterMilli: number): void {
    this.database.prepare('UPDATE stock_movements SET balance_after_milli = ? WHERE id = ?').run(balanceAfterMilli, id)
  }
}
