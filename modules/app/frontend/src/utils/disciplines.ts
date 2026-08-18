import {
    Building,
    Building2,
    Unplug,
    HousePlug,
    Cpu,
    BrickWall,
    AudioWaveform,
    type LucideIcon
} from "lucide-react";

interface Discipline {
    id: string;
    name: string;
    icon: LucideIcon;
}

// Suggested folder names - naming a folder after one of these is what makes
// its IFC/TTL files show up in a dedicated section on the digital twin page
// (see ProjectTreeSection); any other folder name still works for plain
// storage, it just won't get a discipline section there.
const DISCIPLINES: Discipline[] = [
    { id: "disc-ark", name: "ARK - Architectural", icon: Building },
    { id: "disc-rak", name: "RAK - Structural", icon: BrickWall },
    { id: "disc-lvi", name: "LVI - HVAC & Plumbing", icon: AudioWaveform },
    { id: "disc-sahko", name: "SÄHKÖ - Electrical", icon: HousePlug },
    { id: "sensor-node", name: "Sensor", icon: Cpu },
    { id: "disc-sahko:linkset", name: "Linkset", icon: Unplug }
];

function getDisciplineIcon(folder: string): LucideIcon {
    return DISCIPLINES.find((d) => d.id === folder)?.icon ?? Building2;
}

export { DISCIPLINES, getDisciplineIcon, type Discipline };
