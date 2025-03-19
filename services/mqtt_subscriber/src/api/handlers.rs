//! API request handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono;
use log::{error, info};
use std::sync::Arc;
use tokio::sync::RwLock;

use super::models::{ApiResponse, MetricsResponse, SubscribeRequest, TopicsResponse};
use crate::mqtt::subscriber::MqttSubscriber;
use crate::{kafka::producer::KafkaProducer, metrics::MessageMetrics};

/// State type for API handlers
pub struct AppState {
    pub subscriber: Arc<MqttSubscriber>,
    pub _kafka_producer: Arc<KafkaProducer>,
    pub metrics: Arc<RwLock<MessageMetrics>>,
}

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", content_type = "text/plain")
    ),
    tag = "MQTT Subscriber"
)]
pub async fn health_check() -> &'static str {
    "MQTT Subscriber is running"
}

/// Get a list of all subscribed topics
#[utoipa::path(
    get,
    path = "/topics",
    responses(
        (status = 200, description = "List of subscribed topics", body = TopicsResponse)
    ),
    tag = "MQTT Subscriber"
)]
pub async fn get_topics(State(state): State<Arc<AppState>>) -> Json<TopicsResponse> {
    let topics = state.subscriber.get_topics().await;
    Json(TopicsResponse { topics })
}

/// Subscribe to a new MQTT topic
#[utoipa::path(
    post,
    path = "/subscribe",
    request_body = SubscribeRequest,
    responses(
        (status = 200, description = "Successfully subscribed to topic", body = ApiResponse),
        (status = 500, description = "Internal server error")
    ),
    tag = "MQTT Subscriber"
)]
pub async fn subscribe_to_topic(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SubscribeRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let topic = req.topic;

    match state.subscriber.subscribe(&topic).await {
        Ok(_) => {
            info!("API: Subscribed to topic: {}", topic);
            Ok(Json(ApiResponse {
                success: true,
                message: format!("Subscribed to topic: {}", topic),
            }))
        }
        Err(e) => {
            error!("API: Failed to subscribe to topic {}: {}", topic, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Unsubscribe from a topic
#[utoipa::path(
    delete,
    path = "/unsubscribe/{topic}",
    params(
        ("topic" = String, Path, description = "The topic to unsubscribe from")
    ),
    responses(
        (status = 200, description = "Successfully unsubscribed from topic", body = ApiResponse),
        (status = 500, description = "Internal server error")
    ),
    tag = "MQTT Subscriber"
)]
pub async fn unsubscribe_from_topic(
    State(state): State<Arc<AppState>>,
    Path(topic): Path<String>,
) -> Result<Json<ApiResponse>, StatusCode> {
    match state.subscriber.unsubscribe(&topic).await {
        Ok(_) => {
            info!("API: Unsubscribed from topic: {}", topic);
            Ok(Json(ApiResponse {
                success: true,
                message: format!("Unsubscribed from topic: {}", topic),
            }))
        }
        Err(e) => {
            error!("API: Failed to unsubscribe from topic {}: {}", topic, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get service metrics
///
/// Note that throughput and other calculations are based only on completed windows,
/// so data is at most one minute old.
#[utoipa::path(
    get,
    path = "/metrics",
    responses(
        (status = 200, description = "Service metrics from the last completed minute", body = MetricsResponse)
    ),
    tag = "MQTT Subscriber"
)]
pub async fn get_metrics(State(state): State<Arc<AppState>>) -> Json<MetricsResponse> {
    let metrics_read = state.metrics.read().await;
    let topics = state.subscriber.get_topics().await;

    // Format the last message time as ISO 8601 string if available
    let last_message_time = metrics_read.window_last_message_time().map(|time| {
        // Convert SystemTime to a proper ISO 8601 date time format
        let datetime = chrono::DateTime::<chrono::Utc>::from(time);
        datetime.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    });

    Json(MetricsResponse {
        window_time_sec: metrics_read.window_time_sec,
        messages_received: metrics_read.window_messages_received(),
        messages_processed: metrics_read.window_messages_processed(),
        messages_dropped: metrics_read.window_messages_dropped(),
        processing_errors: metrics_read.window_processing_errors(),
        active_topics: topics.len(),
        throughput: metrics_read.window_throughput(),
        average_message_size: metrics_read.window_average_message_size(),
        max_message_size: metrics_read.window_max_message_size(),
        average_processing_time_ms: metrics_read.window_average_processing_time().as_secs_f64()
            * 1000.0,
        max_processing_time_ms: metrics_read.window_max_processing_time().as_secs_f64() * 1000.0,
        last_message_time,
    })
}
