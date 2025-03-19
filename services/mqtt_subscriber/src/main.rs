//! MQTT Subscriber Service

use dotenv::dotenv;
use log::info;
use std::sync::Arc;

// Import from our modules
use crate::api::routes::create_router;
use crate::config::load_config;
use crate::mqtt::subscriber::MqttSubscriber;

// Import our modules
mod api;
mod config;
mod metrics;
mod models;
mod mqtt;
mod processor;

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
    let config = load_config();

    // Create and initialize the MQTT subscriber
    let subscriber = MqttSubscriber::new(config.mqtt.mqtt_options, config.mqtt.mqtt_qos);
    let subscriber = Arc::new(subscriber);

    // Create API router
    let app = create_router(subscriber.clone());

    // Start the HTTP server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.api.port))
        .await
        .unwrap();

    info!("API server running on http://0.0.0.0:{}", config.api.port);
    info!(
        "API documentation available at http://0.0.0.0:{}/docs/",
        config.api.port
    );

    axum::serve(listener, app).await.unwrap();
}
