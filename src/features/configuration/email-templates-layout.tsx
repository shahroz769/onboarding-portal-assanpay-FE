import { Link, Outlet, useParams } from '@tanstack/react-router'

import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'

import { EMAIL_TEMPLATE_TABS } from './email-template-tabs'
import { ConfigurationHeaderActions } from './panels/configuration-panel-shared'
import { EmailSendingSettingsDialog } from './panels/email-sending-settings-dialog'

/** Every email template as a tab, with the sending settings in the header. */
export function EmailTemplatesLayout() {
  const templateKey = useParams({
    strict: false,
    select: (params) => params.templateKey,
  })

  return (
    <>
      <ConfigurationHeaderActions>
        <EmailSendingSettingsDialog />
      </ConfigurationHeaderActions>
      {/* Same tab motion as the merchant details page (tab-next / tab-prev in
          route-transitions.ts). */}
      <Tabs value={templateKey ?? EMAIL_TEMPLATE_TABS[0].key} className="gap-6">
        <TabsList
          aria-label="Email templates"
          className="grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto sm:grid-cols-3 xl:inline-flex xl:w-fit"
        >
          {EMAIL_TEMPLATE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              nativeButton={false}
              render={
                <Link
                  to="/configuration/email-templates/$templateKey"
                  params={{ templateKey: tab.key }}
                />
              }
            >
              <tab.icon />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div data-vt="tab-panel" className="min-w-0">
          <Outlet />
        </div>
      </Tabs>
    </>
  )
}
