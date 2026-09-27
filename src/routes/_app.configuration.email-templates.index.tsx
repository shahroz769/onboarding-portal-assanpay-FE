import { createFileRoute, redirect } from '@tanstack/react-router'
import * as z from 'zod'

import { EMAIL_TEMPLATE_TABS } from '#/features/configuration/email-template-tabs'

// `template` is from the first version of this page, which picked the email
// with `?template=<key>`; old links still land on the right one.
const emailTemplatesSearchSchema = z.object({
  template: z.string().optional(),
})

export const Route = createFileRoute('/_app/configuration/email-templates/')({
  validateSearch: emailTemplatesSearchSchema,
  beforeLoad: ({ search }) => {
    const template = EMAIL_TEMPLATE_TABS.find(
      (item) => item.key === search.template,
    )
    throw redirect({
      to: '/configuration/email-templates/$templateKey',
      params: { templateKey: (template ?? EMAIL_TEMPLATE_TABS[0]).key },
      replace: true,
    })
  },
})
