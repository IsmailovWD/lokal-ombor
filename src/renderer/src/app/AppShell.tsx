import { AppShell as MantineAppShell, Box, Group, Text } from '@mantine/core'
import { NavLink, Outlet } from 'react-router-dom'

const navigationItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/products', label: 'Mahsulotlar', end: false },
  { to: '/units', label: 'Birliklar', end: false },
  { to: '/stock-in', label: 'Kirim', end: false },
  { to: '/stock-out', label: 'Chiqim', end: false },
  { to: '/history', label: 'Tarix', end: false },
  { to: '/settings', label: 'Sozlamalar', end: false }
] as const

export function ApplicationShell() {
  return (
    <MantineAppShell header={{ height: 64 }} navbar={{ width: 256, breakpoint: 'sm' }} padding="lg">
      <MantineAppShell.Header className="application-header">
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="sm">
            <Box className="brand-mark" aria-hidden="true">O</Box>
            <div>
              <Text fw={800}>Obmor</Text>
              <Text c="dimmed" size="xs">Lokal ombor boshqaruvi</Text>
            </div>
          </Group>
          <Text c="dimmed" size="sm">Phase 15</Text>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="sm" className="application-sidebar">
        <Text c="dimmed" fw={700} px="sm" py="xs" size="xs">
          NAVIGATSIYA
        </Text>
        <Box className="navigation-list">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `navigation-link${isActive ? ' navigation-link-active' : ''}`}
            >
              <span className="navigation-indicator" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </Box>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main className="application-main">
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  )
}
