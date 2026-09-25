import { useEffect, useRef, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { MarkerType } from '@xyflow/react'

import type { Connection, EdgeChange, NodeChange } from '@xyflow/react'

import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react'

import { Save, Undo2 } from 'lucide-react'

import { useTheme } from 'next-themes'

import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

import { Badge } from '#/components/ui/badge'

import { Button } from '#/components/ui/button'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

import { Field, FieldLabel, FieldSet } from '#/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

import { Spinner } from '#/components/ui/spinner'

import { Textarea } from '#/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'

import {
  caseFlowConfigurationQueryOptions,
  isCaseFlowRevisionConflict,
  useUpdateCaseFlowConfigurationMutation,
} from '#/hooks/use-configuration-query'

import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

import { WorkflowBuilderSkeleton } from '../configuration-route-skeleton'

import { ConfigurationHeaderActions } from '../panels/configuration-panel-shared'

import { CaseFlowBackfillDialog } from './backfill-dialog'

import { WorkflowCanvas } from './workflow-canvas'

import {
  buildWorkflowGraph,
  canonicalizeFlowRules,
  getNewEdgeError,
  graphToConfig,
  makeWorkflowEdge,
  nextRuleOrder,
} from './workflow-graph-mapper'

import type {
  WorkflowEdge,
  WorkflowEdgeData,
  WorkflowNode,
} from './workflow-graph-types'

import {
  EDGE_KIND_META,
  KIND_HANDLES,
  SOURCE_HANDLE_KIND,
} from './workflow-graph-types'

import { WorkflowInspector } from './workflow-inspector'

import { layoutWorkflowGraph } from './workflow-layout'

import { getWorkflowFormError } from './workflow-validation'

export function WorkflowBuilderPanel() {
  const queryClient = useQueryClient()

  const { resolvedTheme } = useTheme()

  const [selectedVersionId, setSelectedVersionId] = useState<
    number | undefined
  >()

  const [changeNote, setChangeNote] = useState('')

  const { data, isPending, isError, refetch } = useQuery(
    caseFlowConfigurationQueryOptions(selectedVersionId),
  )

  const mutation = useUpdateCaseFlowConfigurationMutation()

  const [base, setBase] = useState<CaseFlowConfiguration | null>(null)

  const [nodes, setNodes] = useState<WorkflowNode[]>([])

  const [edges, setEdges] = useState<WorkflowEdge[]>([])

  const [dirty, setDirty] = useState(false)

  const [staleRevisionOpen, setStaleRevisionOpen] = useState(false)

  const [publishOpen, setPublishOpen] = useState(false)

  const [reloadingStale, setReloadingStale] = useState(false)

  const [backfillTriggerId, setBackfillTriggerId] = useState<string | null>(
    null,
  )

  const readOnly = Boolean(base && base.versionId !== base.activeVersionId)

  const dirtyRef = useRef(false)

  const baseRef = useRef<CaseFlowConfiguration | null>(null)

  function markDirty() {
    dirtyRef.current = true

    setDirty(true)
  }

  function initializeFromConfig(config: CaseFlowConfiguration) {
    const graph = buildWorkflowGraph(config)

    baseRef.current = config

    setBase(config)

    setEdges(graph.edges)

    setNodes(layoutWorkflowGraph(graph.nodes, graph.edges))

    dirtyRef.current = false

    setDirty(false)

    setChangeNote('')
  }

  // Sync from the query cache whenever the server config changes and the

  // user has no unsaved edits.

  useEffect(() => {
    if (!data || dirtyRef.current) return

    const current = baseRef.current

    if (
      current &&
      current.revision === data.revision &&
      current.versionId === data.versionId &&
      canonicalizeFlowRules(current) === canonicalizeFlowRules(data)
    ) {
      return
    }

    const graph = buildWorkflowGraph(data)

    baseRef.current = data

    setBase(data)

    setEdges(graph.edges)

    setNodes(layoutWorkflowGraph(graph.nodes, graph.edges))
  }, [data])

  // Keep derived node badges (start-rule count, in-flow styling) in sync

  // with the current edges without disturbing node identity.

  const inFlowIds = new Set<string>()

  for (const edge of edges) {
    inFlowIds.add(edge.source)

    inFlowIds.add(edge.target)
  }

  const activeStartRules = edges.filter(
    (edge) => edge.data.kind === 'startRule' && edge.data.isActive,
  ).length

  const displayNodes = nodes.map((node): WorkflowNode => {
    if (node.type === 'submission') {
      return node.data.startRuleCount === activeStartRules
        ? node
        : { ...node, data: { startRuleCount: activeStartRules } }
    }

    const inFlow = inFlowIds.has(node.id)

    return node.data.inFlow === inFlow
      ? node
      : { ...node, data: { ...node.data, inFlow } }
  })

  const formError = base
    ? getWorkflowFormError(graphToConfig(base, edges))
    : null

  const selectedEdge = edges.find((edge) => edge.selected) ?? null

  const selectedNode = selectedEdge
    ? null
    : (displayNodes.find((node) => node.selected) ?? null)

  // ─── Canvas callbacks ─────────────────────────────────────────────────────

  function handleNodesChange(changes: NodeChange<WorkflowNode>[]) {
    setNodes((current) => applyNodeChanges(changes, current))
  }

  function handleEdgesChange(changes: EdgeChange<WorkflowEdge>[]) {
    if (readOnly || mutation.isPending) {
      setEdges((current) =>
        applyEdgeChanges(
          changes.filter((change) => change.type === 'select'),
          current,
        ),
      )

      return
    }

    if (changes.some((change) => change.type === 'remove')) {
      dirtyRef.current = true

      setDirty(true)
    }

    setEdges((current) => applyEdgeChanges(changes, current))
  }

  function handleConnect(connection: Connection) {
    if (readOnly || mutation.isPending) return

    if (!connection.source || !connection.target) return

    const kind =
      SOURCE_HANDLE_KIND[connection.sourceHandle ?? ''] ?? 'closeTrigger'

    const error = getNewEdgeError({
      edges,

      nodes,

      kind,

      source: connection.source,

      target: connection.target,
    })

    if (error) {
      toast.error(error)

      return
    }

    const needsOrder = kind === 'startRule' || kind === 'closeTrigger'

    const edge = makeWorkflowEdge({
      kind,

      source: connection.source,

      target: connection.target,

      isActive: true,

      ...(needsOrder ? { order: nextRuleOrder(edges, kind) } : {}),
    })

    setEdges((current) => [
      ...current.map((item) => ({ ...item, selected: false })),

      { ...edge, selected: true },
    ])

    setNodes((current) => current.map((node) => ({ ...node, selected: false })))

    dirtyRef.current = true

    setDirty(true)
  }

  function isValidConnection(connection: Connection | WorkflowEdge) {
    if (!connection.source || !connection.target) return false

    const kind =
      SOURCE_HANDLE_KIND[connection.sourceHandle ?? ''] ?? 'closeTrigger'

    return (
      getNewEdgeError({
        edges,

        nodes,

        kind,

        source: connection.source,

        target: connection.target,
      }) === null
    )
  }

  function handleRelayout() {
    setNodes((current) => layoutWorkflowGraph(current, edges))
  }

  // ─── Inspector callbacks ──────────────────────────────────────────────────

  function handleSelectEdge(edgeId: string) {
    setEdges((current) =>
      current.map((edge) => ({ ...edge, selected: edge.id === edgeId })),
    )

    setNodes((current) => current.map((node) => ({ ...node, selected: false })))
  }

  function handleUpdateEdge(edgeId: string, patch: Partial<WorkflowEdgeData>) {
    if (readOnly || mutation.isPending) return

    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== edgeId) return edge

        if (patch.kind && patch.kind !== edge.data.kind) {
          // Kind switch = deactivate the old rule server-side (omitted from

          // its array) and insert a new one (ruleId dropped).

          const kind = patch.kind

          const handles = KIND_HANDLES[kind]

          const needsOrder = kind === 'startRule' || kind === 'closeTrigger'

          return {
            ...edge,

            sourceHandle: handles.source,

            targetHandle: handles.target,

            markerEnd: {
              type: MarkerType.ArrowClosed,

              width: 16,

              height: 16,

              color: EDGE_KIND_META[kind].color,
            },

            data: {
              kind,

              isActive: patch.isActive ?? edge.data.isActive,

              ...(needsOrder
                ? { order: edge.data.order ?? nextRuleOrder(current, kind) }
                : {}),
            },
          }
        }

        return { ...edge, data: { ...edge.data, ...patch } }
      }),
    )

    markDirty()
  }

  function handleDeleteEdge(edgeId: string) {
    if (readOnly || mutation.isPending) return

    setEdges((current) => current.filter((edge) => edge.id !== edgeId))

    markDirty()
  }

  function handleDeleteNodeRules(nodeId: string) {
    if (readOnly || mutation.isPending) return

    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    )

    markDirty()
  }

  // ─── Save / reload ────────────────────────────────────────────────────────

  async function handleSave() {
    const current = baseRef.current

    if (!current || readOnly) return

    const payload = { ...graphToConfig(current, edges), changeNote }

    try {
      const saved = await mutation.mutateAsync(payload)

      setSelectedVersionId(undefined)

      initializeFromConfig(saved)

      setPublishOpen(false)
    } catch (error) {
      if (isCaseFlowRevisionConflict(error)) {
        setPublishOpen(false)

        setStaleRevisionOpen(true)
      }
    }
  }

  function handleDiscard() {
    const current = baseRef.current

    if (!current) return

    initializeFromConfig(current)
  }

  async function handleReloadStaleConfig() {
    setReloadingStale(true)

    try {
      const latest = await queryClient.fetchQuery({
        ...caseFlowConfigurationQueryOptions(),
        staleTime: 0,
      })

      setSelectedVersionId(undefined)

      initializeFromConfig(latest)

      setStaleRevisionOpen(false)
    } finally {
      setReloadingStale(false)
    }
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load flow version</AlertTitle>
        <AlertDescription>
          <Button variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (isPending || !base || base.versionId !== data?.versionId) {
    return <WorkflowBuilderSkeleton />
  }

  const publication = base.versions.find(
    (version) => version.id === base.versionId,
  )

  const backfillRuleId =
    readOnly &&
    selectedEdge?.data.kind === 'closeTrigger' &&
    selectedEdge.data.isActive
      ? selectedEdge.data.ruleId
      : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto xl:overflow-hidden">
      <ConfigurationHeaderActions>
        {backfillRuleId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBackfillTriggerId(backfillRuleId)}
          >
            Create missing cases for v{base.versionId}
          </Button>
        ) : null}

        {dirty && !mutation.isPending ? (
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
        ) : null}

        {/* The select is disabled while dirty, so the hover target is a wrapper */}
        <Tooltip disabled={!dirty}>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <Select
              items={base.versions.map((version) => ({
                value: String(version.id),
                label: `v${version.id}${version.id === base.activeVersionId ? ' - Current' : ' - History'} (${new Date(version.publishedAt).toLocaleDateString()})`,
              }))}
              value={String(base.versionId)}
              disabled={dirty || mutation.isPending}
              onValueChange={(value) => {
                setChangeNote('')
                setBackfillTriggerId(null)
                setSelectedVersionId(Number(value))
              }}
            >
              <SelectTrigger
                size="sm"
                className={cn('w-56', dirty && 'pointer-events-none')}
                aria-label="Flow version"
              >
                <SelectValue placeholder="Select flow version" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="end">
                <SelectGroup>
                  {[...base.versions].reverse().map((version) => (
                    <SelectItem key={version.id} value={String(version.id)}>
                      v{version.id}
                      {version.id === base.activeVersionId
                        ? ' - Current'
                        : ' - History'}{' '}
                      ({new Date(version.publishedAt).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </TooltipTrigger>
          <TooltipContent>
            Publish or discard changes to switch versions.
          </TooltipContent>
        </Tooltip>

        {dirty ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDiscard}
            disabled={mutation.isPending}
          >
            <Undo2 data-icon="inline-start" />
            Discard
          </Button>
        ) : null}

        {!readOnly ? (
          <Button
            size="sm"
            disabled={mutation.isPending || Boolean(formError) || !dirty}
            onClick={() => setPublishOpen(true)}
          >
            <Save data-icon="inline-start" />
            Publish new version
          </Button>
        ) : null}
      </ConfigurationHeaderActions>

      <div className="flex min-w-0 shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Badge
          variant={readOnly ? 'outline' : 'secondary'}
          className="shrink-0"
        >
          {readOnly
            ? `v${base.versionId} · Read-only`
            : `v${base.versionId} · Current`}
        </Badge>
        <span className="min-w-0 truncate">
          {readOnly
            ? 'Published rules are read-only. Select the current version to make changes.'
            : 'New submissions use this version. Publishing creates a new version; existing merchants keep theirs.'}
          {publication?.changeNote ? ` — “${publication.changeNote}”` : null}
        </span>
      </div>

      {!readOnly && formError ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>Fix these errors before publishing</AlertTitle>

          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1 xl:flex-row">
        <div className="h-[60vh] min-h-105 min-w-0 overflow-hidden rounded-lg border bg-muted/20 xl:h-auto xl:min-h-0 xl:flex-1">
          <WorkflowCanvas
            readOnly={readOnly || mutation.isPending}

            nodes={displayNodes}

            edges={edges}

            colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}

            onNodesChange={handleNodesChange}

            onEdgesChange={handleEdgesChange}

            onConnect={handleConnect}

            isValidConnection={isValidConnection}

            onRelayout={handleRelayout}
          />
        </div>

        <FieldSet
          disabled={readOnly || mutation.isPending}
          className="min-w-0 shrink-0 xl:min-h-0 xl:w-85 xl:overflow-y-auto"
        >
          <WorkflowInspector
            className="shrink-0"

            nodes={displayNodes}

            edges={edges}

            selectedNode={selectedNode}

            selectedEdge={selectedEdge}

            onSelectEdge={handleSelectEdge}

            onUpdateEdge={handleUpdateEdge}

            onDeleteEdge={handleDeleteEdge}

            onDeleteNodeRules={handleDeleteNodeRules}

            onOpenBackfill={(id) => {
              if (dirty) {
                toast.error(
                  'Publish or discard changes before creating missing cases.',
                )
                return
              }
              setBackfillTriggerId(id)
            }}
          />
        </FieldSet>
      </div>

      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!mutation.isPending) setPublishOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish new version</DialogTitle>

            <DialogDescription>
              New submissions will use the published version. Existing merchants
              keep the version they started on.
            </DialogDescription>
          </DialogHeader>

          <Field data-disabled={mutation.isPending}>
            <FieldLabel htmlFor="flow-change-note">
              Change note (optional)
            </FieldLabel>

            <Textarea
              id="flow-change-note"
              autoFocus
              maxLength={1000}
              value={changeNote}
              disabled={mutation.isPending}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder="What changed in this version?"
            />
          </Field>

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                />
              }
            >
              Cancel
            </DialogClose>

            <Button
              disabled={mutation.isPending || Boolean(formError)}
              onClick={() => void handleSave()}
            >
              {mutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={staleRevisionOpen} onOpenChange={setStaleRevisionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Configuration was updated</AlertDialogTitle>

            <AlertDialogDescription>
              Someone else saved case flow rules while you were editing. Reload
              the latest configuration before making changes. Your unsaved edits
              will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogAction
              disabled={reloadingStale}

              onClick={(event) => {
                event.preventDefault()

                void handleReloadStaleConfig()
              }}
            >
              {reloadingStale ? <Spinner data-icon="inline-start" /> : null}

              {reloadingStale ? 'Reloading' : 'Reload configuration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CaseFlowBackfillDialog
        triggerId={backfillTriggerId}

        onOpenChange={(open) => {
          if (!open) setBackfillTriggerId(null)
        }}
      />
    </div>
  )
}
