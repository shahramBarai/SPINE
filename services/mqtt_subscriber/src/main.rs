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
use tokio::sync::{mpsc, Mutex, RwLock};
use tower_http::cors::{Any, CorsLayer};
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

// Connection manager for MQTT
struct MqttConnection {
    client: Option<AsyncClient>,
    event_loop_handle: Option<tokio::task::JoinHandle<()>>,
}

// Type for shared state across handlers
struct AppState {
    mqtt_connection: Arc<Mutex<MqttConnection>>,
    topics: Arc<RwLock<HashSet<String>>>,
    mqtt_options: MqttOptions,
    mqtt_qos: QoS,
    message_handlers: Arc<Mutex<Vec<mpsc::Sender<(String, Vec<u8>)>>>>,
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

// Process incoming messages from MQTT
async fn process_messages(mut rx: mpsc::Receiver<(String, Vec<u8>)>) {
    while let Some((topic, payload)) = rx.recv().await {
        let payload_str = String::from_utf8_lossy(&payload);
        info!("Received message from {}: {}", topic, payload_str);
        
        // TODO: Process message based on topic
        }
    }
}

// Connect to MQTT broker and start event processing
async fn connect_mqtt(
    mqtt_options: MqttOptions,
    topics: Arc<RwLock<HashSet<String>>>,
    message_handlers: Arc<Mutex<Vec<mpsc::Sender<(String, Vec<u8>)>>>>,
    qos: QoS,
) -> Result<(AsyncClient, tokio::task::JoinHandle<()>), String> {
    info!("Connecting to MQTT broker with options: {:?}", mqtt_options);
    
    // Create MQTT client
    let (client, mut eventloop) = AsyncClient::new(mqtt_options, 100);
    let client_clone = client.clone();
    
    // Clone the topics Arc for use in the event loop
    let topics_for_eventloop = Arc::clone(&topics);
    
    // Start event processing loop
    let handle = tokio::spawn(async move {
        info!("MQTT event loop started");
        
        loop {
            match eventloop.poll().await {
                Ok(notification) => {
                    match notification {
                        Event::Incoming(Packet::Publish(publish)) => {
                            let topic = publish.topic.clone();
                            let payload = publish.payload.to_vec();
                            
                            // Distribute the message to all handlers
                            let handlers = message_handlers.lock().await;
                            for handler in handlers.iter() {
                                if let Err(e) = handler.send((topic.clone(), payload.clone())).await {
                                    error!("Failed to send message to handler: {:?}", e);
                                }
                            }
                        },
                        Event::Incoming(packet) => {
                            info!("Received MQTT packet: {:?}", packet);
                        },
                        Event::Outgoing(packet) => {
                            if log::log_enabled!(log::Level::Debug) {
                                info!("Sent MQTT packet: {:?}", packet);
                            }
                        }
                    }
                },
                Err(e) => {
                    error!("MQTT connection error: {:?}", e);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    
                    // Try to reconnect
                    let topics_to_resubscribe = {
                        let topics_read = topics_for_eventloop.read().await;
                        topics_read.iter().cloned().collect::<Vec<_>>()
                    };
                    
                    if !topics_to_resubscribe.is_empty() {
                        info!("Reconnecting and resubscribing to {} topics", topics_to_resubscribe.len());
                        for topic in topics_to_resubscribe {
                            match client_clone.subscribe(&topic, qos).await {
                                Ok(_) => info!("Resubscribed to topic: {}", topic),
                                Err(e) => error!("Failed to resubscribe to {}: {:?}", topic, e),
                            }
                        }
                    }
                }
            }
        }
    });
    
    // Now we can safely use the original topics Arc
    // Subscribe to all current topics
    let topics_to_subscribe = {
        let topics_read = topics.read().await;
        topics_read.iter().cloned().collect::<Vec<_>>()
    };
    
    for topic in topics_to_subscribe {
        match client.subscribe(&topic, qos).await {
            Ok(_) => info!("Subscribed to topic: {}", topic),
            Err(e) => error!("Failed to subscribe to {}: {:?}", topic, e),
        }
    }
    
    Ok((client, handle))
}

// Ensure MQTT connection exists if needed
async fn ensure_mqtt_connection(state: &Arc<AppState>) -> Result<(), String> {
    let topics_read = state.topics.read().await;
    let topics_count = topics_read.len();
    drop(topics_read);  // Release the read lock
    
    // Check if we need a connection
    if topics_count == 0 {
        info!("No topics to subscribe to, connection not needed");
        return Ok(());
    }
    
    let mut connection = state.mqtt_connection.lock().await;
    
    // Create connection if needed
    if connection.client.is_none() {
        info!("Creating new MQTT connection for {} topics", topics_count);
        let mqtt_options = state.mqtt_options.clone();
        let topics = Arc::clone(&state.topics);
        let message_handlers = Arc::clone(&state.message_handlers);
        let qos = state.mqtt_qos;
        
        match connect_mqtt(mqtt_options, topics, message_handlers, qos).await {
            Ok((client, handle)) => {
                connection.client = Some(client);
                connection.event_loop_handle = Some(handle);
                info!("MQTT connection established successfully");
            },
            Err(e) => {
                error!("Failed to establish MQTT connection: {}", e);
                return Err(format!("Failed to establish MQTT connection: {}", e));
            }
        }
    }
    
    Ok(())
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
    
    // Add to our list of subscribed topics BEFORE ensuring connection
    {
        let mut topics_write = state.topics.write().await;
        topics_write.insert(topic.clone());
        info!("Added topic to tracking list: {}", topic);
    }
    
    // Now ensure MQTT connection exists
    if let Err(e) = ensure_mqtt_connection(&state).await {
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
            ensure_mqtt_connection(&state).await
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
    
    // Generate a random client ID
    let random_client_id = if mqtt_client_id == "mqtt-subscriber-rust" {
        use std::time::SystemTime;
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("mqtt-subscriber-rust-{}", timestamp)
    } else {
        mqtt_client_id
    };
    
    // MQTT options setup
    let mut mqtt_options = MqttOptions::new(random_client_id.clone(), mqtt_broker, mqtt_port);
    mqtt_options.set_keep_alive(Duration::from_secs(60));
    mqtt_options.set_clean_session(true);
    
    // Set credentials if provided
    if !mqtt_username.is_empty() && !mqtt_password.is_empty() {
        mqtt_options.set_credentials(mqtt_username, mqtt_password);
        info!("Using provided MQTT credentials");
    } else {
        info!("No MQTT credentials provided");
    }
    
    info!("Using client ID: {}", random_client_id);
    
    // Create message processing channel
    let (tx, rx) = mpsc::channel(100);
    let message_handlers = Arc::new(Mutex::new(vec![tx]));
    
    // Start message processing
    tokio::spawn(async move {
        process_messages(rx).await;
    });
    
    // Set up shared state
    let state = Arc::new(AppState {
        mqtt_connection: Arc::new(Mutex::new(MqttConnection {
            client: None,
            event_loop_handle: None,
        })),
        topics: Arc::new(RwLock::new(HashSet::new())),
        mqtt_options,
        mqtt_qos,
        message_handlers,
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