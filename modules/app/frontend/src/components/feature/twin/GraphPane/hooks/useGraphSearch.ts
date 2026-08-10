import { useEffect, useMemo, useState } from "react";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { type GraphNode } from "../types/graph";

const SEARCH_DEBOUNCE_MS = 500;

/**
 * Splits the search query into tokens, lowercases them, and also includes
 *
 * @param query The raw search query string.
 * @returns An array of search tokens, including both the full token and the part after any colon.
 */
const searchTokens = (query: string): string[] =>
    query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .flatMap((token) => {
            if (!token) return [];
            const withoutPrefix = token.includes(":")
                ? (token.split(":").pop() ?? "")
                : "";
            return withoutPrefix ? [token, withoutPrefix] : [token];
        });

// Debounces the shared search text (see useDigitalTwin), matches it against
// this window's own node list, and drives the shared selection from the
// result - so any window with a node/label list can wire up the same search
// box behavior. Returns the matched node id (or null) for callers that also
// want to show match state locally. Debouncing means we don't re-highlight
// on every keystroke while the user is still typing.
function useGraphSearch({
    nodes
}: {
    nodes: Pick<GraphNode, "id" | "label" | "sameAsIds">[];
}): string | null {
    const { searchText, selectObject, clearSelection } = useDigitalTwin();
    const [debouncedText, setDebouncedText] = useState(searchText);

    useEffect(() => {
        const timeout = setTimeout(
            () => setDebouncedText(searchText),
            SEARCH_DEBOUNCE_MS
        );
        return () => clearTimeout(timeout);
    }, [searchText]);

    const matchId = useMemo(() => {
        const tokens = searchTokens(debouncedText);
        if (!tokens.length) {
            return null;
        }

        const matchesAllTokens = (parts: string[]) => {
            const haystack = parts.map((part) => part.toLowerCase()).join(" ");
            return tokens.every((token) => haystack.includes(token));
        };

        const match = nodes.find((node) => matchesAllTokens([node.label]));
        return match ? match.id : null;
    }, [nodes, debouncedText]);

    useEffect(() => {
        if (!matchId) {
            clearSelection();
            return;
        }
        const match = nodes.find((node) => node.id === matchId);
        selectObject(matchId, match?.sameAsIds);
    }, [matchId, nodes, selectObject, clearSelection]);

    return matchId;
}

export { useGraphSearch };
