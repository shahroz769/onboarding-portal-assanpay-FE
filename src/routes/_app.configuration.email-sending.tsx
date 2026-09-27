import { createFileRoute, redirect } from '@tanstack/react-router'

// Email sending settings moved into a dialog on the Email Templates page;
// old links land there.
export const Route = createFileRoute('/_app/configuration/email-sending')({
  beforeLoad: () => {
    throw redirect({ to: '/configuration/email-templates', replace: true })
  },
})
