import { Activity, Box } from "lucide-react";
import { cn } from "@/lib/utils";
import { type IfcNode } from "@/lib/twin-data";
import { useProjectTreeQuery, useSensorsQuery } from "@/hooks/use-twin-data";

const findNode = (nodes: IfcNode[], id: string): IfcNode | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
};

export const SelectedElementPanel = ({
  selectedId,
  liveMode,
}: {
  selectedId: string | null;
  liveMode: boolean;
}) => {
  const { data: projectTreeData } = useProjectTreeQuery();
  const { data: sensorsData } = useSensorsQuery();
  const node = selectedId ? findNode(projectTreeData, selectedId) : null;
  const bound = sensorsData.filter((s) => s.bound === selectedId);

  return (
    <div className="mx-3 mb-3 rounded-md border border-border/60 bg-card/40 overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-border/60 flex items-center gap-2 bg-primary/5">
        <Activity className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Selected Element
        </span>
        {liveMode && node && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-live shadow-live pulse-live" />
        )}
      </div>

      <div className="p-2.5">
        {node ? (
          <>
            <div className="mb-2">
              <div className="text-[9px] uppercase font-mono text-primary tracking-wider mb-0.5">
                {node.type}
              </div>
              <div className="text-xs font-semibold leading-tight">{node.name}</div>
              <div className="text-[9px] font-mono text-muted-foreground mt-0.5 truncate">
                ifc:{node.id}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="bg-secondary/50 rounded p-1.5">
                <div className="text-[9px] uppercase text-muted-foreground font-mono">GUID</div>
                <div className="font-mono text-[10px] truncate">2K9b$F1d{node.id.slice(-3)}</div>
              </div>
              <div className="bg-secondary/50 rounded p-1.5">
                <div className="text-[9px] uppercase text-muted-foreground font-mono">Sensors</div>
                <div className="font-mono text-[10px] text-primary">{bound.length} bound</div>
              </div>
            </div>

            {bound.length > 0 ? (
              <div className="space-y-1">
                {bound.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-secondary/40 border border-border/40 rounded px-1.5 py-1"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          s.status === "alert" ? "bg-destructive" : "bg-live shadow-live"
                        )}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        {s.name}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] shrink-0">
                      <span className={s.status === "alert" ? "text-destructive" : "text-live"}>
                        {s.value}
                      </span>
                      <span className="text-muted-foreground ml-1 text-[9px]">{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground italic py-1">
                No sensors bound to this element.
              </div>
            )}
          </>
        ) : (
          <div className="text-[10px] text-muted-foreground py-4 text-center">
            <Box className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
            Select an element to inspect metadata.
          </div>
        )}
      </div>
    </div>
  );
};
