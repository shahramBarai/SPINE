import { useQuery } from "@tanstack/react-query";
import { fallbackTwinData, fetchApiHealth, fetchGraph, fetchProjectTree, fetchSensors, fetchTriples } from "@/lib/twin-api";

export const useApiHealthQuery = () =>
  useQuery({
    queryKey: ["api", "health"],
    queryFn: fetchApiHealth,
    refetchInterval: 15_000,
    retry: false,
  });

export const useProjectTreeQuery = () => {
  const query = useQuery({
    queryKey: ["twin", "tree"],
    queryFn: fetchProjectTree,
    staleTime: 30000,
  });

  return {
    ...query,
    data: query.data ?? fallbackTwinData.projectTree,
  };
};

export const useSensorsQuery = () => {
  const query = useQuery({
    queryKey: ["twin", "sensors"],
    queryFn: fetchSensors,
    staleTime: 10000,
  });

  return {
    ...query,
    data: query.data ?? fallbackTwinData.sensors,
  };
};

export const useTriplesQuery = () => {
  const query = useQuery({
    queryKey: ["twin", "triples"],
    queryFn: fetchTriples,
    staleTime: 10000,
  });

  return {
    ...query,
    data: query.data ?? fallbackTwinData.triples,
  };
};

export const useGraphQuery = (focusId?: string | null) => {
  const query = useQuery({
    queryKey: ["twin", "graph", focusId ?? "all"],
    queryFn: () => fetchGraph(focusId),
    staleTime: 10000,
  });

  return {
    ...query,
    data: query.data ?? fallbackTwinData.graph,
  };
};
