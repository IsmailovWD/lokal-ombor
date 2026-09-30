import type { BackupErrorCode } from '@shared/contracts/app.contract'

export class BackupRestoreServiceError extends Error {
  public constructor(public readonly code: BackupErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'BackupRestoreServiceError'
  }
}
