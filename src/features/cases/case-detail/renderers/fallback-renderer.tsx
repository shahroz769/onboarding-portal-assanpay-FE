import { Card, CardContent } from '#/components/ui/card'
import type { QueueRendererProps } from '../queue-registry'

export default function FallbackRenderer({ caseDetail }: QueueRendererProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground text-center">
          No specialized view configured for the{' '}
          <span className="font-medium">{caseDetail.queue.name}</span> queue.
        </p>
      </CardContent>
    </Card>
  )
}
