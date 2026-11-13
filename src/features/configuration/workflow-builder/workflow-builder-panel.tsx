import { useReducer, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { Connection, EdgeChange, NodeChange } from '@xyflow/react'

import { applyEdgeChanges, applyNodeChanges, MarkerType } from '@xyflow/react'

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

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from '#/components/ui/field'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
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
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { cn } from '#/lib/utils'
import { useMorph } from '#/hooks/use-morph'

import {
  caseFlowConfigurationQueryOptions,
  caseFlowDraftMerchantMovePreviewQueryOptions,
  caseFlowMerchantMovePreviewQueryOptions,
  isCaseFlowRevisionConflict,
  useUpdateCaseFlowConfigurationMutation,
} from '#/hooks/use-configuration-query'

import { WorkflowBuilderSkeleton } from '../configuration-route-skeleton'

import { ConfigurationHeaderActions } from '../panels/configuration-panel-shared'

import { CaseFlowBackfillDialog } from './backfill-dialog'

import { MerchantMoveImpact } from './merchant-move-impact'

import { MoveMerchantsDialog } from './move-merchants-dialog'

import { WorkflowCanvas } from './workflow-canvas'

import {
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

import {
  initialWorkflowEditorState,
  isWorkflowReadOnly,
  workflowEditorReducer,
} from './workflow-editor-state'

export function WorkflowBuilderPanel() {
  const queryClient = useQueryClient()

  const { resolvedTheme } = useTheme()

  const [selectedVersionId, setSelectedVersionId] = useState<
    number | undefined
  >()

  const { data, isPending, isError, refetch } = useQuery(
    caseFlowConfigurationQueryOptions(selectedVersionId),
  )

  const mutation = useUpdateCaseFlowConfigurationMutation()

  const [moveOpen, setMoveOpen] = useState(false)

  const moveMorph = useMorph()

  const [editor, dispatch] = useReducer(
    workflowEditorReducer,
    initialWorkflowEditorState,
  )

  const { base, nodes, edges, dirty, changeNote, moveExisting } = editor

  const publishOpen = editor.dialog === 'publish'

  const staleRevisionOpen =
    editor.dialog === 'stale' || editor.dialog === 'reloading'

  const reloadingStale = editor.dialog === 'reloading'
  // Publish and backfill dialogs grow out of the buttons that open them.
  const publishMorph = useMorph()
  const backfillMorph = useMorph()

  const [backfillTriggerId, setBackfillTriggerId] = useState<string | null>(
    null,
  )

  const readOnly = isWorkflowReadOnly(editor)

  const { data: movePreview } = useQuery({
    ...caseFlowMerchantMovePreviewQueryOptions(),
    enabled: Boolean(base) && !readOnly,
  })

  const draftConfig = base && dirty ? graphToConfig(base, edges) : null

  const {
    data: draftMovePreview,
    isPending: draftMovePreviewPending,
    isError: draftMovePreviewFailed,
  } = useQuery({
    ...caseFlowDraftMerchantMovePreviewQueryOptions(
      draftConfig,
      draftConfig ? canonicalizeFlowRules(draftConfig) : '',
    ),
    enabled: publishOpen && Boolean(draftConfig),
  })

  // Server data replaces the graph only while there are no unsaved edits;
  // the reducer decides. Synced during render when the query result changes,
  // so the new graph lands in the same render instead of one effect later.
  const [syncedData, setSyncedData] = useState<typeof data>(undefined)
  if (data !== syncedData) {
    setSyncedData(data)
    if (data) dispatch({ type: 'server_config', config: data })
  }

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

  function setNodes(update: (current: WorkflowNode[]) => WorkflowNode[]) {
    dispatch({ type: 'nodes', update })
  }

  /** `edit` marks the flow as changed; selection alone does not. */
  function setEdges(
    update: (current: WorkflowEdge[]) => WorkflowEdge[],
    edit = true,
  ) {
    dispatch({ type: 'edges', update, edit })
  }

  function handleNodesChange(changes: NodeChange<WorkflowNode>[]) {
    setNodes((current) => applyNodeChanges(changes, current))
  }

  function handleEdgesChange(changes: EdgeChange<WorkflowEdge>[]) {
    if (readOnly || mutation.isPending) {
      setEdges(
        (current) =>
          applyEdgeChanges(
            changes.filter((change) => change.type === 'select'),
            current,
          ),
        false,
      )

      return
    }

    setEdges(
      (current) => applyEdgeChanges(changes, current),
      changes.some((change) => change.type === 'remove'),
    )
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
    setEdges(
      (current) =>
        current.map((edge) => ({ ...edge, selected: edge.id === edgeId })),
      false,
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
  }

  function handleDeleteEdge(edgeId: string) {
    if (readOnly || mutation.isPending) return

    setEdges((current) => current.filter((edge) => edge.id !== edgeId))
  }

  function handleDeleteNodeRules(nodeId: string) {
    if (readOnly || mutation.isPending) return

    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    )
  }

  // ─── Save / reload ────────────────────────────────────────────────────────

  async function handleSave() {
    if (!base || readOnly) return

    const payload = {
      ...graphToConfig(base, edges),
      changeNote,
      moveExistingMerchants: moveExisting,
    }

    try {
      const saved = await mutation.mutateAsync(payload)

      setSelectedVersionId(undefined)

      dispatch({ type: 'reset', config: saved })
    } catch (error) {
      if (isCaseFlowRevisionConflict(error)) {
        dispatch({ type: 'publish_conflict' })
      }
    }
  }

  function handleDiscard() {
    if (base) dispatch({ type: 'reset', config: base })
  }

  async function handleReloadStaleConfig() {
    dispatch({ type: 'reload_started' })

    try {
      const latest = await queryClient.fetchQuery({
        ...caseFlowConfigurationQueryOptions(),
        staleTime: 0,
      })

      setSelectedVersionId(undefined)

      dispatch({ type: 'reset', config: latest })
    } catch (error) {
      dispatch({ type: 'reload_failed' })
      toast.error(
        getApiErrorMessage(error, 'Could not reload the configuration.'),
      )
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

  const pendingMoveCount = readOnly
    ? 0
    : (movePreview?.eligibleMerchantCount ?? 0)

  const draftMoveCount = draftMovePreview?.eligibleMerchantCount ?? 0

  const moveBlocked =
    moveExisting &&
    (draftMovePreviewPending || !draftMovePreview || !changeNote.trim())

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
            onClick={(event) =>
              backfillMorph.run(
                () => setBackfillTriggerId(backfillRuleId),
                event.currentTarget,
              )
            }
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
                label: `v${version.id}${version.id === base.activeVersionId ? ' - Current' : ' - History'} (${formatVersionDate(version.publishedAt)})`,
              }))}
              value={String(base.versionId)}
              disabled={dirty || mutation.isPending}
              onValueChange={(value) => {
                dispatch({ type: 'change_note', value: '' })
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
                      ({formatVersionDate(version.publishedAt)})
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
            onClick={(event) =>
              publishMorph.run(
                () => dispatch({ type: 'publish_dialog', open: true }),
                event.currentTarget,
              )
            }
          >
            <Save data-icon="inline-start" />
            Publish new version
          </Button>
        ) : null}
      </ConfigurationHeaderActions>

      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge
          variant={readOnly ? 'outline' : 'secondary'}
          className="shrink-0"
        >
          {readOnly
            ? `v${base.versionId} · Read-only`
            : `v${base.versionId} · Current`}
        </Badge>
        <span className="min-w-0 flex-1 basis-60 text-pretty">
          {readOnly
            ? 'Published rules are read-only. Select the current version to make changes.'
            : pendingMoveCount > 0
              ? `New submissions use this version. ${pendingMoveCount} in-progress merchant${pendingMoveCount === 1 ? ' is' : 's are'} still on an older version.`
              : 'New submissions use this version. Publishing creates a new version; existing merchants keep theirs unless you move them.'}
          {publication?.changeNote ? ` — “${publication.changeNote}”` : null}
        </span>
        {!readOnly && !dirty && pendingMoveCount > 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={(event) =>
              moveMorph.run(() => setMoveOpen(true), event.currentTarget)
            }
          >
            Move to v{base.versionId}
          </Button>
        ) : null}
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
          className="min-w-0 shrink-0 xl:min-h-0 xl:w-85 xl:overflow-y-auto xl:scrollbar-thin"
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
              backfillMorph.run(() => setBackfillTriggerId(id))
            }}
          />
        </FieldSet>
      </div>

      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          if (!mutation.isPending) dispatch({ type: 'publish_dialog', open })
        }}
      >
        <DialogContent
          {...publishMorph.popupProps}
          className={cn('sm:max-w-lg', publishMorph.popupProps.className)}
        >
          <DialogHeader>
            <DialogTitle>Publish new version</DialogTitle>

            <DialogDescription>
              New submissions will always use the published version.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            aria-label="Apply this version to"
            value={moveExisting ? 'existing' : 'new'}
            disabled={mutation.isPending}
            onValueChange={(value) =>
              dispatch({ type: 'move_existing', value: value === 'existing' })
            }
          >
            <FieldLabel>
              <Field orientation="horizontal">
                <RadioGroupItem value="new" />
                <FieldContent>
                  <FieldTitle>New merchants only</FieldTitle>
                  <FieldDescription>
                    Merchants already in progress stay on their current version.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>

            <FieldLabel>
              <Field
                orientation="horizontal"
                data-disabled={!draftMovePreviewPending && draftMoveCount === 0}
              >
                <RadioGroupItem
                  value="existing"
                  disabled={
                    mutation.isPending ||
                    draftMovePreviewPending ||
                    draftMoveCount === 0
                  }
                />
                <FieldContent>
                  <FieldTitle>New and in-progress merchants</FieldTitle>
                  <FieldDescription>
                    {draftMovePreviewFailed
                      ? "Couldn't check in-progress merchants. Close this dialog and try again."
                      : draftMovePreviewPending
                        ? 'Checking in-progress merchants…'
                        : draftMoveCount === 0
                          ? 'No in-progress merchants to move.'
                          : `${draftMoveCount} merchant${draftMoveCount === 1 ? '' : 's'} will move to this version.`}
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          </RadioGroup>

          {moveExisting && draftMovePreview ? (
            <MerchantMoveImpact
              preview={draftMovePreview}
              targetLabel="this version"
            />
          ) : null}

          <Field data-disabled={mutation.isPending}>
            <FieldLabel htmlFor="flow-change-note">
              {moveExisting ? 'Change note' : 'Change note (optional)'}
            </FieldLabel>

            <Textarea
              id="flow-change-note"
              autoFocus
              maxLength={1000}
              value={changeNote}
              disabled={mutation.isPending}
              onChange={(event) =>
                dispatch({ type: 'change_note', value: event.target.value })
              }
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
              disabled={mutation.isPending || Boolean(formError) || moveBlocked}
              onClick={() => void handleSave()}
            >
              {mutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {moveExisting
                ? `Publish and move ${draftMoveCount} merchant${draftMoveCount === 1 ? '' : 's'}`
                : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={staleRevisionOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'stale_dismissed' })
        }}
      >
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

      <MoveMerchantsDialog
        open={moveOpen}
        preview={movePreview}
        versionId={base.versionId}
        popupProps={moveMorph.popupProps}
        onOpenChange={setMoveOpen}
      />

      <CaseFlowBackfillDialog
        triggerId={backfillTriggerId}
        popupProps={backfillMorph.popupProps}

        onOpenChange={(open) => {
          if (!open) setBackfillTriggerId(null)
        }}
      />
    </div>
  )
}

const VERSION_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'Asia/Karachi',
})

function formatVersionDate(value: string | Date) {
  return VERSION_DATE_FORMATTER.format(new Date(value))
}
