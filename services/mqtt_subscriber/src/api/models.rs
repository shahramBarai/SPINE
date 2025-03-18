//! API data models

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Request for subscribing to a topic
#[derive(Deserialize, ToSchema)]
pub struct SubscribeRequest {
    /// MQTT topic to subscribe to
    pub topic: String,
}

/// Standard API response
#[derive(Serialize, ToSchema)]
pub struct ApiResponse {
    /// Whether the operation was successful
    pub success: bool,
    /// Response message
    pub message: String,
}

/// Response for topics endpoint
#[derive(Serialize, ToSchema)]
pub struct TopicsResponse {
    /// List of subscribed topics
    pub topics: Vec<String>,
}

/// Response for metrics endpoint
#[derive(Serialize, ToSchema)]
pub struct MetricsResponse {
    /// Total number of messages received
    pub messages_received: usize,
    /// Total number of messages processed
    pub messages_processed: usize,
    /// Number of messages dropped due to errors
    pub messages_dropped: usize,
    /// Number of processing errors
    pub processing_errors: usize,
    /// Number of active topics
    pub active_topics: usize,
    /// Messages per second (recent throughput)
    pub throughput: f64,
    /// Average message size in bytes
    pub average_message_size: usize,
    /// Maximum message size seen
    pub max_message_size: usize,
    /// Average message processing time in milliseconds
    pub average_processing_time_ms: f64,
    /// Maximum processing time seen in milliseconds
    pub max_processing_time_ms: f64,
    /// Time since first message in seconds (if any)
    pub uptime_since_first_message: Option<u64>,
    /// Time of the last message (ISO 8601 format, if any)
    pub last_message_time: Option<String>,
}
