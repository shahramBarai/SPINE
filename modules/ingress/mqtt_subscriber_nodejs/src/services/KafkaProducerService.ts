import { Kafka, Producer } from "kafkajs";
import { getKafkaConfig, getKafkaTopic } from "../config";
import { logger } from "../utils/logger";

class KafkaProducerService {
    private kafka: Kafka;
    private producer: Producer;
    private topic: string;

    constructor() {
        const config = getKafkaConfig();
        const topic = getKafkaTopic();

        this.kafka = new Kafka(config);
        this.producer = this.kafka.producer();
        this.topic = topic;
    }

    async connect(): Promise<void> {
        try {
            await this.producer.connect();
            logger.info("Kafka producer: Connected to Kafka");
        } catch (error) {
            logger.error("Kafka producer: Failed to connect to Kafka", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.producer.disconnect();
            logger.warn("Kafka producer: Disconnected from Kafka");
        } catch (error) {
            logger.warn(
                "Kafka producer: Failed to disconnect from Kafka",
                error,
            );
            throw error;
        }
    }

    async sendMessage(message: string): Promise<void> {
        try {
            const result = await this.producer.send({
                topic: this.topic,
                messages: [{ value: message }],
                acks: 0,
            });
            logger.debug("Kafka producer: Message sent to Kafka", result);
        } catch (error) {
            logger.error(
                "Kafka producer: Failed to send message to Kafka",
                error,
            );
            throw error;
        }
    }

    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }> {
        try {
            await this.producer.connect();
            return {
                status: "connected",
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                status: "disconnected",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            };
        }
    }
}

export { KafkaProducerService };
