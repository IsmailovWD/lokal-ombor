export type DatabaseErrorCode =
  | 'DATABASE_INITIALIZATION_FAILED'
  | 'DATABASE_NOT_INITIALIZED'
  | 'DATABASE_INTEGRITY_FAILED'
  | 'MIGRATION_FAILED'
  | 'MIGRATION_CONFLICT'

export class DatabaseError extends Error {
  public readonly code: DatabaseErrorCode

  public constructor(code: DatabaseErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DatabaseError'
    this.code = code
  }
}
