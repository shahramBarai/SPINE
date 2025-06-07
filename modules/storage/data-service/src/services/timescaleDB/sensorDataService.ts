import { timescaleDb } from "../../db/timescale";
import {
  EntityNotFoundError,
  ValidationError,
  DatabaseError,
} from "../../utils/errors";

export interface CreateSensorReadingData {
  sensorId: string;
  topic: string;
  schemaRef: string;
  payload: any;
  sensorTimestamp: Date;
}

export interface UpdateSensorReadingData {
  topic?: string;
  schemaRef?: string;
  payload?: any;
}

export interface SensorDataQueryOptions {
  sensorId?: string;
  topic?: string;
  schemaRef?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export class SensorDataService {
  // Create sensor reading
  static async createSensorReading(data: CreateSensorReadingData) {
    return timescaleDb.sensorReading.create({
      data: {
        sensorId: data.sensorId,
        topic: data.topic,
        schemaRef: data.schemaRef,
        payload: data.payload,
        sensorTimestamp: data.sensorTimestamp,
      },
    });
  }

  // Bulk create sensor readings
  static async createManySensorReadings(data: CreateSensorReadingData[]) {
    return timescaleDb.sensorReading.createMany({
      data: data.map((reading) => ({
        sensorId: reading.sensorId,
        topic: reading.topic,
        schemaRef: reading.schemaRef,
        payload: reading.payload,
        sensorTimestamp: reading.sensorTimestamp,
      })),
    });
  }

  // Get sensor readings with filters
  static async getSensorReadings(options: SensorDataQueryOptions = {}) {
    const where: any = {};

    if (options.sensorId) {
      where.sensorId = options.sensorId;
    }

    if (options.topic) {
      where.topic = options.topic;
    }

    if (options.schemaRef) {
      where.schemaRef = options.schemaRef;
    }

    if (options.startTime || options.endTime) {
      where.sensorTimestamp = {};
      if (options.startTime) {
        where.sensorTimestamp.gte = options.startTime;
      }
      if (options.endTime) {
        where.sensorTimestamp.lte = options.endTime;
      }
    }

    return timescaleDb.sensorReading.findMany({
      where,
      orderBy: {
        sensorTimestamp: "desc",
      },
      take: options.limit,
      skip: options.offset,
    });
  }

  // Get sensor reading by id and timestamp
  static async getSensorReadingById(sensorId: string, sensorTimestamp: Date) {
    return timescaleDb.sensorReading.findUnique({
      where: {
        sensorId_sensorTimestamp: {
          sensorId,
          sensorTimestamp,
        },
      },
    });
  }

  // Get latest reading for a sensor
  static async getLatestSensorReading(sensorId: string) {
    return timescaleDb.sensorReading.findFirst({
      where: { sensorId },
      orderBy: {
        sensorTimestamp: "desc",
      },
    });
  }

  // Get sensor readings within time range
  static async getSensorReadingsInTimeRange(
    sensorId: string,
    startTime: Date,
    endTime: Date,
    limit?: number
  ) {
    return timescaleDb.sensorReading.findMany({
      where: {
        sensorId,
        sensorTimestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        sensorTimestamp: "asc",
      },
      take: limit,
    });
  }

  // Get readings by topic
  static async getReadingsByTopic(
    topic: string,
    options: SensorDataQueryOptions = {}
  ) {
    const where: any = { topic };

    if (options.startTime || options.endTime) {
      where.sensorTimestamp = {};
      if (options.startTime) {
        where.sensorTimestamp.gte = options.startTime;
      }
      if (options.endTime) {
        where.sensorTimestamp.lte = options.endTime;
      }
    }

    return timescaleDb.sensorReading.findMany({
      where,
      orderBy: {
        sensorTimestamp: "desc",
      },
      take: options.limit,
      skip: options.offset,
    });
  }

  // Get readings by schema reference
  static async getReadingsBySchema(
    schemaRef: string,
    options: SensorDataQueryOptions = {}
  ) {
    const where: any = { schemaRef };

    if (options.startTime || options.endTime) {
      where.sensorTimestamp = {};
      if (options.startTime) {
        where.sensorTimestamp.gte = options.startTime;
      }
      if (options.endTime) {
        where.sensorTimestamp.lte = options.endTime;
      }
    }

    return timescaleDb.sensorReading.findMany({
      where,
      orderBy: {
        sensorTimestamp: "desc",
      },
      take: options.limit,
      skip: options.offset,
    });
  }

  // Update sensor reading
  static async updateSensorReading(
    sensorId: string,
    sensorTimestamp: Date,
    data: UpdateSensorReadingData
  ) {
    return timescaleDb.sensorReading.update({
      where: {
        sensorId_sensorTimestamp: {
          sensorId,
          sensorTimestamp,
        },
      },
      data,
    });
  }

  // Delete sensor reading
  static async deleteSensorReading(sensorId: string, sensorTimestamp: Date) {
    return timescaleDb.sensorReading.delete({
      where: {
        sensorId_sensorTimestamp: {
          sensorId,
          sensorTimestamp,
        },
      },
    });
  }

  // Delete readings older than specified date
  static async deleteOldReadings(beforeDate: Date) {
    return timescaleDb.sensorReading.deleteMany({
      where: {
        sensorTimestamp: {
          lt: beforeDate,
        },
      },
    });
  }

  // Get sensor reading count
  static async getSensorReadingCount(options: SensorDataQueryOptions = {}) {
    const where: any = {};

    if (options.sensorId) {
      where.sensorId = options.sensorId;
    }

    if (options.topic) {
      where.topic = options.topic;
    }

    if (options.schemaRef) {
      where.schemaRef = options.schemaRef;
    }

    if (options.startTime || options.endTime) {
      where.sensorTimestamp = {};
      if (options.startTime) {
        where.sensorTimestamp.gte = options.startTime;
      }
      if (options.endTime) {
        where.sensorTimestamp.lte = options.endTime;
      }
    }

    return timescaleDb.sensorReading.count({ where });
  }

  // Get unique sensor IDs
  static async getUniqueSensorIds() {
    const result = await timescaleDb.sensorReading.findMany({
      select: {
        sensorId: true,
      },
      distinct: ["sensorId"],
    });
    return result.map((r) => r.sensorId);
  }

  // Get unique topics
  static async getUniqueTopics() {
    const result = await timescaleDb.sensorReading.findMany({
      select: {
        topic: true,
      },
      distinct: ["topic"],
    });
    return result.map((r) => r.topic);
  }

  // Get unique schema references
  static async getUniqueSchemaRefs() {
    const result = await timescaleDb.sensorReading.findMany({
      select: {
        schemaRef: true,
      },
      distinct: ["schemaRef"],
    });
    return result.map((r) => r.schemaRef);
  }
}
