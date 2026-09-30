import { BrowserWindow } from 'electron'
import { join } from 'node:path'

import { getRendererProductionUrl } from '../protocol/app-protocol'
import { isAllowedRendererUrl } from '../security/session-security'

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    backgroundColor: '#f8faf8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedRendererUrl(navigationUrl)) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const developmentUrl = process.env.ELECTRON_RENDERER_URL

  if (developmentUrl) {
    void mainWindow.loadURL(developmentUrl)
  } else {
    void mainWindow.loadURL(getRendererProductionUrl())
  }

  return mainWindow
}
