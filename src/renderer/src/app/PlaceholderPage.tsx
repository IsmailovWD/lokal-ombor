import { Paper, Stack, Text, Title } from '@mantine/core'

interface PlaceholderPageProps {
  readonly title: string
  readonly description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Paper withBorder radius="lg" p="xl" className="placeholder-page">
      <Stack gap="xs">
        <Text c="green.7" fw={700} size="sm">
          Phase 2 foundation
        </Text>
        <Title order={1}>{title}</Title>
        <Text c="dimmed" maw={640}>
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}
