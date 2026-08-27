import { useCallback, useEffect, useRef, useState } from 'react'

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

import { Button } from '#/components/ui/button'

import { Spinner } from '#/components/ui/spinner'

import {
  CASE_FLOW_CONFIGURATION_KEY,
  caseFlowConfigurationQueryOptions,
  isCaseFlowRevisionConflict,
  useUpdateCaseFlowConfigurationMutation,
} from '#/hooks/use-configuration-query'

import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

import { WorkflowBuilderSkeleton } from '../configuration-route-skeleton'
import { ConfigurationActionBar } from '../panels/configuration-panel-shared'

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
  const { data, isPending } = useQuery(caseFlowConfigurationQueryOptions())
  const mutation = useUpdateCaseFlowConfigurationMutation()

  const [base, setBase] = useState<CaseFlowConfiguration | null>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [dirty, setDirty] = useState(false)
  const [staleRevisionOpen, setStaleRevisionOpen] = useState(false)
  const [reloadingStale, setReloadingStale] = useState(false)
  const [backfillTriggerId, setBackfillTriggerId] = useState<string | null>(
    null,
  )

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
  }

  // Sync from the query cache whenever the server config changes and the
  // user has no unsaved edits.
  useEffect(() => {
    if (!data || dirtyRef.current) return
    const current = baseRef.current
    if (
      current &&
      current.revision === data.revision &&
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
  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current))
    },
    [],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowEdge>[]) => {
      if (changes.some((change) => change.type === 'remove')) {
        dirtyRef.current = true
        setDirty(true)
      }
      setEdges((current) => applyEdgeChanges(changes, current))
    },
    [],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
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
      setNodes((current) =>
        current.map((node) => ({ ...node, selected: false })),
      )
      dirtyRef.current = true
      setDirty(true)
    },
    [edges, nodes],
  )

  const isValidConnection = useCallback(
    (connection: Connection | WorkflowEdge) => {
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
    },
    [edges, nodes],
  )

  const handleRelayout = useCallback(() => {
    setNodes((current) => layoutWorkflowGraph(current, edges))
  }, [edges])

  // ─── Inspector callbacks ──────────────────────────────────────────────────
  function handleSelectEdge(edgeId: string) {
    setEdges((current) =>
      current.map((edge) => ({ ...edge, selected: edge.id === edgeId })),
    )
    setNodes((current) => current.map((node) => ({ ...node, selected: false })))
  }

  function handleUpdateEdge(edgeId: string, patch: Partial<WorkflowEdgeData>) {
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
    setEdges((current) => current.filter((edge) => edge.id !== edgeId))
    markDirty()
  }

  function handleDeleteNodeRules(nodeId: string) {
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
    if (!current) return
    const payload = graphToConfig(current, edges)
    try {
      const saved = await mutation.mutateAsync(payload)
      initializeFromConfig(saved)
    } catch (error) {
      if (isCaseFlowRevisionConflict(error)) {
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
    await queryClient
      .invalidateQueries({
        queryKey: CASE_FLOW_CONFIGURATION_KEY,
      })
      .then(() => setStaleRevisionOpen(false))
      .finally(() => setReloadingStale(false))
  }

  if (isPending || !base) {
    return <WorkflowBuilderSkeleton />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="h-[62vh] min-h-[480px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
          <WorkflowCanvas
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
        <WorkflowInspector
          className="shrink-0 xl:w-[320px]"
          nodes={displayNodes}
          edges={edges}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onSelectEdge={handleSelectEdge}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
          onDeleteNodeRules={handleDeleteNodeRules}
          onOpenBackfill={setBackfillTriggerId}
        />
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Fix the errors below</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <ConfigurationActionBar>
        {dirty ? (
          <span className="mr-auto text-sm text-muted-foreground">
            Unsaved changes
          </span>
        ) : null}
        {dirty ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={mutation.isPending}
          >
            <Undo2 data-icon="inline-start" />
            Discard changes
          </Button>
        ) : null}
        <Button
          disabled={mutation.isPending || Boolean(formError) || !dirty}
          onClick={() => void handleSave()}
        >
          {mutation.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Save workflow
        </Button>
      </ConfigurationActionBar>

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
