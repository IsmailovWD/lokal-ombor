import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  UnstyledButton
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { Product, ProductListQuery, ProductListResult, ProductSortField, SortDirection, UnitOption } from '@shared/contracts/app.contract'
import { formatMilli, parseNonNegativeMilli } from '@shared/quantity'

interface ProductFormValues {
  name: string
  sku: string
  note: string
  unitId: string
  minimumStock: string
}

const pageSize = 10
const initialQuery: ProductListQuery = {
  search: '',
  status: 'all',
  unitId: null,
  stockLevel: 'all',
  sort: 'name',
  direction: 'asc',
  page: 1,
  pageSize
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

function notifyError(error: { readonly message: string }): void {
  notifications.show({ color: 'red', title: 'Amal bajarilmadi', message: error.message })
}

function SortableHeader({
  label, field, sort, direction, onSort
}: {
  readonly label: string
  readonly field: ProductSortField
  readonly sort: ProductSortField
  readonly direction: SortDirection
  readonly onSort: (field: ProductSortField) => void
}) {
  const isCurrent = sort === field
  return (
    <UnstyledButton className="unit-sort-button" onClick={() => onSort(field)}>
      <span>{label}</span><span aria-hidden="true">{isCurrent ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
    </UnstyledButton>
  )
}

export function ProductsPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState<ProductListQuery>(() => ({
    ...initialQuery,
    stockLevel: searchParams.get('stockLevel') === 'low' ? 'low' : 'all'
  }))
  const [debouncedSearch] = useDebouncedValue(query.search, 250)
  const [listResult, setListResult] = useState<ProductListResult>({ items: [], total: 0, page: 1, pageSize })
  const [unitOptions, setUnitOptions] = useState<readonly UnitOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editorProduct, setEditorProduct] = useState<Product | 'create' | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const effectiveQuery = useMemo(() => ({ ...query, search: debouncedSearch }), [debouncedSearch, query])
  const totalPages = Math.max(1, Math.ceil(listResult.total / pageSize))
  const isEditing = editorProduct !== null && editorProduct !== 'create'

  const form = useForm<ProductFormValues>({
    initialValues: { name: '', sku: '', note: '', unitId: '', minimumStock: '' },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Mahsulot nomini kiriting.' : null),
      unitId: (value) => (value.length === 0 ? 'Birlikni tanlang.' : null),
      minimumStock: (value) => (value.trim().length > 0 && parseNonNegativeMilli(value) === null ? '0 yoki 3 xonagacha kasrli musbat qiymat kiriting.' : null),
      note: (value) => (value.trim().length > 1000 ? 'Izoh 1000 belgidan oshmasligi kerak.' : null)
    }
  })

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.units.listActiveOptions().then((result) => {
      if (!isCurrent) return
      if (result.ok) setUnitOptions(result.data)
      else notifyError(result.error)
    })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.products.list(effectiveQuery).then((result) => {
      if (!isCurrent) return
      if (result.ok) setListResult(result.data)
      else notifyError(result.error)
      setIsLoading(false)
    })
    return () => { isCurrent = false }
  }, [effectiveQuery, refreshKey])

  const refresh = (): void => setRefreshKey((key) => key + 1)
  const unitSelectData = unitOptions.map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.shortName})` }))
  const filterUnitData = [{ value: 'all', label: 'Barcha birliklar' }, ...unitSelectData]
  const editorUnitData = isEditing && !unitOptions.some((unit) => unit.id === editorProduct.unitId)
    ? [{ value: String(editorProduct.unitId), label: `${editorProduct.unitName} (${editorProduct.unitShortName}) — nofaol` }, ...unitSelectData]
    : unitSelectData

  const openCreate = (): void => {
    form.setValues({ name: '', sku: '', note: '', unitId: '', minimumStock: '' })
    form.clearErrors()
    setEditorProduct('create')
  }

  const openEdit = (product: Product): void => {
    form.setValues({
      name: product.name,
      sku: product.sku ?? '',
      note: product.note ?? '',
      unitId: String(product.unitId),
      minimumStock: product.minimumStockMilli === null ? '' : formatMilli(product.minimumStockMilli)
    })
    form.clearErrors()
    setEditorProduct(product)
  }

  const sortBy = (field: ProductSortField): void => {
    setQuery((current) => ({
      ...current,
      sort: field,
      direction: current.sort === field && current.direction === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }

  const saveProduct = async (values: ProductFormValues): Promise<void> => {
    const minimumStockMilli = parseNonNegativeMilli(values.minimumStock)
    const unitId = Number(values.unitId)

    if (!Number.isSafeInteger(unitId) || unitId <= 0) {
      form.setFieldError('unitId', 'Birlikni tanlang.')
      return
    }

    if (values.minimumStock.trim().length > 0 && minimumStockMilli === null) {
      form.setFieldError('minimumStock', '0 yoki 3 xonagacha kasrli musbat qiymat kiriting.')
      return
    }

    setIsSubmitting(true)
    const input = { name: values.name, sku: values.sku, note: values.note, unitId, minimumStockMilli }
    const result = editorProduct !== null && editorProduct !== 'create'
      ? await window.omborApi.products.update({ id: editorProduct.id, ...input })
      : await window.omborApi.products.create(input)
    setIsSubmitting(false)

    if (!result.ok) {
      if (result.error.code === 'PRODUCT_DUPLICATE_NAME') form.setFieldError('name', result.error.message)
      else if (result.error.code === 'PRODUCT_DUPLICATE_SKU') form.setFieldError('sku', result.error.message)
      else if (result.error.code === 'PRODUCT_UNIT_NOT_FOUND' || result.error.code === 'PRODUCT_UNIT_INACTIVE') form.setFieldError('unitId', result.error.message)
      else notifyError(result.error)
      return
    }

    notifications.show({ color: 'green', title: isEditing ? 'Mahsulot yangilandi' : 'Mahsulot yaratildi', message: `“${result.data.name}” saqlandi.` })
    setEditorProduct(null)
    refresh()
  }

  const setProductActive = async (product: Product, isActive: boolean): Promise<void> => {
    const result = await window.omborApi.products.setActive({ id: product.id, isActive })
    if (!result.ok) return notifyError(result.error)
    notifications.show({ color: 'green', title: isActive ? 'Mahsulot faollashtirildi' : 'Mahsulot nofaol qilindi', message: `“${product.name}” holati yangilandi.` })
    refresh()
  }

  const deleteProduct = async (): Promise<void> => {
    if (!deleteCandidate) return
    setIsSubmitting(true)
    const result = await window.omborApi.products.delete({ id: deleteCandidate.id })
    setIsSubmitting(false)
    if (!result.ok) return notifyError(result.error)
    notifications.show({ color: 'green', title: 'Mahsulot o‘chirildi', message: `“${deleteCandidate.name}” o‘chirildi.` })
    setDeleteCandidate(null)
    refresh()
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div><Title order={1}>Mahsulotlar</Title><Text c="dimmed" mt={4}>Ombordagi mahsulotlar katalogini boshqaring.</Text></div>
        <Tooltip label={unitOptions.length === 0 ? 'Avval faol birlik yarating.' : undefined}>
          <Button onClick={openCreate} disabled={unitOptions.length === 0}>Yangi mahsulot</Button>
        </Tooltip>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="end" grow>
          <TextInput label="Qidirish" placeholder="Nomi yoki SKU" value={query.search} onChange={(event) => setQuery((current) => ({ ...current, search: event.currentTarget.value, page: 1 }))} />
          <Select label="Birligi" data={filterUnitData} value={query.unitId === null ? 'all' : String(query.unitId)} onChange={(value) => setQuery((current) => ({ ...current, unitId: value && value !== 'all' ? Number(value) : null, page: 1 }))} />
          <Select label="Holati" data={[{ value: 'all', label: 'Barchasi' }, { value: 'active', label: 'Faol' }, { value: 'inactive', label: 'Nofaol' }]} value={query.status} onChange={(value) => { if (value === 'all' || value === 'active' || value === 'inactive') setQuery((current) => ({ ...current, status: value, page: 1 })) }} />
          <Select label="Qoldiq holati" data={[{ value: 'all', label: 'Barchasi' }, { value: 'low', label: 'Minimal qoldiq' }]} value={query.stockLevel ?? 'all'} onChange={(value) => { if (value === 'all' || value === 'low') setQuery((current) => ({ ...current, stockLevel: value, page: 1 })) }} />
        </Group>
      </Paper>

      <Paper withBorder radius="md" className="units-table-panel">
        <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead><Table.Tr>
            <Table.Th><SortableHeader label="Nomi" field="name" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th><SortableHeader label="SKU" field="sku" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th>Izoh</Table.Th>
            <Table.Th><SortableHeader label="Birligi" field="unitName" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th><SortableHeader label="Minimal qoldiq" field="minimumStock" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th>Joriy qoldiq</Table.Th>
            <Table.Th><SortableHeader label="Holati" field="status" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th><SortableHeader label="Yaratilgan vaqt" field="createdAtUtc" sort={query.sort} direction={query.direction} onSort={sortBy} /></Table.Th>
            <Table.Th className="unit-actions-header">Amallar</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {isLoading ? <Table.Tr><Table.Td colSpan={9}><Center py="xl"><Loader size="sm" /></Center></Table.Td></Table.Tr>
              : listResult.items.length === 0 ? <Table.Tr><Table.Td colSpan={9}><Text c="dimmed" py="xl" ta="center">Mos mahsulotlar topilmadi.</Text></Table.Td></Table.Tr>
                : listResult.items.map((product) => <Table.Tr key={product.id}>
                  <Table.Td><Group gap="xs"><Text fw={600}>{product.name}</Text>{product.isLowStock ? <Badge color="orange" variant="light">Minimal qoldiq</Badge> : null}</Group></Table.Td>
                  <Table.Td>{product.sku ?? '—'}</Table.Td>
                  <Table.Td>{product.note ? <Tooltip label={product.note}><Text lineClamp={1} maw={170}>{product.note}</Text></Tooltip> : '—'}</Table.Td>
                  <Table.Td>{product.unitName} <Text component="span" c="dimmed" size="sm">({product.unitShortName})</Text></Table.Td>
                  <Table.Td>{product.minimumStockMilli === null ? '—' : `${formatMilli(product.minimumStockMilli)} ${product.unitShortName}`}</Table.Td>
                  <Table.Td {...(product.isLowStock ? { c: 'orange.8', fw: 700 } : {})}>{formatMilli(product.currentBalanceMilli)} {product.unitShortName}</Table.Td>
                  <Table.Td><Badge color={product.isActive ? 'green' : 'gray'} variant="light">{product.isActive ? 'Faol' : 'Nofaol'}</Badge></Table.Td>
                  <Table.Td>{formatDateTime(product.createdAtUtc)}</Table.Td>
                  <Table.Td><Group gap="xs" justify="flex-end" wrap="nowrap">
                    <Button size="compact-sm" variant="subtle" onClick={() => openEdit(product)}>Tahrirlash</Button>
                    <Button size="compact-sm" variant="subtle" color={product.isActive ? 'orange' : 'green'} onClick={() => void setProductActive(product, !product.isActive)}>{product.isActive ? 'Nofaol qilish' : 'Faollashtirish'}</Button>
                    <Tooltip label="O‘chirish"><ActionIcon variant="subtle" color="red" aria-label={`${product.name}ni o‘chirish`} onClick={() => setDeleteCandidate(product)}>×</ActionIcon></Tooltip>
                  </Group></Table.Td>
                </Table.Tr>)}
          </Table.Tbody>
        </Table>
        <Group justify="space-between" p="md" className="units-table-footer"><Text c="dimmed" size="sm">Jami: {listResult.total} ta mahsulot</Text><Pagination total={totalPages} value={Math.min(query.page, totalPages)} onChange={(page) => setQuery((current) => ({ ...current, page }))} /></Group>
      </Paper>

      <Modal opened={editorProduct !== null} onClose={() => setEditorProduct(null)} title={isEditing ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} centered>
        <form onSubmit={form.onSubmit(saveProduct)}><Stack>
          <TextInput label="Mahsulot nomi" placeholder="Masalan, Sement" withAsterisk {...form.getInputProps('name')} />
          <TextInput label="SKU" placeholder="Ixtiyoriy identifikator" {...form.getInputProps('sku')} />
          <Textarea label="Izoh" placeholder="Ixtiyoriy izoh" maxLength={1000} autosize minRows={2} {...form.getInputProps('note')} />
          <Select label="Asosiy birlik" placeholder="Birlikni tanlang" data={editorUnitData} withAsterisk searchable {...form.getInputProps('unitId')} />
          <TextInput label="Minimal qoldiq" placeholder="Masalan, 10 yoki 10.500" {...form.getInputProps('minimumStock')} />
          <Text c="dimmed" size="xs">Minimal qoldiq bo‘sh bo‘lsa nazorat qilinmaydi; 0 alohida, haqiqiy qiymatdir. Qiymat 3 xonagacha kasrli bo‘lishi mumkin.</Text>
          <Group justify="flex-end" mt="sm"><Button variant="default" onClick={() => setEditorProduct(null)}>Bekor qilish</Button><Button type="submit" loading={isSubmitting}>{isEditing ? 'Saqlash' : 'Yaratish'}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={deleteCandidate !== null} onClose={() => setDeleteCandidate(null)} title="Mahsulotni o‘chirish" centered>
        <Stack><Text>{deleteCandidate ? `“${deleteCandidate.name}” mahsulotini o‘chirmoqchimisiz?` : ''}</Text><Text c="dimmed" size="sm">Bu amalni ortga qaytarib bo‘lmaydi.</Text><Group justify="flex-end" mt="sm"><Button variant="default" onClick={() => setDeleteCandidate(null)}>Bekor qilish</Button><Button color="red" loading={isSubmitting} onClick={() => void deleteProduct()}>O‘chirish</Button></Group></Stack>
      </Modal>
    </Stack>
  )
}
