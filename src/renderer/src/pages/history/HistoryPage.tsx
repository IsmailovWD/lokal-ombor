import { Badge, Button, Center, Group, Loader, Pagination, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'

import type { HistoryFilterOptions, HistoryListQuery, HistoryListResult, HistorySortField, SortDirection } from '@shared/contracts/app.contract'
import { formatMilli } from '@shared/quantity'

const pageSize = 25
const initialQuery: HistoryListQuery = {
  search: '', type: 'all', productId: null, unitId: null, fromUtc: null, toUtcExclusive: null,
  sort: 'occurredAtUtc', direction: 'desc', page: 1, pageSize
}

function localDateStartToUtc(value: string): string | null {
  if (value.length === 0) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function localDateEndExclusiveToUtc(value: string): string | null {
  if (value.length === 0) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.valueOf())) return null
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uz-Latn-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function notifyError(error: { readonly message: string }): void {
  notifications.show({ color: 'red', title: 'Tarix yuklanmadi', message: error.message })
}

function SortableHeader({ label, field, sort, direction, onSort }: { readonly label: string; readonly field: HistorySortField; readonly sort: HistorySortField; readonly direction: SortDirection; readonly onSort: (field: HistorySortField) => void }) {
  const isCurrent = field === sort
  return <UnstyledButton className="unit-sort-button" onClick={() => onSort(field)}><span>{label}</span><span aria-hidden="true">{isCurrent ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span></UnstyledButton>
}

export function HistoryPage() {
  const [query, setQuery] = useState<HistoryListQuery>(initialQuery)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [debouncedSearch] = useDebouncedValue(query.search, 250)
  const [filterOptions, setFilterOptions] = useState<HistoryFilterOptions>({ products: [], units: [] })
  const [listResult, setListResult] = useState<HistoryListResult>({ items: [], total: 0, page: 1, pageSize })
  const [isLoading, setIsLoading] = useState(true)
  const effectiveQuery = useMemo(() => ({ ...query, search: debouncedSearch }), [debouncedSearch, query])
  const totalPages = Math.max(1, Math.ceil(listResult.total / pageSize))

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.history.getFilterOptions().then((result) => {
      if (!isCurrent) return
      if (result.ok) setFilterOptions(result.data)
      else notifyError(result.error)
    })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.history.list(effectiveQuery).then((result) => {
      if (!isCurrent) return
      if (result.ok) setListResult(result.data)
      else notifyError(result.error)
      setIsLoading(false)
    })
    return () => { isCurrent = false }
  }, [effectiveQuery])

  const productFilterData = [{ value: 'all', label: 'Barcha mahsulotlar' }, ...filterOptions.products.map((product) => ({ value: String(product.id), label: `${product.name} (${product.unitShortName})` }))]
  const unitFilterData = [{ value: 'all', label: 'Barcha birliklar' }, ...filterOptions.units.map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.shortName})` }))]

  const sortBy = (field: HistorySortField): void => setQuery((current) => ({ ...current, sort: field, direction: current.sort === field && current.direction === 'asc' ? 'desc' : 'asc', page: 1 }))
  const resetFilters = (): void => { setFromDate(''); setToDate(''); setQuery(initialQuery) }
  const setDateFilter = (value: string, kind: 'from' | 'to'): void => {
    if (kind === 'from') {
      setFromDate(value)
      setQuery((current) => ({ ...current, fromUtc: localDateStartToUtc(value), page: 1 }))
    } else {
      setToDate(value)
      setQuery((current) => ({ ...current, toUtcExclusive: localDateEndExclusiveToUtc(value), page: 1 }))
    }
  }

  return <Stack gap="lg">
    <Group justify="space-between" align="flex-end"><div><Title order={1}>Tarix</Title><Text c="dimmed" mt={4}>Barcha kirim va chiqim operatsiyalarining o‘zgarmas qaydi.</Text></div><Button variant="default" onClick={resetFilters}>Filterlarni tozalash</Button></Group>
    <Paper withBorder p="md" radius="md"><SimpleGrid cols={{ base: 1, md: 3 }}>
      <TextInput label="Qidirish" placeholder="Mahsulot, SKU, birlik yoki izoh" value={query.search} onChange={(event) => setQuery((current) => ({ ...current, search: event.currentTarget.value, page: 1 }))} />
      <Select label="Operatsiya turi" data={[{ value: 'all', label: 'Barchasi' }, { value: 'IN', label: 'Kirim' }, { value: 'OUT', label: 'Chiqim' }]} value={query.type} onChange={(value) => { if (value === 'all' || value === 'IN' || value === 'OUT') setQuery((current) => ({ ...current, type: value, page: 1 })) }} />
      <Select label="Mahsulot" data={productFilterData} searchable value={query.productId === null ? 'all' : String(query.productId)} onChange={(value) => setQuery((current) => ({ ...current, productId: value && value !== 'all' ? Number(value) : null, page: 1 }))} />
      <Select label="Birlik" data={unitFilterData} searchable value={query.unitId === null ? 'all' : String(query.unitId)} onChange={(value) => setQuery((current) => ({ ...current, unitId: value && value !== 'all' ? Number(value) : null, page: 1 }))} />
      <TextInput label="Boshlanish sanasi" type="date" value={fromDate} onChange={(event) => setDateFilter(event.currentTarget.value, 'from')} />
      <TextInput label="Tugash sanasi" type="date" value={toDate} onChange={(event) => setDateFilter(event.currentTarget.value, 'to')} />
    </SimpleGrid></Paper>
    <Paper withBorder radius="md" className="units-table-panel"><Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th><SortableHeader label="Vaqt" field="occurredAtUtc" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th><Table.Th><SortableHeader label="Turi" field="type" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th><Table.Th><SortableHeader label="Mahsulot" field="productName" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th><Table.Th>Birlik</Table.Th><Table.Th><SortableHeader label="Miqdor" field="quantity" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th><Table.Th>Keyingi qoldiq</Table.Th><Table.Th>Izoh</Table.Th><Table.Th><SortableHeader label="Yaratilgan" field="createdAtUtc" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th></Table.Tr></Table.Thead><Table.Tbody>
      {isLoading ? <Table.Tr><Table.Td colSpan={8}><Center py="xl"><Loader size="sm" /></Center></Table.Td></Table.Tr> : listResult.items.length === 0 ? <Table.Tr><Table.Td colSpan={8}><Text c="dimmed" py="xl" ta="center">Mos tarix yozuvlari topilmadi.</Text></Table.Td></Table.Tr> : listResult.items.map((movement) => <Table.Tr key={movement.id}><Table.Td>{formatDateTime(movement.occurredAtUtc)}</Table.Td><Table.Td><Badge color={movement.type === 'IN' ? 'green' : 'orange'} variant="light">{movement.type === 'IN' ? 'Kirim' : 'Chiqim'}</Badge></Table.Td><Table.Td fw={600}>{movement.productName}</Table.Td><Table.Td>{movement.unitName} ({movement.unitShortName})</Table.Td><Table.Td c={movement.type === 'IN' ? 'green.8' : 'orange.8'}>{movement.type === 'IN' ? '+' : '−'}{formatMilli(movement.quantityMilli)}</Table.Td><Table.Td>{formatMilli(movement.balanceAfterMilli)}</Table.Td><Table.Td>{movement.note ?? '—'}</Table.Td><Table.Td>{formatDateTime(movement.createdAtUtc)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Group justify="space-between" p="md" className="units-table-footer"><Text c="dimmed" size="sm">Jami: {listResult.total} ta operatsiya</Text><Pagination total={totalPages} value={Math.min(query.page, totalPages)} onChange={(page) => setQuery((current) => ({ ...current, page }))} /></Group></Paper>
  </Stack>
}
