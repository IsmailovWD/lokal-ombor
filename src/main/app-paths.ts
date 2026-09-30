import { join } from 'node:path'

// Brend nomi o'zgarsa ham avvalgi lokal database yo'li saqlanadi.
const stableUserDataFolderName = 'Ombor'

export function getStableUserDataPath(appDataDirectory: string): string {
  return join(appDataDirectory, stableUserDataFolderName)
}
