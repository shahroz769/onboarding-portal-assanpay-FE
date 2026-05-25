import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import type { EmailSendingMode } from '#/schemas/configuration.schema'

interface EmailModeChoiceProps {
  mode: EmailSendingMode
  autoContent: React.ReactNode
  manualContent: React.ReactNode
}

export function EmailModeChoice({ mode, autoContent, manualContent }: EmailModeChoiceProps) {
  // Both enabled — show tabs
  if (mode.autoEnabled && mode.manualEnabled) {
    return (
      <Tabs defaultValue="auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="auto">Auto (Resend)</TabsTrigger>
          <TabsTrigger value="manual">Manual (Gmail)</TabsTrigger>
        </TabsList>
        <TabsContent value="auto" className="pt-4">
          {autoContent}
        </TabsContent>
        <TabsContent value="manual" className="pt-4">
          {manualContent}
        </TabsContent>
      </Tabs>
    )
  }

  // Only auto
  if (mode.autoEnabled) {
    return <>{autoContent}</>
  }

  // Only manual
  return <>{manualContent}</>
}
