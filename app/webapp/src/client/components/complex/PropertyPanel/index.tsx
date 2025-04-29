import { Button } from "@/client/components/basics/Button";
import KafkaSource from "./KafkaSource/index";
import { cn } from "@/client/utils";
import { BookmarkIcon } from "@heroicons/react/16/solid";

export * from "./KafkaSource/index";

export const PropertyPanel = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="bg-surface flex justify-between items-center py-2 px-4">
        <span className="text-base font-medium text-foreground">
          {`Kafka Source (<topicName>)`}
        </span>
        <Button>
          <BookmarkIcon className="size-4 mr-1" />
          Save
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <KafkaSource />
      </div>
    </div>
  );
};
