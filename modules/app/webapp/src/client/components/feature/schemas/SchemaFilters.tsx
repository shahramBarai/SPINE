import { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Input } from "@/client/components/basics/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/basics/select";
import { SchemaFilters as SchemaFiltersType } from "@/server/schemas/schema-registry";

interface SchemaFiltersProps {
  onFiltersChange: (filters: SchemaFiltersType) => void;
}

export const SchemaFilters: React.FC<SchemaFiltersProps> = ({
  onFiltersChange,
}) => {
  const [search, setSearch] = useState("");
  const [schemaType, setSchemaType] = useState<string>("all");
  const [topic, setTopic] = useState("");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    updateFilters({ search: value || undefined });
  };

  const handleSchemaTypeChange = (value: string) => {
    setSchemaType(value);
    updateFilters({ 
      schemaType: value === "all" ? undefined : (value as "AVRO" | "JSON" | "PROTOBUF")
    });
  };

  const handleTopicChange = (value: string) => {
    setTopic(value);
    updateFilters({ topic: value || undefined });
  };

  const updateFilters = (newFilter: Partial<SchemaFiltersType>) => {
    const filters: SchemaFiltersType = {
      search: search || undefined,
      schemaType: schemaType === "all" ? undefined : (schemaType as "AVRO" | "JSON" | "PROTOBUF"),
      topic: topic || undefined,
      ...newFilter,
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof SchemaFiltersType] === undefined) {
        delete filters[key as keyof SchemaFiltersType];
      }
    });
    
    onFiltersChange(filters);
  };

  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Schema Type Filter */}
        <Select value={schemaType} onValueChange={handleSchemaTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="AVRO">AVRO</SelectItem>
            <SelectItem value="JSON">JSON</SelectItem>
            <SelectItem value="PROTOBUF">PROTOBUF</SelectItem>
          </SelectContent>
        </Select>

        {/* Topic Filter */}
        <Input
          type="text"
          placeholder="Filter by topic..."
          value={topic}
          onChange={(e) => handleTopicChange(e.target.value)}
        />
      </div>
    </div>
  );
};