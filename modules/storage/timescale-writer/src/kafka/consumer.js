import "dotenv/config";
import { SensorData } from "../db/timescale.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Kafka, CompressionTypes, CompressionCodecs } = require("kafkajs");
const SnappyCodec = require("kafkajs-snappy");

// Register Snappy codec
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

// Kafka configuration
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9094").split(",");
const KAFKA_TOPICS = process.env.KAFKA_TOPICS
  ? process.env.KAFKA_TOPICS.split(",")
  : ["sensor-data"];

let consumer = null;

export async function startConsumer() {
  const clientId = `timescale-writer-${Math.random()
    .toString(36)
    .substring(2, 15)}`;
  const kafka = new Kafka({
    clientId,
    brokers: KAFKA_BROKERS,
  });

  consumer = kafka.consumer({ groupId: "timescale-writer-group" });
  await consumer.connect();

  for (const topic of KAFKA_TOPICS) {
    await consumer.subscribe({ topic }); // ensure reading from earliest
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      // Pass topic, message buffer and benchmark timestamp to the message handler
      await handleMessage(message.value.toString());
      //console.log(message.value.toString());
    },
  });
}

async function handleMessage(kafkaMessage) {
  try {
    const sensorData = JSON.parse(kafkaMessage);
    const { sensor_id, message, sensor_timestamp } = sensorData;

    // Validate sensor_timestamp
    const timestamp = new Date(
      sensor_timestamp.secs_since_epoch * 1000 +
        sensor_timestamp.nanos_since_epoch / 1000000
    );
    if (isNaN(timestamp.getTime())) {
      throw new Error("Invalid date");
    }

    await SensorData.create({
      sensor_id,
      message,
      sensor_timestamp: timestamp,
    });
  } catch (error) {
    console.error("Error handling message:", error);
  }
}
