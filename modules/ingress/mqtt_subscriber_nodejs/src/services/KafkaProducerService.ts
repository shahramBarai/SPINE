import { Kafka, Producer } from "kafkajs";
import { getKafkaConfig, getKafkaTopic } from "../config";

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
            console.info("Kafka producer connected");
        } catch (error) {
            console.error("Failed to connect to Kafka", error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            await this.producer.disconnect();
            console.info("Kafka producer disconnected");
        } catch (error) {
            console.error("Failed to disconnect from Kafka", error);
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
            console.log("Message sent to Kafka", result);
        } catch (error) {
            console.error("Failed to send message to Kafka", error);
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
