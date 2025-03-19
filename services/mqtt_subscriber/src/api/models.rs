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
    /// Time window in seconds (currently 60 seconds/1 minute)
    pub window_time_sec: u64,
    /// Total number of messages received in completed windows
    pub messages_received: usize,
    /// Total number of messages processed in completed windows
    pub messages_processed: usize,
    /// Number of messages dropped due to errors in completed windows
    pub messages_dropped: usize,
    /// Number of processing errors in completed windows
    pub processing_errors: usize,
    /// Number of active topics
    pub active_topics: usize,
    /// Messages per second (throughput calculated from completed windows)
    pub throughput: f64,
    /// Average message size in bytes from completed windows
    pub average_message_size: usize,
    /// Maximum message size seen in completed windows
    pub max_message_size: usize,
    /// Average message processing time in milliseconds from completed windows
    pub average_processing_time_ms: f64,
    /// Maximum processing time seen in milliseconds from completed windows
    pub max_processing_time_ms: f64,
    /// Last message time in ISO 8601 format
    pub last_message_time: Option<String>,
}
