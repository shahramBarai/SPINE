import { KafkaConsumerService, MQTTService } from "./services";

const KafkaConsumer = new KafkaConsumerService();
const MQTTClient = new MQTTService();

export { KafkaConsumer, MQTTClient };