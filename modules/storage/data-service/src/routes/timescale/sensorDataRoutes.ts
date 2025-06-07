import { FastifyInstance } from "fastify";
import {
  SensorDataService,
  CreateSensorReadingData,
  SensorDataQueryOptions,
} from "../../services/timescaleDB";

export async function sensorDataRoutes(fastify: FastifyInstance) {
  // Create sensor reading
  fastify.post("/sensor-readings", async (request, reply) => {
    try {
      const data = request.body as CreateSensorReadingData;
      const reading = await SensorDataService.createSensorReading(data);
      reply.code(201).send(reading);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Bulk create sensor readings
  fastify.post("/sensor-readings/bulk", async (request, reply) => {
    try {
      const data = request.body as CreateSensorReadingData[];
      const result = await SensorDataService.createManySensorReadings(data);
      reply.code(201).send(result);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get sensor readings with filters
  fastify.get("/sensor-readings", async (request, reply) => {
    try {
      const query = request.query as any;
      const options: SensorDataQueryOptions = {
        sensorId: query.sensorId,
        topic: query.topic,
        schemaRef: query.schemaRef,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      };

      const readings = await SensorDataService.getSensorReadings(options);
      reply.send(readings);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get sensor reading by ID and timestamp
  fastify.get(
    "/sensor-readings/:sensorId/:timestamp",
    async (request, reply) => {
      try {
        const { sensorId, timestamp } = request.params as {
          sensorId: string;
          timestamp: string;
        };
        const reading = await SensorDataService.getSensorReadingById(
          sensorId,
          new Date(timestamp)
        );

        if (!reading) {
          reply.code(404).send({ error: "Sensor reading not found" });
          return;
        }

        reply.send(reading);
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get latest reading for a sensor
  fastify.get("/sensors/:sensorId/latest", async (request, reply) => {
    try {
      const { sensorId } = request.params as { sensorId: string };
      const reading = await SensorDataService.getLatestSensorReading(sensorId);

      if (!reading) {
        reply.code(404).send({ error: "No readings found for sensor" });
        return;
      }

      reply.send(reading);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get sensor readings in time range
  fastify.get("/sensors/:sensorId/range", async (request, reply) => {
    try {
      const { sensorId } = request.params as { sensorId: string };
      const query = request.query as any;

      if (!query.startTime || !query.endTime) {
        reply.code(400).send({ error: "startTime and endTime are required" });
        return;
      }

      const readings = await SensorDataService.getSensorReadingsInTimeRange(
        sensorId,
        new Date(query.startTime),
        new Date(query.endTime),
        query.limit ? parseInt(query.limit) : undefined
      );

      reply.send(readings);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get readings by topic
  fastify.get("/topics/:topic/readings", async (request, reply) => {
    try {
      const { topic } = request.params as { topic: string };
      const query = request.query as any;

      const options: SensorDataQueryOptions = {
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      };

      const readings = await SensorDataService.getReadingsByTopic(
        topic,
        options
      );
      reply.send(readings);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get readings by schema
  fastify.get("/schemas/:schemaRef/readings", async (request, reply) => {
    try {
      const { schemaRef } = request.params as { schemaRef: string };
      const query = request.query as any;

      const options: SensorDataQueryOptions = {
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        offset: query.offset ? parseInt(query.offset) : undefined,
      };

      const readings = await SensorDataService.getReadingsBySchema(
        schemaRef,
        options
      );
      reply.send(readings);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete sensor reading
  fastify.delete(
    "/sensor-readings/:sensorId/:timestamp",
    async (request, reply) => {
      try {
        const { sensorId, timestamp } = request.params as {
          sensorId: string;
          timestamp: string;
        };
        await SensorDataService.deleteSensorReading(
          sensorId,
          new Date(timestamp)
        );
        reply.code(204).send();
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Delete old readings
  fastify.delete("/sensor-readings/cleanup", async (request, reply) => {
    try {
      const query = request.query as any;

      if (!query.beforeDate) {
        reply.code(400).send({ error: "beforeDate is required" });
        return;
      }

      const result = await SensorDataService.deleteOldReadings(
        new Date(query.beforeDate)
      );
      reply.send({ deletedCount: result.count });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get sensor reading count
  fastify.get("/sensor-readings/count", async (request, reply) => {
    try {
      const query = request.query as any;
      const options: SensorDataQueryOptions = {
        sensorId: query.sensorId,
        topic: query.topic,
        schemaRef: query.schemaRef,
        startTime: query.startTime ? new Date(query.startTime) : undefined,
        endTime: query.endTime ? new Date(query.endTime) : undefined,
      };

      const count = await SensorDataService.getSensorReadingCount(options);
      reply.send({ count });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get unique sensor IDs
  fastify.get("/sensors/unique", async (request, reply) => {
    try {
      const sensorIds = await SensorDataService.getUniqueSensorIds();
      reply.send({ sensorIds });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get unique topics
  fastify.get("/topics/unique", async (request, reply) => {
    try {
      const topics = await SensorDataService.getUniqueTopics();
      reply.send({ topics });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get unique schema references
  fastify.get("/schemas/unique", async (request, reply) => {
    try {
      const schemaRefs = await SensorDataService.getUniqueSchemaRefs();
      reply.send({ schemaRefs });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
}
