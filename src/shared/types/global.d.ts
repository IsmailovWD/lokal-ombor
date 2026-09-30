import type { OmborApi } from '@shared/contracts/app.contract'

declare global {
  interface Window {
    omborApi: OmborApi
  }
}

export {}
