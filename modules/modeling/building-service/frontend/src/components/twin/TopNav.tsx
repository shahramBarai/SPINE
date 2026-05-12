import { Activity, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileCode2, CloudUpload, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { convertIfcToTtl, syncIfcToFuseki, fetchFusekiStatus, type PipelineRequest } from "@/lib/twin-api";

type ActionKey = "ttl" | "fuseki";

const PROJECT_OPTIONS = ["Metropolia Myllypuro Campus", "SmartLab"] as const;

export const TopNav = ({
  liveMode,
  project,
  onProjectChange,
}: {
  liveMode: boolean;
  project: string;
  onProjectChange: (project: string) => void;
}) => {
  const [inputPath, setInputPath] = useState("");
  const [openProj, setOpenProj] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fusekiStatusQuery = useQuery({
    queryKey: ["fuseki", "status"],
    queryFn: fetchFusekiStatus,
    refetchInterval: 15_000,
    retry: false,
  });

  const fusekiConnected = fusekiStatusQuery.data?.connected ?? false;

  const convertMutation = useMutation({
    mutationFn: (request: PipelineRequest) => convertIfcToTtl(request),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["twin", "triples"] }),
        queryClient.invalidateQueries({ queryKey: ["twin", "graph"] }),
      ]);
      toast({
        title: "IFC Converted",
        description: `Converted ${result.successful}/${result.processed} file(s) to TTL.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (request: PipelineRequest) => syncIfcToFuseki(request),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["twin", "tree"] }),
        queryClient.invalidateQueries({ queryKey: ["twin", "sensors"] }),
        queryClient.invalidateQueries({ queryKey: ["twin", "triples"] }),
        queryClient.invalidateQueries({ queryKey: ["twin", "graph"] }),
      ]);
      toast({
        title: "Sync Completed",
        description: `Synced ${result.successful}/${result.processed} file(s) to Fuseki.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fuseki Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const loading: ActionKey | null = convertMutation.isPending
    ? "ttl"
    : syncMutation.isPending
    ? "fuseki"
    : null;

  const parseInputPath = (): Pick<PipelineRequest, "file" | "dir"> | null => {
    const value = inputPath.trim();
    if (!value) {
      toast({
        title: "Path Required",
        description: "Enter an IFC file path or directory path first.",
        variant: "destructive",
      });
      return null;
    }

    if (value.toLowerCase().endsWith(".ifc")) {
      return { file: value };
    }

    return { dir: value };
  };

  const fire = (k: ActionKey) => {
    const request = parseInputPath();
    if (!request) {
      return;
    }

    if (k === "ttl") {
      convertMutation.mutate(request);
      return;
    }

    syncMutation.mutate({ ...request, fuseki_replace: false });
  };

  const actions: { key: ActionKey; label: string; icon: any }[] = [
    { key: "ttl", label: "Convert to TTL", icon: FileCode2 },
    { key: "fuseki", label: "Sync to Fuseki", icon: CloudUpload },
  ];

  return (
    <header className="h-14 shrink-0 border-b border-border/60 glass-strong flex items-center px-4 gap-4 z-30 relative">
      {/* Logo */}
      <div className="flex items-center gap-2.5 pr-4 border-r border-border/60 h-full">
        <img src="/logo.png" alt="MD2MV logo" className="h-8 w-8 rounded object-cover" />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight text-sm">
            MD<span className="text-primary">2MV</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
            Command Center
          </div>
        </div>
      </div>

      {/* Project selector */}
      <div className="relative">
        <button
          onClick={() => setOpenProj(!openProj)}
          className="flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/60 hover:bg-secondary border border-border/60 text-sm transition-colors"
        >
          <span className="text-muted-foreground text-xs">Project</span>
          <span className="font-medium">{project}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {openProj && (
          <div className="absolute top-full mt-1 left-0 w-64 glass-strong rounded-md shadow-elevated p-1 animate-fade-in">
            {PROJECT_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  onProjectChange(p);
                  setOpenProj(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm hover:bg-accent transition-colors",
                  p === project && "text-primary"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center actions */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border/50">
          {actions.map(({ key, label, icon: Icon }) => {
            const isLoading = loading === key;
            return (
              <Button
                key={key}
                onClick={() => fire(key)}
                disabled={!!loading}
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-xs font-medium hover:bg-primary/10 hover:text-primary data-[loading=true]:text-primary"
                data-loading={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Search + status */}
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="IFC Path · C:/data/IFC or C:/data/IFC/model.ifc"
            className="h-9 pl-8 pr-16 bg-secondary/60 border-border/60 font-mono text-xs placeholder:text-muted-foreground/70 focus-visible:ring-primary/40"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground bg-background/60 border border-border px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-medium transition-all",
            liveMode
              ? "border-live/40 bg-live/10 text-live shadow-live"
              : "border-border/60 bg-secondary/60 text-muted-foreground"
          )}
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            {liveMode && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75 animate-ping" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2 w-2 rounded-full transition-colors",
                liveMode ? "bg-live shadow-live" : "bg-muted-foreground/40"
              )}
            />
          </span>
          {liveMode ? <Activity className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          LIVE
        </div>

        <div
          className={cn(
            "flex items-center gap-2 h-9 px-3 rounded-md border text-xs transition-all",
            fusekiConnected
              ? "border-live/40 bg-live/10 text-live shadow-live"
              : "bg-secondary/60 border-border/60"
          )}
        >
          <span className={cn("font-mono", fusekiConnected ? "text-live" : "text-muted-foreground")}>Fuseki</span>
          {fusekiConnected ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-live shadow-live" />
            </span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 transition-colors" />
          )}
        </div>
      </div>
    </header>
  );
};
