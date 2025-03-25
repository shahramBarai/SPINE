//! Message processing handlers

use log::{debug, error, info, warn};
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

                            // Process the message in a separate task
                            if let Err(e) = process_message(
                                &message,
                                metrics_for_processing,
                                &kafka_producer_clone,
                            )
                            .await
                            {
                                error!("Error processing message: {}", e);

                                // Update error metrics - don't use if let with RwLock.write()
                                {
                                    let mut metrics_guard = metrics_clone.write().await;
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
                // Update the connection status
                mqtt_subscriber.update_connection_status(false);
                tokio::time::sleep(Duration::from_secs(5)).await;

                // Try to reconnect and resubscribe to topics
                mqtt_subscriber.resubscribe_to_topics().await;
            }
        }
    }
}

/// Process a single MQTT message
pub async fn process_message(
    message: &MqttMessage,
    metrics: Arc<RwLock<MessageMetrics>>,
    kafka_producer: &Arc<KafkaProducer>,
) -> Result<(), String> {
    // Start timing the processing
    let processing_start = Instant::now();

    // Get payload as string for logging
    let payload_str = std::str::from_utf8(&message.payload).unwrap_or("[binary data]");

    // Truncate long payloads for logging
    let display_payload = if payload_str.len() > 100 {
        format!("{}... (truncated)", &payload_str[..100])
    } else {
        payload_str.to_string()
    };

    // Log the message details
    debug!(
        "Processing message from topic '{}': {}",
        message.topic, display_payload
    );

    // Send to Kafka with graceful error handling
    match kafka_producer.send(&message.topic, &message.payload).await {
        Ok(_) => {
            // Message sent successfully
            debug!("Successfully sent message to Kafka");
        }
        Err(e) => {
            // Just log the error, don't fail the whole message processing
            if kafka_producer.is_connected() {
                // Only log detailed errors if we thought we were connected
                warn!("Failed to send to Kafka: {}", e);
            } else {
                // Just log at debug level if we know we're disconnected
                debug!("Skipped sending to Kafka: {}", e);
            }
        }
    }

    // Record processing time
    let processing_time = processing_start.elapsed();

    // Update metrics
    {
        let mut metrics_guard = metrics.write().await;
        metrics_guard.record_message_processed(processing_time);
    }

    // Return success even if Kafka send failed
    Ok(())
}
