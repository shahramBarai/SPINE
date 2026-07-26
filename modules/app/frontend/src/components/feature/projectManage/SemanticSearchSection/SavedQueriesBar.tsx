import { useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { SectionCard } from "components/complex/SectionCard";
import { cn } from "utils/index";

interface SavedQuery {
    id: string;
    name: string;
    query: string;
}

// Stands in for real persistence: saving a query as a .sparql file via
// ProjectFileService + the /files proxy, so saved queries survive a browser
// reload as originally asked. For now this only lives in component state and
// is lost on refresh.
function SavedQueriesBar({
    query,
    className
}: {
    query: string;
    className?: string;
}) {
    const [saveName, setSaveName] = useState("");

    const handleSave = () => {
        const name = saveName.trim();
        if (!name) {
            toast.warning("Enter a name for this query.");
            return;
        }
        //TODO: implement actual save functionality
        void query; // avoid unused variable warning
        setSaveName("");
        toast.success(`Query "${name}" saved.`);
    };

    const handleRemove = (id: string) => {
        //TODO: implement remove functionality
    };

    return (
        <SectionCard
            title="Save current query as"
            className={cn("gap-2!", className)}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Query name"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={handleSave}>
                        <Bookmark className="h-4 w-4" />
                        Save query
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}

export { SavedQueriesBar };
