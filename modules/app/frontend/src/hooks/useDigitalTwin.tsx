import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction
} from "react";

type ProjectInfo = {
    id: string;
    name: string;
};

// Everything a digital-twin window (sidebar, graph pane, and future 3D
// viewer / semantic data panels) needs to share so an action in one window
// (select a node, search, hide a type) is reflected in every other one.
// Window-local concerns - physics simulation, SVG pan/zoom, and similar
// rendering state - stay in that window's own hooks instead of here.
type DigitalTwinContextValue = {
    projectInfo: ProjectInfo;

    selectedObjectIds: string[];
    setSelectedObjectIds: Dispatch<SetStateAction<string[]>>;
    selectObject: (id: string, sameAsIds?: string[]) => void;
    clearSelection: () => void;

    focusId: string;
    setFocusId: Dispatch<SetStateAction<string>>;

    ttlFilesHidden: string[];
    setTtlFilesHidden: Dispatch<SetStateAction<string[]>>;

    searchText: string;
    setSearchText: Dispatch<SetStateAction<string>>;

    selectedNodeTypes: Set<string> | null;
    setSelectedNodeTypes: Dispatch<SetStateAction<Set<string> | null>>;
    selectedPredicates: Set<string> | null;
    setSelectedPredicates: Dispatch<SetStateAction<Set<string> | null>>;
};

const DigitalTwinContext = createContext<DigitalTwinContextValue | undefined>(
    undefined
);

export function DigitalTwinProvider({
    projectInfo,
    focusId: initialFocusId,
    children
}: {
    projectInfo: ProjectInfo;
    focusId: string;
    children: ReactNode;
}) {
    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
    const [focusId, setFocusId] = useState<string>(initialFocusId);
    const [ttlFilesHidden, setTtlFilesHidden] = useState<string[]>([]);
    const [searchText, setSearchText] = useState("");
    const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<
        string
    > | null>(null);
    const [selectedPredicates, setSelectedPredicates] = useState<Set<
        string
    > | null>(null);

    const selectObject = useCallback(
        (id: string, sameAsIds: string[] = []) =>
            setSelectedObjectIds([id, ...sameAsIds]),
        []
    );
    const clearSelection = useCallback(() => setSelectedObjectIds([]), []);

    const value = useMemo<DigitalTwinContextValue>(
        () => ({
            projectInfo,
            selectedObjectIds,
            setSelectedObjectIds,
            selectObject,
            clearSelection,
            focusId,
            setFocusId,
            ttlFilesHidden,
            setTtlFilesHidden,
            searchText,
            setSearchText,
            selectedNodeTypes,
            setSelectedNodeTypes,
            selectedPredicates,
            setSelectedPredicates
        }),
        [
            projectInfo,
            selectedObjectIds,
            selectObject,
            clearSelection,
            focusId,
            ttlFilesHidden,
            searchText,
            selectedNodeTypes,
            selectedPredicates
        ]
    );

    return (
        <DigitalTwinContext.Provider value={value}>
            {children}
        </DigitalTwinContext.Provider>
    );
}

export function useDigitalTwin() {
    const ctx = useContext(DigitalTwinContext);
    if (!ctx) {
        throw new Error(
            "useDigitalTwin must be used within a DigitalTwinProvider"
        );
    }

    return ctx;
}
