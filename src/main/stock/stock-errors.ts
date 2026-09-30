import type { StockMovementErrorCode } from '@shared/contracts/app.contract'

export class StockMovementServiceError extends Error {
  public constructor(
    public readonly code: StockMovementErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'StockMovementServiceError'
  }
}
