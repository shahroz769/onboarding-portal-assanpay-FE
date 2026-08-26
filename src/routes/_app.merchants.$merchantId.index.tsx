import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/merchants/$merchantId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/merchants/$merchantId/overview',
      params: { merchantId: params.merchantId },
      replace: true,
    })
  },
})
