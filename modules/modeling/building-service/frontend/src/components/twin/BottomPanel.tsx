import { Database, Filter, Download, ChevronUp, ChevronDown, Search, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { runSemanticSearch, type GraphData } from "@/lib/twin-api";
import { type Triple } from "@/lib/twin-data";

const defaultSparqlQuery = `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o .
}
LIMIT 200`;

const prefixColor = (s: string) => {
  if (s.startsWith("ifc:")) return "text-primary";
  if (s.startsWith("iot:")) return "text-live";
  if (s.startsWith("saref:")) return "text-[hsl(280_80%_70%)]";
  if (s.startsWith("bot:") || s.startsWith("fso:")) return "text-warning";
  return "text-foreground";
};

export const BottomPanel = ({
  collapsed,
  onToggle,
  onGraphResultChange,
  selectedNodeId,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onGraphResultChange: (graph: GraphData | null, triples?: Triple[]) => void;
  selectedNodeId?: string | null;
}) => {
  const { toast } = useToast();
  const [query, setQuery] = useState(defaultSparqlQuery);
  const [triples, setTriples] = useState<Triple[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const toNodeId = (value: string): string => {
    const term = value.trim();
    if (!term) {
      return "";
    }

    if (term.startsWith("_:")) {
      return term;
    }

    const uri = term.startsWith("<") && term.endsWith(">") ? term.slice(1, -1) : term;
    const lower = uri.toLowerCase();
    if (!(lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("urn:"))) {
      return uri;
    }

    if (uri.includes("#")) {
      return uri.split("#").pop() ?? uri;
    }
    if (uri.includes("/")) {
      return uri.split("/").pop() ?? uri;
    }
    return uri;
  };

  const matchedRowIndex = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    const index = triples.findIndex((triple) => {
      const subjectId = toNodeId(triple.subject);
      const objectId = toNodeId(triple.object);
      return subjectId === selectedNodeId || objectId === selectedNodeId;
    });

    return index >= 0 ? index : null;
  }, [selectedNodeId, triples]);

  useEffect(() => {
    if (collapsed || matchedRowIndex == null) {
      return;
    }

    const row = rowRefs.current[matchedRowIndex];
    if (!row) {
      return;
    }

    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [collapsed, matchedRowIndex]);

  const searchMutation = useMutation({
    mutationFn: (queryText: string) => runSemanticSearch({ query: queryText, limit: 500 }),
    onSuccess: (result) => {
      setTriples(result.triples);
      onGraphResultChange(result.graph, result.triples);
      toast({
        title: "Semantic Search Completed",
        description: `Returned ${result.triples.length} triple(s).`,
      });
    },
    onError: (error) => {
      toast({
        title: "Semantic Search Failed",
        description: error instanceof Error ? error.message : "Invalid or failed SPARQL query.",
        variant: "destructive",
      });
    },
  });

  const runSearch = () => {
    const queryText = query.trim();
    if (!queryText) {
      toast({
        title: "Query Required",
        description: "Enter a SPARQL SELECT or CONSTRUCT query before searching.",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(queryText);
  };

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border/60 glass-strong overflow-hidden transition-[height] duration-300",
        collapsed ? "h-10" : "h-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center h-10 px-3 border-b border-border/60 gap-3">
        <Database className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Semantic Search
        </span>
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
          {triples.length} triples
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Filter className="h-3.5 w-3.5" />
          </button>
          <button className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100%-40px)]">
          <section className="border-r border-border/40 p-3 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Semantic Search</h3>
              <Button
                onClick={runSearch}
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Search
              </Button>
            </div>
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-full min-h-[120px] resize-none bg-secondary/40 border-border/60 font-mono text-xs leading-relaxed"
              placeholder="SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 200"
            />
            <p className="text-[10px] font-mono text-muted-foreground">
              SELECT must return ?s ?p ?o (or ?subject ?predicate ?object). CONSTRUCT is also supported.
            </p>
          </section>

          <section className="min-h-0 overflow-auto">
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 border-b border-border/40 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                Result
              </div>
              <div className="overflow-auto h-full">
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
                    <tr className="border-b border-border/60">
                      <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium w-12">
                        #
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                        Subject
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                        Predicate
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                        Object
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {triples.map((t, i) => (
                      <tr
                        key={i}
                        ref={(element) => {
                          rowRefs.current[i] = element;
                        }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        className={cn(
                          "border-b border-border/30 transition-colors",
                          matchedRowIndex === i ? "bg-primary/12" : "",
                          hovered === i ? "bg-primary/5" : "hover:bg-accent/30"
                        )}
                      >
                        <td className="px-4 py-2 text-muted-foreground">{String(i + 1).padStart(3, "0")}</td>
                        <td className={cn("px-4 py-2", prefixColor(t.subject))}>{t.subject}</td>
                        <td className="px-4 py-2 text-muted-foreground">{t.predicate}</td>
                        <td className={cn("px-4 py-2", prefixColor(t.object))}>{t.object}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
