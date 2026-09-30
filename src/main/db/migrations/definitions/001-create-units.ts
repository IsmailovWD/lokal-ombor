import type { MigrationDefinition } from '../migration.types'

export const createUnits: MigrationDefinition = {
  version: 1,
  name: 'create_units',
  up: (database) => {
    database.exec(`
      CREATE TABLE units (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(name) > 0),
        short_name TEXT NOT NULL CHECK (length(short_name) > 0),
        name_normalized TEXT NOT NULL UNIQUE,
        short_name_normalized TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at_utc TEXT NOT NULL,
        updated_at_utc TEXT NOT NULL
      );

      CREATE INDEX idx_units_active_name ON units (is_active, name_normalized);
    `)
  }
}
