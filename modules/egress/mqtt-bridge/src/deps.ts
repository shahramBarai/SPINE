import * as config from "./utils";
import { KafkaConsumerService, MQTTService } from "./services";

let kafkaConfig: config.KafkaConfig | undefined = undefined;
let kafkaTopic: string | undefined = undefined;
let mqttConfig: config.MQTTConfig | undefined = undefined;

try {
    kafkaConfig = config.getKafkaConfig();
    kafkaTopic = config.getKafkaTopic();
    mqttConfig = config.getMQTTConfig();
} catch (error) {
    console.error("Error loading configuration:", error);
    process.exit(1);
}

const KafkaConsumer = new KafkaConsumerService({
    config: kafkaConfig,
    topic: kafkaTopic
});
const MQTTClient = new MQTTService(mqttConfig);

export { KafkaConsumer, MQTTClient };
