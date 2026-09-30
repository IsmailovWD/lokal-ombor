import { Alert, Badge, Button, Group, Loader, Pagination, Paper, Select, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'

import type { DashboardOverview, DashboardQuery } from '@shared/contracts/app.contract'
import { formatMilli } from '@shared/quantity'

const stockPageSize = 10

function getThirtyDayQuery(unitId: number | null, stockPage: number): DashboardQuery {
  const to = new Date()
  to.setHours(0, 0, 0, 0)
  to.setDate(to.getDate() + 1)
  const from = new Date(to)
  from.setDate(from.getDate() - 30)

  return { unitId, fromUtc: from.toISOString(), toUtcExclusive: to.toISOString(), stockPage, stockPageSize }
}

function formatDateLabel(dateLocal: string): string {
  return new Date(`${dateLocal}T00:00:00`).toLocaleDateString('uz-Latn-UZ', { day: '2-digit', month: 'short' })
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

function DashboardMetric({ label, value, description }: { readonly label: string; readonly value: string | number; readonly description?: string }) {
  return (
    <Paper withBorder radius="lg" p="lg">
      <Text c="dimmed" size="sm">{label}</Text>
      <Text fw={700} size="xl">{value}</Text>
      {description ? <Text c="dimmed" size="xs" mt={4}>{description}</Text> : null}
    </Paper>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [unitId, setUnitId] = useState<number | null>(null)
  const [stockPage, setStockPage] = useState(1)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const request = useMemo(() => getThirtyDayQuery(unitId, stockPage), [unitId, stockPage])

  const loadOverview = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    const result = await window.omborApi.dashboard.getOverview(request)
    if (!result.ok) {
      setOverview(null)
      setError(result.error.message)
    } else {
      setOverview(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    let isCurrent = true

    void window.omborApi.dashboard.getOverview(request)
      .then((result) => {
        if (!isCurrent) return
        if (!result.ok) {
          setOverview(null)
          setError(result.error.message)
        } else {
          setOverview(result.data)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!isCurrent) return
        setOverview(null)
        setError('Dashboard ma’lumotlarini yuklab bo‘lmadi. Qayta urinib ko‘ring.')
        setIsLoading(false)
      })

    return () => { isCurrent = false }
  }, [request])

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <div>
          <Text c="green.7" fw={700} size="sm">OMBOR BOSHQARUVI</Text>
          <Title order={1}>Dashboard</Title>
          <Text c="dimmed">Oxirgi 30 kun bo‘yicha ombor ko‘rinishi.</Text>
        </div>
        <Button variant="light" onClick={() => void loadOverview()} loading={isLoading}>Yangilash</Button>
      </Group>

      {error ? <Alert color="red" title="Yuklash xatosi">{error}</Alert> : null}
      {isLoading && !overview ? <Group gap="xs"><Loader size="sm" /><Text c="dimmed">Dashboard yuklanmoqda…</Text></Group> : null}

      {overview ? (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <DashboardMetric label="Faol mahsulotlar" value={overview.activeProductCount} />
            <DashboardMetric label="Faol birliklar" value={overview.activeUnitCount} />
            <DashboardMetric label="Minimal qoldiq warning" value={overview.lowStockProductCount} />
            <DashboardMetric label="Bugungi kirim" value={overview.todayInMovementCount} description="Operatsiyalar soni" />
            <DashboardMetric label="Bugungi chiqim" value={overview.todayOutMovementCount} description="Operatsiyalar soni" />
            <DashboardMetric label="Oylik kirim" value={overview.monthInMovementCount} description="Operatsiyalar soni" />
            <DashboardMetric label="Oylik chiqim" value={overview.monthOutMovementCount} description="Operatsiyalar soni" />
          </SimpleGrid>

          <Paper withBorder radius="lg" p="lg">
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={700}>Minimal qoldiq ogohlantirishlari</Text>
                  <Text c="dimmed" size="sm">Faol mahsulotlarda limitga teng yoki undan past qoldiq.</Text>
                </div>
                <Button variant="light" onClick={() => navigate('/products?stockLevel=low')}>Barchasini ko‘rish</Button>
              </Group>
              {overview.lowStockProducts.length === 0 ? <Text c="dimmed" size="sm">Hozircha minimal qoldiq ogohlantirishi yo‘q.</Text> : overview.lowStockProducts.map((product) => (
                <Group key={product.id} justify="space-between" wrap="nowrap" className="low-stock-row">
                  <Text fw={600}>{product.name}</Text>
                  <Text c="orange.8" fw={700} size="sm">{formatMilli(product.currentBalanceMilli)} / {formatMilli(product.minimumStockMilli)} {product.unitShortName}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="lg">
            <Stack gap="md">
              <Group justify="space-between" align="end">
                <div>
                  <Text fw={700}>Miqdorlar va harakatlar</Text>
                  <Text c="dimmed" size="sm">Miqdorlar faqat bitta birlik doirasida ko‘rsatiladi.</Text>
                </div>
                <Select
                  label="Birlik"
                  placeholder="Barchasi"
                  clearable
                  data={overview.unitOptions.map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.shortName})` }))}
                  value={unitId === null ? null : String(unitId)}
                  onChange={(value) => {
                    setIsLoading(true)
                    setUnitId(value === null ? null : Number(value))
                  }}
                  w={260}
                />
              </Group>

              {overview.selectedUnit && overview.selectedUnitMetrics ? (
                <>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
                    <DashboardMetric label="Joriy qoldiq" value={`${formatMilli(overview.selectedUnitMetrics.currentBalanceMilli)} ${overview.selectedUnit.shortName}`} description="Faol mahsulotlar bo‘yicha" />
                    <DashboardMetric label="Bugungi kirim" value={`${formatMilli(overview.selectedUnitMetrics.todayInMilli)} ${overview.selectedUnit.shortName}`} />
                    <DashboardMetric label="Bugungi chiqim" value={`${formatMilli(overview.selectedUnitMetrics.todayOutMilli)} ${overview.selectedUnit.shortName}`} />
                    <DashboardMetric label="Oylik kirim" value={`${formatMilli(overview.selectedUnitMetrics.monthInMilli)} ${overview.selectedUnit.shortName}`} />
                    <DashboardMetric label="Oylik chiqim" value={`${formatMilli(overview.selectedUnitMetrics.monthOutMilli)} ${overview.selectedUnit.shortName}`} />
                  </SimpleGrid>
                  <div className="dashboard-chart" aria-label="Oxirgi 30 kunlik kirim va chiqim charti">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={overview.dailyVolumes} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="dateLocal" tickFormatter={formatDateLabel} minTickGap={22} />
                        <YAxis tickFormatter={formatMilli} width={52} />
                        <Tooltip
                          labelFormatter={(value) => formatDateLabel(String(value))}
                          formatter={(value) => `${formatMilli(Number(value))} ${overview.selectedUnit?.shortName ?? ''}`}
                        />
                        <Legend formatter={(value) => value === 'inMilli' ? 'Kirim' : 'Chiqim'} />
                        <Bar dataKey="inMilli" name="inMilli" fill="var(--mantine-color-green-6)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outMilli" name="outMilli" fill="var(--mantine-color-orange-5)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <Alert color="blue" title="Birlik tanlanmagan">
                  Turli birliklarni qo‘shib yubormaslik uchun yuqorida faqat operatsiyalar soni chiqadi; miqdorlar va chart birlik tanlangach ko‘rsatiladi.
                </Alert>
              )}
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" className="units-table-panel">
            <Group justify="space-between" p="lg">
              <div><Text fw={700}>Joriy qoldiqlar</Text><Text c="dimmed" size="sm">Faol mahsulotlar qoldig‘i.</Text></div>
              <Button variant="light" onClick={() => navigate('/products')}>Mahsulotlar</Button>
            </Group>
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead><Table.Tr><Table.Th>Mahsulot</Table.Th><Table.Th>SKU</Table.Th><Table.Th>Qoldiq</Table.Th><Table.Th>Birlik</Table.Th><Table.Th>Minimal qoldiq</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {overview.currentStock.items.map((product) => <Table.Tr key={product.id}>
                  <Table.Td fw={600}>{product.name}</Table.Td>
                  <Table.Td>{product.sku ?? '—'}</Table.Td>
                  <Table.Td {...(product.isLowStock ? { c: 'orange.8', fw: 700 } : {})}>{formatMilli(product.currentBalanceMilli)}</Table.Td>
                  <Table.Td>{product.unitShortName}</Table.Td>
                  <Table.Td>{product.minimumStockMilli === null ? '—' : <Group gap="xs"><Text size="sm">{formatMilli(product.minimumStockMilli)}</Text>{product.isLowStock ? <Badge color="orange" variant="light">Warning</Badge> : null}</Group>}</Table.Td>
                </Table.Tr>)}
                {overview.currentStock.items.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" py="lg" ta="center">Faol mahsulot topilmadi.</Text></Table.Td></Table.Tr> : null}
              </Table.Tbody>
            </Table>
            <Group justify="space-between" p="md" className="units-table-footer">
              <Text c="dimmed" size="sm">Jami: {overview.currentStock.total} ta faol mahsulot</Text>
              <Pagination total={Math.max(1, Math.ceil(overview.currentStock.total / stockPageSize))} value={stockPage} onChange={(page) => { setIsLoading(true); setStockPage(page) }} />
            </Group>
          </Paper>

          <Paper withBorder radius="lg" className="units-table-panel">
            <Group justify="space-between" p="lg">
              <div><Text fw={700}>Oxirgi operatsiyalar</Text><Text c="dimmed" size="sm">So‘nggi 5 ta kirim yoki chiqim.</Text></div>
              <Button variant="light" onClick={() => navigate('/history')}>Tarix</Button>
            </Group>
            <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead><Table.Tr><Table.Th>Sana va vaqt</Table.Th><Table.Th>Tur</Table.Th><Table.Th>Mahsulot</Table.Th><Table.Th>Miqdor</Table.Th><Table.Th>Izoh</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {overview.recentMovements.map((movement) => <Table.Tr key={movement.id}>
                  <Table.Td>{formatDateTime(movement.occurredAtUtc)}</Table.Td>
                  <Table.Td><Badge color={movement.type === 'IN' ? 'green' : 'orange'} variant="light">{movement.type === 'IN' ? 'Kirim' : 'Chiqim'}</Badge></Table.Td>
                  <Table.Td fw={600}>{movement.productName}</Table.Td>
                  <Table.Td>{formatMilli(movement.quantityMilli)} {movement.unitShortName}</Table.Td>
                  <Table.Td>{movement.note || '—'}</Table.Td>
                </Table.Tr>)}
                {overview.recentMovements.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" py="lg" ta="center">Hali operatsiyalar yo‘q.</Text></Table.Td></Table.Tr> : null}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      ) : null}
    </Stack>
  )
}
