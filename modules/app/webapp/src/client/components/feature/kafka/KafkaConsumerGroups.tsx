import { ConsumerGroup, ConsumerGroupsResponse } from "@/server/schemas/kafka";

interface KafkaConsumerGroupsProps {
  data?: ConsumerGroupsResponse | unknown;
}

export function KafkaConsumerGroups({ data }: KafkaConsumerGroupsProps) {
  if (!data || !(data as ConsumerGroupsResponse).groups) {
    return null;
  }

  const consumerGroups = data as ConsumerGroupsResponse;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Consumer Groups</h3>
      <div className="space-y-2">
        {(consumerGroups.groups || []).map((group: ConsumerGroup) => (
          <div
            key={group.groupId}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div>
              <span className="font-medium">{group.groupId}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({group.protocolType})
              </span>
            </div>
            <div className="text-sm text-gray-500">
              State: {group.state}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}