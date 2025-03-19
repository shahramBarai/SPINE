//! MQTT Subscriber implementation

use log::{error, info};
use rumqttc::{AsyncClient, EventLoop, MqttOptions, QoS};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;

/// MQTT Subscriber for managing MQTT topic subscriptions
pub struct MqttSubscriber {
    client: AsyncClient,
    topics: Arc<RwLock<HashSet<String>>>,
    mqtt_qos: QoS,
}

impl MqttSubscriber {
    /// Create a new MQTT subscriber with a persistent connection
    pub fn new(mqtt_options: MqttOptions, mqtt_qos: QoS) -> (Self, EventLoop) {
        info!("Creating new MQTT client");

        // Create MQTT client and event loop
        let (client, event_loop) = AsyncClient::new(mqtt_options, 100);

        let subscriber = Self {
            client,
            topics: Arc::new(RwLock::new(HashSet::new())),
            mqtt_qos,
        };

        info!("MQTT client created");

        (subscriber, event_loop)
    }

    /// Subscribe to a topic
    pub async fn subscribe(&self, topic: &str) -> Result<(), String> {
        // Check if we're already subscribed
        {
            let topics_read = self.topics.read().await;
            if topics_read.contains(topic) {
                return Ok(());
            }
        }

        // Subscribe to the topic
        match self.client.subscribe(topic, self.mqtt_qos).await {
            Ok(_) => {
                // Add to our list of topics
                let mut topics_write = self.topics.write().await;
                topics_write.insert(topic.to_string());

                info!("Subscribed to topic: {}", topic);
                Ok(())
            }
            Err(e) => {
                error!("Failed to subscribe to topic {}: {:?}", topic, e);
                Err(format!("Failed to subscribe: {:?}", e))
            }
        }
    }

    /// Unsubscribe from a topic
    pub async fn unsubscribe(&self, topic: &str) -> Result<(), String> {
        // Check if we're subscribed to this topic
        {
            let topics_read = self.topics.read().await;
            if !topics_read.contains(topic) {
                return Ok(());
            }
        }

        // Unsubscribe from the topic
        match self.client.unsubscribe(topic).await {
            Ok(_) => {
                // Remove from our list of topics
                let mut topics_write = self.topics.write().await;
                topics_write.remove(topic);

                info!("Unsubscribed from topic: {}", topic);
                Ok(())
            }
            Err(e) => {
                error!("Failed to unsubscribe from topic {}: {:?}", topic, e);
                Err(format!("Failed to unsubscribe: {:?}", e))
            }
        }
    }

    /// Get a list of all subscribed topics
    pub async fn get_topics(&self) -> Vec<String> {
        let topics_read = self.topics.read().await;
        topics_read.iter().cloned().collect()
    }
}
