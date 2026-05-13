import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Maximize2, Minimize2, Move3d, Layers, Scan, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type IfcNode } from "@/lib/twin-data";
import { useProjectTreeQuery } from "@/hooks/use-twin-data";
import { Progress } from "@/components/ui/progress";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IFCLoader } from "web-ifc-three/IFCLoader";
import { fetchEntityProperties } from "@/lib/twin-api";
import { type Triple } from "@/lib/twin-data";
import {
  applyOptimizedIfcMaterials,
  applyDistanceBasedLod,
  createOptimizedLighting,
  PerformanceMonitor,
  disposeObject,
} from "@/lib/geometry-optimization";

type LoadedIfcFile = {
  name: string;
  size: number;
  lastModified: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type ViewerIfcFile = {
  disciplineId: string;
  file: LoadedIfcFile;
  fileKey: string;
  selectionId: string;
};

type LoadedModelRecord = {
  model: THREE.Object3D;
  ifc: ViewerIfcFile;
};

type MaterialSnapshot = {
  transparent: boolean;
  opacity: number;
  color?: THREE.Color;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
};

type ComponentInfoRow = {
  group: string;
  name: string;
  value: string;
};

type ComponentInfo = {
  modelName: string;
  expressId: number;
  globalId: string;
  type: string;
  name: string;
  rows: ComponentInfoRow[];
  loading?: boolean;
  error?: string;
};

type ModelLoadStage = "preparing" | "reading" | "parsing" | "optimizing" | "finalizing";

type ModelLoadState = {
  currentFileName: string;
  currentIndex: number;
  total: number;
  stage: ModelLoadStage;
  largeModel: boolean;
};

const getIfcFileKey = (file: LoadedIfcFile): string => `${file.name}:${file.size}:${file.lastModified}`;
const makeIfcFileSelectionId = (disciplineId: string, fileKey: string): string =>
  `${disciplineId}:ifc-file:${encodeURIComponent(fileKey)}`;

const parseSelectedIfcFile = (value: string | null): { disciplineId: string; fileKey: string } | null => {
  if (!value) return null;

  const marker = ":ifc-file:";
  const markerIndex = value.indexOf(marker);
  if (markerIndex <= 0) return null;

  const disciplineId = value.slice(0, markerIndex);
  const encodedFileKey = value.slice(markerIndex + marker.length);
  if (!disciplineId || !encodedFileKey) return null;

  try {
    return {
      disciplineId,
      fileKey: decodeURIComponent(encodedFileKey),
    };
  } catch {
    return {
      disciplineId,
      fileKey: encodedFileKey,
    };
  }
};

const DISCIPLINE_LABELS: Record<string, string> = {
  "disc-ark": "ARK",
  "disc-rak": "RAK",
  "disc-lvi": "LVI",
  "disc-sahko": "SAHKO",
};

const LARGE_IFC_THRESHOLD_MB = 80;
const MIN_ADAPTIVE_PIXEL_RATIO = 0.65;
const MAX_ADAPTIVE_PIXEL_RATIO = 1.5;
const LOW_FPS_THRESHOLD = 24;
const HIGH_FPS_THRESHOLD = 52;
const BOT_SPACE_TYPE_URI = "https://w3id.org/bot#Space";
const GLOBAL_ID_IFC_ROOT_PROPERTY = "globalIdIfcRoot_attribute_simple";
const BOT_SPACE_HIGHLIGHT_SUBSET_ID = "bot-space-highlight";
const IFC_ENTITY_HIGHLIGHT_SUBSET_ID = "ifc-entity-highlight";
const IFC_MULTI_SELECT_SUBSET_ID = "ifc-multi-select-highlight";

type ClickedIfcEntity = {
  selectionId: string;
  modelID: number;
  expressId: number;
};

const MODEL_STAGE_PROGRESS: Record<ModelLoadStage, number> = {
  preparing: 5,
  reading: 15,
  parsing: 55,
  optimizing: 82,
  finalizing: 100,
};

const MODEL_STAGE_LABELS: Record<ModelLoadStage, string> = {
  preparing: "Preparing viewer",
  reading: "Reading IFC file",
  parsing: "Parsing geometry",
  optimizing: "Optimizing scene",
  finalizing: "Finalizing view",
};

const readIfcLabel = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) {
      return readIfcLabel(obj.value);
    }
    if ("label" in obj) {
      return readIfcLabel(obj.label);
    }
    if ("Name" in obj) {
      return readIfcLabel(obj.Name);
    }
    if ("NominalValue" in obj) {
      return readIfcLabel(obj.NominalValue);
    }
  }

  return "";
};

const valueToDisplay = (value: unknown): string => {
  if (value == null) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => valueToDisplay(item)).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if ("value" in objectValue) {
      return valueToDisplay(objectValue.value);
    }
    if ("NominalValue" in objectValue) {
      return valueToDisplay(objectValue.NominalValue);
    }
    if ("Values" in objectValue) {
      return valueToDisplay(objectValue.Values);
    }
    if ("Description" in objectValue) {
      const description = valueToDisplay(objectValue.Description);
      if (description && description !== "-") {
        return description;
      }
    }

    try {
      return JSON.stringify(objectValue);
    } catch {
      return String(objectValue);
    }
  }

  return String(value);
};

const extractPropertySetRows = (propertySets: unknown): ComponentInfoRow[] => {
  if (!Array.isArray(propertySets)) {
    return [];
  }

  const rows: ComponentInfoRow[] = [];
  for (const propertySet of propertySets) {
    if (!propertySet || typeof propertySet !== "object") continue;

    const pset = propertySet as Record<string, unknown>;
    const group = readIfcLabel(pset.Name) || readIfcLabel(pset.GlobalId) || "Property Set";
    const properties = Array.isArray(pset.HasProperties)
      ? pset.HasProperties
      : Array.isArray(pset.Quantities)
      ? pset.Quantities
      : [];

    for (const propertyItem of properties) {
      if (!propertyItem || typeof propertyItem !== "object") continue;
      const property = propertyItem as Record<string, unknown>;
      const name = readIfcLabel(property.Name) || "Property";
      const value = valueToDisplay(
        property.NominalValue ?? property.Value ?? property.LengthValue ?? property.AreaValue ?? property.VolumeValue
      );

      rows.push({
        group,
        name,
        value,
      });
    }
  }

  return rows;
};

const isWasmAbortError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("aborted");
};

const configureIfcLoaderForLargeModels = async (ifcLoader: IFCLoader, lightweight = false): Promise<void> => {
  await ifcLoader.ifcManager.setWasmPath("/wasm/");

  const manager = ifcLoader.ifcManager as unknown as {
    applyWebIfcConfig?: (config: Record<string, unknown>) => Promise<void>;
    parser?: {
      setupOptionalCategories?: (categories: Record<number, boolean>) => Promise<void>;
    };
    types?: Record<string, number>;
  };

  await manager.applyWebIfcConfig?.({
    COORDINATE_TO_ORIGIN: false,
    USE_FAST_BOOLS: true,
    CIRCLE_SEGMENTS_LOW: lightweight ? 3 : 6,
    CIRCLE_SEGMENTS_MEDIUM: lightweight ? 6 : 12,
    CIRCLE_SEGMENTS_HIGH: lightweight ? 8 : 16,
    BOOL_ABORT_THRESHOLD: lightweight ? 20 : 50,
    MEMORY_LIMIT: lightweight ? 4096 : 2048,
    TAPE_SIZE: lightweight ? 67108864 : 33554432,
  });

  const parser = manager.parser;
  const types = manager.types;
  if (parser?.setupOptionalCategories && types) {
    const categories: Record<number, boolean> = {};

    if (typeof types.IFCSPACE === "number") {
      categories[types.IFCSPACE] = !lightweight;
    }
    if (typeof types.IFCOPENINGELEMENT === "number") {
      categories[types.IFCOPENINGELEMENT] = !lightweight;
    }
    if (typeof types.IFCREINFORCINGBAR === "number") {
      categories[types.IFCREINFORCINGBAR] = !lightweight;
    }

    await parser.setupOptionalCategories(categories);
  }
};

// Find a node by id
const findNode = (nodes: IfcNode[], id: string): IfcNode | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
};

const isRdfTypeProperty = (propertyUri: string): boolean => {
  const lower = propertyUri.toLowerCase();
  return lower.endsWith("#type") || lower.endsWith("/type");
};

const isBotSpaceNode = (properties: Array<{ property: string; value: string }>): boolean => {
  return properties.some(
    (property) => isRdfTypeProperty(property.property) && property.value.toLowerCase() === BOT_SPACE_TYPE_URI.toLowerCase()
  );
};

const readGlobalIdIfcRoot = (properties: Array<{ property: string; value: string }>): string | null => {
  const match = properties.find((property) =>
    property.property.toLowerCase().endsWith(`#${GLOBAL_ID_IFC_ROOT_PROPERTY}`.toLowerCase()) ||
    property.property.toLowerCase().endsWith(`/${GLOBAL_ID_IFC_ROOT_PROPERTY}`.toLowerCase())
  );

  const value = match?.value?.trim();
  return value ? value : null;
};

const resolveNodeUriFromTriples = (selectedId: string | null, semanticTriples?: Triple[]): string | null => {
  if (!selectedId || !semanticTriples?.length) {
    return null;
  }

  return semanticTriples.reduce<string | null>((found, triple) => {
    if (found) {
      return found;
    }
    if (triple.subject.endsWith(`#${selectedId}`) || triple.subject.endsWith(`/${selectedId}`)) {
      return triple.subject;
    }
    if (triple.object.endsWith(`#${selectedId}`) || triple.object.endsWith(`/${selectedId}`)) {
      return triple.object;
    }
    return null;
  }, null);
};

export const ViewerPane = ({
  selectedId,
  onSelect,
  liveMode,
  loadedIfcByDiscipline,
  ifcVisibilityByFile,
  semanticTriples,
  maximized = false,
  onToggleMaximize,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  liveMode: boolean;
  loadedIfcByDiscipline: Record<string, LoadedIfcFile[]>;
  ifcVisibilityByFile: Record<string, boolean>;
  semanticTriples?: Triple[];
  maximized?: boolean;
  onToggleMaximize?: () => void;
}) => {
  const { data: projectTreeData } = useProjectTreeQuery();
  const node = useMemo(() => (selectedId ? findNode(projectTreeData, selectedId) : null), [projectTreeData, selectedId]);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [modelLoadState, setModelLoadState] = useState<ModelLoadState | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({ fps: 0, triangles: 0, drawCalls: 0 });
  const [componentInfo, setComponentInfo] = useState<ComponentInfo | null>(null);
  const [modifierHint, setModifierHint] = useState<"add" | "remove" | null>(null);
  const [cursorHintPosition, setCursorHintPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const selectedIfcFileRef = useRef<{ disciplineId: string; fileKey: string } | null>(null);
  const onSelectRef = useRef(onSelect);
  const modelsRef = useRef<THREE.Object3D[]>([]);
  const loadedModelsBySelectionRef = useRef<Map<string, LoadedModelRecord>>(new Map());
  const visibleSelectionIdsRef = useRef<Set<string>>(new Set());
  const selectedModelHelperRef = useRef<THREE.BoxHelper | null>(null);
  const componentInfoCacheRef = useRef<Map<string, ComponentInfo>>(new Map());
  const componentInfoRequestIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const metricsUpdateRef = useRef<number>(0);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);
  const adaptivePixelRatioRef = useRef<number>(Math.min(window.devicePixelRatio, MAX_ADAPTIVE_PIXEL_RATIO));
  const materialSnapshotsRef = useRef<Map<string, MaterialSnapshot>>(new Map());
  const focusedMaterialSnapshotsRef = useRef<Map<string, MaterialSnapshot>>(new Map());
  const focusedSubsetRef = useRef<THREE.Object3D | null>(null);
  const focusedHighlightMaterialRef = useRef<THREE.Material | null>(null);
  const multiSelectedEntitiesRef = useRef<Map<string, ClickedIfcEntity>>(new Map());
  const multiHighlightSubsetsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const multiHighlightMaterialRef = useRef<THREE.Material | null>(null);
  const guidToExpressIdCacheRef = useRef<Map<string, Map<string, number>>>(new Map());
  const focusedIfcEntityRef = useRef<ClickedIfcEntity | null>(null);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [loadedModelsVersion, setLoadedModelsVersion] = useState(0);
  const selectedIfcFile = useMemo(() => parseSelectedIfcFile(selectedId), [selectedId]);
  const selectedDiscipline = useMemo(() => {
    if (selectedIfcFile) return null;
    if (!selectedId) return null;
    const [disciplineId] = selectedId.split(":");
    return DISCIPLINE_LABELS[disciplineId] ? disciplineId : null;
  }, [selectedId, selectedIfcFile]);

  useEffect(() => {
    selectedIfcFileRef.current = selectedIfcFile;
  }, [selectedIfcFile]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const totalLoadedIfc = useMemo(
    () => Object.values(loadedIfcByDiscipline).reduce((sum, files) => sum + files.length, 0),
    [loadedIfcByDiscipline]
  );
  const viewerFiles = useMemo<ViewerIfcFile[]>(
    () => {
      if (selectedDiscipline) {
        return (loadedIfcByDiscipline[selectedDiscipline] ?? [])
          .map((file) => {
            const fileKey = getIfcFileKey(file);
            return {
              disciplineId: selectedDiscipline,
              file,
              fileKey,
              selectionId: makeIfcFileSelectionId(selectedDiscipline, fileKey),
            };
          });
      }

      return Object.entries(loadedIfcByDiscipline)
        .flatMap(([disciplineId, files]) =>
          files
            .map((file) => {
              const fileKey = getIfcFileKey(file);
              return {
                disciplineId,
                file,
                fileKey,
                selectionId: makeIfcFileSelectionId(disciplineId, fileKey),
              };
            })
        );
    },
    [loadedIfcByDiscipline, selectedDiscipline]
  );

  const visibleSelectionIds = useMemo(() => {
    const visible = new Set<string>();
    for (const viewerFile of viewerFiles) {
      const visibilityKey = `${viewerFile.disciplineId}:${viewerFile.fileKey}`;
      if (ifcVisibilityByFile[visibilityKey] ?? true) {
        visible.add(viewerFile.selectionId);
      }
    }
    return visible;
  }, [viewerFiles, ifcVisibilityByFile]);

  useEffect(() => {
    visibleSelectionIdsRef.current = visibleSelectionIds;
  }, [visibleSelectionIds]);

  const clearSelectedModelHighlight = () => {
    const scene = sceneRef.current;
    const helper = selectedModelHelperRef.current;
    if (!scene || !helper) return;

    scene.remove(helper);
    const material = helper.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
    selectedModelHelperRef.current = null;
  };

  const restoreMaterialVisualization = () => {
    const snapshots = materialSnapshotsRef.current;
    if (!snapshots.size) {
      return;
    }

    for (const model of modelsRef.current) {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const snapshot = snapshots.get(material.uuid);
          if (!snapshot) {
            continue;
          }

          material.transparent = snapshot.transparent;
          material.opacity = snapshot.opacity;

          const mutable = material as THREE.Material & {
            color?: THREE.Color;
            emissive?: THREE.Color;
            emissiveIntensity?: number;
          };

          if (snapshot.color && mutable.color) {
            mutable.color.copy(snapshot.color);
          }
          if (snapshot.emissive && mutable.emissive) {
            mutable.emissive.copy(snapshot.emissive);
          }
          if (typeof snapshot.emissiveIntensity === "number" && typeof mutable.emissiveIntensity === "number") {
            mutable.emissiveIntensity = snapshot.emissiveIntensity;
          }

          material.needsUpdate = true;
        }
      });
    }

    snapshots.clear();
  };

  const clearBotSpaceHighlightSubset = () => {
    const records = loadedModelsBySelectionRef.current;
    for (const record of records.values()) {
      const ifcModel = record.model as {
        modelID?: number;
        ifcManager?: {
          removeSubset?: (modelID: number, material?: unknown, customID?: string) => void;
        };
      };

      if (typeof ifcModel.modelID !== "number") {
        continue;
      }

      ifcModel.ifcManager?.removeSubset?.(ifcModel.modelID, undefined, BOT_SPACE_HIGHLIGHT_SUBSET_ID);
    }
  };

  const clearFocusedEntityHighlightSubset = () => {
    const records = loadedModelsBySelectionRef.current;
    for (const record of records.values()) {
      const ifcModel = record.model as {
        modelID?: number;
        ifcManager?: {
          removeSubset?: (modelID: number, material?: unknown, customID?: string) => void;
        };
      };

      if (typeof ifcModel.modelID !== "number") {
        continue;
      }

      try {
        ifcModel.ifcManager?.removeSubset?.(ifcModel.modelID, undefined, IFC_ENTITY_HIGHLIGHT_SUBSET_ID);
      } catch (error) {
        console.warn("Failed to clear focused IFC entity subset", error);
      }
    }

    const scene = sceneRef.current;
    if (scene && focusedSubsetRef.current) {
      scene.remove(focusedSubsetRef.current);
    }
    focusedSubsetRef.current = null;

    if (focusedHighlightMaterialRef.current) {
      focusedHighlightMaterialRef.current.dispose();
      focusedHighlightMaterialRef.current = null;
    }
  };

  const clearMultiSelectHighlightSubsets = () => {
    const records = loadedModelsBySelectionRef.current;
    for (const record of records.values()) {
      const ifcModel = record.model as {
        modelID?: number;
        ifcManager?: {
          removeSubset?: (modelID: number, material?: unknown, customID?: string) => void;
        };
      };

      if (typeof ifcModel.modelID !== "number") {
        continue;
      }

      try {
        ifcModel.ifcManager?.removeSubset?.(ifcModel.modelID, undefined, IFC_MULTI_SELECT_SUBSET_ID);
      } catch (error) {
        console.warn("Failed to clear multi-select IFC subset", error);
      }
    }

    const scene = sceneRef.current;
    if (scene) {
      for (const subset of multiHighlightSubsetsRef.current.values()) {
        scene.remove(subset);
      }
    }
    multiHighlightSubsetsRef.current.clear();

    if (multiHighlightMaterialRef.current) {
      multiHighlightMaterialRef.current.dispose();
      multiHighlightMaterialRef.current = null;
    }
  };

  const updateMultiSelectHighlight = () => {
    clearMultiSelectHighlightSubsets();

    const entities = Array.from(multiSelectedEntitiesRef.current.values());
    if (!entities.length) {
      return;
    }

    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const highlightMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color("#f8fafc"),
      emissive: new THREE.Color("#22d3ee"),
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
    });
    multiHighlightMaterialRef.current = highlightMaterial;

    const groupedBySelection = new Map<string, { modelID: number; ids: number[] }>();
    for (const entity of entities) {
      const current = groupedBySelection.get(entity.selectionId);
      if (current) {
        current.ids.push(entity.expressId);
      } else {
        groupedBySelection.set(entity.selectionId, { modelID: entity.modelID, ids: [entity.expressId] });
      }
    }

    for (const [selectionId, group] of groupedBySelection.entries()) {
      const record = loadedModelsBySelectionRef.current.get(selectionId);
      if (!record) {
        continue;
      }

      const ifcModel = record.model as {
        ifcManager?: {
          createSubset?: (config: {
            modelID: number;
            ids: number[];
            material?: THREE.Material;
            scene?: THREE.Scene;
            removePrevious?: boolean;
            customID?: string;
          }) => unknown;
        };
      };

      try {
        const subset = ifcModel.ifcManager?.createSubset?.({
          modelID: group.modelID,
          ids: Array.from(new Set(group.ids)),
          material: highlightMaterial,
          scene,
          removePrevious: true,
          customID: IFC_MULTI_SELECT_SUBSET_ID,
        });

        if (subset instanceof THREE.Object3D) {
          multiHighlightSubsetsRef.current.set(selectionId, subset);
        }
      } catch (error) {
        console.warn("Failed to create multi-select IFC subset", error);
      }
    }
  };

  const restoreDefaultIfcVisualization = () => {
    clearBotSpaceHighlightSubset();
    restoreMaterialVisualization();
  };

  const restoreFocusedEntityVisualization = () => {
    const snapshots = focusedMaterialSnapshotsRef.current;

    clearFocusedEntityHighlightSubset();

    if (snapshots.size) {
      for (const model of modelsRef.current) {
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }

          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            try {
              const snapshot = snapshots.get(material.uuid);
              if (!snapshot) {
                continue;
              }

              material.transparent = snapshot.transparent;
              material.opacity = snapshot.opacity;

              const mutable = material as THREE.Material & {
                color?: THREE.Color;
                emissive?: THREE.Color;
                emissiveIntensity?: number;
              };

              if (snapshot.color && mutable.color) {
                mutable.color.copy(snapshot.color);
              }
              if (snapshot.emissive && mutable.emissive) {
                mutable.emissive.copy(snapshot.emissive);
              }
              if (typeof snapshot.emissiveIntensity === "number" && typeof mutable.emissiveIntensity === "number") {
                mutable.emissiveIntensity = snapshot.emissiveIntensity;
              }

              material.needsUpdate = true;
            } catch (error) {
              console.warn("Failed to restore focused IFC material snapshot", error);
            }
          }
        });
      }

      snapshots.clear();
    }

    focusedIfcEntityRef.current = null;
  };

  const applyFocusedEntityVisualization = (focused: ClickedIfcEntity) => {
    const records = loadedModelsBySelectionRef.current;
    const record = records.get(focused.selectionId);
    if (!record) {
      restoreFocusedEntityVisualization();
      return;
    }

    restoreFocusedEntityVisualization();

    let focusedHighlightApplied = false;

    const ifcModel = record.model as {
      modelID?: number;
      ifcManager?: {
        createSubset?: (config: {
          modelID: number;
          ids: number[];
          material?: THREE.Material;
          scene?: THREE.Scene;
          removePrevious?: boolean;
          customID?: string;
        }) => unknown;
      };
    };

    const scene = sceneRef.current;
    if (scene && typeof ifcModel.modelID === "number" && typeof ifcModel.ifcManager?.createSubset === "function") {
      const highlightMaterial = new THREE.MeshLambertMaterial({
        color: new THREE.Color("#f8fafc"),
        emissive: new THREE.Color("#38bdf8"),
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.98,
        depthTest: false,
      });

      try {
        const subset = ifcModel.ifcManager.createSubset({
          modelID: ifcModel.modelID,
          ids: [focused.expressId],
          material: highlightMaterial,
          scene,
          removePrevious: true,
          customID: IFC_ENTITY_HIGHLIGHT_SUBSET_ID,
        });
        focusedHighlightMaterialRef.current = highlightMaterial;
        if (subset instanceof THREE.Object3D) {
          focusedSubsetRef.current = subset;
        }
        focusedHighlightApplied = true;
      } catch (error) {
        highlightMaterial.dispose();
        focusedHighlightMaterialRef.current = null;
        console.warn("Failed to create focused IFC entity subset", error);
      }
    }

    if (!focusedHighlightApplied) {
      focusedIfcEntityRef.current = null;
      return;
    }

    const snapshots = focusedMaterialSnapshotsRef.current;
    for (const model of modelsRef.current) {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          try {
            if (!snapshots.has(material.uuid)) {
              const mutable = material as THREE.Material & {
                color?: THREE.Color;
                emissive?: THREE.Color;
                emissiveIntensity?: number;
              };
              snapshots.set(material.uuid, {
                transparent: material.transparent,
                opacity: material.opacity,
                color: mutable.color ? mutable.color.clone() : undefined,
                emissive: mutable.emissive ? mutable.emissive.clone() : undefined,
                emissiveIntensity:
                  typeof mutable.emissiveIntensity === "number" ? mutable.emissiveIntensity : undefined,
              });
            }

            const mutable = material as THREE.Material & {
              color?: THREE.Color;
              emissive?: THREE.Color;
              emissiveIntensity?: number;
            };

            material.transparent = true;
            material.opacity = Math.max(0.35, material.opacity * 0.6);
            if (mutable.color) {
              mutable.color.multiplyScalar(0.55);
            }
            if (mutable.emissive) {
              mutable.emissive.multiplyScalar(0.45);
            }
            if (typeof mutable.emissiveIntensity === "number") {
              mutable.emissiveIntensity *= 0.6;
            }
            material.needsUpdate = true;
          } catch (error) {
            console.warn("Failed to dim non-selected IFC material", error);
          }
        }
      });
    }

    focusedIfcEntityRef.current = focused;
  };

  const applyDimToAllIfcEntities = () => {
    const snapshots = materialSnapshotsRef.current;
    for (const model of modelsRef.current) {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!snapshots.has(material.uuid)) {
            const mutable = material as THREE.Material & {
              color?: THREE.Color;
              emissive?: THREE.Color;
              emissiveIntensity?: number;
            };
            snapshots.set(material.uuid, {
              transparent: material.transparent,
              opacity: material.opacity,
              color: mutable.color ? mutable.color.clone() : undefined,
              emissive: mutable.emissive ? mutable.emissive.clone() : undefined,
              emissiveIntensity:
                typeof mutable.emissiveIntensity === "number" ? mutable.emissiveIntensity : undefined,
            });
          }

          const mutable = material as THREE.Material & {
            color?: THREE.Color;
            emissive?: THREE.Color;
            emissiveIntensity?: number;
          };

          material.transparent = true;
          material.opacity = 0.18;
          if (mutable.color) {
            mutable.color.multiplyScalar(0.28);
          }
          if (mutable.emissive) {
            mutable.emissive.multiplyScalar(0.2);
          }
          if (typeof mutable.emissiveIntensity === "number") {
            mutable.emissiveIntensity *= 0.35;
          }
          material.needsUpdate = true;
        }
      });
    }
  };

  const findIfcSpaceExpressIdByGuid = async (record: LoadedModelRecord, guid: string): Promise<number | null> => {
    const ifcModel = record.model as {
      modelID?: number;
      ifcManager?: {
        getAllItemsOfType?: (modelID: number, type: number, verbose?: boolean) => Promise<number[]>;
        getItemProperties?: (modelID: number, expressID: number, recursive?: boolean) => Promise<unknown>;
        types?: Record<string, number>;
      };
    };

    if (typeof ifcModel.modelID !== "number") {
      return null;
    }

    const manager = ifcModel.ifcManager;
    if (!manager) {
      return null;
    }

    const cacheKey = record.ifc.selectionId;
    if (!guidToExpressIdCacheRef.current.has(cacheKey)) {
      guidToExpressIdCacheRef.current.set(cacheKey, new Map());
    }

    const cache = guidToExpressIdCacheRef.current.get(cacheKey)!;
    if (cache.has(guid)) {
      return cache.get(guid) ?? null;
    }

    const ifcSpaceType = manager.types?.IFCSPACE;
    if (typeof ifcSpaceType !== "number") {
      cache.set(guid, -1);
      return null;
    }

    const expressIds = await manager.getAllItemsOfType?.(ifcModel.modelID, ifcSpaceType, false);
    if (!Array.isArray(expressIds) || expressIds.length === 0) {
      cache.set(guid, -1);
      return null;
    }

    for (const expressId of expressIds) {
      const itemProperties = await manager.getItemProperties?.(ifcModel.modelID, expressId, false);
      const item = (itemProperties ?? {}) as Record<string, unknown>;
      const itemGuid = readIfcLabel(item.GlobalId).trim();
      if (itemGuid) {
        cache.set(itemGuid, expressId);
      }
      if (itemGuid === guid) {
        return expressId;
      }
    }

    cache.set(guid, -1);
    return null;
  };

  const highlightIfcSpaceByGuid = async (guid: string): Promise<boolean> => {
    const scene = sceneRef.current;
    if (!scene || !modelsRef.current.length) {
      return false;
    }

    let highlightedAny = false;
    const highlightMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.96,
      depthTest: false,
    });

    for (const record of loadedModelsBySelectionRef.current.values()) {
      const ifcModel = record.model as {
        modelID?: number;
        ifcManager?: {
          createSubset?: (config: {
            modelID: number;
            ids: number[];
            material?: THREE.Material;
            scene?: THREE.Scene;
            removePrevious?: boolean;
            customID?: string;
          }) => unknown;
        };
      };

      if (typeof ifcModel.modelID !== "number") {
        continue;
      }

      const expressId = await findIfcSpaceExpressIdByGuid(record, guid);
      if (typeof expressId !== "number" || expressId < 0) {
        continue;
      }

      ifcModel.ifcManager?.createSubset?.({
        modelID: ifcModel.modelID,
        ids: [expressId],
        material: highlightMaterial,
        scene,
        removePrevious: true,
        customID: BOT_SPACE_HIGHLIGHT_SUBSET_ID,
      });

      highlightedAny = true;
    }

    return highlightedAny;
  };

  const updateSelectedModelHighlight = () => {
    clearSelectedModelHighlight();

    const scene = sceneRef.current;
    if (!scene) return;

    const selectedFile = parseSelectedIfcFile(selectedId);
    if (!selectedFile) return;

    const selectionId = makeIfcFileSelectionId(selectedFile.disciplineId, selectedFile.fileKey);
    const selectedModel = modelsRef.current.find((model) => model.userData.ifcSelectionId === selectionId);
    if (!selectedModel) return;

    const helper = new THREE.BoxHelper(selectedModel, 0x38bdf8);
    helper.material.depthTest = false;
    helper.renderOrder = 999;
    helper.update();
    scene.add(helper);
    selectedModelHelperRef.current = helper;
  };

  const resolveModelRecord = (object: THREE.Object3D): LoadedModelRecord | null => {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const selectionId = cursor.userData?.ifcSelectionId;
      if (typeof selectionId === "string") {
        return loadedModelsBySelectionRef.current.get(selectionId) ?? null;
      }
      cursor = cursor.parent;
    }
    return null;
  };

  const resolveClickedIfcEntity = (
    intersection: THREE.Intersection<THREE.Object3D>
  ): ClickedIfcEntity | null => {
    const mesh = intersection.object as THREE.Mesh;
    if (!(mesh instanceof THREE.Mesh)) {
      return null;
    }

    const record = resolveModelRecord(mesh);
    if (!record) {
      return null;
    }

    const ifcModel = record.model as {
      modelID?: number;
      ifcManager?: {
        getExpressId?: (geometry: THREE.BufferGeometry, faceIndex: number) => number;
      };
    };

    const modelID = ifcModel.modelID;
    const manager = ifcModel.ifcManager;
    const faceIndex = intersection.faceIndex;
    if (typeof modelID !== "number" || !manager || typeof faceIndex !== "number") {
      return null;
    }

    const expressId = manager.getExpressId?.(mesh.geometry, faceIndex);
    if (typeof expressId !== "number" || expressId < 0) {
      return null;
    }

    return {
      selectionId: record.ifc.selectionId,
      modelID,
      expressId,
    };
  };

  const toClickedEntityKey = (entity: ClickedIfcEntity): string => `${entity.selectionId}:${entity.expressId}`;

  const loadComponentInfo = async (
    focusedEntity: ClickedIfcEntity
  ): Promise<ClickedIfcEntity | null> => {
    const requestId = ++componentInfoRequestIdRef.current;

    const record = loadedModelsBySelectionRef.current.get(focusedEntity.selectionId);
    if (!record) {
      return null;
    }

    const ifcModel = record.model as {
      modelID?: number;
      ifcManager?: {
        getExpressId?: (geometry: THREE.BufferGeometry, faceIndex: number) => number;
        getItemProperties?: (modelID: number, expressID: number, recursive?: boolean) => Promise<unknown>;
        getPropertySets?: (modelID: number, expressID: number, recursive?: boolean) => Promise<unknown>;
      };
    };

    const modelID = ifcModel.modelID;
    const manager = ifcModel.ifcManager;
    if (typeof modelID !== "number" || !manager) {
      return null;
    }

    const expressId = focusedEntity.expressId;
    if (expressId < 0) {
      return null;
    }

    const cacheKey = `${modelID}:${expressId}`;
    const cached = componentInfoCacheRef.current.get(cacheKey);
    if (cached) {
      if (requestId === componentInfoRequestIdRef.current) {
        setComponentInfo(cached);
      }
      return focusedEntity;
    }

    if (requestId === componentInfoRequestIdRef.current) {
      setComponentInfo({
        modelName: record.ifc.file.name,
        expressId,
        globalId: "",
        type: "",
        name: "",
        rows: [],
        loading: true,
      });
    }

    try {
      const [itemProperties, propertySets] = await Promise.all([
        manager.getItemProperties?.(modelID, expressId, true),
        manager.getPropertySets?.(modelID, expressId, true),
      ]);
      const item = (itemProperties ?? {}) as Record<string, unknown>;

      const info: ComponentInfo = {
        modelName: record.ifc.file.name,
        expressId,
        globalId: readIfcLabel(item.GlobalId),
        type: readIfcLabel(item.type),
        name: readIfcLabel(item.Name),
        rows: extractPropertySetRows(propertySets),
      };

      componentInfoCacheRef.current.set(cacheKey, info);
      if (requestId === componentInfoRequestIdRef.current) {
        setComponentInfo(info);
      }
      return focusedEntity;
    } catch (error) {
      if (requestId === componentInfoRequestIdRef.current) {
        setComponentInfo({
          modelName: record.ifc.file.name,
          expressId,
          globalId: "",
          type: "",
          name: "",
          rows: [],
          error: error instanceof Error ? error.message : "Failed to read IFC properties.",
        });
      }
      return focusedEntity;
    }
  };

  const releaseIfcModel = (scene: THREE.Scene, model: THREE.Object3D) => {
    if (typeof (model as { modelID?: number }).modelID === "number") {
      try {
        const ifcModel = model as {
          modelID: number;
          ifcManager?: { close: (modelID: number, scene?: THREE.Scene) => void };
        };
        ifcModel.ifcManager?.close(ifcModel.modelID, scene);
      } catch (closeError) {
        console.warn("Failed to close IFC model in manager", closeError);
      }
    }
    scene.remove(model);
    disposeObject(model);
  };

  useEffect(() => {
    const records = loadedModelsBySelectionRef.current;
    for (const [selectionId, record] of records.entries()) {
      record.model.visible = visibleSelectionIds.has(selectionId);
    }
    updateSelectedModelHighlight();
  }, [visibleSelectionIds, selectedId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f1117");

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / Math.max(containerRef.current.clientHeight, 1),
      0.1,
      2000
    );
    camera.position.set(12, 9, 12);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio for large models
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false; // Disable shadows for performance on large IFC models
    adaptivePixelRatioRef.current = renderer.getPixelRatio();
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);

    const lights = createOptimizedLighting();
    lights.forEach((light) => scene.add(light));
    scene.add(new THREE.GridHelper(200, 200, 0x2d3340, 0x1b202a));

    const onResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    resizeObserver.observe(container);

    // Initialize performance monitor
    const perfMonitor = new PerformanceMonitor();
    performanceMonitorRef.current = perfMonitor;

    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      perfMonitor.update(renderer);
      const now = performance.now();
      if (now - metricsUpdateRef.current > 1000) {
        metricsUpdateRef.current = now;
        const metrics = perfMonitor.getMetrics();
        setPerformanceMetrics(metrics);

        let nextPixelRatio = adaptivePixelRatioRef.current;
        if (metrics.fps > 0 && metrics.fps < LOW_FPS_THRESHOLD) {
          nextPixelRatio = Math.max(MIN_ADAPTIVE_PIXEL_RATIO, adaptivePixelRatioRef.current - 0.1);
        } else if (metrics.fps > HIGH_FPS_THRESHOLD) {
          const deviceCap = Math.min(window.devicePixelRatio, MAX_ADAPTIVE_PIXEL_RATIO);
          nextPixelRatio = Math.min(deviceCap, adaptivePixelRatioRef.current + 0.1);
        }

        if (Math.abs(nextPixelRatio - adaptivePixelRatioRef.current) > 0.01) {
          adaptivePixelRatioRef.current = nextPixelRatio;
          renderer.setPixelRatio(nextPixelRatio);
          renderer.setSize(container.clientWidth, container.clientHeight, false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);

    const onCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = raycasterRef.current;
      raycaster.setFromCamera({ x, y }, camera);
      const intersects = raycaster.intersectObjects(modelsRef.current, true);
      const isAddSelection = event.ctrlKey;
      const isRemoveSelection = event.altKey;

      if (intersects.length === 0) {
        if (isAddSelection || isRemoveSelection) {
          return;
        }

        componentInfoRequestIdRef.current += 1;
        multiSelectedEntitiesRef.current.clear();
        clearMultiSelectHighlightSubsets();
        restoreFocusedEntityVisualization();
        setComponentInfo(null);
        if (!selectedIfcFileRef.current) return;
        onSelectRef.current(null);
        return;
      }

      const focusedEntity = resolveClickedIfcEntity(intersects[0]);
      if (!focusedEntity) {
        return;
      }

      if (isAddSelection || isRemoveSelection) {
        componentInfoRequestIdRef.current += 1;
        restoreFocusedEntityVisualization();

        const key = toClickedEntityKey(focusedEntity);
        if (isRemoveSelection) {
          multiSelectedEntitiesRef.current.delete(key);
        } else {
          multiSelectedEntitiesRef.current.set(key, focusedEntity);
        }

        updateMultiSelectHighlight();

        if (multiSelectedEntitiesRef.current.size > 1) {
          setComponentInfo(null);
        }
        return;
      }

      multiSelectedEntitiesRef.current.clear();
      clearMultiSelectHighlightSubsets();

      // Apply visual focus immediately; metadata fetch can complete asynchronously.
      applyFocusedEntityVisualization(focusedEntity);
      void loadComponentInfo(focusedEntity);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        setModifierHint("remove");
        if (lastPointerPositionRef.current) {
          setCursorHintPosition(lastPointerPositionRef.current);
        }
      } else if (event.ctrlKey) {
        setModifierHint("add");
        if (lastPointerPositionRef.current) {
          setCursorHintPosition(lastPointerPositionRef.current);
        }
      }

      if (event.key !== "Escape") return;
      if (!selectedIfcFileRef.current) return;
      multiSelectedEntitiesRef.current.clear();
      clearMultiSelectHighlightSubsets();
        restoreFocusedEntityVisualization();
      onSelectRef.current(null);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.altKey && !event.ctrlKey) {
        setModifierHint(null);
        setCursorHintPosition(null);
      }
    };

    const onWindowMouseMove = (event: MouseEvent) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };

      if (!event.altKey && !event.ctrlKey) {
        setModifierHint(null);
        setCursorHintPosition(null);
        return;
      }

      setModifierHint(event.altKey ? "remove" : "add");
      setCursorHintPosition({ x: event.clientX, y: event.clientY });
    };

    renderer.domElement.addEventListener("click", onCanvasClick);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    onResize();
    tick();

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    return () => {
      renderer.domElement.removeEventListener("click", onCanvasClick);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Properly dispose of models
      for (const model of modelsRef.current) {
        releaseIfcModel(scene, model);
      }
      modelsRef.current = [];
      loadedModelsBySelectionRef.current.clear();
      componentInfoCacheRef.current.clear();
      guidToExpressIdCacheRef.current.clear();
      multiSelectedEntitiesRef.current.clear();
      clearMultiSelectHighlightSubsets();
      setCursorHintPosition(null);
      setModifierHint(null);
      setComponentInfo(null);
      restoreDefaultIfcVisualization();
      restoreFocusedEntityVisualization();
      clearSelectedModelHighlight();
      
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      performanceMonitorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    let cancelled = false;

    /**
     * Yields control back to browser to prevent frame freezing during large IFC loads.
     * This allows the browser to handle user input and render frames during loading.
     */
    const yieldToMain = (): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    };

    const paintLoadingState = async (nextState: ModelLoadState): Promise<void> => {
      setModelLoadState(nextState);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 0);
        });
      });
    };

    const loadModels = async () => {
      setViewerError(null);
      const records = loadedModelsBySelectionRef.current;
      const desired = new Map(viewerFiles.map((file) => [file.selectionId, file]));

      restoreFocusedEntityVisualization();
      clearSelectedModelHighlight();

      for (const [selectionId, record] of Array.from(records.entries())) {
        if (desired.has(selectionId)) {
          continue;
        }
        releaseIfcModel(scene, record.model);
        records.delete(selectionId);
      }

      if (!desired.size) {
        modelsRef.current = [];
        setLoadedModelsVersion((value) => value + 1);
        setModelLoadState(null);
        return;
      }

      const box = new THREE.Box3();
      const filesToLoad = Array.from(desired.values()).filter((file) => !records.has(file.selectionId));

      if (filesToLoad.length > 0) {
        await paintLoadingState({
          currentFileName: filesToLoad[0].file.name,
          currentIndex: 1,
          total: filesToLoad.length,
          stage: "preparing",
          largeModel: filesToLoad[0].file.size >= LARGE_IFC_THRESHOLD_MB * 1024 * 1024,
        });
      } else {
        setModelLoadState(null);
      }

      for (let i = 0; i < filesToLoad.length; i++) {
        const viewerFile = filesToLoad[i];
        const file = viewerFile.file;
        try {
          let model: THREE.Object3D;
          const isLargeIfc = file.size >= LARGE_IFC_THRESHOLD_MB * 1024 * 1024;

          await paintLoadingState({
            currentFileName: file.name,
            currentIndex: i + 1,
            total: filesToLoad.length,
            stage: "reading",
            largeModel: isLargeIfc,
          });

          const buffer = await file.arrayBuffer();

          await paintLoadingState({
            currentFileName: file.name,
            currentIndex: i + 1,
            total: filesToLoad.length,
            stage: "parsing",
            largeModel: isLargeIfc,
          });

          if (isLargeIfc) {
            const lightweightLoader = new IFCLoader();
            await configureIfcLoaderForLargeModels(lightweightLoader, true);
            model = await lightweightLoader.parse(buffer);
          } else {
            const primaryLoader = new IFCLoader();
            await configureIfcLoaderForLargeModels(primaryLoader, false);

            try {
              model = await primaryLoader.parse(buffer);
            } catch (error) {
              if (!isWasmAbortError(error)) {
                throw error;
              }

              console.warn(
                `IFC parser aborted for ${file.name}. Retrying with lightweight parser settings...`,
                error
              );

              const fallbackLoader = new IFCLoader();
              await configureIfcLoaderForLargeModels(fallbackLoader, true);
              model = await fallbackLoader.parse(buffer);
            }
          }

          if (cancelled) {
            disposeObject(model);
            continue;
          }

          await paintLoadingState({
            currentFileName: file.name,
            currentIndex: i + 1,
            total: filesToLoad.length,
            stage: "optimizing",
            largeModel: isLargeIfc,
          });
          
          applyOptimizedIfcMaterials(model);

          if (isLargeIfc) {
            applyDistanceBasedLod(model, {
              minVertices: 8000,
              mediumRatio: 0.6,
              lowRatio: 0.3,
              mediumDistance: 90,
              lowDistance: 200,
            });
          }

          model.userData.ifcSelectionId = viewerFile.selectionId;
          model.visible = visibleSelectionIdsRef.current.has(viewerFile.selectionId);
          
          scene.add(model);
          records.set(viewerFile.selectionId, { model, ifc: viewerFile });

          await paintLoadingState({
            currentFileName: file.name,
            currentIndex: i + 1,
            total: filesToLoad.length,
            stage: "finalizing",
            largeModel: isLargeIfc,
          });

          // Yield to main thread after each model to prevent UI freezing
          // This allows browser to handle user interactions during large file loads
          if (i < filesToLoad.length - 1) {
            await yieldToMain();
          }
        } catch (error) {
          console.error(`Failed to load IFC model: ${file.name}`, error);
          if (isWasmAbortError(error)) {
            setViewerError(
              `Failed to load ${file.name} due to IFC parser memory limits. Try loading only this file, reducing model detail, or splitting the IFC file.`
            );
          } else {
            setViewerError(`Failed to load ${file.name}. Check browser console for IFC parser details.`);
          }
        }
      }

      setModelLoadState(null);

      modelsRef.current = Array.from(records.values()).map((record) => record.model);
      setLoadedModelsVersion((value) => value + 1);

      for (const record of records.values()) {
        if (!record.model.visible) {
          continue;
        }
        box.expandByObject(record.model);
      }

      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3()).length() || 10;
        controls.target.copy(center);
        camera.position.set(
          center.x + size * 0.8,
          center.y + size * 0.5,
          center.z + size * 0.8
        );
        camera.near = 0.1;
        camera.far = Math.max(2000, size * 10);
        camera.updateProjectionMatrix();
      }

      updateSelectedModelHighlight();
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [viewerFiles]);

  useEffect(() => {
    updateSelectedModelHighlight();

    return () => {
      clearSelectedModelHighlight();
    };
  }, [selectedId]);

  useEffect(() => {
    const focused = focusedIfcEntityRef.current;
    if (!focused) {
      return;
    }

    if (!selectedId) {
      restoreFocusedEntityVisualization();
      return;
    }

    const selectedFile = parseSelectedIfcFile(selectedId);
    if (!selectedFile) {
      restoreFocusedEntityVisualization();
      return;
    }

    const currentSelectionId = makeIfcFileSelectionId(selectedFile.disciplineId, selectedFile.fileKey);
    if (currentSelectionId !== focused.selectionId) {
      restoreFocusedEntityVisualization();
    }
  }, [selectedId]);

  useEffect(() => {
    const validSelectionIds = new Set(viewerFiles.map((file) => file.selectionId));
    let changed = false;

    for (const [key, entity] of multiSelectedEntitiesRef.current.entries()) {
      if (!validSelectionIds.has(entity.selectionId)) {
        multiSelectedEntitiesRef.current.delete(key);
        changed = true;
      }
    }

    if (changed) {
      updateMultiSelectHighlight();
      if (multiSelectedEntitiesRef.current.size > 1) {
        setComponentInfo(null);
      }
    }
  }, [viewerFiles]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      restoreDefaultIfcVisualization();

      if (!selectedId) {
        return;
      }

      const selectedNodeUri = resolveNodeUriFromTriples(selectedId, semanticTriples);
      if (!selectedNodeUri) {
        return;
      }

      const properties = await fetchEntityProperties(selectedNodeUri);
      if (cancelled) {
        return;
      }

      if (!isBotSpaceNode(properties)) {
        return;
      }

      const globalId = readGlobalIdIfcRoot(properties);
      if (!globalId) {
        return;
      }

      applyDimToAllIfcEntities();
      const highlighted = await highlightIfcSpaceByGuid(globalId);
      if (!highlighted) {
        restoreDefaultIfcVisualization();
      }
    };

    void run();

    return () => {
      cancelled = true;
      restoreDefaultIfcVisualization();
    };
  }, [loadedModelsVersion, selectedId, semanticTriples]);


  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-card/40">
      {modelLoadState && (
        <div className="absolute inset-x-4 top-16 z-30 rounded-xl border border-primary/20 bg-background/92 p-4 shadow-elevated backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-foreground">Loading IFC model</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {MODEL_STAGE_LABELS[modelLoadState.stage]} {modelLoadState.currentIndex} of {modelLoadState.total}: {modelLoadState.currentFileName}
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
              {MODEL_STAGE_PROGRESS[modelLoadState.stage]}%
            </div>
          </div>
          <Progress className="mt-3 h-2 bg-primary/10" value={MODEL_STAGE_PROGRESS[modelLoadState.stage]} />
          <div className="mt-3 text-[11px] text-muted-foreground">
            {modelLoadState.largeModel
              ? "Large IFC detected. Geometry parsing can briefly monopolize the browser thread. Keep this tab open while the viewer finishes loading."
              : "The viewer is preparing geometry and materials. You can wait here without reloading the page."}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 glass rounded-md p-1">
        {[Move3d, Scan, Layers].map((Icon, i) => (
          <button
            key={i}
            className={cn(
              "h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
              i === 0 && "text-primary bg-primary/10"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button
          onClick={onToggleMaximize}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 glass rounded-md px-2.5 py-1.5">
          <Box className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            IFC.js Viewer
          </span>
          <span className="text-[10px] font-mono text-primary">{totalLoadedIfc} loaded</span>
        </div>
      </div>

      {/* IFC.js canvas */}
      <div className="absolute inset-0 grid-bg">
        <div className="absolute inset-0 bg-gradient-glow" />
        <div ref={containerRef} className="absolute inset-0" />

        {/* Compass */}
        <div className="absolute bottom-3 right-3 glass rounded-full h-12 w-12 flex items-center justify-center">
          <div className="text-[10px] font-mono">
            <div className="text-primary text-center">N</div>
          </div>
        </div>

        {/* Coords & Performance Metrics */}
        <div className="absolute bottom-3 left-3 glass rounded-md px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          <div>FPS: {performanceMetrics.fps} · {performanceMetrics.triangles.toLocaleString()} tris · {performanceMetrics.drawCalls} calls</div>
        </div>

        {viewerError && (
          <div className="absolute left-3 top-16 z-20 max-w-[520px] rounded border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
            {viewerError}
          </div>
        )}

        {componentInfo && (
          <div className="absolute right-3 top-16 z-20 w-[420px] max-w-[calc(100%-1.5rem)] rounded border border-border/60 bg-background/95 backdrop-blur-md shadow-elevated">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <div>
                <div className="text-xs font-semibold">IFC Component</div>

            {modifierHint && cursorHintPosition && (
              <div
                className="pointer-events-none fixed z-[200] rounded-md border border-primary/60 bg-background px-2 py-0.5 text-sm font-bold text-primary shadow-[0_0_0_1px_rgba(14,165,233,0.35),0_6px_14px_rgba(15,23,42,0.45)]"
                style={{ left: `${cursorHintPosition.x + 14}px`, top: `${cursorHintPosition.y + 14}px` }}
                aria-hidden="true"
              >
                {modifierHint === "add" ? "+" : "-"}
              </div>
            )}
                <div className="text-[10px] font-mono text-muted-foreground truncate">{componentInfo.modelName}</div>
              </div>
              <button
                onClick={() => setComponentInfo(null)}
                className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Close component info"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-3 py-2 text-[11px]">
              <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 text-muted-foreground">
                <div>Express ID</div>
                <div className="text-foreground font-mono">{componentInfo.expressId}</div>
                <div>Name</div>
                <div className="text-foreground">{componentInfo.name || "-"}</div>
                <div>Type</div>
                <div className="text-foreground">{componentInfo.type || "-"}</div>
                <div>GlobalId</div>
                <div className="text-foreground font-mono break-all">{componentInfo.globalId || "-"}</div>
              </div>

              <div className="mt-3 rounded border border-border/60 overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-secondary/60 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1 font-medium">Property Set</th>
                      <th className="text-left px-2 py-1 font-medium">Property</th>
                      <th className="text-left px-2 py-1 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentInfo.loading ? (
                      <tr>
                        <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                          Loading IFC properties...
                        </td>
                      </tr>
                    ) : componentInfo.error ? (
                      <tr>
                        <td className="px-2 py-2 text-destructive" colSpan={3}>
                          {componentInfo.error}
                        </td>
                      </tr>
                    ) : componentInfo.rows.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                          No property set data found for this component.
                        </td>
                      </tr>
                    ) : (
                      componentInfo.rows.map((row, index) => (
                        <tr key={`${row.group}:${row.name}:${index}`} className="border-t border-border/40">
                          <td className="px-2 py-1.5 text-muted-foreground">{row.group}</td>
                          <td className="px-2 py-1.5">{row.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground break-all">{row.value}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>
  );
};
