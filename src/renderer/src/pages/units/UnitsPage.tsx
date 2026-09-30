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
  Title,
  Tooltip,
  UnstyledButton
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useMemo, useState } from 'react'

import type { SortDirection, Unit, UnitListQuery, UnitListResult, UnitSortField } from '@shared/contracts/app.contract'

interface UnitFormValues {
  name: string
  shortName: string
}

const pageSize = 10
const initialQuery: UnitListQuery = {
  search: '',
  status: 'all',
  sort: 'name',
  direction: 'asc',
  page: 1,
  pageSize
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function errorMessage(error: { readonly message: string }): void {
  notifications.show({ color: 'red', title: 'Amal bajarilmadi', message: error.message })
}

function SortableHeader({
  label,
  field,
  sort,
  direction,
  onSort
}: {
  readonly label: string
  readonly field: UnitSortField
  readonly sort: UnitSortField
  readonly direction: SortDirection
  readonly onSort: (field: UnitSortField) => void
}) {
  const isCurrent = field === sort
  const icon = isCurrent ? (direction === 'asc' ? '↑' : '↓') : '↕'

  return (
    <UnstyledButton className="unit-sort-button" onClick={() => onSort(field)}>
      <span>{label}</span>
      <span aria-hidden="true">{icon}</span>
    </UnstyledButton>
  )
}

export function UnitsPage() {
  const [query, setQuery] = useState<UnitListQuery>(initialQuery)
  const [debouncedSearch] = useDebouncedValue(query.search, 250)
  const [listResult, setListResult] = useState<UnitListResult>({ items: [], total: 0, page: 1, pageSize })
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editorUnit, setEditorUnit] = useState<Unit | 'create' | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Unit | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const effectiveQuery = useMemo(() => ({ ...query, search: debouncedSearch }), [debouncedSearch, query])
  const totalPages = Math.max(1, Math.ceil(listResult.total / pageSize))
  const isEditing = editorUnit !== null && editorUnit !== 'create'

  const form = useForm<UnitFormValues>({
    initialValues: { name: '', shortName: '' },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Birlik nomini kiriting.' : null),
      shortName: (value) => (value.trim().length === 0 ? 'Qisqartmani kiriting.' : null)
    }
  })

  useEffect(() => {
    let isCurrent = true

    void window.omborApi.units.list(effectiveQuery).then((result) => {
      if (!isCurrent) {
        return
      }

      if (result.ok) {
        setListResult(result.data)
      } else {
        errorMessage(result.error)
      }

      setIsLoading(false)
    })

    return () => {
      isCurrent = false
    }
  }, [effectiveQuery, refreshKey])

  const refresh = (): void => setRefreshKey((key) => key + 1)

  const openCreate = (): void => {
    form.setValues({ name: '', shortName: '' })
    form.clearErrors()
    setEditorUnit('create')
  }

  const openEdit = (unit: Unit): void => {
    form.setValues({ name: unit.name, shortName: unit.shortName })
    form.clearErrors()
    setEditorUnit(unit)
  }

  const handleSort = (field: UnitSortField): void => {
    setQuery((current) => ({
      ...current,
      sort: field,
      direction: current.sort === field && current.direction === 'asc' ? 'desc' : 'asc',
      page: 1
    }))
  }

  const saveUnit = async (values: UnitFormValues): Promise<void> => {
    setIsSubmitting(true)
    const result = editorUnit !== null && editorUnit !== 'create'
      ? await window.omborApi.units.update({ id: editorUnit.id, ...values })
      : await window.omborApi.units.create(values)
    setIsSubmitting(false)

    if (!result.ok) {
      if (result.error.code === 'UNIT_DUPLICATE_NAME') {
        form.setFieldError('name', result.error.message)
      } else if (result.error.code === 'UNIT_DUPLICATE_SHORT_NAME') {
        form.setFieldError('shortName', result.error.message)
      } else {
        errorMessage(result.error)
      }
      return
    }

    notifications.show({
      color: 'green',
      title: isEditing ? 'Birlik yangilandi' : 'Birlik yaratildi',
      message: `“${result.data.name}” saqlandi.`
    })
    setEditorUnit(null)
    refresh()
  }

  const setUnitActive = async (unit: Unit, isActive: boolean): Promise<void> => {
    const result = await window.omborApi.units.setActive({ id: unit.id, isActive })

    if (!result.ok) {
      errorMessage(result.error)
      return
    }

    notifications.show({
      color: 'green',
      title: isActive ? 'Birlik faollashtirildi' : 'Birlik nofaol qilindi',
      message: `“${unit.name}” holati yangilandi.`
    })
    refresh()
  }

  const deleteUnit = async (): Promise<void> => {
    if (!deleteCandidate) {
      return
    }

    setIsSubmitting(true)
    const result = await window.omborApi.units.delete({ id: deleteCandidate.id })
    setIsSubmitting(false)

    if (!result.ok) {
      errorMessage(result.error)
      return
    }

    notifications.show({ color: 'green', title: 'Birlik o‘chirildi', message: `“${deleteCandidate.name}” o‘chirildi.` })
    setDeleteCandidate(null)
    refresh()
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Birliklar</Title>
          <Text c="dimmed" mt={4}>Mahsulot miqdorini ifodalash uchun birliklarni boshqaring.</Text>
        </div>
        <Button onClick={openCreate}>Yangi birlik</Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="end" grow>
          <TextInput
            label="Qidirish"
            placeholder="Nomi yoki qisqartmasi"
            value={query.search}
            onChange={(event) => setQuery((current) => ({ ...current, search: event.currentTarget.value, page: 1 }))}
          />
          <Select
            label="Holati"
            data={[
              { value: 'all', label: 'Barchasi' },
              { value: 'active', label: 'Faol' },
              { value: 'inactive', label: 'Nofaol' }
            ]}
            value={query.status}
            onChange={(value) => {
              if (value === 'all' || value === 'active' || value === 'inactive') {
                setQuery((current) => ({ ...current, status: value, page: 1 }))
              }
            }}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="md" className="units-table-panel">
        <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th><SortableHeader label="Nomi" field="name" sort={query.sort} direction={query.direction} onSort={handleSort} /></Table.Th>
              <Table.Th><SortableHeader label="Qisqartmasi" field="shortName" sort={query.sort} direction={query.direction} onSort={handleSort} /></Table.Th>
              <Table.Th><SortableHeader label="Holati" field="status" sort={query.sort} direction={query.direction} onSort={handleSort} /></Table.Th>
              <Table.Th><SortableHeader label="Yaratilgan vaqt" field="createdAtUtc" sort={query.sort} direction={query.direction} onSort={handleSort} /></Table.Th>
              <Table.Th className="unit-actions-header">Amallar</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr><Table.Td colSpan={5}><Center py="xl"><Loader size="sm" /></Center></Table.Td></Table.Tr>
            ) : listResult.items.length === 0 ? (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" py="xl" ta="center">Mos birliklar topilmadi.</Text></Table.Td></Table.Tr>
            ) : listResult.items.map((unit) => (
              <Table.Tr key={unit.id}>
                <Table.Td fw={600}>{unit.name}</Table.Td>
                <Table.Td>{unit.shortName}</Table.Td>
                <Table.Td><Badge color={unit.isActive ? 'green' : 'gray'} variant="light">{unit.isActive ? 'Faol' : 'Nofaol'}</Badge></Table.Td>
                <Table.Td>{formatDateTime(unit.createdAtUtc)}</Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    <Button size="compact-sm" variant="subtle" onClick={() => openEdit(unit)}>Tahrirlash</Button>
                    <Button size="compact-sm" variant="subtle" color={unit.isActive ? 'orange' : 'green'} onClick={() => void setUnitActive(unit, !unit.isActive)}>
                      {unit.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
                    </Button>
                    <Tooltip label="O‘chirish"><ActionIcon variant="subtle" color="red" aria-label={`${unit.name}ni o‘chirish`} onClick={() => setDeleteCandidate(unit)}>×</ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="space-between" p="md" className="units-table-footer">
          <Text c="dimmed" size="sm">Jami: {listResult.total} ta birlik</Text>
          <Pagination total={totalPages} value={Math.min(query.page, totalPages)} onChange={(page) => setQuery((current) => ({ ...current, page }))} />
        </Group>
      </Paper>

      <Modal opened={editorUnit !== null} onClose={() => setEditorUnit(null)} title={isEditing ? 'Birlikni tahrirlash' : 'Yangi birlik'} centered>
        <form onSubmit={form.onSubmit(saveUnit)}>
          <Stack>
            <TextInput label="Birlik nomi" placeholder="Masalan, Kilogramm" withAsterisk {...form.getInputProps('name')} />
            <TextInput label="Qisqartmasi" placeholder="Masalan, kg" withAsterisk {...form.getInputProps('shortName')} />
            <Text c="dimmed" size="xs">Boshlang‘ich va oxirgi bo‘sh joylar saqlanmaydi. Nom va qisqartma katta-kichik harfga sezgir emas.</Text>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditorUnit(null)}>Bekor qilish</Button>
              <Button type="submit" loading={isSubmitting}>{isEditing ? 'Saqlash' : 'Yaratish'}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleteCandidate !== null} onClose={() => setDeleteCandidate(null)} title="Birlikni o‘chirish" centered>
        <Stack>
          <Text>{deleteCandidate ? `“${deleteCandidate.name}” birligini o‘chirmoqchimisiz?` : ''}</Text>
          <Text c="dimmed" size="sm">Bu amalni ortga qaytarib bo‘lmaydi.</Text>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setDeleteCandidate(null)}>Bekor qilish</Button>
            <Button color="red" loading={isSubmitting} onClick={() => void deleteUnit()}>O‘chirish</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
