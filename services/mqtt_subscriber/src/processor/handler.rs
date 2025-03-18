//! Message processing handlers

use log::{debug, info};
use std::{str, time::Instant};

use crate::models::MqttMessage;

/// Process a single MQTT message
pub async fn process_message(
    message: &MqttMessage,
    metrics: &mut crate::models::MessageMetrics,
) -> Result<(), String> {
    // Start timing the processing
    let processing_start = Instant::now();

    // Get payload as string if it's valid UTF-8
    let payload_str = match str::from_utf8(&message.payload) {
        Ok(s) => s,
        Err(_) => {
            // If not valid UTF-8, just use a placeholder
            "[binary data]"
        }
    };

    // Log message details with timestamp
    debug!(
        "Processing message from topic '{}' received at {:?}: {}",
        message.topic,
        message.timestamp,
        if payload_str.len() > 100 {
            format!("{}... (truncated)", &payload_str[..100])
        } else {
            payload_str.to_string()
        }
    );

    // In the future, this would send to Kafka
    // For now, just print to the console
    info!(
        "Would send to Kafka: Topic={}, Timestamp={:?}, Payload={}",
        message.topic, message.timestamp, payload_str
    );

    // TODO: Implement Kafka producer
    // kafka_producer
    //     .send("mqtt-messages", &message.topic, &message.payload)
    //     .await?;

    // Record processing time
    let processing_time = processing_start.elapsed();
    metrics.record_message_processed(processing_time);

    Ok(())
}
