//! MQTT Subscriber implementation

use log::{error, info};
use rumqttc::{AsyncClient, MqttOptions, QoS};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::models::MessageMetrics;

/// MQTT Subscriber for managing MQTT topic subscriptions
pub struct MqttSubscriber {
    connection: Arc<Mutex<Option<AsyncClient>>>,
    topics: Arc<RwLock<HashSet<String>>>,
    metrics: Arc<RwLock<MessageMetrics>>,
    mqtt_options: MqttOptions,
    mqtt_qos: QoS,
    event_loop_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl MqttSubscriber {
    /// Create a new MQTT subscriber
    pub fn new(mqtt_options: MqttOptions, mqtt_qos: QoS) -> Self {
        Self {
            connection: Arc::new(Mutex::new(None)),
            topics: Arc::new(RwLock::new(HashSet::new())),
            metrics: Arc::new(RwLock::new(MessageMetrics::new())),
            mqtt_options,
            mqtt_qos,
            event_loop_handle: Arc::new(Mutex::new(None)),
        }
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

        // Add to our list of topics
        {
            let mut topics_write = self.topics.write().await;
            topics_write.insert(topic.to_string());
        }

        // Ensure connection exists
        self.ensure_connection().await?;

        // Subscribe to the topic
        let connection_lock = self.connection.lock().await;
        if let Some(client) = &*connection_lock {
            match client.subscribe(topic, self.mqtt_qos).await {
                Ok(_) => {
                    info!("Subscribed to topic: {}", topic);
                    Ok(())
                }
                Err(e) => {
                    // If subscription fails, remove the topic
                    let mut topics_write = self.topics.write().await;
                    topics_write.remove(topic);

                    error!("Failed to subscribe to topic {}: {:?}", topic, e);
                    Err(format!("Failed to subscribe: {:?}", e))
                }
            }
        } else {
            Err("MQTT client not available".to_string())
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

        // Get the client if it exists
        let connection_lock = self.connection.lock().await;
        let client = match &*connection_lock {
            Some(client) => client,
            None => {
                return Err("MQTT client not available".to_string());
            }
        };

        // Unsubscribe from the topic
        match client.unsubscribe(topic).await {
            Ok(_) => {
                // Remove from our list of subscribed topics
                let mut topics_write = self.topics.write().await;
                topics_write.remove(topic);
                drop(topics_write);
                drop(connection_lock);

                // Update connection state
                self.ensure_connection().await?;

                info!("Unsubscribed from topic: {}", topic);
                Ok(())
            }
            Err(e) => {
                error!("Failed to unsubscribe from topic {}: {:?}", topic, e);
                Err(format!("Failed to unsubscribe: {:?}", e))
            }
        }
    }

    /// Get currently subscribed topics
    pub async fn get_topics(&self) -> Vec<String> {
        let topics_read = self.topics.read().await;
        topics_read.iter().cloned().collect()
    }

    /// Get metrics
    pub async fn get_metrics(&self) -> MessageMetrics {
        let metrics_read = self.metrics.read().await;
        metrics_read.clone()
    }

    /// Ensure MQTT connection exists if needed
    async fn ensure_connection(&self) -> Result<(), String> {
        let topics_read = self.topics.read().await;
        let topics_count = topics_read.len();
        drop(topics_read); // Release the read lock

        // Create a new connection if needed
        if topics_count > 0 {
            // Check if we already have a connection
            let have_connection = {
                let connection_lock = self.connection.lock().await;
                connection_lock.is_some()
            };

            // Create a new connection if needed
            if !have_connection {
                // Clone necessary values for the async task
                let mqtt_options = self.mqtt_options.clone();
                let topics = Arc::clone(&self.topics);
                let connection = Arc::clone(&self.connection);
                let event_loop_handle = Arc::clone(&self.event_loop_handle);
                let metrics = Arc::clone(&self.metrics);
                let mqtt_qos = self.mqtt_qos;

                // Create the connection
                super::connection::create_connection(
                    mqtt_options,
                    topics,
                    connection,
                    event_loop_handle,
                    metrics,
                    mqtt_qos,
                )
                .await?;
            }
        } else {
            // If no topics, disconnect
            let mut connection_lock = self.connection.lock().await;
            if connection_lock.is_some() {
                *connection_lock = None;

                // Also drop the event loop handle
                let mut event_loop_lock = self.event_loop_handle.lock().await;
                if let Some(handle) = event_loop_lock.take() {
                    handle.abort();
                }

                info!("Disconnected MQTT client as no topics are subscribed");
            }
        }

        Ok(())
    }

    /// Reset metrics to prevent overflow in long-running deployments
    pub async fn reset_metrics(&self) {
        let mut metrics_guard = self.metrics.write().await;

        // Create a new metrics instance
        let mut new_metrics = MessageMetrics::new();

        // Copy over the timestamp fields we want to keep
        new_metrics.first_message_time = metrics_guard.first_message_time;
        new_metrics.last_message_time = metrics_guard.last_message_time;

        // Replace the metrics
        *metrics_guard = new_metrics;

        log::info!("Metrics have been reset");
    }
}
