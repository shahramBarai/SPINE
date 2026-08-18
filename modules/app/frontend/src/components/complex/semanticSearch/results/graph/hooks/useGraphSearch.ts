import { useEffect, useMemo, useState } from "react";
import { type GraphNode } from "../types";

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

/**
 * Debounces the search text and matches it against the given node list,
 * returning the id of the first node whose label contains every token (or
 * null when there is no match / nothing typed). Debouncing means we don't
 * re-highlight on every keystroke while the user is still typing.
 *
 * @param nodes The nodes to search through.
 * @param searchText The raw, undebounced search text.
 * @returns The matched node id, or null.
 */
function useGraphSearch({
    nodes,
    searchText
}: {
    nodes: Pick<GraphNode, "id" | "label">[];
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

        const match = nodes.find((node) => matchesAllTokens([node.label]));
        return match ? match.id : null;
    }, [nodes, debouncedText]);
}

export { useGraphSearch };
