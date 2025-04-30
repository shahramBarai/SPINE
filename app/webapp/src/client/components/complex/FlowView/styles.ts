// Node style definitions

export const nodeTypeColors = {
  source: {
    background: "#2563eb",
    borderColor: "#1e40af",
  },
  process: {
    background: "#475569",
    borderColor: "#334155",
  },
  sink: {
    background: "#dc2626",
    borderColor: "#b91c1c",
  },
  storage: {
    background: "#059669",
    borderColor: "#047857",
  },
  analytics: {
    background: "#9333ea",
    borderColor: "#6b21a8",
  },
};

export enum NodeTypeStyle {
  SOURCE = "source",
  PROCESS = "process",
  SINK = "sink",
  STORAGE = "storage",
  ANALYTICS = "analytics",
}

export const getNodeStyle = (type: NodeTypeStyle) => {
  return {
    ...nodeTypeColors[type],
  };
};

export const edgeStyles = {
  stroke: "#94a3b8",
  strokeWidth: 2,
};

export const animatedEdgeStyles = {
  ...edgeStyles,
  stroke: "#000000",
  strokeWidth: 2,
};
