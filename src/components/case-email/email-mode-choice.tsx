import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import type { EmailSendingMode } from '#/schemas/configuration.schema'

interface EmailModeChoiceProps {
  mode: EmailSendingMode
  autoContent: ReactNode
  manualContent: ReactNode
  whatsappContent?: ReactNode
}

type ModeTab = {
  value: string
  label: string
  content: ReactNode
}

export function EmailModeChoice({
  mode,
  autoContent,
  manualContent,
  whatsappContent,
}: EmailModeChoiceProps) {
  const enabledTabs = [
    mode.autoEnabled
      ? { value: 'auto', label: 'Auto (Resend)', content: autoContent }
      : null,
    mode.manualEnabled
      ? { value: 'manual', label: 'Manual (Gmail)', content: manualContent }
      : null,
    whatsappContent
      ? { value: 'whatsapp', label: 'WhatsApp', content: whatsappContent }
      : null,
  ].filter((tab): tab is ModeTab => Boolean(tab))

  if (enabledTabs.length > 1) {
    return (
      <Tabs defaultValue={enabledTabs[0]?.value}>
        <TabsList
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${enabledTabs.length}, minmax(0, 1fr))`,
          }}
        >
          {enabledTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {enabledTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="pt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    )
  }

  return <>{enabledTabs[0]?.content ?? null}</>
}
