import React, {
  useState,
  useRef,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import "@xyflow/react/dist/style.css";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
  ReactFlowInstance,
  OnNodesChange,
} from "@xyflow/react";
import { edgeStyles, animatedEdgeStyles } from "./utils/nodeStyles";
import Sidebar from "./Sidebar";
import { nodeTypes } from "./nodes";
import { cn } from "@/client/utils";

// Rest of your component remains largely the same
const initialEdges: Edge[] = [];

export default function FlowView({
  className,
  nodes,
  setNodes,
  onNodesChange,
  selectNode,
}: {
  className?: string;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  selectNode: (node: Node | null) => void;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
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

      const { type } = JSON.parse(dataStr);

      // Calculate position from mouse event
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Initialize data as a non-undefined object
      let data: Record<string, unknown> = {};

      // Add default properties based on node type
      switch (type) {
        case "kafkaSource":
          data = {
            consumer: {
              topic: "new-topic",
              bootstrapServers: "localhost:9092",
              groupId: "default-group",
              properties: "",
              startupMode: "latest",
            },
            preview: {
              offsetMode: "latest",
              sampleSize: 100,
              partitions: "",
            },
            deserialization: {
              format: "none",
            },
            schema: {
              fields: [],
            },
            eventTime: {
              eventTimeField: "",
              watermarkStrategy: "",
              delayMs: 0,
            },
          };
          break;
        case "filter":
          data = {
            condition: "value > 0",
          };
          break;
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: data as Record<string, unknown>,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent event from bubbling up to parent elements
      event.stopPropagation();

      // Update the selected node
      selectNode(node);

      // Optionally highlight the selected node
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === node.id,
        }))
      );
    },
    [selectNode, setNodes]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);

    // Clear selection
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      }))
    );
  }, [selectNode, setNodes]);

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
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
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
