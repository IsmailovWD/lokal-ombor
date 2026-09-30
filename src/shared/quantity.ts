export function parseNonNegativeMilli(value: string): number | null {
  const normalized = value.trim()

  if (normalized.length === 0) {
    return null
  }

  if (!/^\d+(?:[.,]\d{1,3})?$/.test(normalized)) {
    return null
  }

  const [wholePart = '', decimalPart = ''] = normalized.replace(',', '.').split('.')
  const milli = Number(wholePart) * 1000 + Number(decimalPart.padEnd(3, '0'))

  return Number.isSafeInteger(milli) ? milli : null
}

export function formatMilli(value: number): string {
  const whole = Math.trunc(value / 1000)
  const fraction = Math.abs(value % 1000)

  if (fraction === 0) {
    return String(whole)
  }

  return `${whole}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`
}
