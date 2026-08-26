import type { ReactNode } from 'react'

import {
  FileCheck2,
  GitBranch,
  Landmark,
  ListRestart,
  MousePointer2,
  Play,
  Trash2,
} from 'lucide-react'

import { Button } from '#/components/ui/button'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

import { Separator } from '#/components/ui/separator'

import { Switch } from '#/components/ui/switch'

import { cn } from '#/lib/utils'

import type {
  QueueFlowNode,
  SubmissionFlowNode,
  WorkflowEdge,
  WorkflowEdgeData,
  WorkflowEdgeKind,
  WorkflowNode,
} from './workflow-graph-types'
import {
  EDGE_KIND_META,
  QUEUE_TO_QUEUE_KINDS,
  SUBMISSION_NODE_ID,
} from './workflow-graph-types'
import { getNewEdgeError } from './workflow-graph-mapper'

const KIND_ICONS: Record<WorkflowEdgeKind, typeof Play> = {
  startRule: Play,
  closeTrigger: GitBranch,
  closeBlocker: FileCheck2,
  creationRequirement: Landmark,
}

export function WorkflowInspector({
  className,
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  onSelectEdge,
  onUpdateEdge,
  onDeleteEdge,
  onDeleteNodeRules,
  onOpenBackfill,
}: {
  className?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: WorkflowNode | null
  selectedEdge: WorkflowEdge | null
  onSelectEdge: (edgeId: string) => void
  onUpdateEdge: (edgeId: string, patch: Partial<WorkflowEdgeData>) => void
  onDeleteEdge: (edgeId: string) => void
  onDeleteNodeRules: (nodeId: string) => void
  onOpenBackfill: (ruleId: string) => void
}) {
  return (
    <Card className={className}>
      {selectedEdge ? (
        <EdgeInspector
          edge={selectedEdge}
          nodes={nodes}
          edges={edges}
          onUpdateEdge={onUpdateEdge}
          onDeleteEdge={onDeleteEdge}
          onOpenBackfill={onOpenBackfill}
        />
      ) : selectedNode?.type === 'queue' ? (
        <QueueInspector
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          onSelectEdge={onSelectEdge}
          onUpdateEdge={onUpdateEdge}
          onDeleteNodeRules={onDeleteNodeRules}
        />
      ) : selectedNode?.type === 'submission' ? (
        <SubmissionInspector
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          onSelectEdge={onSelectEdge}
          onUpdateEdge={onUpdateEdge}
        />
      ) : (
        <EmptyInspector nodes={nodes} edges={edges} />
      )}
    </Card>
  )
}

function queueName(nodes: WorkflowNode[], queueId: string) {
  const node = nodes.find((item) => item.id === queueId)
  if (node?.type === 'queue') return node.data.queue.name
  return 'Unknown queue'
}

// ─── Edge inspector ─────────────────────────────────────────────────────────
function EdgeInspector({
  edge,
  nodes,
  edges,
  onUpdateEdge,
  onDeleteEdge,
  onOpenBackfill,
}: {
  edge: WorkflowEdge
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onUpdateEdge: (edgeId: string, patch: Partial<WorkflowEdgeData>) => void
  onDeleteEdge: (edgeId: string) => void
  onOpenBackfill: (ruleId: string) => void
}) {
  const meta = EDGE_KIND_META[edge.data.kind]
  const KindIcon = KIND_ICONS[edge.data.kind]
  const isStartRule = edge.data.kind === 'startRule'
  const hasOrder =
    edge.data.kind === 'startRule' || edge.data.kind === 'closeTrigger'
  const sourceName =
    edge.source === SUBMISSION_NODE_ID
      ? 'Onboarding submitted'
      : queueName(nodes, edge.source)
  const targetName = queueName(nodes, edge.target)

  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md border',
              meta.chipClass,
            )}
          >
            <KindIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{meta.label}</CardTitle>
            <CardDescription className="truncate">
              {sourceName} → {targetName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!isStartRule ? (
          <div className="flex flex-col gap-2">
            <Label>Rule type</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {QUEUE_TO_QUEUE_KINDS.map((kind) => {
                const kindMeta = EDGE_KIND_META[kind]
                const KindOptionIcon = KIND_ICONS[kind]
                const unavailable =
                  kind !== edge.data.kind &&
                  getNewEdgeError({
                    edges,
                    nodes,
                    kind,
                    source: edge.source,
                    target: edge.target,
                    ignoreEdgeId: edge.id,
                  }) !== null
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={unavailable}
                    onClick={() => onUpdateEdge(edge.id, { kind })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      kind === edge.data.kind
                        ? 'border-primary bg-accent font-medium'
                        : 'hover:border-foreground/40',
                      unavailable && 'cursor-not-allowed opacity-50',
                    )}
                    title={
                      unavailable
                        ? 'This relation already exists between these queues.'
                        : kindMeta.description
                    }
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: kindMeta.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {kindMeta.label}
                    </span>
                    <KindOptionIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {hasOrder ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`edge-order-${edge.id}`}>Run order</Label>
            <Input
              id={`edge-order-${edge.id}`}
              type="number"
              min={1}
              step={1}
              value={edge.data.order ?? 1}
              onChange={(event) => {
                const order = Number.parseInt(event.target.value, 10)
                if (Number.isNaN(order) || order < 1) return
                onUpdateEdge(edge.id, { order })
              }}
            />
            <p className="text-xs text-muted-foreground">
              {edge.data.kind === 'startRule'
                ? 'Start rules with lower numbers open first.'
                : 'Triggers with lower numbers open first when several fire.'}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`edge-active-${edge.id}`}>Active</Label>
          <Switch
            id={`edge-active-${edge.id}`}
            checked={edge.data.isActive}
            onCheckedChange={(isActive) => onUpdateEdge(edge.id, { isActive })}
          />
        </div>

        {edge.data.kind === 'closeTrigger' &&
        edge.data.ruleId &&
        edge.data.isActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenBackfill(edge.data.ruleId!)}
          >
            <ListRestart data-icon="inline-start" />
            Create missing cases
          </Button>
        ) : null}

        <Separator />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDeleteEdge(edge.id)}
        >
          <Trash2 data-icon="inline-start" />
          Delete rule
        </Button>
        {!edge.data.ruleId ? (
          <p className="text-xs text-muted-foreground">
            New rule — saved when you save the workflow.
          </p>
        ) : null}
      </CardContent>
    </>
  )
}

// ─── Queue node inspector ───────────────────────────────────────────────────
function QueueInspector({
  node,
  nodes,
  edges,
  onSelectEdge,
  onUpdateEdge,
  onDeleteNodeRules,
}: {
  node: QueueFlowNode
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onSelectEdge: (edgeId: string) => void
  onUpdateEdge: (edgeId: string, patch: Partial<WorkflowEdgeData>) => void
  onDeleteNodeRules: (nodeId: string) => void
}) {
  const { queue, connectable } = node.data
  const related = edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  )
  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {queue.prefix.slice(0, 3)}
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{queue.name}</CardTitle>
            <CardDescription>
              {connectable
                ? `${related.length} rule${related.length === 1 ? '' : 's'}`
                : `Queue is ${queue.lifecycle ?? 'inactive'}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!connectable ? (
          <p className="text-xs text-muted-foreground">
            Draft and inactive queues keep their existing rules but cannot
            receive new connections.
          </p>
        ) : null}
        {related.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Not in the flow yet. Drag from this queue&apos;s right-hand handles
            to another queue to create a rule.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {related.map((edge) => (
              <EdgeRuleRow
                key={edge.id}
                edge={edge}
                perspectiveNodeId={node.id}
                nodes={nodes}
                onSelect={() => onSelectEdge(edge.id)}
                onToggle={(isActive) => onUpdateEdge(edge.id, { isActive })}
              />
            ))}
          </div>
        )}
        {related.length > 0 ? (
          <>
            <Separator />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDeleteNodeRules(node.id)}
            >
              <Trash2 data-icon="inline-start" />
              Remove all rules for this queue
            </Button>
          </>
        ) : null}
      </CardContent>
    </>
  )
}

// ─── Submission node inspector ──────────────────────────────────────────────
function SubmissionInspector({
  node,
  nodes,
  edges,
  onSelectEdge,
  onUpdateEdge,
}: {
  node: SubmissionFlowNode
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onSelectEdge: (edgeId: string) => void
  onUpdateEdge: (edgeId: string, patch: Partial<WorkflowEdgeData>) => void
}) {
  void node
  const startRules = edges
    .filter((edge) => edge.data.kind === 'startRule')
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white dark:bg-emerald-700">
            <Play className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base">Onboarding submitted</CardTitle>
            <CardDescription>
              First cases opened when a merchant submits onboarding.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {startRules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No start rules yet. Drag from this node&apos;s right handle to the
            first queue a merchant should enter.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {startRules.map((edge) => (
              <EdgeRuleRow
                key={edge.id}
                edge={edge}
                perspectiveNodeId={SUBMISSION_NODE_ID}
                nodes={nodes}
                onSelect={() => onSelectEdge(edge.id)}
                onToggle={(isActive) => onUpdateEdge(edge.id, { isActive })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </>
  )
}

// ─── Shared rule row ────────────────────────────────────────────────────────
function EdgeRuleRow({
  edge,
  perspectiveNodeId,
  nodes,
  onSelect,
  onToggle,
}: {
  edge: WorkflowEdge
  perspectiveNodeId: string
  nodes: WorkflowNode[]
  onSelect: () => void
  onToggle: (isActive: boolean) => void
}) {
  const meta = EDGE_KIND_META[edge.data.kind]
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors hover:border-foreground/30',
        !edge.data.isActive && 'opacity-60',
      )}
    >
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate text-left hover:underline"
        title="Select this rule on the canvas"
      >
        {describeEdge(edge, perspectiveNodeId, nodes)}
      </button>
      <Switch
        checked={edge.data.isActive}
        onCheckedChange={onToggle}
        aria-label={edge.data.isActive ? 'Deactivate rule' : 'Activate rule'}
      />
    </div>
  )
}

function describeEdge(
  edge: WorkflowEdge,
  perspectiveNodeId: string,
  nodes: WorkflowNode[],
): string {
  const source = queueName(nodes, edge.source)
  const target = queueName(nodes, edge.target)
  switch (edge.data.kind) {
    case 'startRule':
      return `Opens ${target} on submission · #${edge.data.order ?? 1}`
    case 'closeTrigger':
      return edge.source === perspectiveNodeId
        ? `On close → opens ${target} · #${edge.data.order ?? 1}`
        : `Opened when ${source} closes · #${edge.data.order ?? 1}`
    case 'closeBlocker':
      return edge.target === perspectiveNodeId
        ? `Cannot close until ${source} closes`
        : `Must close before ${target} can close`
    case 'creationRequirement':
      return edge.target === perspectiveNodeId
        ? `Requires ${source} closed before creation`
        : `Required before ${target} can be created`
  }
}

// ─── Empty state (legend + help) ────────────────────────────────────────────
function EmptyInspector({
  nodes,
  edges,
}: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}) {
  const activeCount = edges.filter((edge) => edge.data.isActive).length
  const queuesInFlow = nodes.filter(
    (node) => node.type === 'queue' && node.data.inFlow,
  ).length
  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <MousePointer2 className="size-4 text-muted-foreground" />
          </span>
          <div>
            <CardTitle className="text-base">Caseflow builder</CardTitle>
            <CardDescription>
              {queuesInFlow} queue{queuesInFlow === 1 ? '' : 's'} in flow ·{' '}
              {activeCount} active rule{activeCount === 1 ? '' : 's'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            How to build
          </p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <li>
              Drag from a colored handle on the right of a node to another queue
              to create a rule.
            </li>
            <li>
              Blue handle: close trigger. Amber: close requirement. Violet:
              creation requirement.
            </li>
            <li>
              Drag from &quot;Onboarding submitted&quot; to set the first case.
            </li>
            <li>
              Click any line or node to edit it here. Press Delete to remove a
              selected rule.
            </li>
          </ul>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Legend
          </p>
          <div className="flex flex-col gap-1.5">
            {(
              Object.entries(EDGE_KIND_META) as Array<
                [WorkflowEdgeKind, (typeof EDGE_KIND_META)[WorkflowEdgeKind]]
              >
            ).map(([kind, meta]) => (
              <LegendRow key={kind} kind={kind}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{meta.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                </span>
              </LegendRow>
            ))}
          </div>
        </div>
      </CardContent>
    </>
  )
}

function LegendRow({
  kind,
  children,
}: {
  kind: WorkflowEdgeKind
  children: ReactNode
}) {
  const meta = EDGE_KIND_META[kind]
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-0.5 w-8 shrink-0 rounded-full"
        style={{
          backgroundColor: meta.strokeDasharray ? 'transparent' : meta.color,
          borderTop: meta.strokeDasharray
            ? `2px dashed ${meta.color}`
            : undefined,
        }}
      />
      {children}
    </div>
  )
}
