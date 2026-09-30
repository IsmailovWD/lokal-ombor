import type { ProductErrorCode } from '@shared/contracts/app.contract'

export class ProductServiceError extends Error {
  public constructor(
    public readonly code: ProductErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'ProductServiceError'
  }
}
