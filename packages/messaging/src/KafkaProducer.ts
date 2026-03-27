import { Kafka, Producer } from "kafkajs";
import { logger } from "@spine/shared";
import { type KafkaConfig } from "./utils/config";

class KafkaProducer {
    private kafka: Kafka;
    private producer: Producer;
    private topic: string;
    private isConnected: boolean = false;

    constructor(config: KafkaConfig, topic: string) {
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

    /**
     * Send a message to a topic
     * @param topic - The topic to send the message to
     * @param key - The key to send the message to
     * @param value - The value to send the message to
     */
    async sendMessage({topic, key, value}: {topic?: string, key: string, value: string}): Promise<void> {
        try {
            const result = await this.producer.send({
                topic: topic || this.topic,
                messages: [{ key, value }],
                acks: 0,
            });
            logger.debug("Kafka producer: Message sent to Kafka! Result: ", result);
            if (!this.isConnected) {
                logger.debug("Kafka producer: Kafka connection is established after sending message");
                this.isConnected = true;
            }
        } catch (error) {
            logger.error("Kafka producer: Failed to send keyed message to Kafka", error);
            if (this.isConnected) {
                logger.debug(
                    "Kafka producer: Connection is lost! Keyed message not sent, topic=%s key=%s",
                    topic,
                    key,
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

export { KafkaProducer };