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

type SharedDictionary = Record<string, unknown>;

export type DigitalTwinFloorOption = {
    key: string;
    label: string;
};

type DigitalTwinContextValue = {
    projectInfo: ProjectInfo | null;
    setProjectInfo: Dispatch<SetStateAction<ProjectInfo | null>>;
    focusObjectId: string | null;
    setFocusObjectId: Dispatch<SetStateAction<string | null>>;
    selectedIds: string[];
    setSelectedIds: Dispatch<SetStateAction<string[]>>;
    ifcFilesVisibility: string[];
    setIfcFilesVisibility: Dispatch<SetStateAction<string[]>>;
    selectedFloorKeys: string[];
    setSelectedFloorKeys: Dispatch<SetStateAction<string[]>>;
    // Not used for now:
    loadedIfcByDiscipline: Record<string, File[]>;
    setLoadedIfcByDiscipline: Dispatch<SetStateAction<Record<string, File[]>>>;
    floorOptions: DigitalTwinFloorOption[];
    setFloorOptions: Dispatch<SetStateAction<DigitalTwinFloorOption[]>>;
    selectedComponentInfo: SharedDictionary | null;
    setSelectedComponentInfo: Dispatch<SetStateAction<SharedDictionary | null>>;
    sharedObjects: SharedDictionary;
    setSharedObject: (key: string, value: unknown) => void;
};

const DigitalTwinContext = createContext<DigitalTwinContextValue | undefined>(
    undefined
);

export function DigitalTwinProvider({ children }: { children: ReactNode }) {
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [focusObjectId, setFocusObjectId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [loadedIfcByDiscipline, setLoadedIfcByDiscipline] = useState<
        Record<string, File[]>
    >({});
    const [ifcFilesVisibility, setIfcFilesVisibility] = useState<string[]>([]);
    const [selectedFloorKeys, setSelectedFloorKeys] = useState<string[]>([]);
    const [floorOptions, setFloorOptions] = useState<DigitalTwinFloorOption[]>(
        []
    );
    const [selectedComponentInfo, setSelectedComponentInfo] =
        useState<SharedDictionary | null>(null);
    const [sharedObjects, setSharedObjects] = useState<SharedDictionary>({});

    const setSharedObject = (key: string, value: unknown) => {
        setSharedObjects((current) => ({
            ...current,
            [key]: value
        }));
    };

    const value = useMemo<DigitalTwinContextValue>(
        () => ({
            projectInfo,
            setProjectInfo,
            focusObjectId,
            setFocusObjectId,
            selectedIds,
            setSelectedIds,
            loadedIfcByDiscipline,
            setLoadedIfcByDiscipline,
            ifcFilesVisibility,
            setIfcFilesVisibility,
            selectedFloorKeys,
            setSelectedFloorKeys,
            floorOptions,
            setFloorOptions,
            selectedComponentInfo,
            setSelectedComponentInfo,
            sharedObjects,
            setSharedObject
        }),
        [
            projectInfo,
            focusObjectId,
            selectedIds,
            loadedIfcByDiscipline,
            ifcFilesVisibility,
            selectedFloorKeys,
            floorOptions,
            selectedComponentInfo,
            sharedObjects
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
