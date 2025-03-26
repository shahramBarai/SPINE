//! Message processing handlers

use log::{debug, error, info};
use rumqttc::{Event, EventLoop, Packet};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tokio::sync::RwLock;

use crate::kafka::producer::KafkaProducer;
use crate::metrics::MessageMetrics;
use crate::models::MqttMessage;
use crate::mqtt::subscriber::MqttSubscriber;

/// Start the MQTT message processor
pub async fn start_message_processor(
    mut event_loop: EventLoop,
    mqtt_subscriber: Arc<MqttSubscriber>,
    kafka_producer: Arc<KafkaProducer>,
    metrics: Arc<RwLock<MessageMetrics>>,
) {
    info!("Starting MQTT event loop and message processor");

    // Process events in a loop
    loop {
        match event_loop.poll().await {
            Ok(notification) => {
                match notification {
                    Event::Incoming(Packet::Publish(publish)) => {
                        // Log message details
                        debug!(
                            "Received message on '{}' ({} bytes)",
                            publish.topic,
                            publish.payload.len()
                        );

                        // Create message object
                        let message = MqttMessage {
                            topic: publish.topic.clone(),
                            payload: publish.payload.to_vec(),
                            qos: publish.qos,
                            retain: publish.retain,
                            received_at: Instant::now(),
                            timestamp: SystemTime::now(),
                        };

                        // Clone references for the new task
                        let metrics_clone = Arc::clone(&metrics);
                        let kafka_producer_clone = Arc::clone(&kafka_producer);

                        // Spawn a new task to process the message asynchronously
                        tokio::spawn(async move {
                            // Record message receipt in metrics first
                            let message_size = message.payload.len();
                            {
                                let mut metrics_guard = metrics_clone.write().await;
                                metrics_guard
                                    .record_message_received(message_size, message.timestamp);
                            }

                            // Clone metrics_clone again before passing it to process_message
                            let metrics_for_processing = Arc::clone(&metrics_clone);

                            // Track whether the message was successfully delivered to Kafka
                            let mut delivered_to_kafka = false;
                            // Start timing the processing
                            let processing_start = Instant::now();
                            // Process the message in a separate task
                            match process_message(&message, &kafka_producer_clone).await {
                                Ok(_) => {
                                    delivered_to_kafka = true;
                                }
                                Err(e) => {
                                    error!("{}", e);
                                }
                            }

                            let processing_duration = processing_start.elapsed();

                            // Update metrics
                            {
                                let mut metrics_guard = metrics_for_processing.write().await;
                                metrics_guard.record_message_processed(processing_duration);
                                if !delivered_to_kafka {
                                    metrics_guard.record_processing_error();
                                    metrics_guard.record_message_dropped();
                                }
                            }
                        });
                    }
                    Event::Incoming(Packet::ConnAck(_)) => {
                        // Update the connection status
                        mqtt_subscriber.update_connection_status(true);
                    }
                    Event::Incoming(packet) => {
                        debug!("Received MQTT control packet: {:?}", packet);
                    }
                    Event::Outgoing(packet) => {
                        debug!("Sent MQTT packet: {:?}", packet);
                    }
                }
            }
            Err(_) => {
                // Update the MQTT subscriber connection status
                mqtt_subscriber.update_connection_status(false);
                tokio::time::sleep(Duration::from_secs(5)).await;

                // Try to reconnect and resubscribe to MQTT topics
                mqtt_subscriber.resubscribe_to_topics().await;
            }
        }
    }
}

/// Process a single MQTT message
pub async fn process_message(
    message: &MqttMessage,
    kafka_producer: &Arc<KafkaProducer>,
) -> Result<(), String> {
    // TODO: Add logic to validate message and populate message with additional fields

    // Send to Kafka with graceful error handling
    match kafka_producer.send_sensor_data(&message.payload).await {
        Ok(_) => {
            // Message sent successfully
            debug!("Successfully sent message to Kafka");
            return Ok(());
        }
        Err(e) => {
            // TODO: Add additional logic to store non-delivered messages in e.g. temporary storage

            // Return the error so it can be handled by the caller
            if kafka_producer.is_connected() {
                return Err(format!("Failed to send to Kafka: {}", e));
            }
            return Err("Skipped sending to Kafka (known disconnected)".to_string());
        }
    }
}
