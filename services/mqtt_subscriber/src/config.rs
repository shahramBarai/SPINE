//! Configuration handling for the MQTT subscriber service

use rumqttc::{MqttOptions, QoS};
use std::env;
use std::time::{Duration, SystemTime};

/// Service configuration
pub struct MqttConfig {
    pub mqtt_options: MqttOptions,
    pub mqtt_qos: QoS,
}

pub struct ApiConfig {
    pub port: u16,
}

pub struct KafkaConfig {
    pub broker: String,
    pub topic_sensor_data: String,
    pub topic_service_metrics: String,
}

pub struct Config {
    pub mqtt: MqttConfig,
    pub api: ApiConfig,
    pub kafka: KafkaConfig,
}

/// Get an environment variable or return a default value
fn get_env_or_default(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Load configuration from environment variables
pub fn load_mqtt_configs() -> MqttConfig {
    // Load MQTT configuration
    let mqtt_broker = get_env_or_default("MQTT_BROKER", "xrdevmqtt.edu.metropolia.fi");
    let mqtt_port = get_env_or_default("MQTT_PORT", "1883")
        .parse::<u16>()
        .unwrap_or(1883);
    let mqtt_username = get_env_or_default("MQTT_USERNAME", "");
    let mqtt_password = get_env_or_default("MQTT_PASSWORD", "");
    let mqtt_qos = match get_env_or_default("MQTT_QOS", "0").as_str() {
        "1" => QoS::AtLeastOnce,
        "2" => QoS::ExactlyOnce,
        _ => QoS::AtMostOnce,
    };
    let mqtt_keep_alive = get_env_or_default("MQTT_KEEP_ALIVE", "60")
        .parse::<u64>()
        .unwrap_or(60);

    // Generate a random client ID
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let random_client_id = format!("mqtt-subscriber-{}", timestamp);

    // Create MQTT options
    let mut mqtt_options = MqttOptions::new(random_client_id, mqtt_broker, mqtt_port);

    // Configure MQTT connection (send ping if no message is received for mqtt_keep_alive seconds)
    mqtt_options.set_keep_alive(Duration::from_secs(mqtt_keep_alive));

    // Add credentials if provided
    if !mqtt_username.is_empty() {
        mqtt_options.set_credentials(mqtt_username, mqtt_password);
    }

    MqttConfig {
        mqtt_options,
        mqtt_qos,
    }
}

pub fn load_api_configs() -> ApiConfig {
    let api_port = get_env_or_default("API_PORT", "3000")
        .parse::<u16>()
        .unwrap_or(3000);

    ApiConfig { port: api_port }
}

pub fn load_kafka_configs() -> KafkaConfig {
    let kafka_broker = get_env_or_default("KAFKA_BROKER", "localhost:9092");
    let kafka_topic_sensor_data = get_env_or_default("KAFKA_TOPIC_SENSOR_DATA", "smartlab-data");
    let kafka_topic_service_metrics =
        get_env_or_default("KAFKA_TOPIC_SERVICE_METRICS", "smartlab-subscriber-metrics");

    KafkaConfig {
        broker: kafka_broker,
        topic_sensor_data: kafka_topic_sensor_data,
        topic_service_metrics: kafka_topic_service_metrics,
    }
}

pub fn load_config() -> Config {
    Config {
        mqtt: load_mqtt_configs(),
        api: load_api_configs(),
        kafka: load_kafka_configs(),
    }
}
