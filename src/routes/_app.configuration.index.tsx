import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/configuration/')({
  staticData: {
    title: 'Configuration',
    subtitle: 'Manage portal-wide workflow and onboarding settings.',
  },
  beforeLoad: () => {
    throw redirect({
      to: '/configuration/limits-and-mdr',
      replace: true,
    })
  },
})
