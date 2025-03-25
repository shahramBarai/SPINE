//! Kafka integration for MQTT messages

use log::{debug, error, info, warn};
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{BaseConsumer, Consumer};
use rdkafka::error::KafkaError;
use rdkafka::producer::{FutureProducer, FutureRecord, Producer};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Kafka producer for sending MQTT messages to Kafka
pub struct KafkaProducer {
    producer: FutureProducer,
    bootstrap_servers: String,
    connection_status: Arc<AtomicBool>,
    health_check_interval: Duration,
}

impl KafkaProducer {
    /// Create a new Kafka producer
    pub async fn new(bootstrap_servers: &str) -> Result<Self, KafkaError> {
        let reconnect_attempts = 5;
        let health_check_interval = Duration::from_secs(30);

        let (producer, connection_status) =
            Self::create_producer(bootstrap_servers, reconnect_attempts).await?;

        let kafka_producer = KafkaProducer {
            producer,
            bootstrap_servers: bootstrap_servers.to_string(),
            connection_status: Arc::new(AtomicBool::new(connection_status)),
            health_check_interval,
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
            .create()?;

        Ok(producer)
    }

    /// Create a new Kafka producer
    async fn create_producer(
        bootstrap_servers: &str,
        max_attempts: u32,
    ) -> Result<(FutureProducer, bool), KafkaError> {
        let mut attempt = 0;

        while attempt < max_attempts {
            info!(
                "Attempting to connect to Kafka at {} (attempt {}/{})",
                bootstrap_servers,
                attempt + 1,
                max_attempts
            );

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
                            info!(
                                "Available topics: {:?}",
                                metadata
                                    .topics()
                                    .iter()
                                    .map(|t| t.name())
                                    .collect::<Vec<_>>()
                            );
                            return Ok((producer, true));
                        }
                        Err(e) => {
                            warn!("Connected to Kafka but metadata fetch failed: {}", e);
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to connect to Kafka: {}", e);
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
        warn!("All connection attempts to Kafka failed, creating producer in disconnected state");
        let producer = Self::initialize_producer(bootstrap_servers).await?;
        Ok((producer, false))
    }

    fn start_health_check(&self) {
        let connection_status = self.connection_status.clone();
        let bootstrap_servers = self.bootstrap_servers.clone();
        let interval = self.health_check_interval;

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);

            loop {
                interval_timer.tick().await;
                // Create a temporary client to check health without affecting the producer
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
                            }
                        }
                        Err(e) => {
                            if connection_status.load(Ordering::SeqCst) {
                                warn!("Kafka connection lost: {}", e);
                                connection_status.store(false, Ordering::SeqCst);
                            }
                        }
                    },
                    Err(e) => {
                        if connection_status.load(Ordering::SeqCst) {
                            warn!("Failed to create Kafka client for health check: {}", e);
                            connection_status.store(false, Ordering::SeqCst);
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

    /// Send a message to Kafka with graceful fallback
    pub async fn send(&self, topic: &str, payload: &[u8]) -> Result<(), KafkaError> {
        if !self.connection_status.load(Ordering::SeqCst) {
            warn!("Not sending message to Kafka as connection is down");
            return Err(KafkaError::Canceled);
        }

        let record = FutureRecord::to(topic).key(topic).payload(payload);

        match self.producer.send(record, Duration::from_secs(1)).await {
            Ok(_) => {
                // Update connection status on success
                self.connection_status.store(true, Ordering::Relaxed);
                debug!("Message sent to Kafka topic {}", topic);
                Ok(())
            }
            Err((e, _)) => {
                // Update connection status on failure
                self.connection_status.store(false, Ordering::Relaxed);
                error!("Error sending to Kafka: {}", e);
                Err(e)
            }
        }
    }
}
