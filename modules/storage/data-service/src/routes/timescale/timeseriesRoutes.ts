import { FastifyInstance } from "fastify";
import {
  TimeseriesService,
  TimeseriesAggregationOptions,
  DownsamplingOptions,
} from "../../services/timescaleDB";

export async function timeseriesRoutes(fastify: FastifyInstance) {
  // Get time-bucketed aggregations
  fastify.get("/timeseries/aggregations", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const options: TimeseriesAggregationOptions = {
        sensorId: query.sensorId,
        topic: query.topic,
        schemaRef: query.schemaRef,
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
        interval: query.interval || "1 hour",
      };

      const aggregations = await TimeseriesService.getTimeBucketAggregation(
        options
      );
      reply.send(aggregations);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get numeric aggregations for a specific payload field
  fastify.get("/timeseries/numeric-aggregations", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.startTime || !query.endTime || !query.payloadField) {
        reply.code(400).send({
          error: "startTime, endTime, and payloadField are required",
        });
        return;
      }

      const options = {
        sensorId: query.sensorId,
        topic: query.topic,
        schemaRef: query.schemaRef,
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
        interval: query.interval || "1 hour",
        payloadField: query.payloadField,
      };

      const aggregations = await TimeseriesService.getNumericAggregation(
        options
      );
      reply.send(aggregations);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get reading frequency analysis for a sensor
  fastify.get(
    "/timeseries/frequency-analysis/:sensorId",
    async (request, reply) => {
      try {
        const { sensorId } = request.params as { sensorId: string };
        const query = request.query as any;

        if (!query.startTime || !query.endTime) {
          reply.code(400).send({ error: "startTime and endTime are required" });
          return;
        }

        const analysis = await TimeseriesService.getReadingFrequencyAnalysis(
          sensorId,
          new Date(query.startTime),
          new Date(query.endTime)
        );

        reply.send(analysis);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get data quality metrics
  fastify.get("/timeseries/data-quality", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const options: TimeseriesAggregationOptions = {
        sensorId: query.sensorId,
        topic: query.topic,
        schemaRef: query.schemaRef,
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
      };

      const metrics = await TimeseriesService.getDataQualityMetrics(options);
      reply.send(metrics);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get hourly distribution of readings
  fastify.get("/timeseries/hourly-distribution", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const options: TimeseriesAggregationOptions = {
        sensorId: query.sensorId,
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
      };

      const distribution = await TimeseriesService.getHourlyDistribution(
        options
      );
      reply.send(distribution);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get top sensors by activity
  fastify.get("/timeseries/top-sensors", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const limit = query.limit ? parseInt(query.limit) : 10;

      const topSensors = await TimeseriesService.getTopSensorsByActivity(
        new Date(query.startTime),
        new Date(query.endTime),
        limit
      );

      reply.send(topSensors);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get TimescaleDB compression info
  fastify.get("/timeseries/compression-info", async (request, reply) => {
    try {
      const compressionInfo = await TimeseriesService.getCompressionInfo();
      reply.send(compressionInfo);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get hypertable information
  fastify.get("/timeseries/hypertable-info", async (request, reply) => {
    try {
      const hypertableInfo = await TimeseriesService.getHypertableInfo();
      reply.send(hypertableInfo);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Downsample data
  fastify.get("/timeseries/downsample/:sensorId", async (request, reply) => {
    try {
      const { sensorId } = request.params as { sensorId: string };
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const options: DownsamplingOptions = {
        sensorId,
        startTime: new Date(query.startTime),
        endTime: new Date(query.endTime),
        bucketSize: query.bucketSize || "1 hour",
        aggregationField: query.aggregationField,
      };

      const downsampledData = await TimeseriesService.downsampleData(options);
      reply.send(downsampledData);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get data gaps
  fastify.get("/timeseries/gaps/:sensorId", async (request, reply) => {
    try {
      const { sensorId } = request.params as { sensorId: string };
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const gaps = await TimeseriesService.getDataGaps(
        sensorId,
        new Date(query.startTime),
        new Date(query.endTime),
        query.expectedInterval || "1 minute"
      );

      reply.send(gaps);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get retention policy information
  fastify.get("/timeseries/retention-policies", async (request, reply) => {
    try {
      const policies = await TimeseriesService.getRetentionPolicyInfo();
      reply.send(policies);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
}
