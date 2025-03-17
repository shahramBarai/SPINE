//! API request handlers

use crate::models::{ApiResponse, AppState, SubscribeRequest, TopicsResponse};
use crate::mqtt::ensure_mqtt_connection;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use log::{error, info};
use std::sync::Arc;

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
pub async fn get_topics(
    State(state): State<Arc<AppState>>,
) -> Json<TopicsResponse> {
    let topics_read = state.topics.read().await;
    let topics_vec: Vec<String> = topics_read.iter().cloned().collect();
    
    Json(TopicsResponse {
        topics: topics_vec,
    })
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
    
    // Check if we're already subscribed
    {
        let topics_read = state.topics.read().await;
        if topics_read.contains(&topic) {
            return Ok(Json(ApiResponse {
                success: true,
                message: format!("Already subscribed to topic: {}", topic),
            }));
        }
    }
    
    // Add to our list of subscribed topics BEFORE ensuring connection
    {
        let mut topics_write = state.topics.write().await;
        topics_write.insert(topic.clone());
        info!("Added topic to tracking list: {}", topic);
    }
    
    // Now ensure MQTT connection exists
    if let Err(e) = ensure_mqtt_connection(
        &state.mqtt_connection,
        &state.topics,
        state.mqtt_options.clone(),
        &state.message_handlers,
        state.mqtt_qos
    ).await {
        // If connection fails, remove the topic we just added
        let mut topics_write = state.topics.write().await;
        topics_write.remove(&topic);
        
        error!("Failed to create MQTT connection: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    
    // Get the client, which should exist after calling ensure_mqtt_connection
    let connection_lock = state.mqtt_connection.lock().await;
    let client = match &connection_lock.client {
        Some(client) => client,
        None => {
            // If still no client, remove the topic we just added
            let mut topics_write = state.topics.write().await;
            topics_write.remove(&topic);
            
            error!("MQTT client not available after connection attempt");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // Subscribe to the topic
    match client.subscribe(&topic, state.mqtt_qos).await {
        Ok(_) => {
            info!("Successfully subscribed to topic: {}", topic);
            Ok(Json(ApiResponse {
                success: true,
                message: format!("Subscribed to topic: {}", topic),
            }))
        },
        Err(e) => {
            // If subscription fails, remove the topic
            let mut topics_write = state.topics.write().await;
            topics_write.remove(&topic);
            
            error!("Failed to subscribe to topic {}: {:?}", topic, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Unsubscribe from an MQTT topic
#[utoipa::path(
    delete,
    path = "/unsubscribe/{topic}",
    params(
        ("topic" = String, Path, description = "MQTT topic to unsubscribe from")
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
    // Check if we're subscribed to this topic
    {
        let topics_read = state.topics.read().await;
        if !topics_read.contains(&topic) {
            return Ok(Json(ApiResponse {
                success: false,
                message: format!("Not subscribed to topic: {}", topic),
            }));
        }
    }
    
    // Get the client if it exists
    let connection_lock = state.mqtt_connection.lock().await;
    let client = match &connection_lock.client {
        Some(client) => client,
        None => {
            error!("MQTT client not available");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // Unsubscribe from the topic
    match client.unsubscribe(&topic).await {
        Ok(_) => {
            // Remove from our list of subscribed topics
            let mut topics_write = state.topics.write().await;
            topics_write.remove(&topic);
            drop(topics_write);
            drop(connection_lock);
            
            // Check if we need to close the connection
            ensure_mqtt_connection(
                &state.mqtt_connection,
                &state.topics,
                state.mqtt_options.clone(),
                &state.message_handlers,
                state.mqtt_qos
            ).await
                .map_err(|e| {
                    error!("Failed to manage MQTT connection: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;
            
            info!("Successfully unsubscribed from topic: {}", topic);
            Ok(Json(ApiResponse {
                success: true,
                message: format!("Unsubscribed from topic: {}", topic),
            }))
        },
        Err(e) => {
            error!("Failed to unsubscribe from topic {}: {:?}", topic, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
} 