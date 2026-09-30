import { UnitServiceError } from './unit-errors'

export interface NormalizedUnitInput {
  readonly name: string
  readonly shortName: string
  readonly nameNormalized: string
  readonly shortNameNormalized: string
}

function normalizeDisplayValue(value: string, fieldLabel: string): string {
  if (typeof value !== 'string') {
    throw new UnitServiceError('UNIT_VALIDATION', `${fieldLabel} matn bo‘lishi kerak.`)
  }

  const normalized = value.trim().normalize('NFC')

  if (normalized.length === 0) {
    throw new UnitServiceError('UNIT_VALIDATION', `${fieldLabel} bo‘sh bo‘lishi mumkin emas.`)
  }

  return normalized
}

export function normalizeUnitInput(input: { readonly name: string; readonly shortName: string }): NormalizedUnitInput {
  const name = normalizeDisplayValue(input.name, 'Birlik nomi')
  const shortName = normalizeDisplayValue(input.shortName, 'Qisqartma')

  return {
    name,
    shortName,
    nameNormalized: name.toLowerCase(),
    shortNameNormalized: shortName.toLowerCase()
  }
}
