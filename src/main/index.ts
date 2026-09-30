import { app, BrowserWindow, dialog, session } from 'electron'
import { join } from 'node:path'

import { getStableUserDataPath } from './app-paths'
import { registerAppIpcHandlers } from './ipc/app.ipc'
import { databaseManager } from './db/database'
import { getDatabasePath } from './db/database-path'
import { registerAppProtocol } from './protocol/app-protocol'
import { configureSessionSecurity } from './security/session-security'
import { createMainWindow } from './windows/main-window'

function configureWebContentsSecurity(): void {
  app.on('web-contents-created', (_event, webContents) => {
    webContents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })
}

async function bootstrap(): Promise<void> {
  app.setName('Obmor')
  app.setPath('userData', getStableUserDataPath(app.getPath('appData')))
  app.setAppUserModelId('uz.ombor.desktop')

  await app.whenReady()

  databaseManager.initialize({
    databasePath: getDatabasePath(app.getPath('userData'))
  })
  registerAppProtocol(join(__dirname, '../renderer'))
  configureSessionSecurity(session.defaultSession)
  configureWebContentsSecurity()
  registerAppIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
}

void bootstrap().catch((error: unknown) => {
  console.error('Obmor ishga tushmadi.', error)
  dialog.showErrorBox('Obmor ishga tushmadi', 'Lokal database ishga tushmadi. Ilova xavfsizlik sabab ochilmadi.')
  app.quit()
})

app.on('before-quit', () => {
  databaseManager.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
