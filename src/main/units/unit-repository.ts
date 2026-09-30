import type Database from 'better-sqlite3'

import type { Unit, UnitListQuery, UnitListResult, UnitOption } from '@shared/contracts/app.contract'

export interface CreateUnitRecord {
  readonly name: string
  readonly shortName: string
  readonly nameNormalized: string
  readonly shortNameNormalized: string
  readonly now: string
}

export interface UpdateUnitRecord extends CreateUnitRecord {
  readonly id: number
}

interface UnitRow {
  readonly id: number
  readonly name: string
  readonly short_name: string
  readonly is_active: 0 | 1
  readonly created_at_utc: string
  readonly updated_at_utc: string
}

interface CountRow {
  readonly count: number
}

const orderColumns = {
  name: 'name_normalized',
  shortName: 'short_name_normalized',
  status: 'is_active',
  createdAtUtc: 'created_at_utc'
} as const

function toUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    isActive: row.is_active === 1,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc
  }
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export class UnitRepository {
  public constructor(private readonly database: Database.Database) {}

  public findById(id: number): Unit | undefined {
    const row = this.database
      .prepare('SELECT id, name, short_name, is_active, created_at_utc, updated_at_utc FROM units WHERE id = ?')
      .get(id) as UnitRow | undefined

    return row ? toUnit(row) : undefined
  }

  public existsByNameNormalized(nameNormalized: string, excludedId?: number): boolean {
    const row = excludedId === undefined
      ? this.database.prepare('SELECT COUNT(*) AS count FROM units WHERE name_normalized = ?').get(nameNormalized) as CountRow
      : this.database.prepare('SELECT COUNT(*) AS count FROM units WHERE name_normalized = ? AND id <> ?').get(nameNormalized, excludedId) as CountRow

    return row.count > 0
  }

  public existsByShortNameNormalized(shortNameNormalized: string, excludedId?: number): boolean {
    const row = excludedId === undefined
      ? this.database.prepare('SELECT COUNT(*) AS count FROM units WHERE short_name_normalized = ?').get(shortNameNormalized) as CountRow
      : this.database.prepare('SELECT COUNT(*) AS count FROM units WHERE short_name_normalized = ? AND id <> ?').get(shortNameNormalized, excludedId) as CountRow

    return row.count > 0
  }

  public create(record: CreateUnitRecord): Unit {
    const result = this.database
      .prepare(`
        INSERT INTO units (name, short_name, name_normalized, short_name_normalized, is_active, created_at_utc, updated_at_utc)
        VALUES (@name, @shortName, @nameNormalized, @shortNameNormalized, 1, @now, @now)
      `)
      .run(record)

    return this.findById(Number(result.lastInsertRowid))!
  }

  public update(record: UpdateUnitRecord): Unit | undefined {
    const result = this.database
      .prepare(`
        UPDATE units
        SET name = @name,
            short_name = @shortName,
            name_normalized = @nameNormalized,
            short_name_normalized = @shortNameNormalized,
            updated_at_utc = @now
        WHERE id = @id
      `)
      .run(record)

    return result.changes === 1 ? this.findById(record.id) : undefined
  }

  public setActive(id: number, isActive: boolean, now: string): Unit | undefined {
    const result = this.database
      .prepare('UPDATE units SET is_active = ?, updated_at_utc = ? WHERE id = ?')
      .run(isActive ? 1 : 0, now, id)

    return result.changes === 1 ? this.findById(id) : undefined
  }

  public delete(id: number): boolean {
    return this.database.prepare('DELETE FROM units WHERE id = ?').run(id).changes === 1
  }

  public listActiveOptions(): readonly UnitOption[] {
    const rows = this.database
      .prepare('SELECT id, name, short_name FROM units WHERE is_active = 1 ORDER BY name_normalized ASC, id ASC')
      .all() as Array<{ readonly id: number; readonly name: string; readonly short_name: string }>

    return rows.map((row) => ({ id: row.id, name: row.name, shortName: row.short_name }))
  }

  public list(query: UnitListQuery): UnitListResult {
    const conditions: string[] = []
    const parameters: unknown[] = []
    const search = query.search.trim().normalize('NFC').toLowerCase()

    if (search.length > 0) {
      const pattern = `%${escapeLike(search)}%`
      conditions.push("(name_normalized LIKE ? ESCAPE '\\' OR short_name_normalized LIKE ? ESCAPE '\\')")
      parameters.push(pattern, pattern)
    }

    if (query.status !== 'all') {
      conditions.push('is_active = ?')
      parameters.push(query.status === 'active' ? 1 : 0)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countRow = this.database.prepare(`SELECT COUNT(*) AS count FROM units ${whereClause}`).get(...parameters) as CountRow
    const orderColumn = orderColumns[query.sort]
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC'
    const offset = (query.page - 1) * query.pageSize
    const rows = this.database
      .prepare(`
        SELECT id, name, short_name, is_active, created_at_utc, updated_at_utc
        FROM units
        ${whereClause}
        ORDER BY ${orderColumn} ${direction}, id ASC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters, query.pageSize, offset) as UnitRow[]

    return {
      items: rows.map(toUnit),
      total: countRow.count,
      page: query.page,
      pageSize: query.pageSize
    }
  }
}
