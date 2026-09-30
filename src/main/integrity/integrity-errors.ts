import type { IntegrityErrorCode } from '@shared/contracts/app.contract'

export class IntegrityServiceError extends Error {
  public constructor(public readonly code: IntegrityErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'IntegrityServiceError'
  }
}
