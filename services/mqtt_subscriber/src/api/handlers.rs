//! API request handlers

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono;
use log::{error, info};
use std::sync::Arc;
use std::time::SystemTime;

use super::models::{ApiResponse, MetricsResponse, SubscribeRequest, TopicsResponse};
use crate::mqtt::subscriber::MqttSubscriber;

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
pub async fn get_topics(State(subscriber): State<Arc<MqttSubscriber>>) -> Json<TopicsResponse> {
    let topics = subscriber.get_topics().await;
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
    State(subscriber): State<Arc<MqttSubscriber>>,
    Json(req): Json<SubscribeRequest>,
) -> Result<Json<ApiResponse>, StatusCode> {
    let topic = req.topic;

    match subscriber.subscribe(&topic).await {
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
    State(subscriber): State<Arc<MqttSubscriber>>,
    Path(topic): Path<String>,
) -> Result<Json<ApiResponse>, StatusCode> {
    match subscriber.unsubscribe(&topic).await {
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
#[utoipa::path(
    get,
    path = "/metrics",
    responses(
        (status = 200, description = "Service metrics", body = MetricsResponse)
    ),
    tag = "MQTT Subscriber"
)]
pub async fn get_metrics(State(subscriber): State<Arc<MqttSubscriber>>) -> Json<MetricsResponse> {
    let metrics = subscriber.get_metrics().await;
    let topics = subscriber.get_topics().await;

    // Calculate uptime if we have message timestamps
    let uptime_since_first_message = metrics.first_message_time.map(|first_time| {
        SystemTime::now()
            .duration_since(first_time)
            .unwrap_or_default()
            .as_secs()
    });

    // Format the last message time as ISO 8601 string if available
    let last_message_time = metrics.last_message_time.map(|time| {
        // Convert SystemTime to a proper ISO 8601 date time format
        // First, convert to chrono DateTime
        let datetime = chrono::DateTime::<chrono::Utc>::from(time);
        // Format it with ISO 8601 format
        datetime.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
    });

    Json(MetricsResponse {
        messages_received: metrics.messages_received,
        messages_processed: metrics.messages_processed,
        messages_dropped: metrics.messages_dropped,
        processing_errors: metrics.processing_errors,
        active_topics: topics.len(),
        throughput: metrics.throughput,
        average_message_size: metrics.average_message_size,
        max_message_size: metrics.max_message_size,
        average_processing_time_ms: metrics.average_processing_time.as_secs_f64() * 1000.0,
        max_processing_time_ms: metrics.max_processing_time.as_secs_f64() * 1000.0,
        uptime_since_first_message,
        last_message_time,
    })
}

/// Reset service metrics
#[utoipa::path(
    post,
    path = "/admin/reset-metrics",
    responses(
        (status = 200, description = "Metrics reset successfully", body = ApiResponse)
    ),
    tag = "MQTT Subscriber Administration"
)]
pub async fn reset_metrics(State(subscriber): State<Arc<MqttSubscriber>>) -> Json<ApiResponse> {
    subscriber.reset_metrics().await;

    Json(ApiResponse {
        success: true,
        message: "Metrics have been reset".to_string(),
    })
}
