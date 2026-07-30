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

export type SelectedIfcFile = {
    discipline: string;
    fileId: string;
    fileName: string;
};

/** Shared state across digital-twin windows (sidebar, graph pane, 3D
 *  viewer) - window-local concerns stay in that window's own hooks. */
type DigitalTwinContextValue = {
    projectInfo: ProjectInfo;

    selectedObjectIds: string[];
    setSelectedObjectIds: Dispatch<SetStateAction<string[]>>;
    selectObject: (id: string, sameAsIds?: string[]) => void;
    clearSelection: () => void;

    focusId: string;
    setFocusId: Dispatch<SetStateAction<string>>;

    visibleIfcFiles: SelectedIfcFile[];
    toggleIfcFile: (file: SelectedIfcFile) => void;

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
    const [visibleIfcFiles, setVisibleIfcFiles] = useState<SelectedIfcFile[]>(
        []
    );
    const [ttlFilesHidden, setTtlFilesHidden] = useState<string[]>([]);
    const [searchText, setSearchText] = useState("");
    const [selectedNodeTypes, setSelectedNodeTypes] =
        useState<Set<string> | null>(null);
    const [selectedPredicates, setSelectedPredicates] =
        useState<Set<string> | null>(null);

    const selectObject = useCallback(
        (id: string, sameAsIds: string[] = []) =>
            setSelectedObjectIds([id, ...sameAsIds]),
        []
    );
    const clearSelection = useCallback(() => setSelectedObjectIds([]), []);

    /** Adds `file` to the visible set, or removes it if already present. */
    const toggleIfcFile = useCallback((file: SelectedIfcFile) => {
        setVisibleIfcFiles((current) =>
            current.some((f) => f.fileId === file.fileId)
                ? current.filter((f) => f.fileId !== file.fileId)
                : [...current, file]
        );
    }, []);

    const value = useMemo<DigitalTwinContextValue>(
        () => ({
            projectInfo,
            selectedObjectIds,
            setSelectedObjectIds,
            selectObject,
            clearSelection,
            focusId,
            setFocusId,
            visibleIfcFiles,
            toggleIfcFile,
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
            visibleIfcFiles,
            toggleIfcFile,
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
