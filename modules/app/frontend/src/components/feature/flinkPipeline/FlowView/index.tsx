import React, { useState, useRef, useCallback } from "react";
import "@xyflow/react/dist/style.css";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    type Node,
    type Edge,
    type Connection,
    BackgroundVariant,
    type ReactFlowInstance,
    useNodesState,
    useEdgesState,
    addEdge
} from "@xyflow/react";
import { cn } from "utils/index";
import { useTheme } from "hooks/useTheme";
import Sidebar from "./Sidebar";
import CustomNode from "./CustomNode";
import ConnectionLine from "./ConnectionLine";

// Every node on the canvas is our own component; React Flow's built-in
// node types are unused.
const nodeTypes = {
    CustomNode: CustomNode
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export default function FlowView({
    className,
    selectNode
}: {
    className?: string;
    selectNode: (node: Node | null) => void;
}) {
    const { theme } = useTheme();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] =
        useState<ReactFlowInstance | null>(null);

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

            const newNode: Node = {
                id: `node-${Date.now()}`,
                type,
                position: reactFlowInstance.screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY
                }),
                data: { label }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const onNodeClick = useCallback(
        (event: React.MouseEvent, node: Node) => {
            // Keep the click off the pane handler below, which would
            // immediately deselect what we just selected.
            event.stopPropagation();

            selectNode(node);

            setNodes((nds) =>
                nds.map((n) => ({
                    ...n,
                    selected: n.id === node.id
                }))
            );
        },
        [selectNode, setNodes]
    );

    const onPaneClick = useCallback(() => {
        selectNode(null);

        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                selected: false
            }))
        );
    }, [selectNode, setNodes]);

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) =>
                addEdge(
                    {
                        ...params,
                        animated: true,
                        style: {
                            stroke: "var(--surface-foreground)",
                            strokeWidth: 1.5
                        }
                    },
                    eds
                )
            );
        },
        [setEdges]
    );

    const defaultEdgeOptions = {
        animated: true,
        style: {
            stroke: "var(--primary)",
            strokeWidth: 1.5,
            transition: "stroke 0.3s, stroke-width 0.3s"
        }
    };

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
                    colorMode={theme}
                    defaultEdgeOptions={defaultEdgeOptions}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    connectionLineComponent={ConnectionLine}
                    proOptions={{ hideAttribution: true }}
                >
                    <Controls className="bg-surface text-foreground" />
                    <MiniMap
                        nodeStrokeWidth={3}
                        nodeColor={(node) =>
                            String(node.style?.background || "#475569")
                        }
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
