import { createFileRoute } from '@tanstack/react-router'
import {
  FileText,
  GitBranch,
  ListChecks,
  Mail,
  Send,
  Store,
  Timer,
  Wallet,
  Workflow,
} from 'lucide-react'

import {
  AgreementsPanel,
  CaseFlowRulesPanel,
  CaseTriggeringPanel,
  EmailSendingModePanel,
  LimitsAndMdrPanel,
  LinkDeadlinesPanel,
  MerchantPortalPanel,
  QueuesPanel,
  SubMerchantsPanel,
} from '#/features/configuration/configuration-panels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  caseFlowConfigurationQueryOptions,
  configurationQueryOptions,
} from '#/hooks/use-configuration-query'
import { queuesQueryOptions } from '#/hooks/use-cases-query'
import { merchantOptionsQueryOptions } from '#/hooks/use-merchants-query'

export const Route = createFileRoute('/_app/configuration/')({
  staticData: {
    title: 'Configuration',
    subtitle: 'Manage portal-wide rules, documents, workflow, and emails.',
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(configurationQueryOptions()),
      context.queryClient.ensureQueryData(caseFlowConfigurationQueryOptions()),
      context.queryClient.ensureQueryData(
        queuesQueryOptions({ includeInactive: true }),
      ),
      context.queryClient.ensureQueryData(merchantOptionsQueryOptions()),
    ])
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Tabs defaultValue="limits-and-mdr" className="gap-6">
      <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-3 xl:inline-flex xl:w-fit">
        <TabsTrigger value="limits-and-mdr">
          <Wallet />
          Limits and MDR
        </TabsTrigger>
        <TabsTrigger value="agreements">
          <FileText />
          Agreements
        </TabsTrigger>
        <TabsTrigger value="sub-merchants">
          <Store />
          Sub-Merchants
        </TabsTrigger>
        <TabsTrigger value="queues">
          <Workflow />
          Queues
        </TabsTrigger>
        <TabsTrigger value="case-triggering">
          <ListChecks />
          Case Triggering
        </TabsTrigger>
        <TabsTrigger value="case-flow-rules">
          <GitBranch />
          Case Flow Rules
        </TabsTrigger>
        <TabsTrigger value="link-deadlines">
          <Timer />
          Link Deadlines
        </TabsTrigger>
        <TabsTrigger value="email-sending">
          <Mail />
          Email Sending
        </TabsTrigger>
        <TabsTrigger value="merchant-portal">
          <Send />
          Merchant Portal
        </TabsTrigger>
      </TabsList>

      <TabsContent value="limits-and-mdr">
        <LimitsAndMdrPanel />
      </TabsContent>

      <TabsContent value="agreements">
        <AgreementsPanel />
      </TabsContent>

      <TabsContent value="sub-merchants">
        <SubMerchantsPanel />
      </TabsContent>

      <TabsContent value="queues">
        <QueuesPanel />
      </TabsContent>

      <TabsContent value="case-triggering">
        <CaseTriggeringPanel />
      </TabsContent>

      <TabsContent value="case-flow-rules">
        <CaseFlowRulesPanel />
      </TabsContent>

      <TabsContent value="link-deadlines">
        <LinkDeadlinesPanel />
      </TabsContent>

      <TabsContent value="email-sending">
        <EmailSendingModePanel />
      </TabsContent>

      <TabsContent value="merchant-portal">
        <MerchantPortalPanel />
      </TabsContent>
    </Tabs>
  )
}
