import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
  useStore,
} from '@xyflow/react'
import type {
  Connection,
  EdgeChange,
  EdgeTypes,
  NodeChange,
  NodeTypes,
} from '@xyflow/react'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { LayoutGrid } from 'lucide-react'

import '@xyflow/react/dist/style.css'

import { Button } from '#/components/ui/button'
import { prefersReducedMotion } from '#/hooks/use-reduced-motion'

import type { WorkflowEdge, WorkflowNode } from './workflow-graph-types'
import { FlowEdge } from './edges/flow-edge'
import { QueueNode } from './nodes/queue-node'
import { SubmissionNode } from './nodes/submission-node'

const nodeTypes = {
  submission: SubmissionNode,
  queue: QueueNode,
} satisfies NodeTypes

const FIT_VIEW_OPTIONS = { padding: 0.25, maxZoom: 1 }

const edgeTypes = {
  flow: FlowEdge,
} satisfies EdgeTypes

export function WorkflowCanvas({
  readOnly = false,
  nodes,
  edges,
  colorMode,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onRelayout,
}: {
  readOnly?: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  colorMode: 'light' | 'dark'
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void
  onConnect: (connection: Connection) => void
  isValidConnection: (connection: Connection | WorkflowEdge) => boolean
  onRelayout: () => void
}) {
  // Set once the user pans or zooms, so resizes stop re-centering the view
  // under them. Auto-layout clears it.
  const userMovedRef = useRef(false)
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      colorMode={colorMode}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      onMoveStart={(event) => {
        // `event` is null for programmatic moves such as fitView.
        if (event) userMovedRef.current = true
      }}
      minZoom={0.2}
      maxZoom={1.5}
      nodesConnectable={!readOnly}
      edgesReconnectable={!readOnly}
      deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
      selectNodesOnDrag={false}
      connectionRadius={36}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
      <Controls position="bottom-left" showInteractive={false} />
      <FitOnResize userMovedRef={userMovedRef} />
      <AutoLayoutPanel onRelayout={onRelayout} userMovedRef={userMovedRef} />
    </ReactFlow>
  )
}

/**
 * The `fitView` prop only fits once, on mount. The canvas is a flex child
 * whose size settles after that (the page layout, alerts above it, the
 * sidebar, window resizes), which left the graph off-center and clipped.
 * Refit whenever the pane resizes, until the user takes over the viewport.
 */
function FitOnResize({ userMovedRef }: { userMovedRef: RefObject<boolean> }) {
  const { fitView } = useReactFlow()
  const width = useStore((state) => state.width)
  const height = useStore((state) => state.height)

  useEffect(() => {
    if (!width || !height || userMovedRef.current) return
    void fitView(FIT_VIEW_OPTIONS)
  }, [fitView, height, userMovedRef, width])

  return null
}

function AutoLayoutPanel({
  onRelayout,
  userMovedRef,
}: {
  onRelayout: () => void
  userMovedRef: RefObject<boolean>
}) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="top-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="bg-background shadow-xs"
        onClick={() => {
          userMovedRef.current = false
          onRelayout()
          window.setTimeout(() => {
            void fitView({
              ...FIT_VIEW_OPTIONS,
              duration: prefersReducedMotion() ? 0 : 300,
            })
          }, 50)
        }}
      >
        <LayoutGrid data-icon="inline-start" />
        Auto-layout
      </Button>
    </Panel>
  )
}
