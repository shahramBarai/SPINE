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
    selectedObjectId: string | null;
    setSelectedObjectId: Dispatch<SetStateAction<string | null>>;
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
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
        null
    );
    const [focusId, setFocusId] = useState<string>(initialFocusId);
    const [ttlFilesHidden, setTtlFilesHidden] = useState<string[]>([]);

    const value = useMemo<DigitalTwinContextValue>(
        () => ({
            projectInfo,
            selectedObjectId,
            setSelectedObjectId,
            focusId,
            setFocusId,
            ttlFilesHidden,
            setTtlFilesHidden
        }),
        [projectInfo, selectedObjectId, focusId, ttlFilesHidden]
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
