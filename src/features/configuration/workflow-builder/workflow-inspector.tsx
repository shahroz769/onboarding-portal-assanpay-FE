import type { ReactNode } from 'react'

import {
  FileCheck2,
  GitBranch,
  Landmark,
  ListRestart,
  Play,
  Trash2,
  Workflow,
} from 'lucide-react'

import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { SectionIcon } from '#/components/section-icon'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

import { queueWorkflowIconClasses } from '#/lib/status-styles'
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

// Destructive actions inside the inspector stay secondary (outline) but read
// as destructive, like the row delete actions on the portal tables.
const DESTRUCTIVE_OUTLINE_CLASSES =
  'text-destructive hover:bg-destructive/10 hover:text-destructive'

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

// ─── Shared pieces ──────────────────────────────────────────────────────────

/** Card heading matching the portal's case-detail panels. */
function InspectorHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
}) {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <TruncatedTooltip
            render={<CardTitle className="truncate" />}
            content={title}
          >
            {title}
          </TruncatedTooltip>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/** Small tinted icon chip for a rule kind. */
function KindChip({
  kind,
  className,
}: {
  kind: WorkflowEdgeKind
  className?: string
}) {
  const Icon = KIND_ICONS[kind]
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md',
        EDGE_KIND_META[kind].chipClass,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  )
}

/** The rule's line style as drawn on the canvas (solid or dashed). */
function KindLineSwatch({ kind }: { kind: WorkflowEdgeKind }) {
  const meta = EDGE_KIND_META[kind]
  return (
    <svg
      className="h-2 w-8 shrink-0"
      viewBox="0 0 32 8"
      aria-hidden="true"
      style={{ color: meta.color }}
    >
      <line
        x1="1"
        y1="4"
        x2="31"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={meta.strokeDasharray}
      />
    </svg>
  )
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
      <InspectorHeading
        icon={
          <SectionIcon icon={KIND_ICONS[edge.data.kind]} tone={meta.tint} />
        }
        title={meta.label}
        description={`${sourceName} → ${targetName}`}
      />
      <CardContent className="flex flex-col gap-5">
        {!isStartRule ? (
          <div className="flex flex-col gap-2">
            <SectionLabel>Rule type</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {QUEUE_TO_QUEUE_KINDS.map((kind) => {
                const kindMeta = EDGE_KIND_META[kind]
                const isCurrent = kind === edge.data.kind
                const unavailable =
                  !isCurrent &&
                  getNewEdgeError({
                    edges,
                    nodes,
                    kind,
                    source: edge.source,
                    target: edge.target,
                    ignoreEdgeId: edge.id,
                  }) !== null
                return (
                  <Tooltip key={kind}>
                    {/* Wrapper is the hover target: disabled buttons emit no pointer events */}
                    <TooltipTrigger render={<div className="flex" />}>
                      <button
                        type="button"
                        disabled={unavailable}
                        aria-pressed={isCurrent}
                        onClick={() => onUpdateEdge(edge.id, { kind })}
                        className={cn(
                          'flex flex-1 items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition-colors',
                          isCurrent
                            ? 'border-primary bg-primary/5 font-medium'
                            : 'hover:bg-muted/50',
                          unavailable && 'pointer-events-none opacity-50',
                        )}
                      >
                        <KindChip kind={kind} />
                        <span className="min-w-0 flex-1 truncate">
                          {kindMeta.label}
                        </span>
                        <KindLineSwatch kind={kind} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-60">
                      {unavailable
                        ? 'This relation already exists between these queues.'
                        : kindMeta.description}
                    </TooltipContent>
                  </Tooltip>
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

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`edge-active-${edge.id}`}>Active</Label>
            <p className="text-xs text-muted-foreground">
              Inactive rules stay on the canvas but never fire.
            </p>
          </div>
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

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={DESTRUCTIVE_OUTLINE_CLASSES}
            onClick={() => onDeleteEdge(edge.id)}
          >
            <Trash2 data-icon="inline-start" />
            Delete rule
          </Button>
          {!edge.data.ruleId ? (
            <p className="text-center text-xs text-muted-foreground">
              New rule — saved when you publish the workflow.
            </p>
          ) : null}
        </div>
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
      <InspectorHeading
        icon={
          // Same tint as the queue's workflow badge across the portal.
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tracking-wide uppercase',
              queueWorkflowIconClasses(queue.workflowType),
            )}
          >
            {queue.prefix.slice(0, 3)}
          </span>
        }
        title={queue.name}
        description={
          connectable
            ? `${related.length} rule${related.length === 1 ? '' : 's'}`
            : `Queue is ${queue.lifecycle ?? 'inactive'}`
        }
      />
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
          <div className="flex flex-col gap-2">
            <SectionLabel>Rules</SectionLabel>
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
          </div>
        )}
        {related.length > 0 ? (
          <>
            <Separator />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={DESTRUCTIVE_OUTLINE_CLASSES}
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
      <InspectorHeading
        icon={<SectionIcon icon={Play} tone={EDGE_KIND_META.startRule.tint} />}
        title="Onboarding submitted"
        description="First cases opened on submission"
      />
      <CardContent className="flex flex-col gap-4">
        {startRules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No start rules yet. Drag from this node&apos;s right handle to the
            first queue a merchant should enter.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <SectionLabel>Start rules</SectionLabel>
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
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border bg-card py-1.5 pr-2.5 pl-1.5 text-sm transition-colors hover:bg-muted/50',
        !edge.data.isActive && 'opacity-60',
      )}
    >
      <KindChip kind={edge.data.kind} />
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onSelect}
              className="min-w-0 flex-1 truncate text-left hover:underline hover:decoration-dashed hover:underline-offset-4"
            />
          }
        >
          {describeEdge(edge, perspectiveNodeId, nodes)}
        </TooltipTrigger>
        <TooltipContent>Select this rule on the canvas</TooltipContent>
      </Tooltip>
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
const HANDLE_KINDS = QUEUE_TO_QUEUE_KINDS

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
      <InspectorHeading
        icon={<SectionIcon icon={Workflow} tone="teal" />}
        title="Caseflow builder"
        description={`${queuesInFlow} queue${queuesInFlow === 1 ? '' : 's'} in flow · ${activeCount} active rule${activeCount === 1 ? '' : 's'}`}
      />
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <SectionLabel>How to build</SectionLabel>
          <ol className="flex flex-col gap-2.5 text-sm">
            <HowToStep step={1}>
              Drag from a handle on the right of a node to another queue to
              create a rule. The handle&apos;s color sets the rule type:
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {HANDLE_KINDS.map((kind) => (
                  <span
                    key={kind}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                      EDGE_KIND_META[kind].chipClass,
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        EDGE_KIND_META[kind].handleClass,
                      )}
                    />
                    {EDGE_KIND_META[kind].label}
                  </span>
                ))}
              </span>
            </HowToStep>
            <HowToStep step={2}>
              Drag from &quot;Onboarding submitted&quot; to set the first case.
            </HowToStep>
            <HowToStep step={3}>
              Click any line or node to edit it here. Press Delete to remove a
              selected rule.
            </HowToStep>
          </ol>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <SectionLabel>Legend</SectionLabel>
          <div className="flex flex-col gap-3">
            {(Object.keys(EDGE_KIND_META) as WorkflowEdgeKind[]).map((kind) => (
              <div key={kind} className="flex items-start gap-2.5">
                <KindChip kind={kind} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {EDGE_KIND_META[kind].label}
                    <KindLineSwatch kind={kind} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {EDGE_KIND_META[kind].description}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </>
  )
}

function HowToStep({ step, children }: { step: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
        {step}
      </span>
      <span className="min-w-0 flex-1 text-muted-foreground">{children}</span>
    </li>
  )
}
