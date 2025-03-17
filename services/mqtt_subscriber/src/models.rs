//! Data models for the MQTT subscriber service

use rumqttc::{AsyncClient, MqttOptions, QoS};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use utoipa::ToSchema;

/// Connection manager for MQTT
pub struct MqttConnection {
    pub client: Option<AsyncClient>,
    pub event_loop_handle: Option<tokio::task::JoinHandle<()>>,
}

/// Type for shared state across handlers
pub struct AppState {
    pub mqtt_connection: Arc<Mutex<MqttConnection>>,
    pub topics: Arc<RwLock<HashSet<String>>>,
    pub mqtt_options: MqttOptions,
    pub mqtt_qos: QoS,
    pub message_handlers: Arc<Mutex<Vec<mpsc::Sender<(String, Vec<u8>)>>>>,
}

/// Request body for subscribe endpoint
#[derive(Deserialize, ToSchema)]
pub struct SubscribeRequest {
    pub topic: String,
}

/// Response structure
#[derive(Serialize, ToSchema)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
}

/// Response structure for topics
#[derive(Serialize, ToSchema)]
pub struct TopicsResponse {
    pub topics: Vec<String>,
}
