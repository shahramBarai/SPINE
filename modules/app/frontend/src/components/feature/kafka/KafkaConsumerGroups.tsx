import { api } from "utils/trpc";

function KafkaConsumerGroups() {
    const { data } = api.kafka.getConsumerGroups.useQuery();

    if (!data?.groups) {
        return null;
    }

    return (
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
                Consumer Groups
            </h3>
            <div className="space-y-2">
                {data.groups.map((group) => (
                    <div
                        key={group.groupId}
                        className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                        <div>
                            <span className="font-medium text-foreground">
                                {group.groupId}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                                ({group.protocolType})
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export { KafkaConsumerGroups };
