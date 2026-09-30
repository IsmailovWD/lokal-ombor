import type { MigrationDefinition } from '../migration.types'

export const addProductNote: MigrationDefinition = {
  version: 4,
  name: 'add_product_note',
  up: (database) => {
    database.exec('ALTER TABLE products ADD COLUMN note TEXT')
  }
}
