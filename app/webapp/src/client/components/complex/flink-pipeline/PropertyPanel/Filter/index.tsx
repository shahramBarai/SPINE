import { Accordion } from "@/client/components/basics/accordion";
import FieldSection from "./FieldSection";
import FunctionsSection from "./FunctionsSection";

export const Filter = ({
  nodeId,
  sourceNodeId,
}: {
  nodeId: string;
  sourceNodeId?: string;
}) => {
  console.log(nodeId, sourceNodeId);

  return (
    <Accordion type="multiple" className="w-full" defaultValue={["fields"]}>
      <FieldSection sourceNodeId={sourceNodeId} />
      <FunctionsSection />
    </Accordion>
  );
};

export default Filter;
