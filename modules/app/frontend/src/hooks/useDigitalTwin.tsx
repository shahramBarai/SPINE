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
    // The object currently clicked/highlighted - changes freely, on every
    // click (canvas node, tree node, search match, ...).
    selectedObjectId: string | null;
    setSelectedObjectId: Dispatch<SetStateAction<string | null>>;
    // The node views like the Relationship Graph are centered on/scoped to -
    // deliberately separate from selectedObjectId so that clicking around
    // doesn't silently move what's being fetched; only an explicit "confirm"
    // action (e.g. a button in SelectionPanel) should call setFocusId.
    focusId: string | null;
    setFocusId: Dispatch<SetStateAction<string | null>>;
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
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
        null
    );
    const [focusId, setFocusId] = useState<string | null>(null);
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
            selectedObjectId,
            setSelectedObjectId,
            focusId,
            setFocusId,
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
            selectedObjectId,
            focusId,
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
