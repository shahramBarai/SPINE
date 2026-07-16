import {
    createContext,
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

type DigitalTwinContextValue = {
    projectInfo: ProjectInfo;
    selectedObjectIds: string[];
    setSelectedObjectIds: Dispatch<SetStateAction<string[]>>;
    focusId: string;
    setFocusId: Dispatch<SetStateAction<string>>;
    ttlFilesHidden: string[];
    setTtlFilesHidden: Dispatch<SetStateAction<string[]>>;
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

    const value = useMemo<DigitalTwinContextValue>(
        () => ({
            projectInfo,
            selectedObjectIds,
            setSelectedObjectIds,
            focusId,
            setFocusId,
            ttlFilesHidden,
            setTtlFilesHidden
        }),
        [projectInfo, selectedObjectIds, focusId, ttlFilesHidden]
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
