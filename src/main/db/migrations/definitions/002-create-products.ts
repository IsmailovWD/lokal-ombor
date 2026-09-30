import type { MigrationDefinition } from '../migration.types'

export const createProducts: MigrationDefinition = {
  version: 2,
  name: 'create_products',
  up: (database) => {
    database.exec(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(name) > 0),
        name_normalized TEXT NOT NULL UNIQUE,
        sku TEXT,
        sku_normalized TEXT,
        unit_id INTEGER NOT NULL REFERENCES units(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        minimum_stock_milli INTEGER CHECK (minimum_stock_milli IS NULL OR minimum_stock_milli >= 0),
        current_balance_milli INTEGER NOT NULL DEFAULT 0 CHECK (current_balance_milli >= 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE UNIQUE INDEX idx_products_sku_normalized_unique
        ON products (sku_normalized)
        WHERE sku_normalized IS NOT NULL;

      CREATE INDEX idx_products_active_name ON products (is_active, name_normalized);
      CREATE INDEX idx_products_unit_id ON products (unit_id);
    `)
  }
}
