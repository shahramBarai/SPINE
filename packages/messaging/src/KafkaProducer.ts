import { Kafka, Producer } from "kafkajs";
import { logger } from "@spine/shared";
import { getKafkaConfig, getKafkaTopic } from "./utils/config";

interface KafkaConfig {
    clientId: string;
    brokers: string[];
    connectionTimeout: number;
    requestTimeout: number;
    retry: {
        retries: number;
    };
}

class KafkaProducer {
    private kafka: Kafka;
    private producer: Producer;
    private topic: string;
    private isConnected: boolean = false;

    constructor() {
        const config = getKafkaConfig();
        const topic = getKafkaTopic();
        
        this.kafka = new Kafka(config);
        this.producer = this.kafka.producer();
        this.topic = topic;
        this.isConnected = false;
    }

    async connect() {
        try {
            await this.producer.connect();
            logger.info("Kafka producer: Connected to Kafka");
            this.isConnected = true;
            return true;
        } catch (error) {
            logger.error("Kafka producer: Failed to connect to Kafka", error);
            this.isConnected = false;
            return false;
        }
    }

    async disconnect() {
        try {
            await this.producer.disconnect();
            logger.warn("Kafka producer: Disconnected from Kafka");
            this.isConnected = false;
            return true;
        } catch (error) {
            logger.error("Kafka producer: Failed to disconnect from Kafka", error);
            return false;
        }
    }

    async sendMessage(message: string): Promise<void> {
        try {
            const result = await this.producer.send({
                topic: this.topic,
                messages: [{ value: message }],
                acks: 0,
            })
            logger.debug("Kafka producer: Message sent to Kafka! Result: ", result);
            if (!this.isConnected) {
                logger.debug("Kafka producer: Kafka connection is established after sending message");
                this.isConnected = true;
            }
        } catch (error) {
            logger.error("Kafka producer: Failed to send message to Kafka", error);
            if (this.isConnected) {
                logger.debug(
                    "Kafka producer: Connection is lost! Message not sent: " +
                        message,
                );
                this.isConnected = false;
            }
        }
    }

    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }> {
        return {
            status: this.isConnected ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
            error: this.isConnected ? undefined : "Not connected to Kafka",
        };
    }
}

export { KafkaProducer, type KafkaConfig };