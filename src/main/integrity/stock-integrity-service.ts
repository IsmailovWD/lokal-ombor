import type Database from 'better-sqlite3'

import type { IntegrityIssue, IntegrityReport } from '@shared/contracts/app.contract'

import { databaseManager } from '../db/database'
import { checkDatabaseHealth } from '../db/integrity/database-health'
import { runInTransaction } from '../db/transactions'
import { StockMovementServiceError } from '../stock/stock-errors'
import { StockMovementRepository } from '../stock/stock-movement-repository'
import { replayProductBalances } from '../stock/stock-replay-service'

import { IntegrityServiceError } from './integrity-errors'

interface ProductBalanceRow { readonly id: number; readonly current_balance_milli: number }
interface CountRow { readonly count: number }

function createIssue(issue: IntegrityIssue): IntegrityIssue {
  return issue
}

export class StockIntegrityService {
  public check(): IntegrityReport {
    return this.inspect(databaseManager.getConnection())
  }

  public rebuildStockBalances(): IntegrityReport {
    const database = databaseManager.getConnection()
    const productIds = (database.prepare('SELECT id FROM products ORDER BY id ASC').all() as Array<{ readonly id: number }>).map((product) => product.id)

    try {
      runInTransaction(database, () => replayProductBalances(database, productIds))
    } catch (error) {
      if (error instanceof StockMovementServiceError && error.code === 'STOCK_NEGATIVE_BALANCE') {
        throw new IntegrityServiceError('INTEGRITY_REBUILD_REJECTED', 'Qayta hisoblash manfiy tarixiy qoldiq sabab rad etildi. Ma’lumotlarni Tarix bo‘limida tuzating.', { cause: error })
      }
      throw new IntegrityServiceError('INTEGRITY_OPERATION_FAILED', 'Qoldiqlarni qayta hisoblab bo‘lmadi.', { cause: error })
    }

    return this.inspect(database)
  }

  private inspect(database: Database.Database): IntegrityReport {
    const issues: IntegrityIssue[] = []
    const health = checkDatabaseHealth(database)
    if (health.integrityCheckResult !== 'ok') {
      issues.push(createIssue({ code: 'SQLITE_INTEGRITY', message: `SQLite integrity check: ${health.integrityCheckResult}` }))
    }
    if (health.foreignKeyViolationCount > 0) {
      issues.push(createIssue({ code: 'FOREIGN_KEY', message: `Foreign key xatolari: ${health.foreignKeyViolationCount} ta.` }))
    }

    const products = database.prepare('SELECT id, current_balance_milli FROM products ORDER BY id ASC').all() as ProductBalanceRow[]
    const balances = new Map(products.map((product) => [product.id, 0]))
    const movements = new StockMovementRepository(database).listForReplay(products.map((product) => product.id))

    for (const movement of movements) {
      const currentBalance = balances.get(movement.product_id) ?? 0
      const expectedBalance = movement.type === 'IN'
        ? currentBalance + movement.quantity_milli
        : currentBalance - movement.quantity_milli

      if (expectedBalance < 0) {
        issues.push(createIssue({
          code: 'NEGATIVE_LEDGER_BALANCE',
          productId: movement.product_id,
          movementId: movement.id,
          expectedMilli: expectedBalance,
          actualMilli: movement.balance_after_milli,
          message: `Movement #${movement.id} dan keyin product #${movement.product_id} qoldig‘i manfiy bo‘ladi.`
        }))
      }
      if (movement.balance_after_milli !== expectedBalance) {
        issues.push(createIssue({
          code: 'BALANCE_AFTER_MISMATCH',
          productId: movement.product_id,
          movementId: movement.id,
          expectedMilli: expectedBalance,
          actualMilli: movement.balance_after_milli,
          message: `Movement #${movement.id} balance_after qiymati ledger replay bilan mos emas.`
        }))
      }
      balances.set(movement.product_id, expectedBalance)
    }

    for (const product of products) {
      const expectedBalance = balances.get(product.id) ?? 0
      if (product.current_balance_milli !== expectedBalance) {
        issues.push(createIssue({
          code: 'CURRENT_BALANCE_MISMATCH',
          productId: product.id,
          expectedMilli: expectedBalance,
          actualMilli: product.current_balance_milli,
          message: `Product #${product.id} current balance qiymati ledger replay bilan mos emas.`
        }))
      }
    }

    const movementCount = (database.prepare('SELECT COUNT(*) AS count FROM stock_movements').get() as CountRow).count
    return { isHealthy: issues.length === 0, checkedAtUtc: new Date().toISOString(), productCount: products.length, movementCount, issues }
  }
}

export const stockIntegrityService = new StockIntegrityService()
