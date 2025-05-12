import {
  AccordionContent,
  AccordionTrigger,
} from "@/client/components/basics/accordion";
import { AccordionItem } from "@/client/components/basics/accordion";

export const FunctionsSection = () => {
  return (
    <AccordionItem value="functions">
      <AccordionTrigger className="flex-1 px-4 text-sm font-medium">
        Functions
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex w-full gap-1 px-6">
          <div className="flex w-1/5 items-center justify-between px-2 py-1">
            Function
          </div>
          <div className="flex w-4/5 items-center justify-between px-2 py-1 border border-border bg-surface">
            <span className="text-xs text-muted-foreground">
              `function(value1, value2)`
            </span>
            <span className="text-xs text-muted-foreground">
              returns boolean
            </span>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default FunctionsSection;
