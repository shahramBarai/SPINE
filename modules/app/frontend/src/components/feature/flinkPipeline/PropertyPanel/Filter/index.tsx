import { Accordion } from "components/basics/accordion";
import FieldSection from "./FieldSection";
import FunctionsSection from "./FunctionsSection";

/**
 * Editor for a Filter node. Its available fields come from whatever node
 * feeds it, hence `sourceNodeId` rather than any state of its own.
 */
export const Filter = ({ sourceNodeId }: { sourceNodeId?: string }) => {
    return (
        <Accordion type="multiple" className="w-full" defaultValue={["fields"]}>
            <FieldSection sourceNodeId={sourceNodeId} />
            <FunctionsSection />
        </Accordion>
    );
};

export default Filter;
