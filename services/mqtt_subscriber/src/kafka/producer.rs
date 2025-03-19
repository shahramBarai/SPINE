//! Kafka integration for MQTT messages

use log::{error, info};
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;

/// Kafka producer for sending MQTT messages to Kafka
pub struct KafkaProducer {
    producer: FutureProducer,
    topic: String,
}

impl KafkaProducer {
    /// Create a new Kafka producer
    pub fn new(broker: &str, topic: &str, group_id: &str) -> Self {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", broker)
            .set("client.id", "mqtt_subscriber")
            .set("group.id", group_id)
            .create()
            .expect("Failed to create Kafka producer");

        info!("Kafka producer created for topic: {}", topic);

        Self {
            producer,
            topic: topic.to_string(),
        }
    }

    /// Send a message to Kafka
    pub async fn send(&self, mqtt_topic: &str, payload: &[u8]) -> Result<(), String> {
        let record = FutureRecord::to(&self.topic)
            .key(mqtt_topic)
            .payload(payload);

        match self.producer.send(record, Duration::from_secs(0)).await {
            Ok(_) => {
                info!(
                    "Message sent to Kafka topic {}: mqtt_topic={}",
                    self.topic, mqtt_topic
                );
                Ok(())
            }
            Err((e, _)) => {
                error!("Error sending to Kafka: {}", e);
                Err(format!("Failed to send to Kafka: {}", e))
            }
        }
    }
}
