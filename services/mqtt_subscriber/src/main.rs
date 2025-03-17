use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use dotenv::dotenv;
use log::{error, info};
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, env, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

// Type for shared state across handlers
struct AppState {
    mqtt_client: Arc<AsyncClient>,
    topics: Arc<RwLock<HashSet<String>>>,
    mqtt_qos: QoS,
}

// Request body for subscribe endpoint
#[derive(Deserialize, ToSchema)]
struct SubscribeRequest {
    topic: String,
}

// Response structure
#[derive(Serialize, ToSchema)]
struct ApiResponse {
    success: bool,
    message: String,
}

// Response structure for topics
#[derive(Serialize, ToSchema)]
struct TopicsResponse {
    topics: Vec<String>,
}

// Define API documentation
#[derive(OpenApi)]
#[openapi(
    paths(
        health_check,
        get_topics,
        subscribe_to_topic,
        unsubscribe_from_topic
    ),
    components(
        schemas(SubscribeRequest, ApiResponse, TopicsResponse)
    ),
    tags(
        (name = "MQTT Subscriber", description = "MQTT Subscriber API endpoints")
    ),
    info(
        title = "MQTT Subscriber API",
        version = "1.0.0",
        description = "API for subscribing to and managing MQTT topics",
        license(
            name = "MIT",
            url = "https://opensource.org/licenses/MIT"
        ),
        contact(
            name = "Support",
            email = "support@example.com"
        )
    )
)]
struct ApiDoc;

fn get_env_or_default(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

// Handle MQTT events in a separate task
async fn process_mqtt_events(
    mut eventloop: rumqttc::EventLoop,
    topics: Arc<RwLock<HashSet<String>>>,
) {
    info!("Starting MQTT event processing loop");
    
    loop {
        match eventloop.poll().await {
            Ok(notification) => {
                match notification {
                    Event::Incoming(Packet::Publish(publish)) => {
                        let payload = String::from_utf8_lossy(&publish.payload);
                        info!("Received from {}: {}", publish.topic, payload);
                        
                        // Further processing can be added here
                        // - Parse JSON
                        // - Forward to other systems
                        // - Trigger rules engine
                    },
                    Event::Incoming(packet) => {
                        info!("Received packet: {:?}", packet);
                    },
                    Event::Outgoing(packet) => {
                        // Debug level for outgoing packets to reduce noise
                        if log::log_enabled!(log::Level::Debug) {
                            info!("Sent packet: {:?}", packet);
                        }
                    }
                }
            },
            Err(e) => {
                error!("Connection error: {:?}", e);
                
                // If it's a connection error, we might want to reconnect
                error!("Connection error: {:?}, attempting to reconnect in 5s", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
                
                // Resubscribe to topics after reconnection
                let topic_list = topics.read().await;
                if !topic_list.is_empty() {
                    info!("Reconnected, resubscribing to {} topics", topic_list.len());
                    // Resubscription logic would go here
                }
            }
        }
    }
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
async fn subscribe_to_topic(
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
    
    // Subscribe to the topic using AsyncClient
    match state.mqtt_client.subscribe(&topic, state.mqtt_qos).await {
        Ok(_) => {
            // Add to our list of subscribed topics
            let mut topics_write = state.topics.write().await;
            topics_write.insert(topic.clone());
            
            info!("Successfully subscribed to topic: {}", topic);
            Ok(Json(ApiResponse {
                success: true,
                message: format!("Subscribed to topic: {}", topic),
            }))
        },
        Err(e) => {
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
async fn unsubscribe_from_topic(
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
    
    // Unsubscribe from the topic
    match state.mqtt_client.unsubscribe(&topic).await {
        Ok(_) => {
            // Remove from our list of subscribed topics
            let mut topics_write = state.topics.write().await;
            topics_write.remove(&topic);
            
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

/// Get a list of all subscribed topics
#[utoipa::path(
    get,
    path = "/topics",
    responses(
        (status = 200, description = "List of subscribed topics", body = TopicsResponse)
    ),
    tag = "MQTT Subscriber"
)]
async fn get_topics(
    State(state): State<Arc<AppState>>,
) -> Json<TopicsResponse> {
    let topics_read = state.topics.read().await;
    let topics_vec: Vec<String> = topics_read.iter().cloned().collect();
    
    Json(TopicsResponse {
        topics: topics_vec,
    })
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
async fn health_check() -> &'static str {
    "MQTT Subscriber is running"
}

#[tokio::main]
async fn main() {
    // Initialize logging with info level by default
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "info");
    }
    env_logger::init();
    
    // Load environment variables
    dotenv().ok();
    
    // Parse environment variables
    let mqtt_broker = get_env_or_default("MQTT_BROKER", "xrdevmqtt.edu.metropolia.fi");
    let mqtt_port = get_env_or_default("MQTT_PORT", "1883").parse::<u16>().unwrap_or(1883);
    let mqtt_client_id = get_env_or_default("MQTT_CLIENT_ID", "mqtt-subscriber-rust");
    let mqtt_username = get_env_or_default("MQTT_USERNAME", "");
    let mqtt_password = get_env_or_default("MQTT_PASSWORD", "");
    let api_port = get_env_or_default("API_PORT", "3000").parse::<u16>().unwrap_or(3000);
    let mqtt_qos = match get_env_or_default("MQTT_QOS", "0").parse::<u8>().unwrap_or(0) {
        0 => QoS::AtMostOnce,
        1 => QoS::AtLeastOnce,
        _ => QoS::ExactlyOnce,
    };
    
    info!("Starting MQTT Subscriber Service");
    info!("Configuration: Broker={}, Port={}", mqtt_broker, mqtt_port);
    info!("API will be available on port {}", api_port);
    
    // MQTT client setup
    let mut mqtt_options = MqttOptions::new(mqtt_client_id.clone(), mqtt_broker.clone(), mqtt_port);
    mqtt_options.set_keep_alive(Duration::from_secs(60));  // Longer keep-alive
    mqtt_options.set_clean_session(true);  // Start with a clean session

    // Generate a random client ID to avoid conflicts
    if mqtt_client_id == "mqtt-subscriber-rust" {
        use std::time::SystemTime;
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let random_client_id = format!("mqtt-subscriber-rust-{}", timestamp);
        mqtt_options = MqttOptions::new(random_client_id.clone(), mqtt_broker.clone(), mqtt_port);
        info!("Using generated client ID: {}", random_client_id);
    }

    // Set credentials if provided
    if !mqtt_username.is_empty() && !mqtt_password.is_empty() {
        mqtt_options.set_credentials(mqtt_username, mqtt_password);
        info!("Using provided MQTT credentials");
    } else {
        info!("No MQTT credentials provided");
    }
    
    // Create MQTT AsyncClient
    let (client, eventloop) = AsyncClient::new(mqtt_options, 100);
    
    // Initialize the topic set
    let topics = HashSet::new();
    
    // Set up shared state
    let state = Arc::new(AppState {
        mqtt_client: Arc::new(client),
        topics: Arc::new(RwLock::new(topics)),
        mqtt_qos,
    });
    
    // Clone state for the MQTT event processor
    let topics_for_processor = Arc::clone(&state.topics);
    
    // Start MQTT event processing in a separate task
    tokio::spawn(async move {
        process_mqtt_events(eventloop, topics_for_processor).await;
    });
    
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    
    // API documentation
    let openapi = ApiDoc::openapi();
    
    // Create API router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/topics", get(get_topics))
        .route("/subscribe", post(subscribe_to_topic))
        .route("/unsubscribe/{topic}", delete(unsubscribe_from_topic))
        .merge(SwaggerUi::new("/docs").url("/api-docs/openapi.json", openapi))
        .layer(cors)
        .with_state(state);
    
    // Start the HTTP server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", api_port))
        .await
        .unwrap();
    
    info!("API server running on http://0.0.0.0:{}", api_port);
    info!("API documentation available at http://0.0.0.0:{}/docs/", api_port);
    
    axum::serve(listener, app).await.unwrap();
} 