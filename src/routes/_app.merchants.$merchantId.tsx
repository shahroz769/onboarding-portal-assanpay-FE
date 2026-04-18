import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/merchants/$merchantId')({
  staticData: {
    title: 'Merchant Details',
    subtitle: 'View merchant information.',
  },
  component: MerchantDetailsRoute,
})

function MerchantDetailsRoute() {
  return <div />
}
