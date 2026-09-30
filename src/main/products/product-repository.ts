import type Database from 'better-sqlite3'

import type { Product, ProductListQuery, ProductListResult, StockProductOption } from '@shared/contracts/app.contract'

export interface CreateProductRecord {
  readonly name: string
  readonly nameNormalized: string
  readonly sku: string | null
  readonly skuNormalized: string | null
  readonly note: string | null
  readonly unitId: number
  readonly minimumStockMilli: number | null
  readonly now: string
}

export interface UpdateProductRecord extends CreateProductRecord {
  readonly id: number
}

interface ProductRow {
  readonly id: number
  readonly name: string
  readonly sku: string | null
  readonly note: string | null
  readonly unit_id: number
  readonly unit_name: string
  readonly unit_short_name: string
  readonly minimum_stock_milli: number | null
  readonly current_balance_milli: number
  readonly is_low_stock: 0 | 1
  readonly is_active: 0 | 1
  readonly created_at_utc: string
  readonly updated_at_utc: string
}

interface CountRow {
  readonly count: number
}

const selectProduct = `
  SELECT products.id, products.name, products.sku, products.note, products.unit_id,
         units.name AS unit_name, units.short_name AS unit_short_name,
         products.minimum_stock_milli, products.current_balance_milli,
         CASE WHEN products.is_active = 1 AND products.minimum_stock_milli IS NOT NULL AND products.current_balance_milli <= products.minimum_stock_milli THEN 1 ELSE 0 END AS is_low_stock,
         products.is_active, products.created_at_utc, products.updated_at_utc
  FROM products
  INNER JOIN units ON units.id = products.unit_id
`

const orderColumns = {
  name: 'products.name_normalized',
  sku: 'products.sku_normalized',
  unitName: 'units.name_normalized',
  minimumStock: 'products.minimum_stock_milli',
  status: 'products.is_active',
  createdAtUtc: 'products.created_at_utc'
} as const

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    note: row.note,
    unitId: row.unit_id,
    unitName: row.unit_name,
    unitShortName: row.unit_short_name,
    minimumStockMilli: row.minimum_stock_milli,
    currentBalanceMilli: row.current_balance_milli,
    isLowStock: row.is_low_stock === 1,
    isActive: row.is_active === 1,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc
  }
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export class ProductRepository {
  public constructor(private readonly database: Database.Database) {}

  public findById(id: number): Product | undefined {
    const row = this.database.prepare(`${selectProduct} WHERE products.id = ?`).get(id) as ProductRow | undefined
    return row ? toProduct(row) : undefined
  }

  public existsByNameNormalized(nameNormalized: string, excludedId?: number): boolean {
    const row = excludedId === undefined
      ? this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE name_normalized = ?').get(nameNormalized) as CountRow
      : this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE name_normalized = ? AND id <> ?').get(nameNormalized, excludedId) as CountRow

    return row.count > 0
  }

  public existsBySkuNormalized(skuNormalized: string, excludedId?: number): boolean {
    const row = excludedId === undefined
      ? this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE sku_normalized = ?').get(skuNormalized) as CountRow
      : this.database.prepare('SELECT COUNT(*) AS count FROM products WHERE sku_normalized = ? AND id <> ?').get(skuNormalized, excludedId) as CountRow

    return row.count > 0
  }

  public create(record: CreateProductRecord): Product {
    const result = this.database
      .prepare(`
        INSERT INTO products (
          name, name_normalized, sku, sku_normalized, note, unit_id, minimum_stock_milli,
          current_balance_milli, is_active, created_at_utc, updated_at_utc
        ) VALUES (
          @name, @nameNormalized, @sku, @skuNormalized, @note, @unitId, @minimumStockMilli,
          0, 1, @now, @now
        )
      `)
      .run(record)

    return this.findById(Number(result.lastInsertRowid))!
  }

  public update(record: UpdateProductRecord): Product | undefined {
    const result = this.database
      .prepare(`
        UPDATE products
        SET name = @name,
            name_normalized = @nameNormalized,
            sku = @sku,
            sku_normalized = @skuNormalized,
            note = @note,
            unit_id = @unitId,
            minimum_stock_milli = @minimumStockMilli,
            updated_at_utc = @now
        WHERE id = @id
      `)
      .run(record)

    return result.changes === 1 ? this.findById(record.id) : undefined
  }

  public setActive(id: number, isActive: boolean, now: string): Product | undefined {
    const result = this.database
      .prepare('UPDATE products SET is_active = ?, updated_at_utc = ? WHERE id = ?')
      .run(isActive ? 1 : 0, now, id)

    return result.changes === 1 ? this.findById(id) : undefined
  }

  public delete(id: number): boolean {
    return this.database.prepare('DELETE FROM products WHERE id = ?').run(id).changes === 1
  }

  public listActiveStockOptions(): readonly StockProductOption[] {
    const rows = this.database
      .prepare(`
        SELECT products.id, products.name, units.name AS unit_name, units.short_name AS unit_short_name
        FROM products
        INNER JOIN units ON units.id = products.unit_id
        WHERE products.is_active = 1 AND units.is_active = 1
        ORDER BY products.name_normalized ASC, products.id ASC
      `)
      .all() as Array<{ readonly id: number; readonly name: string; readonly unit_name: string; readonly unit_short_name: string }>

    return rows.map((row) => ({ id: row.id, name: row.name, unitName: row.unit_name, unitShortName: row.unit_short_name }))
  }

  public list(query: ProductListQuery): ProductListResult {
    const conditions: string[] = []
    const parameters: unknown[] = []
    const search = query.search.trim().normalize('NFC').toLowerCase()

    if (search.length > 0) {
      const pattern = `%${escapeLike(search)}%`
      conditions.push("(products.name_normalized LIKE ? ESCAPE '\\' OR products.sku_normalized LIKE ? ESCAPE '\\')")
      parameters.push(pattern, pattern)
    }

    if (query.status !== 'all') {
      conditions.push('products.is_active = ?')
      parameters.push(query.status === 'active' ? 1 : 0)
    }

    if (query.unitId !== null) {
      conditions.push('products.unit_id = ?')
      parameters.push(query.unitId)
    }

    if (query.stockLevel === 'low') {
      conditions.push('products.is_active = 1 AND products.minimum_stock_milli IS NOT NULL AND products.current_balance_milli <= products.minimum_stock_milli')
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = this.database
      .prepare(`SELECT COUNT(*) AS count FROM products INNER JOIN units ON units.id = products.unit_id ${whereClause}`)
      .get(...parameters) as CountRow
    const orderColumn = orderColumns[query.sort]
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
    const offset = (query.page - 1) * query.pageSize
    const rows = this.database
      .prepare(`
        ${selectProduct}
        ${whereClause}
        ORDER BY ${orderColumn} ${direction}, products.id ASC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters, query.pageSize, offset) as ProductRow[]

    return {
      items: rows.map(toProduct),
      total: countRow.count,
      page: query.page,
      pageSize: query.pageSize
    }
  }
}
