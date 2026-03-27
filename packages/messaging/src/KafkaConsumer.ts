import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { getKafkaConfig, getKafkaTopic } from "./utils/config";
import { logger } from "@spine/shared";

type MessageHandler = (message: string, topic: string, partition: number, offset: string) => Promise<void>;

class KafkaConsumer {
    private kafka: Kafka;
    private consumer: Consumer | null = null;
    private topic: string;
    private isConnected: boolean = false;
    private messageHandler: MessageHandler | null = null;

    constructor() {
        const config = getKafkaConfig();
        const topic = getKafkaTopic();

        this.kafka = new Kafka({
            clientId: config.clientId,
            brokers: config.brokers,
            connectionTimeout: config.connectionTimeout,
            requestTimeout: config.requestTimeout,
            retry: config.retry,
        });
        this.consumer = this.kafka.consumer({ groupId: config.clientId });
        this.topic = topic;
    }

    /**
     * Set message handler callback
     */
    setMessageHandler(handler: MessageHandler): void {
        this.messageHandler = handler;
    }

    /**
     * Connect to Kafka and start consuming messages
     */
    async connect(): Promise<boolean> {
        if (!this.consumer) {
            logger.error("Kafka consumer: Consumer not initialized");
            return false;
        }

        try {
            await this.consumer.connect();
            logger.info("Kafka consumer: Connected to Kafka");

            await this.consumer.subscribe({
                topic: this.topic,
                fromBeginning: false,
            });

            await this.consumer.run({
                eachMessage: async (payload: EachMessagePayload) => {
                    try {
                        const message = payload.message.value?.toString();
                        if (!message) {
                            logger.warn(
                                `Kafka consumer: Received empty message from topic ${payload.topic}`,
                            );
                            return;
                        }

                        if (this.messageHandler) {
                            await this.messageHandler(
                                message,
                                payload.topic,
                                payload.partition,
                                payload.message.offset,
                            );
                        } else {
                            logger.warn(
                                "Kafka consumer: No message handler registered",
                            );
                        }
                    } catch (error) {
                        logger.error(
                            `Kafka consumer: Error processing message from topic ${payload.topic}:`,
                            error,
                        );
                    }
                },
            });

            this.isConnected = true;
            logger.info(
                `Kafka consumer: Started consuming from topic ${this.topic}`,
            );
            return true;
        } catch (error) {
            logger.error("Kafka consumer: Failed to connect to Kafka", error);
            this.isConnected = false;
            return false;
        }
    }

    /**
     * Disconnect from Kafka
     */
    async disconnect(): Promise<void> {
        if (!this.consumer) {
            return;
        }

        try {
            await this.consumer.disconnect();
            logger.info("Kafka consumer: Disconnected from Kafka");
            this.isConnected = false;
        } catch (error) {
            logger.error(
                "Kafka consumer: Failed to disconnect from Kafka",
                error,
            );
        }
    }

    /**
     * Health check for Kafka consumer
     */
    async healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }> {
        return {
            status: this.isConnected ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
            error: this.isConnected
                ? undefined
                : "Not connected to Kafka",
        };
    }
}

export { KafkaConsumer };
