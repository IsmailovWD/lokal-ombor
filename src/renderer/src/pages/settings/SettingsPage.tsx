import { Alert, Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'

import type { DatabaseRestoreCompleted, IntegrityReport } from '@shared/contracts/app.contract'

type Notice = { readonly color: 'green' | 'red' | 'blue'; readonly message: string } | null

export function SettingsPage() {
  const [isBackupRunning, setIsBackupRunning] = useState(false)
  const [isRestoreRunning, setIsRestoreRunning] = useState(false)
  const [isRestoreConfirmationOpen, setIsRestoreConfirmationOpen] = useState(false)
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null)
  const [isIntegrityLoading, setIsIntegrityLoading] = useState(false)
  const [isRebuildConfirmationOpen, setIsRebuildConfirmationOpen] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const createBackup = async (): Promise<void> => {
    setIsBackupRunning(true)
    setNotice(null)
    try {
      const result = await window.omborApi.backup.create()
      if (!result.ok) setNotice({ color: 'red', message: result.error.message })
      else if (result.data) setNotice({ color: 'green', message: `Backup saqlandi: ${result.data.fileName}` })
    } catch {
      setNotice({ color: 'red', message: 'Backup yaratib bo‘lmadi. Qayta urinib ko‘ring.' })
    } finally {
      setIsBackupRunning(false)
    }
  }

  const restoreBackup = async (): Promise<void> => {
    setIsRestoreConfirmationOpen(false)
    setIsRestoreRunning(true)
    setNotice(null)
    try {
      const result = await window.omborApi.backup.restore()
      if (!result.ok) {
        setNotice({ color: 'red', message: result.error.message })
      } else if (result.data) {
        const restore = result.data as DatabaseRestoreCompleted
        setNotice({ color: 'green', message: `Tiklash tugadi. Safety backup: ${restore.safetyBackupFileName}. Ilova yangilanmoqda…` })
        window.setTimeout(() => window.location.reload(), 900)
      }
    } catch {
      setNotice({ color: 'red', message: 'Backup’dan tiklash bajarilmadi. Joriy database saqlab qolindi.' })
    } finally {
      setIsRestoreRunning(false)
    }
  }

  const checkIntegrity = async (): Promise<void> => {
    setIsIntegrityLoading(true)
    setNotice(null)
    try {
      const result = await window.omborApi.integrity.check()
      if (!result.ok) setNotice({ color: 'red', message: result.error.message })
      else setIntegrityReport(result.data)
    } catch {
      setNotice({ color: 'red', message: 'Database integrity tekshiruvini bajarib bo‘lmadi. Qayta urinib ko‘ring.' })
    } finally {
      setIsIntegrityLoading(false)
    }
  }

  const rebuildBalances = async (): Promise<void> => {
    setIsRebuildConfirmationOpen(false)
    setIsIntegrityLoading(true)
    setNotice(null)
    try {
      const result = await window.omborApi.integrity.rebuildStockBalances()
      if (!result.ok) setNotice({ color: 'red', message: result.error.message })
      else {
        setIntegrityReport(result.data)
        setNotice({ color: 'green', message: 'Qoldiqlar ledger asosida qayta hisoblandi.' })
      }
    } catch {
      setNotice({ color: 'red', message: 'Qoldiqlarni qayta hisoblab bo‘lmadi.' })
    } finally {
      setIsIntegrityLoading(false)
    }
  }

  return (
    <Stack gap="lg">
      <div>
        <Text c="green.7" fw={700} size="sm">MA’LUMOTLAR XAVFSIZLIGI</Text>
        <Title order={1}>Sozlamalar</Title>
        <Text c="dimmed">Lokal database backup va restore boshqaruvi.</Text>
      </div>

      {notice ? <Alert color={notice.color}>{notice.message}</Alert> : null}

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700}>Database integrity</Text>
              <Text c="dimmed" size="sm">SQLite, foreign key, movement ledger va cached qoldiqlar tekshiriladi.</Text>
            </div>
            <Group>
              <Button variant="light" onClick={() => void checkIntegrity()} loading={isIntegrityLoading}>Tekshirish</Button>
              <Button color="orange" variant="light" disabled={!integrityReport || integrityReport.isHealthy || isIntegrityLoading} onClick={() => setIsRebuildConfirmationOpen(true)}>Qoldiqlarni qayta hisoblash</Button>
            </Group>
          </Group>
          {integrityReport ? (
            <Alert color={integrityReport.isHealthy ? 'green' : 'orange'} title={integrityReport.isHealthy ? 'Database sog‘lom' : 'Nomuvofiqlik aniqlandi'}>
              <Stack gap="xs">
                <Text size="sm">{integrityReport.productCount} mahsulot, {integrityReport.movementCount} movement tekshirildi.</Text>
                {!integrityReport.isHealthy ? integrityReport.issues.slice(0, 10).map((issue, index) => <Text key={`${issue.code}-${issue.productId ?? 'database'}-${issue.movementId ?? index}`} size="sm">• {issue.message}</Text>) : null}
                {integrityReport.issues.length > 10 ? <Text size="sm">Yana {integrityReport.issues.length - 10} ta muammo bor.</Text> : null}
              </Stack>
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <div>
            <Text fw={700}>Backup yaratish</Text>
            <Text c="dimmed" size="sm">SQLite snapshot xavfsiz olinadi. Saqlash joyini native dialog orqali o‘zingiz tanlaysiz.</Text>
          </div>
          <Group><Button onClick={() => void createBackup()} loading={isBackupRunning}>Backup yaratish</Button></Group>
        </Stack>
      </Paper>

      <Paper withBorder radius="lg" p="lg">
        <Stack gap="sm">
          <div>
            <Text fw={700}>Backup’dan tiklash</Text>
            <Text c="dimmed" size="sm">Tiklashdan oldin joriy database avtomatik safety backup sifatida saqlanadi.</Text>
          </div>
          <Group><Button color="orange" variant="light" onClick={() => setIsRestoreConfirmationOpen(true)} loading={isRestoreRunning}>Backup’ni tiklash</Button></Group>
        </Stack>
      </Paper>

      <Modal opened={isRestoreConfirmationOpen} onClose={() => setIsRestoreConfirmationOpen(false)} title="Backup’dan tiklash" centered>
        <Stack>
          <Text size="sm">Tanlangan backup joriy database o‘rniga tiklanadi. Davom etishdan oldin joriy ma’lumotlar avtomatik safety backup sifatida saqlanadi.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsRestoreConfirmationOpen(false)}>Bekor qilish</Button>
            <Button color="orange" onClick={() => void restoreBackup()}>Davom etish</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isRebuildConfirmationOpen} onClose={() => setIsRebuildConfirmationOpen(false)} title="Qoldiqlarni qayta hisoblash" centered>
        <Stack>
          <Text size="sm">Barcha movementlar tarixiy tartibda replay qilinadi va `balance_after` hamda joriy qoldiq qiymatlari yangilanadi. Agar manfiy tarixiy qoldiq aniqlansa, hech qanday o‘zgarish saqlanmaydi.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsRebuildConfirmationOpen(false)}>Bekor qilish</Button>
            <Button color="orange" onClick={() => void rebuildBalances()}>Qayta hisoblash</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
