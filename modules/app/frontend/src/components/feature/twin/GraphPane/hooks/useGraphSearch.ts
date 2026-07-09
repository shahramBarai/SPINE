import { useEffect, useMemo, useState } from "react";
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

// Debounces the raw search text, then returns the id of the first node
// whose id or label matches every search token (or null if the query is
// empty or nothing matches). Debouncing means we don't re-highlight on
// every keystroke while the user is still typing.
function useGraphSearch({
    nodes,
    searchText
}: {
    nodes: GraphNode[];
    searchText: string;
}): string | null {
    const [debouncedText, setDebouncedText] = useState(searchText);

    useEffect(() => {
        const timeout = setTimeout(
            () => setDebouncedText(searchText),
            SEARCH_DEBOUNCE_MS
        );
        return () => clearTimeout(timeout);
    }, [searchText]);

    return useMemo(() => {
        const tokens = searchTokens(debouncedText);
        if (!tokens.length) {
            return null;
        }

        const matchesAllTokens = (parts: string[]) => {
            const haystack = parts.map((part) => part.toLowerCase()).join(" ");
            return tokens.every((token) => haystack.includes(token));
        };

        const match = nodes.find((node) =>
            matchesAllTokens([node.id, node.label])
        );
        return match ? match.id : null;
    }, [nodes, debouncedText]);
}

export { useGraphSearch };
