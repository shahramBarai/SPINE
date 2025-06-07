//! Kafka integration for MQTT messages

use log::{debug, error, info, warn};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::KafkaError;
use rdkafka::producer::{FutureProducer, FutureRecord, Producer};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::models::SensorData;

/// Kafka producer for sending MQTT messages to Kafka
pub struct KafkaProducer {
    producer: FutureProducer,
    bootstrap_servers: String,
    connection_status: Arc<AtomicBool>,
    available_topics: Vec<String>,
    sensor_data_topic: String,
    service_metrics_topic: String,
    health_check_interval: Duration,
    reconnect_backoff_ms: Arc<std::sync::atomic::AtomicU64>,
}

impl KafkaProducer {
    /// Create a new Kafka producer
    pub async fn new(
        bootstrap_servers: &str,
        sensor_data_topic: &str,
        service_metrics_topic: &str,
    ) -> Result<Self, KafkaError> {
        let reconnect_attempts = 5;
        let health_check_interval = Duration::from_secs(30);

        let (producer, connection_status, available_topics) =
            Self::create_producer(bootstrap_servers, reconnect_attempts).await?;

        let kafka_producer = KafkaProducer {
            producer,
            bootstrap_servers: bootstrap_servers.to_string(),
            connection_status: Arc::new(AtomicBool::new(connection_status)),
            available_topics,
            sensor_data_topic: sensor_data_topic.to_string(),
            service_metrics_topic: service_metrics_topic.to_string(),
            health_check_interval,
            reconnect_backoff_ms: Arc::new(std::sync::atomic::AtomicU64::new(1000)),
        };

        // Start health check in background
        kafka_producer.start_health_check();

        Ok(kafka_producer)
    }

    /// Initialize the Kafka producer
    async fn initialize_producer(bootstrap_servers: &str) -> Result<FutureProducer, KafkaError> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", bootstrap_servers)
            .set("message.timeout.ms", "10000")
            .set("socket.timeout.ms", "10000")
            .set("socket.connection.setup.timeout.ms", "10000")
            .set("reconnect.backoff.ms", "1000")
            .set("reconnect.backoff.max.ms", "10000")
            .set("retry.backoff.ms", "1000")
            .set("request.timeout.ms", "10000")
            .set("message.send.max.retries", "3")
            .set("client.id", "mqtt_subscriber")
            .set("compression.type", "snappy")
            .create()?;

        Ok(producer)
    }

    /// Create a new Kafka producer
    async fn create_producer(
        bootstrap_servers: &str,
        max_attempts: u32,
    ) -> Result<(FutureProducer, bool, Vec<String>), KafkaError> {
        let mut attempt = 0;

        while attempt < max_attempts {
            match Self::initialize_producer(bootstrap_servers).await {
                Ok(producer) => {
                    // Perform handshake by checking metadata
                    match producer
                        .client()
                        .fetch_metadata(None, Duration::from_secs(5))
                    {
                        Ok(metadata) => {
                            info!(
                                "Successfully connected to Kafka cluster with {} brokers",
                                metadata.brokers().len()
                            );
                            let available_topics = metadata
                                .topics()
                                .iter()
                                .map(|t| t.name().to_string())
                                .collect::<Vec<_>>();
                            debug!("Available topics: {:?}", available_topics);
                            return Ok((producer, true, available_topics));
                        }
                        Err(e) => {
                            error!("Connected to Kafka but metadata fetch failed: {}", e);
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to connect to Kafka: {}", e);
                }
            }

            attempt += 1;
            if attempt < max_attempts {
                let backoff_secs = 2u64.pow(attempt.min(6)); // Exponential backoff with a maximum of 64 seconds
                warn!("Retrying Kafka connection in {} seconds", backoff_secs);
                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
            }
        }

        // If all attempts failed but we need to continue, create a producer anyway and return with a status of false
        info!("All connection attempts to Kafka failed, creating producer in disconnected state");
        let producer = Self::initialize_producer(bootstrap_servers).await?;
        Ok((producer, false, Vec::new()))
    }

    fn start_health_check(&self) {
        let connection_status = self.connection_status.clone();
        let bootstrap_servers = self.bootstrap_servers.clone();
        let interval = self.health_check_interval;
        let reconnect_backoff = self.reconnect_backoff_ms.clone();

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);

            loop {
                interval_timer.tick().await;

                if !connection_status.load(Ordering::SeqCst) {
                    let current_backoff = reconnect_backoff.load(Ordering::SeqCst);
                    let new_backoff = std::cmp::min(current_backoff * 2, 60000); // Max 60 seconds
                    reconnect_backoff.store(new_backoff, Ordering::SeqCst);

                    debug!(
                        "Checking Kafka connection. Current backoff: {}ms",
                        current_backoff
                    );
                } else {
                    reconnect_backoff.store(1000, Ordering::SeqCst);
                }

                let client_config = ClientConfig::new()
                    .set("bootstrap.servers", &bootstrap_servers)
                    .set("socket.timeout.ms", "5000")
                    .set("api.version.request", "true")
                    .clone();

                match client_config.create::<BaseConsumer>() {
                    Ok(client) => match client.fetch_metadata(None, Duration::from_secs(5)) {
                        Ok(_) => {
                            if !connection_status.load(Ordering::SeqCst) {
                                info!("Kafka connection restored");
                                connection_status.store(true, Ordering::SeqCst);
                                reconnect_backoff.store(1000, Ordering::SeqCst);
                            }
                        }
                        Err(e) => {
                            if connection_status.load(Ordering::SeqCst) {
                                error!("Kafka connection lost: {}", e);
                                connection_status.store(false, Ordering::SeqCst);
                            } else {
                                error!("Kafka still disconnected: {}", e);
                            }
                        }
                    },
                    Err(e) => {
                        if connection_status.load(Ordering::SeqCst) {
                            error!("Failed to create Kafka client for health check: {}", e);
                            connection_status.store(false, Ordering::SeqCst);
                        } else {
                            error!("Still unable to create Kafka client: {}", e);
                        }
                    }
                }
            }
        });
    }

    /// Check if Kafka is connected
    pub fn is_connected(&self) -> bool {
        self.connection_status.load(Ordering::Relaxed)
    }

    /// Internal method to send a message to a Kafka topic
    async fn send_to_topic(&self, topic: &str, key: &str, payload: &str) -> Result<(), String> {
        // Check connection status
        if !self.connection_status.load(Ordering::SeqCst) {
            return Err("Skipped sending to Kafka (known disconnected)".to_string());
        }

        // Check if topic exists
        if !self.available_topics.contains(&topic.to_string()) {
            return Err(format!(
                "Skipped sending to Kafka (topic {} not available)",
                self.sensor_data_topic
            ));
        }

        // TODO: Add protobuf serialization

        // Create the record
        let record = FutureRecord::to(topic).key(key).payload(payload);

        // Send to Kafka
        match self.producer.send(record, Duration::from_secs(1)).await {
            Ok(_) => Ok(()),
            Err((e, _)) => {
                // Update connection status on failure
                if self.connection_status.load(Ordering::SeqCst) {
                    self.connection_status.store(false, Ordering::Relaxed);
                    return Err(format!("Failed to send to Kafka: {}", e));
                } else {
                    debug!("Still unable to send to Kafka topic {}: {}", topic, e);
                    return Err(format!(
                        "Skipped sending to Kafka (known disconnected): {}",
                        e
                    ));
                }
            }
        }
    }

    /// Send a message to the sensor data topic
    pub async fn send_sensor_data(&self, data: SensorData) -> Result<(), String> {
        let payload = serde_json::to_string(&data).unwrap();
        self.send_to_topic(&self.sensor_data_topic, &self.sensor_data_topic, &payload)
            .await
    }

    /// Send a message to the service metrics topic
    pub async fn send_service_metrics(&self, data: &[u8]) -> Result<(), String> {
        let payload = serde_json::to_string(data).unwrap();
        self.send_to_topic(
            &self.service_metrics_topic,
            &self.service_metrics_topic,
            &payload,
        )
        .await
    }
}
