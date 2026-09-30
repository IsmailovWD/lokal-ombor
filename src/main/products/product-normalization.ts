import { ProductServiceError } from './product-errors'

export interface NormalizedProductInput {
  readonly name: string
  readonly nameNormalized: string
  readonly sku: string | null
  readonly skuNormalized: string | null
  readonly note: string | null
}

function normalizeRequired(value: string, fieldLabel: string): string {
  if (typeof value !== 'string') {
    throw new ProductServiceError('PRODUCT_VALIDATION', `${fieldLabel} matn bo‘lishi kerak.`)
  }

  const normalized = value.trim().normalize('NFC')

  if (normalized.length === 0) {
    throw new ProductServiceError('PRODUCT_VALIDATION', `${fieldLabel} bo‘sh bo‘lishi mumkin emas.`)
  }

  return normalized
}

function normalizeOptional(value: string, fieldLabel: string): string | null {
  if (typeof value !== 'string') {
    throw new ProductServiceError('PRODUCT_VALIDATION', `${fieldLabel} matn bo‘lishi kerak.`)
  }

  const normalized = value.trim().normalize('NFC')
  return normalized.length === 0 ? null : normalized
}

function normalizeNote(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }
  const note = normalizeOptional(value, 'Izoh')
  if (note !== null && note.length > 1000) {
    throw new ProductServiceError('PRODUCT_VALIDATION', 'Izoh 1000 belgidan oshmasligi kerak.')
  }

  return note
}

export function normalizeProductInput(input: { readonly name: string; readonly sku: string; readonly note?: string }): NormalizedProductInput {
  const name = normalizeRequired(input.name, 'Mahsulot nomi')
  const sku = normalizeOptional(input.sku, 'SKU')

  return {
    name,
    nameNormalized: name.toLowerCase(),
    sku,
    skuNormalized: sku?.toLowerCase() ?? null,
    note: normalizeNote(input.note)
  }
}
