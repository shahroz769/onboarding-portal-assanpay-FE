import type { CaseFlowConfiguration } from '#/schemas/configuration.schema'

import {
  buildWorkflowGraph,
  canonicalizeFlowRules,
} from './workflow-graph-mapper'
import type { WorkflowEdge, WorkflowNode } from './workflow-graph-types'
import { layoutWorkflowGraph } from './workflow-layout'

/**
 * The case-flow editor: the published configuration it started from, the
 * graph being edited, and the publish step.
 *
 *   clean ──edit──▶ dirty ──open publish──▶ publish dialog ──published──▶ clean
 *   dirty ──discard──▶ clean
 *   publish dialog ──someone else published first──▶ stale ──reload──▶ reloading ──▶ clean
 *
 * While dirty, newer server data is ignored so it never replaces unsaved edits.
 */
export type WorkflowEditorDialog = 'none' | 'publish' | 'stale' | 'reloading'

export type WorkflowEditorState = {
  base: CaseFlowConfiguration | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  dirty: boolean
  changeNote: string
  moveExisting: boolean
  dialog: WorkflowEditorDialog
}

export type WorkflowEditorAction =
  /** The query delivered a configuration; adopted unless there are edits. */
  | { type: 'server_config'; config: CaseFlowConfiguration }
  /** Start over from `config`: after publishing, discarding or reloading. */
  | { type: 'reset'; config: CaseFlowConfiguration }
  | { type: 'nodes'; update: (nodes: WorkflowNode[]) => WorkflowNode[] }
  /** `edit` marks the flow changed; selection-only updates leave it clean. */
  | {
      type: 'edges'
      update: (edges: WorkflowEdge[]) => WorkflowEdge[]
      edit: boolean
    }
  | { type: 'change_note'; value: string }
  | { type: 'move_existing'; value: boolean }
  | { type: 'publish_dialog'; open: boolean }
  /** The server refused the publish: another version was published first. */
  | { type: 'publish_conflict' }
  | { type: 'stale_dismissed' }
  | { type: 'reload_started' }
  | { type: 'reload_failed' }

export const initialWorkflowEditorState: WorkflowEditorState = {
  base: null,
  nodes: [],
  edges: [],
  dirty: false,
  changeNote: '',
  moveExisting: false,
  dialog: 'none',
}

function graphFrom(config: CaseFlowConfiguration) {
  const graph = buildWorkflowGraph(config)
  return {
    base: config,
    edges: graph.edges,
    nodes: layoutWorkflowGraph(graph.nodes, graph.edges),
  }
}

function isSameConfig(a: CaseFlowConfiguration, b: CaseFlowConfiguration) {
  return (
    a.revision === b.revision &&
    a.versionId === b.versionId &&
    canonicalizeFlowRules(a) === canonicalizeFlowRules(b)
  )
}

export function isWorkflowReadOnly(state: WorkflowEditorState) {
  return Boolean(
    state.base && state.base.versionId !== state.base.activeVersionId,
  )
}

export function workflowEditorReducer(
  state: WorkflowEditorState,
  action: WorkflowEditorAction,
): WorkflowEditorState {
  switch (action.type) {
    case 'server_config':
      if (state.dirty) return state
      if (state.base && isSameConfig(state.base, action.config)) return state
      return { ...state, ...graphFrom(action.config) }

    case 'reset':
      return {
        ...state,
        ...graphFrom(action.config),
        dirty: false,
        changeNote: '',
        moveExisting: false,
        dialog: 'none',
      }

    case 'nodes':
      return { ...state, nodes: action.update(state.nodes) }

    case 'edges':
      // A read-only version only takes selection changes.
      if (action.edit && isWorkflowReadOnly(state)) return state
      return {
        ...state,
        edges: action.update(state.edges),
        dirty: state.dirty || action.edit,
      }

    case 'change_note':
      return { ...state, changeNote: action.value }

    case 'move_existing':
      return { ...state, moveExisting: action.value }

    case 'publish_dialog':
      if (action.open) {
        return state.dirty &&
          state.dialog === 'none' &&
          !isWorkflowReadOnly(state)
          ? { ...state, dialog: 'publish' }
          : state
      }
      return state.dialog === 'publish' ? { ...state, dialog: 'none' } : state

    case 'publish_conflict':
      return state.dialog === 'publish' ? { ...state, dialog: 'stale' } : state

    case 'stale_dismissed':
      return state.dialog === 'stale' ? { ...state, dialog: 'none' } : state

    case 'reload_started':
      return state.dialog === 'stale'
        ? { ...state, dialog: 'reloading' }
        : state

    case 'reload_failed':
      return state.dialog === 'reloading'
        ? { ...state, dialog: 'stale' }
        : state
  }
}
