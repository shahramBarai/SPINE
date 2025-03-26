//! MQTT Subscriber Service

use dotenv::dotenv;
use log::{info, warn};
use std::sync::Arc;
use tokio::sync::RwLock;

// Import from our modules
use crate::api::handlers::AppState;
use crate::api::routes::create_router;
use crate::config::load_config;
use crate::kafka::producer::KafkaProducer;
use crate::metrics::MessageMetrics;
use crate::mqtt::subscriber::MqttSubscriber;
use crate::processor::handler::start_message_processor;

// Import our modules
mod api;
mod config;
mod kafka;
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

    // Load configurations
    let configs = load_config();

    // Create and initialize the Kafka producer,
    let kafka_producer = match KafkaProducer::new(
        &configs.kafka.broker,
        &configs.kafka.topic_sensor_data,
        &configs.kafka.topic_service_metrics,
    )
    .await
    {
        Ok(producer) => Arc::new(producer),
        Err(e) => {
            warn!("Failed to create Kafka producer: {}", e);
            return;
        }
    };

    // Create and initialize the metrics
    let metrics = Arc::new(RwLock::new(MessageMetrics::new()));

    // Create and initialize the MQTT subscriber
    let (subscriber, event_loop) =
        MqttSubscriber::new(configs.mqtt.mqtt_options, configs.mqtt.mqtt_qos);
    let subscriber = Arc::new(subscriber);

    // Start the message processor in a background task
    let processor_metrics = Arc::clone(&metrics);
    let processor_subscriber = Arc::clone(&subscriber);
    let processor_kafka = Arc::clone(&kafka_producer);

    tokio::spawn(async move {
        start_message_processor(
            event_loop,
            processor_subscriber,
            processor_kafka,
            processor_metrics,
        )
        .await;
    });

    // Create application state for API
    let app_state = Arc::new(AppState {
        subscriber: Arc::clone(&subscriber),
        metrics: Arc::clone(&metrics),
        kafka_producer: Arc::clone(&kafka_producer),
    });

    // Create API router
    let app = create_router(app_state);

    // Start the HTTP server
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", configs.api.port))
        .await
        .unwrap();

    info!("API server running on http://0.0.0.0:{}", configs.api.port);
    info!(
        "API documentation available at http://0.0.0.0:{}/docs/",
        configs.api.port
    );

    axum::serve(listener, app).await.unwrap();
}
