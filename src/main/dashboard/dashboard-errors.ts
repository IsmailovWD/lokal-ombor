import type { DashboardErrorCode } from '@shared/contracts/app.contract'

export class DashboardServiceError extends Error {
  public constructor(public readonly code: DashboardErrorCode, message: string) {
    super(message)
    this.name = 'DashboardServiceError'
  }
}
