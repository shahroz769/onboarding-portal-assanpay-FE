import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import type {
  Connection,
  EdgeChange,
  EdgeTypes,
  NodeChange,
  NodeTypes,
} from '@xyflow/react'

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
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
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
      <AutoLayoutPanel onRelayout={onRelayout} />
    </ReactFlow>
  )
}

function AutoLayoutPanel({ onRelayout }: { onRelayout: () => void }) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="top-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="bg-background shadow-xs"
        onClick={() => {
          onRelayout()
          window.setTimeout(() => {
            void fitView({
              padding: 0.25,
              maxZoom: 1,
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
