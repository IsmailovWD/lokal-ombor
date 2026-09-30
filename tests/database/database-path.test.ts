import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { databaseFileName, getDatabasePath } from '../../src/main/db/database-path'

describe('database path', () => {
  it('userData ichida tasdiqlangan database fayl nomini ishlatadi', () => {
    expect(databaseFileName).toBe('ombor_lokal.sqlite')
    expect(getDatabasePath('/tmp/ombor-user-data')).toBe(join('/tmp/ombor-user-data', 'ombor_lokal.sqlite'))
  })
})
