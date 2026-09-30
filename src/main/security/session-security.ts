import type { Session, WebContents } from 'electron'

import { isProductionRendererUrl } from '../protocol/app-protocol'

const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ')

const developmentCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join('; ')

function getDevelopmentOrigin(): string | undefined {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL

  if (!developmentUrl) {
    return undefined
  }

  return new URL(developmentUrl).origin
}

export function isAllowedRendererUrl(url: string): boolean {
  if (isProductionRendererUrl(url)) {
    return true
  }

  try {
    const developmentOrigin = getDevelopmentOrigin()
    return developmentOrigin !== undefined && new URL(url).origin === developmentOrigin
  } catch {
    return false
  }
}

export function assertTrustedRenderer(sender: WebContents): void {
  if (!isAllowedRendererUrl(sender.getURL())) {
    throw new Error('Ruxsat etilmagan IPC jo‘natuvchisi.')
  }
}

export function configureSessionSecurity(session: Session): void {
  session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)

  session.webRequest.onHeadersReceived((details, callback) => {
    const existingHeaders = details.responseHeaders ?? {}

    if (details.resourceType !== 'mainFrame') {
      callback({ responseHeaders: existingHeaders })
      return
    }

    const csp = getDevelopmentOrigin() && details.url.startsWith(getDevelopmentOrigin() ?? '')
      ? developmentCsp
      : productionCsp

    callback({
      responseHeaders: {
        ...existingHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}
