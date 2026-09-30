import { join } from 'node:path'

export const databaseFileName = 'ombor_lokal.sqlite'

export function getDatabasePath(userDataDirectory: string): string {
  return join(userDataDirectory, databaseFileName)
}
