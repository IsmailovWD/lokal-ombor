import {
  ActionIcon,
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
  Title,
  Tooltip
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'

import type { StockInListResult, StockMovement, StockProductOption } from '@shared/contracts/app.contract'
import { formatMilli, parseNonNegativeMilli } from '@shared/quantity'

interface StockInFormValues {
  productId: string
  quantity: string
  occurredAt: string
  note: string
}

const pageSize = 10

function toDateTimeLocal(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

function notifyError(error: { readonly message: string }): void {
  notifications.show({ color: 'red', title: 'Amal bajarilmadi', message: error.message })
}

export function StockInPage() {
  const [products, setProducts] = useState<readonly StockProductOption[]>([])
  const [listResult, setListResult] = useState<StockInListResult>({ items: [], total: 0, page: 1, pageSize })
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editorMovement, setEditorMovement] = useState<StockMovement | 'create' | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<StockMovement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = editorMovement !== null && editorMovement !== 'create'
  const totalPages = Math.max(1, Math.ceil(listResult.total / pageSize))
  const form = useForm<StockInFormValues>({
    initialValues: { productId: '', quantity: '', occurredAt: toDateTimeLocal(new Date()), note: '' },
    validate: {
      productId: (value) => (value.length === 0 ? 'Mahsulotni tanlang.' : null),
      quantity: (value) => {
        const milli = parseNonNegativeMilli(value)
        return milli === null || milli <= 0 ? 'Musbat, 3 xonagacha kasrli miqdor kiriting.' : null
      },
      occurredAt: (value) => (Number.isNaN(new Date(value).valueOf()) ? 'Sana va vaqtni kiriting.' : null)
    }
  })

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.products.listActiveStockOptions().then((result) => {
      if (!isCurrent) return
      if (result.ok) setProducts(result.data)
      else notifyError(result.error)
    })
    return () => { isCurrent = false }
  }, [refreshKey])

  useEffect(() => {
    let isCurrent = true
    void window.omborApi.stockIn.list({ page, pageSize }).then((result) => {
      if (!isCurrent) return
      if (result.ok) setListResult(result.data)
      else notifyError(result.error)
      setIsLoading(false)
    })
    return () => { isCurrent = false }
  }, [page, refreshKey])

  const productSelectData = useMemo(
    () => products.map((product) => ({ value: String(product.id), label: `${product.name} (${product.unitShortName})` })),
    [products]
  )
  const editorProductData = isEditing && !products.some((product) => product.id === editorMovement.productId)
    ? [{ value: String(editorMovement.productId), label: `${editorMovement.productName} (${editorMovement.unitShortName}) — tarixiy` }, ...productSelectData]
    : productSelectData

  const refresh = (): void => setRefreshKey((key) => key + 1)

  const openCreate = (): void => {
    form.setValues({ productId: '', quantity: '', occurredAt: toDateTimeLocal(new Date()), note: '' })
    form.clearErrors()
    setEditorMovement('create')
  }

  const openEdit = (movement: StockMovement): void => {
    form.setValues({
      productId: String(movement.productId),
      quantity: formatMilli(movement.quantityMilli),
      occurredAt: toDateTimeLocal(new Date(movement.occurredAtUtc)),
      note: movement.note ?? ''
    })
    form.clearErrors()
    setEditorMovement(movement)
  }

  const saveMovement = async (values: StockInFormValues): Promise<void> => {
    const productId = Number(values.productId)
    const quantityMilli = parseNonNegativeMilli(values.quantity)
    const occurredAt = new Date(values.occurredAt)

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      form.setFieldError('productId', 'Mahsulotni tanlang.')
      return
    }
    if (quantityMilli === null || quantityMilli <= 0) {
      form.setFieldError('quantity', 'Musbat, 3 xonagacha kasrli miqdor kiriting.')
      return
    }
    if (Number.isNaN(occurredAt.valueOf())) {
      form.setFieldError('occurredAt', 'Sana va vaqtni kiriting.')
      return
    }

    setIsSubmitting(true)
    const input = { productId, quantityMilli, occurredAtUtc: occurredAt.toISOString(), note: values.note }
    const result = editorMovement !== null && editorMovement !== 'create'
      ? await window.omborApi.stockIn.update({ id: editorMovement.id, ...input })
      : await window.omborApi.stockIn.create(input)
    setIsSubmitting(false)

    if (!result.ok) {
      if (result.error.code === 'STOCK_MOVEMENT_PRODUCT_NOT_FOUND' || result.error.code === 'STOCK_MOVEMENT_PRODUCT_INACTIVE' || result.error.code === 'STOCK_MOVEMENT_UNIT_INACTIVE') {
        form.setFieldError('productId', result.error.message)
      } else {
        notifyError(result.error)
      }
      return
    }

    notifications.show({ color: 'green', title: isEditing ? 'Kirim yangilandi' : 'Kirim saqlandi', message: `“${result.data.productName}” qoldig‘i qayta hisoblandi.` })
    setEditorMovement(null)
    setPage(1)
    refresh()
  }

  const deleteMovement = async (): Promise<void> => {
    if (!deleteCandidate) return
    setIsSubmitting(true)
    const result = await window.omborApi.stockIn.delete({ id: deleteCandidate.id })
    setIsSubmitting(false)
    if (!result.ok) return notifyError(result.error)
    notifications.show({ color: 'green', title: 'Kirim o‘chirildi', message: 'Mahsulot qoldig‘i qayta hisoblandi.' })
    setDeleteCandidate(null)
    refresh()
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div><Title order={1}>Kirim</Title><Text c="dimmed" mt={4}>Omborga kelgan mahsulotlarni qayd qiling.</Text></div>
        <Tooltip label={products.length === 0 ? 'Avval faol mahsulot yarating.' : undefined}>
          <Button onClick={openCreate} disabled={products.length === 0}>Yangi kirim</Button>
        </Tooltip>
      </Group>

      <Paper withBorder radius="md" className="units-table-panel">
        <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead><Table.Tr>
            <Table.Th>Mahsulot</Table.Th><Table.Th>Miqdor</Table.Th><Table.Th>Vaqt</Table.Th><Table.Th>Izoh</Table.Th><Table.Th>Operatsiyadan keyin</Table.Th><Table.Th className="unit-actions-header">Amallar</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {isLoading ? <Table.Tr><Table.Td colSpan={6}><Center py="xl"><Loader size="sm" /></Center></Table.Td></Table.Tr>
              : listResult.items.length === 0 ? <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" py="xl" ta="center">Kirimlar hali yo‘q.</Text></Table.Td></Table.Tr>
                : listResult.items.map((movement) => <Table.Tr key={movement.id}>
                  <Table.Td fw={600}>{movement.productName} <Text component="span" c="dimmed" size="sm">({movement.unitShortName})</Text></Table.Td>
                  <Table.Td>+{formatMilli(movement.quantityMilli)} {movement.unitShortName}</Table.Td>
                  <Table.Td>{formatDateTime(movement.occurredAtUtc)}</Table.Td>
                  <Table.Td>{movement.note ?? '—'}</Table.Td>
                  <Table.Td>{formatMilli(movement.balanceAfterMilli)} {movement.unitShortName}</Table.Td>
                  <Table.Td><Group gap="xs" justify="flex-end" wrap="nowrap"><Button size="compact-sm" variant="subtle" onClick={() => openEdit(movement)}>Tahrirlash</Button><Tooltip label="O‘chirish"><ActionIcon variant="subtle" color="red" aria-label={`${movement.productName} kirimini o‘chirish`} onClick={() => setDeleteCandidate(movement)}>×</ActionIcon></Tooltip></Group></Table.Td>
                </Table.Tr>)}
          </Table.Tbody>
        </Table>
        <Group justify="space-between" p="md" className="units-table-footer"><Text c="dimmed" size="sm">Jami: {listResult.total} ta kirim</Text><Pagination total={totalPages} value={Math.min(page, totalPages)} onChange={setPage} /></Group>
      </Paper>

      <Modal opened={editorMovement !== null} onClose={() => setEditorMovement(null)} title={isEditing ? 'Kirimni tahrirlash' : 'Yangi kirim'} centered>
        <form onSubmit={form.onSubmit(saveMovement)}><Stack>
          <Select label="Mahsulot" placeholder="Mahsulotni tanlang" data={editorProductData} searchable withAsterisk {...form.getInputProps('productId')} />
          <TextInput label="Miqdor" placeholder="Masalan, 10 yoki 10.500" withAsterisk {...form.getInputProps('quantity')} />
          <TextInput label="Sana va vaqt" type="datetime-local" withAsterisk {...form.getInputProps('occurredAt')} />
          <TextInput label="Izoh" placeholder="Ixtiyoriy" {...form.getInputProps('note')} />
          <Text c="dimmed" size="xs">Miqdor musbat bo‘lishi va 3 xonagacha kasrga ega bo‘lishi mumkin. Vaqt database’da UTC’da saqlanadi.</Text>
          <Group justify="flex-end" mt="sm"><Button variant="default" onClick={() => setEditorMovement(null)}>Bekor qilish</Button><Button type="submit" loading={isSubmitting}>{isEditing ? 'Saqlash' : 'Kirimni saqlash'}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={deleteCandidate !== null} onClose={() => setDeleteCandidate(null)} title="Kirimni o‘chirish" centered>
        <Stack><Text>Bu kirimni o‘chirmoqchimisiz?</Text><Text c="dimmed" size="sm">Mahsulot qoldig‘i qayta hisoblanadi. Bu amalni ortga qaytarib bo‘lmaydi.</Text><Group justify="flex-end" mt="sm"><Button variant="default" onClick={() => setDeleteCandidate(null)}>Bekor qilish</Button><Button color="red" loading={isSubmitting} onClick={() => void deleteMovement()}>O‘chirish</Button></Group></Stack>
      </Modal>
    </Stack>
  )
}
