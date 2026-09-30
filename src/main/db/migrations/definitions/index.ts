import type { MigrationDefinition } from '../migration.types'

import { createUnits } from './001-create-units'
import { createProducts } from './002-create-products'
import { createStockMovements } from './003-create-stock-movements'
import { addProductNote } from './004-add-product-note'

export const migrations: readonly MigrationDefinition[] = [createUnits, createProducts, createStockMovements, addProductNote]
