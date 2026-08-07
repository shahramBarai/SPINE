import { useState } from "react";
import { Button } from "components/basics/Button";
import { TrashIcon, AlertCircleIcon, Loader2 } from "lucide-react";
import { KafkaCreateTopicForm } from "./KafkaCreateTopicForm";
import { api } from "utils/trpc";

function KafkaTopicsList() {
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const topicsQuery = api.kafka.listTopics.useQuery();

    const deleteTopicMutation = api.kafka.deleteTopic.useMutation({
        onSuccess: () => {
            topicsQuery.refetch();
        }
    });

    const handleDeleteTopic = async (topicName: string) => {
        if (confirm(`Are you sure you want to delete topic "${topicName}"?`)) {
            await deleteTopicMutation.mutateAsync({ topic: topicName });
            setSelectedTopic(null);
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="p-6 border-b border-border">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-foreground">
                        Topics
                    </h3>
                    <Button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2"
                    >
                        <span className="text-sm">+</span>
                        Create Topic
                    </Button>
                </div>
            </div>

            {showCreateForm && (
                <KafkaCreateTopicForm
                    onCancel={() => setShowCreateForm(false)}
                />
            )}

            <div className="p-6">
                {topicsQuery.isLoading && (
                    <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">
                            Loading topics...
                        </p>
                    </div>
                )}

                {topicsQuery.data && topicsQuery.data.length === 0 && (
                    <div className="text-center py-8">
                        <AlertCircleIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No topics found</p>
                    </div>
                )}

                {topicsQuery.data && topicsQuery.data.length > 0 && (
                    <div className="space-y-2">
                        {topicsQuery.data.map((topic) => (
                            <div
                                key={topic}
                                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-medium text-foreground">
                                        {topic}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() =>
                                            setSelectedTopic(
                                                selectedTopic === topic
                                                    ? null
                                                    : topic
                                            )
                                        }
                                        variant="outline"
                                        size="sm"
                                    >
                                        {selectedTopic === topic
                                            ? "Hide Details"
                                            : "Show Details"}
                                    </Button>
                                    <Button
                                        onClick={() => handleDeleteTopic(topic)}
                                        variant="danger"
                                        size="sm"
                                        disabled={deleteTopicMutation.isPending}
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export { KafkaTopicsList };
