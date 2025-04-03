//! Shared data models for the MQTT subscriber service

use rumqttc::QoS;
use serde::{Deserialize, Serialize};
use std::time::{Instant, SystemTime};

/// MQTT Message with metadata
#[derive(Debug)]
#[allow(dead_code)] // Silence warning about unused fields
pub struct MqttMessage {
    pub topic: String,
    pub payload: Vec<u8>,
    pub qos: QoS,
    pub retain: bool,
    pub received_at: Instant,  // Kept for internal timing
    pub timestamp: SystemTime, // Added for absolute timestamp
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SensorData {
    pub sensor_id: String,
    pub message: String,
    pub sensor_timestamp: SystemTime,
}
