import type Database from 'better-sqlite3'

import { StockMovementServiceError } from './stock-errors'
import { StockMovementRepository } from './stock-movement-repository'

export function replayProductBalances(database: Database.Database, productIds: readonly number[]): void {
  const uniqueProductIds = [...new Set(productIds)]

  if (uniqueProductIds.length === 0) {
    return
  }

  const repository = new StockMovementRepository(database)
  const balances = new Map(uniqueProductIds.map((productId) => [productId, 0]))
  const placeholders = uniqueProductIds.map(() => '?').join(', ')

  database.prepare(`UPDATE products SET current_balance_milli = 0 WHERE id IN (${placeholders})`).run(...uniqueProductIds)

  for (const movement of repository.listForReplay(uniqueProductIds)) {
    const currentBalance = balances.get(movement.product_id) ?? 0
    const nextBalance = movement.type === 'IN'
      ? currentBalance + movement.quantity_milli
      : currentBalance - movement.quantity_milli

    if (nextBalance < 0) {
      throw new StockMovementServiceError('STOCK_NEGATIVE_BALANCE', 'Bu o‘zgarish natijasida mahsulot qoldig‘i manfiy bo‘lib qoladi.')
    }

    balances.set(movement.product_id, nextBalance)
    repository.setBalanceAfter(movement.id, nextBalance)
  }

  const updateBalance = database.prepare('UPDATE products SET current_balance_milli = ? WHERE id = ?')
  for (const [productId, balance] of balances) {
    updateBalance.run(balance, productId)
  }
}
