import { spawn } from 'node:child_process'
import { error as writeError } from 'node:console'
import process from 'node:process'

const electronViteArguments = process.argv.slice(2)
const environment = { ...process.env }

// Bu o'zgaruvchi Electron'ni desktop runtime o'rniga Node.js sifatida ochadi.
delete environment.ELECTRON_RUN_AS_NODE

const executable = process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite'
const child = spawn(executable, electronViteArguments, {
  cwd: process.cwd(),
  env: environment,
  shell: process.platform === 'win32',
  stdio: 'inherit'
})

child.once('error', (error) => {
  writeError('electron-vite ishga tushmadi.', error)
  process.exitCode = 1
})

child.once('exit', (code) => {
  process.exitCode = code ?? 1
})
