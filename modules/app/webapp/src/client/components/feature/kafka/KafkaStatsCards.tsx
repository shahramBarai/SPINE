import {
  ServerStackIcon,
  Square3Stack3DIcon,
} from "@heroicons/react/24/outline";
import { ForwardRefExoticComponent, SVGProps } from "react";
import { TitledCard } from "@/client/components/basics/TitledCard";
import { api } from "@/utils/trpc";
import { KafkaLogo } from "./KafkaLogo";

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  trend,
  isLoading,
}: {
  title: string;
  value: number | string;
  icon: ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, "ref">>;
  color: string;
  trend?: string;
  isLoading?: boolean;
}) => (
  <TitledCard title={title} isLoading={isLoading}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {trend && <p className="text-xs text-gray-500 mt-1">{trend}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </TitledCard>
);

function KafkaHealthStatus() {
  const { data, isLoading, isError } = api.kafka.healthCheck.useQuery(
    undefined,
    {
      refetchInterval: 5000,
    }
  );

  const isConnected = data?.status === "connected";

  if (isError) {
    return (
      <TitledCard title="Connection Status" isLoading={false}>
        <div className="flex items-center gap-2 justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-red-600">Error</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Failed to check connection
            </p>
          </div>
          <div className="relative">
            <KafkaLogo className="w-10 h-10" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>
        </div>
      </TitledCard>
    );
  }

  return (
    <TitledCard title="Connection Status" isLoading={isLoading}>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex flex-col">
          <span
            className={`text-lg font-semibold ${
              isConnected ? "text-gray-900" : "text-red-600"
            }`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          {isConnected && data?.brokersCount ? (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.brokersCount} broker{data.brokersCount !== 1 ? "s" : ""}{" "}
              active
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              {isConnected ? "No brokers found" : "Connecting..."}
            </p>
          )}
        </div>
        <div className="relative">
          <KafkaLogo className="w-10 h-10" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            {isLoading ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500"></span>
              </>
            ) : isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            )}
          </span>
        </div>
      </div>
    </TitledCard>
  );
}

function KafkaStatsCards() {
  const clusterQuery = api.kafka.getClusterInfo.useQuery();
  const topicsQuery = api.kafka.listTopics.useQuery();

  const brokersCount = clusterQuery.data?.brokers?.length || 0;
  const topicsCount = topicsQuery.data?.length || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <KafkaHealthStatus />

      <StatCard
        title="Active Brokers"
        value={brokersCount}
        icon={ServerStackIcon}
        color="bg-blue-500"
        trend={brokersCount > 0 ? "Cluster healthy" : "No brokers available"}
        isLoading={clusterQuery.isLoading}
      />

      <StatCard
        title="Total Topics"
        value={topicsCount}
        icon={Square3Stack3DIcon}
        color="bg-purple-500"
        trend={
          topicsCount > 0
            ? `${topicsCount} active topic${topicsCount !== 1 ? "s" : ""}`
            : "No topics created"
        }
      />
    </div>
  );
}

export { KafkaStatsCards };
