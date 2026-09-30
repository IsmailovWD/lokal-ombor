import type { UnitErrorCode } from '@shared/contracts/app.contract'

export class UnitServiceError extends Error {
  public constructor(
    public readonly code: UnitErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'UnitServiceError'
  }
}
