import { NodeTypes } from "@xyflow/react";

import KafkaSource from "./KafkaSource";
import Filter from "./Filter";

// Define node types mapping for React Flow
export const nodeTypes: NodeTypes = {
  kafkaSource: KafkaSource,
  filter: Filter,
};

// Export all node components
export { KafkaSource, Filter };
