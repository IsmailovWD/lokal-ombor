import type { HistoryErrorCode } from '@shared/contracts/app.contract'

export class HistoryServiceError extends Error {
  public constructor(public readonly code: HistoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HistoryServiceError'
  }
}
