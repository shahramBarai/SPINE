import { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type {
    SchemaFilters as SchemaFiltersType,
    SchemaType
} from "@server/clients/schemaRegistryClient";
import { Input } from "components/basics/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";

interface SchemaFiltersProps {
    onFiltersChange: (filters: SchemaFiltersType) => void;
}

const ALL_TYPES = "all";

function SchemaFilters({ onFiltersChange }: SchemaFiltersProps) {
    const [search, setSearch] = useState("");
    const [schemaType, setSchemaType] = useState<string>(ALL_TYPES);
    const [topic, setTopic] = useState("");

    // Each handler passes its own new value through, since the state it sets
    // isn't visible yet on this render.
    const emitFilters = (overrides: Partial<SchemaFiltersType>) => {
        const filters: SchemaFiltersType = {
            search: search || undefined,
            schemaType:
                schemaType === ALL_TYPES
                    ? undefined
                    : (schemaType as SchemaType),
            topic: topic || undefined,
            ...overrides
        };

        // Drop empty keys so the backend sees an absent filter, not undefined.
        (Object.keys(filters) as (keyof SchemaFiltersType)[]).forEach((key) => {
            if (filters[key] === undefined) {
                delete filters[key];
            }
        });

        onFiltersChange(filters);
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        emitFilters({ search: value || undefined });
    };

    const handleSchemaTypeChange = (value: string) => {
        setSchemaType(value);
        emitFilters({
            schemaType: value === ALL_TYPES ? undefined : (value as SchemaType)
        });
    };

    const handleTopicChange = (value: string) => {
        setTopic(value);
        emitFilters({ topic: value || undefined });
    };

    return (
        <div className="bg-card p-4 rounded-lg border border-border space-y-4">
            <h3 className="text-lg font-medium text-foreground">Filters</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search subjects..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <Select
                    value={schemaType}
                    onValueChange={handleSchemaTypeChange}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_TYPES}>All Types</SelectItem>
                        <SelectItem value="AVRO">AVRO</SelectItem>
                        <SelectItem value="JSON">JSON</SelectItem>
                        <SelectItem value="PROTOBUF">PROTOBUF</SelectItem>
                    </SelectContent>
                </Select>

                <Input
                    type="text"
                    placeholder="Filter by topic..."
                    value={topic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                />
            </div>
        </div>
    );
}

export { SchemaFilters };
