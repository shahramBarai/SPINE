import { useState } from "react";
import { Button } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import { Label } from "@/client/components/basics/label";
import { api } from "@/utils/trpc";

export function KafkaCreateTopicForm({ onCancel }: { onCancel: () => void }) {
  const [newTopic, setNewTopic] = useState({
    name: "",
    partitions: 1,
    replicationFactor: 1,
    cleanupPolicy: "delete",
    retentionMs: 604800000, // 7 days
  });

  const utils = api.useUtils();
  const createTopicMutation = api.kafka.createTopic.useMutation({
    onSuccess: () => {
      void utils.kafka.invalidate();
    },
  });

  const handleSubmit = async () => {
    if (!newTopic.name.trim()) return;

    const configEntries = [
      { name: "cleanup.policy", value: newTopic.cleanupPolicy },
      { name: "retention.ms", value: newTopic.retentionMs.toString() },
    ];

    await createTopicMutation.mutateAsync({
      topic: newTopic.name,
      numPartitions: newTopic.partitions,
      replicationFactor: newTopic.replicationFactor,
      configEntries,
    });

    // Reset form
    setNewTopic({
      name: "",
      partitions: 1,
      replicationFactor: 1,
      cleanupPolicy: "delete",
      retentionMs: 604800000,
    });
  };

  return (
    <div className="p-6 border-b border-gray-200 bg-gray-50">
      <h4 className="text-md font-medium mb-4">Create New Topic</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="topic-name">Topic Name</Label>
          <Input
            id="topic-name"
            value={newTopic.name}
            onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
            placeholder="my-topic"
          />
        </div>
        <div>
          <Label htmlFor="partitions">Partitions</Label>
          <Input
            id="partitions"
            type="number"
            min="1"
            value={newTopic.partitions}
            onChange={(e) =>
              setNewTopic({
                ...newTopic,
                partitions: parseInt(e.target.value) || 1,
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="replication">Replication Factor</Label>
          <Input
            id="replication"
            type="number"
            min="1"
            value={newTopic.replicationFactor}
            onChange={(e) =>
              setNewTopic({
                ...newTopic,
                replicationFactor: parseInt(e.target.value) || 1,
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="retention">Retention (ms)</Label>
          <Input
            id="retention"
            type="number"
            value={newTopic.retentionMs}
            onChange={(e) =>
              setNewTopic({
                ...newTopic,
                retentionMs: parseInt(e.target.value) || 604800000,
              })
            }
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          onClick={handleSubmit}
          disabled={!newTopic.name.trim() || createTopicMutation.isPending}
        >
          {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
        </Button>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  );
}
