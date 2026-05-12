// Shared mock data + types for Helix Twin
export type IfcNode = {
  id: string;
  name: string;
  type: "Project" | "Discipline" | "Storey" | "Space" | "Element";
  children?: IfcNode[];
};

export const projectTree: IfcNode[] = [
  {
    id: "project-1",
    name: "Metropolia Myllypuro Campus",
    type: "Project",
    children: [
      {
        id: "disc-ark",
        name: "ARK — Architectural",
        type: "Discipline",
        children: [
          {
            id: "storey-ark-1",
            name: "Level 01 — Lobby",
            type: "Storey",
            children: [
              { id: "space-ark-1-1", name: "Reception Hall", type: "Space" },
              { id: "elem-ark-1-2", name: "Curtain Wall · CW-104", type: "Element" },
            ],
          },
          {
            id: "storey-ark-2",
            name: "Level 02 — Open Office",
            type: "Storey",
            children: [
              { id: "space-a-2-1", name: "Workspace West", type: "Space" },
              { id: "space-a-2-2", name: "Workspace East", type: "Space" },
            ],
          },
          {
            id: "storey-ark-3",
            name: "Level 03 — Labs",
            type: "Storey",
            children: [
              { id: "space-a-3-1", name: "Cleanroom 3A", type: "Space" },
            ],
          },
        ],
      },
      { id: "disc-rak", name: "RAK — Structural", type: "Discipline" },
      { id: "disc-lvi", name: "LVI — HVAC & Plumbing", type: "Discipline" },
      { id: "disc-sahko", name: "SÄHKÖ — Electrical", type: "Discipline" },
    ],
  },
];

export type Sensor = {
  id: string;
  name: string;
  kind: "Temp" | "CO₂" | "Occupancy" | "Power" | "Humidity";
  status: "live" | "idle" | "alert";
  value: number;
  unit: string;
  bound: string; // bound element id
};

export const sensors: Sensor[] = [
  { id: "s-001", name: "TMP-A2-W", kind: "Temp", status: "live", value: 22.4, unit: "°C", bound: "space-a-2-1" },
  { id: "s-002", name: "CO2-A2-W", kind: "CO₂", status: "live", value: 612, unit: "ppm", bound: "space-a-2-1" },
  { id: "s-003", name: "OCC-A2-E", kind: "Occupancy", status: "live", value: 14, unit: "ppl", bound: "space-a-2-2" },
  { id: "s-004", name: "PWR-CH-301", kind: "Power", status: "alert", value: 184.2, unit: "kW", bound: "elem-a-3-2" },
  { id: "s-005", name: "HUM-3A", kind: "Humidity", status: "live", value: 41, unit: "%", bound: "space-a-3-1" },
  { id: "s-006", name: "TMP-LOBBY", kind: "Temp", status: "idle", value: 19.8, unit: "°C", bound: "space-a-1-1" },
  { id: "s-007", name: "PWR-AHU-02", kind: "Power", status: "live", value: 47.6, unit: "kW", bound: "elem-a-2-3" },
];

export type Triple = { subject: string; predicate: string; object: string };

export const triples: Triple[] = [
  { subject: "ifc:Building_A", predicate: "bot:hasStorey", object: "ifc:Storey_L02" },
  { subject: "ifc:Storey_L02", predicate: "bot:hasSpace", object: "ifc:Space_Workspace_W" },
  { subject: "ifc:Space_Workspace_W", predicate: "saref:measuredBy", object: "iot:Sensor_TMP-A2-W" },
  { subject: "iot:Sensor_TMP-A2-W", predicate: "saref:hasValue", object: "22.4 °C" },
  { subject: "ifc:Chiller_CH-301", predicate: "fso:supplies", object: "ifc:AHU-02" },
  { subject: "ifc:AHU-02", predicate: "fso:serves", object: "ifc:Storey_L02" },
  { subject: "iot:Sensor_PWR-CH-301", predicate: "saref:hasState", object: "saref:Alert" },
  { subject: "ifc:CurtainWall_CW-104", predicate: "bot:adjacentZone", object: "ifc:Space_Reception_Hall" },
];
