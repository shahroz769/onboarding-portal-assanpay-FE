import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import type { QueueRendererProps } from '../queue-registry'

export default function GenericRenderer({ caseDetail }: QueueRendererProps) {
  const stages = caseDetail.stages
  const currentStageId = caseDetail.currentStage?.id

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{caseDetail.queue.name}</CardTitle>
          <CardDescription>
            Generic queue workflow. Use take-ownership, stage advancement,
            comments, and history from the case side panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>
              Workflow:{' '}
              <span className="font-medium text-foreground">
                {caseDetail.queue.workflowType}
              </span>
            </span>
            <span>·</span>
            <span>
              Status:{' '}
              <span className="font-medium text-foreground">
                {caseDetail.case.status}
              </span>
            </span>
            {caseDetail.queue.slaHours != null ? (
              <>
                <span>·</span>
                <span>SLA: {caseDetail.queue.slaHours}h</span>
              </>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Stages</p>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => {
                const isCurrent = stage.id === currentStageId
                return (
                  <Badge
                    key={stage.id}
                    variant={isCurrent ? 'default' : 'outline'}
                  >
                    {stage.order}. {stage.name}
                  </Badge>
                )
              })}
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stages configured for this queue.
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
