import { useEffect, useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";
import { SearchDropdown } from "components/complex/SearchDropdown";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";

const ROLE_OPTIONS = ["OWNER", "EDITOR", "VIEWER"] as const;
type Role = (typeof ROLE_OPTIONS)[number];
const SEARCH_DEBOUNCE_MS = 300;

interface MemberRowState {
    userId: string;
    name: string | null;
    email: string;
    role: Role;
    isNew: boolean;
    roleChanged: boolean;
}

function MembersTab({
    projectId,
    isOwner
}: {
    projectId: string;
    isOwner: boolean;
}) {
    const utils = api.useUtils();
    const {
        data: members,
        isLoading,
        error
    } = api.project.getMembers.useQuery({ projectId });

    // Local draft of the member table - seeded from the server once, then
    // edited freely (role changes, additions, removals) until Save reconciles
    // the whole list in one call.
    const [rows, setRows] = useState<MemberRowState[] | null>(null);
    const [dirty, setDirty] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        if (members && rows === null) {
            setRows(
                members.map((member) => ({
                    userId: member.userId,
                    name: member.name,
                    email: member.email,
                    role: member.role,
                    isNew: false,
                    roleChanged: false
                }))
            );
        }
    }, [members, rows]);

    useEffect(() => {
        const timeout = setTimeout(
            () => setDebouncedSearch(search),
            SEARCH_DEBOUNCE_MS
        );
        return () => clearTimeout(timeout);
    }, [search]);

    const query = debouncedSearch.trim();
    const { data: searchResults, isFetching: isSearching } =
        api.user.search.useQuery(
            { query, excludeUserIds: rows?.map((row) => row.userId) ?? [] },
            { enabled: searchOpen && query.length > 0 }
        );

    const updateMembers = api.project.updateMembers.useMutation({
        onSuccess: () => {
            utils.project.getMembers.invalidate({ projectId });
            setRows(null);
            setDirty(false);
            toast.success("Members updated.");
        },
        onError: (err) => toast.error(err.message)
    });

    if (isLoading || rows === null) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members...
            </div>
        );
    }

    if (error || !members) {
        return (
            <p className="text-danger text-sm py-6">
                Failed to load project members.
            </p>
        );
    }

    const ownerCount = rows.filter((row) => row.role === "OWNER").length;

    const updateRole = (userId: string, role: Role) => {
        const memberRole = members.find((m) => m.userId === userId)?.role;
        const roleChanged = memberRole !== role;
        setRows((prev) =>
            prev!.map((row) =>
                row.userId === userId
                    ? { ...row, role, roleChanged: roleChanged }
                    : row
            )
        );
        if (roleChanged || members.length !== rows.length) {
            setDirty(true);
        } else {
            setDirty(false);
        }
    };

    const removeRow = (userId: string) => {
        const newMember =
            members.find((m) => m.userId === userId) === undefined;
        const rowsLenghtAfter = rows.length - 1;
        setRows((prev) => prev!.filter((row) => row.userId !== userId));
        console.log(members.length !== rowsLenghtAfter);
        if (!newMember || members.length !== rowsLenghtAfter) {
            setDirty(true);
        } else {
            setDirty(false);
        }
    };

    const addUser = (user: {
        id: string;
        name: string | null;
        email: string;
    }) => {
        setRows((prev) => [
            ...prev!,
            {
                userId: user.id,
                name: user.name,
                email: user.email,
                role: "VIEWER",
                isNew: true,
                roleChanged: false
            }
        ]);
        setDirty(true);
        setSearchOpen(false);
        setSearch("");
    };

    const handleSave = () => {
        updateMembers.mutate({
            projectId,
            members: rows.map((row) => ({
                userId: row.userId,
                role: row.role
            }))
        });
    };

    return (
        <div className="w-full flex flex-col gap-">
            <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground text-left">
                        <tr>
                            <th className="px-4 py-2 font-medium">Name</th>
                            <th className="px-4 py-2 font-medium">Email</th>
                            <th className="px-4 py-2 font-medium">Role</th>
                            {isOwner && <th className="px-4 py-2 w-10" />}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const isLastOwner =
                                row.role === "OWNER" && ownerCount === 1;
                            return (
                                <tr
                                    key={row.userId}
                                    className={cn(
                                        "border-t border-border",
                                        (row.isNew || row.roleChanged) &&
                                            "bg-primary/5"
                                    )}
                                >
                                    <td className="px-4 py-2 text-foreground max-w-24">
                                        <div className="flex items-center gap-2 ">
                                            <span className="truncate">
                                                {row.name || "—"}
                                            </span>
                                            {row.isNew && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                    New
                                                </span>
                                            )}
                                            {!row.isNew && row.roleChanged && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger/20 text-danger">
                                                    Edit
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-muted-foreground max-w-32">
                                        {row.email}
                                    </td>
                                    <td className="px-4 py-2">
                                        <Select
                                            value={row.role}
                                            disabled={!isOwner || isLastOwner}
                                            onValueChange={(role) =>
                                                updateRole(
                                                    row.userId,
                                                    role as Role
                                                )
                                            }
                                        >
                                            <SelectTrigger size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROLE_OPTIONS.map((role) => (
                                                    <SelectItem
                                                        key={role}
                                                        value={role}
                                                    >
                                                        {role}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    {isOwner && (
                                        <td className="px-4 py-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={isLastOwner}
                                                title={
                                                    isLastOwner
                                                        ? "A project must have at least one owner"
                                                        : "Remove"
                                                }
                                                onClick={() =>
                                                    removeRow(row.userId)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4 text-danger" />
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {isOwner && (
                            <tr>
                                <td colSpan={4} className="p-0">
                                    <button
                                        type="button"
                                        onClick={() => setSearchOpen(true)}
                                        className="w-full py-2 text-center text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors border-t border-dashed border-border"
                                    >
                                        + Add member
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isOwner && dirty && (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setRows(
                                members.map((member) => ({
                                    userId: member.userId,
                                    name: member.name,
                                    email: member.email,
                                    role: member.role,
                                    isNew: false,
                                    roleChanged: false
                                }))
                            );
                            setDirty(false);
                        }}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="primary"
                        disabled={updateMembers.isPending}
                        onClick={handleSave}
                    >
                        {updateMembers.isPending ? "Saving..." : "Save changes"}
                    </Button>
                </div>
            )}

            <SearchDropdown
                open={searchOpen}
                onClose={() => {
                    setSearchOpen(false);
                    setSearch("");
                }}
                query={search}
                onQueryChange={setSearch}
                results={searchResults ?? []}
                isLoading={isSearching}
                getKey={(user) => user.id}
                onSelect={addUser}
                renderResult={(user) => (
                    <>
                        <div className="font-medium text-foreground">
                            {user.name || user.email}
                        </div>
                        {user.name && (
                            <div className="text-xs text-muted-foreground">
                                {user.email}
                            </div>
                        )}
                    </>
                )}
                placeholder="Search by name or email..."
                emptyMessage="No matching users."
            />
        </div>
    );
}

export { MembersTab };
