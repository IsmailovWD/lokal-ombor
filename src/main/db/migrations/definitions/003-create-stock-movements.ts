import type { MigrationDefinition } from '../migration.types'

export const createStockMovements: MigrationDefinition = {
  version: 3,
  name: 'create_stock_movements',
  up: (database) => {
    database.exec(`
      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
        quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
        occurred_at_utc TEXT NOT NULL,
        note TEXT,
        balance_after_milli INTEGER NOT NULL CHECK (balance_after_milli >= 0),
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE INDEX idx_stock_movements_product_replay
        ON stock_movements (product_id, occurred_at_utc, created_at_utc, id);
      CREATE INDEX idx_stock_movements_type_occurred
        ON stock_movements (type, occurred_at_utc DESC, created_at_utc DESC, id DESC);
    `)
  }
}
