import { Button } from "components/basics/Button";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
    KafkaTopicsList,
    KafkaConsumerGroups,
    KafkaStatsCards
} from "components/feature/kafka";
import { api } from "utils/trpc";
import { adminGuard } from "utils/adminGuard";

function KafkaManagementPageContent() {
    const utils = api.useUtils();

    const refreshData = () => {
        void utils.kafka.invalidate();
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-foreground">
                    Kafka Management
                </h1>
                <Button
                    onClick={refreshData}
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            <KafkaStatsCards />

            <KafkaTopicsList />

            <KafkaConsumerGroups />
        </div>
    );
}

const KafkaManagementPage = adminGuard(KafkaManagementPageContent);

export { KafkaManagementPage };
