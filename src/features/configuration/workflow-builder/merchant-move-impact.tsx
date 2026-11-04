import { Minus, Plus } from 'lucide-react'

import type {
  CaseFlowMerchantMovePreview,
  CaseFlowMerchantMoveRuleChange,
} from '#/schemas/configuration.schema'

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function describeChange(change: CaseFlowMerchantMoveRuleChange) {
  const { kind, sourceQueueName, targetQueueName } = change
  switch (kind) {
    case 'start':
      return `Onboarding submitted → ${targetQueueName}`
    case 'closeTrigger':
      return `${sourceQueueName} closes → ${targetQueueName}`
    case 'closeBlocker':
      return `${targetQueueName} can't close until ${sourceQueueName} closes`
    case 'creationRequirement':
      return `${targetQueueName} can't be created until ${sourceQueueName} closes`
  }
}

function ImpactSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** What moving merchants would change. Shared by publishing and the banner action. */
export function MerchantMoveImpact({
  preview,
  targetLabel,
}: {
  preview: CaseFlowMerchantMovePreview
  targetLabel: string
}) {
  const hasAddedCloseTrigger = preview.sourceVersions.some((version) =>
    version.changes.some(
      (change) => change.type === 'added' && change.kind === 'closeTrigger',
    ),
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 text-sm">
      <ImpactSection title="What changes for them">
        {preview.sourceVersions.map((version) => (
          <div key={version.versionId} className="flex flex-col gap-1">
            {preview.sourceVersions.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                v{version.versionId} (
                {plural(version.merchantCount, 'merchant')})
              </p>
            ) : null}
            {version.changes.length === 0 ? (
              <p className="text-muted-foreground">
                The rules are the same as {targetLabel}.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {version.changes.map((change) => (
                  <li
                    key={`${change.type}:${change.kind}:${change.sourceQueueName}:${change.targetQueueName}`}
                    className="flex items-start gap-1.5"
                  >
                    {change.type === 'removed' ? (
                      <Minus
                        aria-label="Removed"
                        className="mt-0.5 size-3.5 shrink-0 text-destructive"
                      />
                    ) : (
                      <Plus
                        aria-label="Added"
                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                      />
                    )}
                    <span className="min-w-0 wrap-break-word">
                      {describeChange(change)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </ImpactSection>

      <ImpactSection title="Who's affected">
        <ul className="flex flex-col gap-1 tabular-nums">
          <li>{plural(preview.eligibleMerchantCount, 'merchant')} will move</li>
          {preview.stayingMerchantCount > 0 ? (
            <li className="text-muted-foreground">
              {preview.stayingMerchantCount} will stay on their current version
              (terminated or finished)
            </li>
          ) : null}
        </ul>
      </ImpactSection>

      <ImpactSection title="Existing work">
        {preview.openCasesOnRemovedSteps.length === 0 &&
        preview.jobsToCancel.length === 0 ? (
          <p className="text-muted-foreground">
            No open cases or pending jobs are affected.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 tabular-nums">
            {preview.openCasesOnRemovedSteps.map((item) => (
              <li key={item.queueName}>
                {plural(item.caseCount, 'open case')} in {item.queueName} will
                stay open. Close them manually.
              </li>
            ))}
            {preview.jobsToCancel.map((item) => (
              <li key={`${item.sourceQueueName}:${item.targetQueueName}`}>
                {plural(item.jobCount, 'pending job')} for{' '}
                {item.sourceQueueName} → {item.targetQueueName} will be
                cancelled.
              </li>
            ))}
          </ul>
        )}
      </ImpactSection>

      {hasAddedCloseTrigger ? (
        <p className="text-xs text-muted-foreground">
          Added rules won't create cases for source cases that already closed.
          Use Create missing cases for those.
        </p>
      ) : null}
    </div>
  )
}
