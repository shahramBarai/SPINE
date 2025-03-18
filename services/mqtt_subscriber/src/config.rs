//! Configuration handling for the MQTT subscriber service

use rumqttc::{MqttOptions, QoS};
use std::env;
use std::time::{Duration, SystemTime};

/// Get an environment variable or return a default value
pub fn get_env_or_default(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

/// Load application configuration from environment variables
pub fn load_config() -> (MqttOptions, QoS, u16) {
    // Parse environment variables
    let mqtt_broker = get_env_or_default("MQTT_BROKER", "xrdevmqtt.edu.metropolia.fi");
    let mqtt_port = get_env_or_default("MQTT_PORT", "1883")
        .parse::<u16>()
        .unwrap_or(1883);
    let mqtt_username = get_env_or_default("MQTT_USERNAME", "");
    let mqtt_password = get_env_or_default("MQTT_PASSWORD", "");
    let api_port = get_env_or_default("API_PORT", "3000")
        .parse::<u16>()
        .unwrap_or(3000);
    let mqtt_qos = match get_env_or_default("MQTT_QOS", "0")
        .parse::<u8>()
        .unwrap_or(0)
    {
        0 => QoS::AtMostOnce,
        1 => QoS::AtLeastOnce,
        _ => QoS::ExactlyOnce,
    };

    // Generate a random client ID
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let random_client_id = format!("mqtt-subscriber-{}", timestamp);

    // MQTT options setup
    let mut mqtt_options = MqttOptions::new(random_client_id.clone(), mqtt_broker, mqtt_port);
    mqtt_options.set_keep_alive(Duration::from_secs(60));
    mqtt_options.set_clean_session(true);

    // Set credentials if provided
    if !mqtt_username.is_empty() && !mqtt_password.is_empty() {
        mqtt_options.set_credentials(mqtt_username, mqtt_password);
    }

    (mqtt_options, mqtt_qos, api_port)
}
