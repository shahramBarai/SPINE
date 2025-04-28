import React, { useState, useRef, useCallback } from "react";
import "@xyflow/react/dist/style.css";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
  ReactFlowInstance,
} from "@xyflow/react";
import { edgeStyles, animatedEdgeStyles } from "./utils/nodeStyles";
import Sidebar from "./Sidebar";
import { nodeTypes } from "./nodes";
import { cn } from "@/client/utils";

// Initial nodes using our custom node types
const initialNodes: Node[] = [];

// Rest of your component remains largely the same
const initialEdges: Edge[] = [];

export default function FlowView({ className }: { className?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: animatedEdgeStyles,
          },
          eds
        )
      ),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const dataStr = event.dataTransfer.getData("application/reactflow");

      if (!dataStr) return;

      const { type, label } = JSON.parse(dataStr);

      // Calculate position from mouse event
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Prepare data based on node type
      const data: {
        label: string;
        topic?: string;
        condition?: string;
        fields?: string[];
        windowType?: string;
        duration?: string;
        query?: string;
        index?: string;
        pattern?: string;
        joinKey?: string;
        timeWindow?: string;
      } = { label };

      // Add default properties based on node type
      switch (type) {
        case "kafkaSource":
          data.topic = "new-new-topic";
          break;
        case "filter":
          data.condition = "value > 0";
          break;
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div className={cn("flex size-full overflow-hidden", className)}>
      <Sidebar />
      <div className="size-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          colorMode="light"
          defaultEdgeOptions={{
            style: edgeStyles,
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="bg-surface text-foreground" />
          <MiniMap
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              return String(node.style?.background || "#475569");
            }}
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={12}
            size={1}
            color="#555"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
