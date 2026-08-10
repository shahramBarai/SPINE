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

/** Shared state across digital-twin windows (sidebar, 3D viewer) -
 *  window-local concerns stay in that window's own hooks. */
type DigitalTwinContextValue = {
    projectInfo: ProjectInfo;

    selectedObjectId: string | null;
    selectObject: (id: string) => void;
    clearSelection: () => void;

    visibleIfcFiles: SelectedIfcFile[];
    toggleIfcFile: (file: SelectedIfcFile) => void;

    ttlFilesHidden: string[];
    setTtlFilesHidden: Dispatch<SetStateAction<string[]>>;
};

const DigitalTwinContext = createContext<DigitalTwinContextValue | undefined>(
    undefined
);

export function DigitalTwinProvider({
    projectInfo,
    children
}: {
    projectInfo: ProjectInfo;
    children: ReactNode;
}) {
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
        null
    );
    const [visibleIfcFiles, setVisibleIfcFiles] = useState<SelectedIfcFile[]>(
        []
    );
    const [ttlFilesHidden, setTtlFilesHidden] = useState<string[]>([]);

    const selectObject = useCallback(
        (id: string) => setSelectedObjectId(id),
        []
    );
    const clearSelection = useCallback(() => setSelectedObjectId(null), []);

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
            selectedObjectId,
            selectObject,
            clearSelection,
            visibleIfcFiles,
            toggleIfcFile,
            ttlFilesHidden,
            setTtlFilesHidden
        }),
        [
            projectInfo,
            selectedObjectId,
            selectObject,
            clearSelection,
            visibleIfcFiles,
            toggleIfcFile,
            ttlFilesHidden
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
