import * as config from "./utils";
import { KafkaConsumerService, MQTTService } from "./services";

const KafkaConsumer = new KafkaConsumerService({ 
    config: config.getKafkaConfig(),
    topic: config.getKafkaTopic()
});
const MQTTClient = new MQTTService(config.getMQTTConfig());

export { KafkaConsumer, MQTTClient };