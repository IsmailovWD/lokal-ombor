function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function listLocalDateKeys(fromUtc: string, toUtcExclusive: string): readonly string[] {
  const end = new Date(toUtcExclusive)
  const cursor = new Date(fromUtc)
  const keys: string[] = []

  while (cursor < end) {
    keys.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return keys
}

export interface LocalPeriodRanges {
  readonly todayFromUtc: string
  readonly todayToUtcExclusive: string
  readonly monthFromUtc: string
  readonly monthToUtcExclusive: string
}

export function getLocalPeriodRanges(toUtcExclusive: string): LocalPeriodRanges {
  const todayTo = new Date(toUtcExclusive)
  const todayFrom = new Date(todayTo)
  todayFrom.setDate(todayFrom.getDate() - 1)
  const monthFrom = new Date(todayFrom.getFullYear(), todayFrom.getMonth(), 1)

  return {
    todayFromUtc: todayFrom.toISOString(),
    todayToUtcExclusive: todayTo.toISOString(),
    monthFromUtc: monthFrom.toISOString(),
    monthToUtcExclusive: todayTo.toISOString()
  }
}
