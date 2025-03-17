mod config;
mod handlers;
mod models;
mod mqtt;

use crate::config::load_config;
use crate::handlers::{get_topics, health_check, subscribe_to_topic, unsubscribe_from_topic};
use crate::models::{ApiResponse, AppState, MqttConnection, SubscribeRequest, TopicsResponse};
use crate::mqtt::{process_messages, ensure_mqtt_connection};

use axum::{routing::{get, post, delete}, Router};
use dotenv::dotenv;
use log::info;
use std::{collections::HashSet, sync::Arc};
use tokio::sync::{mpsc, Mutex, RwLock};
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

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
            name = "Shahram Barai",
            email = "shahram.barai@metropolia.fi"
        )
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() {
    // Initialize logging with info level by default
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "info");
    }
    env_logger::init();
    
    // Load environment variables
    dotenv().ok();
    
    info!("Starting MQTT Subscriber Service");
    
    // Load configuration
    let (mqtt_options, mqtt_qos, api_port) = load_config();
    
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
        .route("/unsubscribe/:topic", delete(unsubscribe_from_topic))
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