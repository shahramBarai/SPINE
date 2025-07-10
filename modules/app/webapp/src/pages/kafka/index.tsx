import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";
import { api } from "@/utils/trpc";
import { Button } from "@/client/components/basics/Button";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import {
  KafkaTopicsList,
  KafkaConsumerGroups,
  KafkaStatsCards,
} from "@/client/components/feature/kafka";

const KafkaManagementPage = () => {
  // Queries
  const utils = api.useUtils();

  const consumerGroupsQuery = api.kafka.getConsumerGroups.useQuery();

  const refreshData = async () => {
    void utils.kafka.invalidate();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Kafka Management</h1>
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

      <KafkaConsumerGroups data={consumerGroupsQuery.data} />
    </div>
  );
};

KafkaManagementPage.getLayout = function getLayout(page: React.ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};

export default KafkaManagementPage;

export const getServerSideProps = withAuthSSR({
  handler: async (ctx) => {
    const user = ctx.req.session.data;

    return {
      props: {
        user,
      },
    };
  },
});
