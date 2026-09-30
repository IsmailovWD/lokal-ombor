import { net, protocol } from 'electron'
import { relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const scheme = 'app'
const rendererHost = 'renderer'

protocol.registerSchemesAsPrivileged([
  {
    scheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

function resolveAssetPath(rendererDirectory: string, requestUrl: string): string {
  const request = new URL(requestUrl)

  if (request.protocol !== `${scheme}:` || request.hostname !== rendererHost) {
    throw new Error('Ruxsat etilmagan app:// manzil so‘rovi.')
  }

  const requestedPath = decodeURIComponent(request.pathname)
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^[/\\]+/, '')
  const assetPath = resolve(rendererDirectory, relativePath)
  const relativeToRoot = relative(rendererDirectory, assetPath)

  if (relativeToRoot.startsWith(`..${sep}`) || relativeToRoot === '..') {
    throw new Error('Renderer asset chegarasidan tashqariga chiqish taqiqlangan.')
  }

  return assetPath
}

export function registerAppProtocol(rendererDirectory: string): void {
  protocol.handle(scheme, async (request) => {
    try {
      const assetPath = resolveAssetPath(rendererDirectory, request.url)
      return net.fetch(pathToFileURL(assetPath).toString())
    } catch {
      return new Response('Topilmadi.', { status: 404 })
    }
  })
}

export function getRendererProductionUrl(): string {
  return `${scheme}://${rendererHost}/index.html`
}

export function isProductionRendererUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === `${scheme}:` && parsedUrl.hostname === rendererHost
  } catch {
    return false
  }
}
