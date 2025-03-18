//! MQTT connection and event handling logic

use crate::models::MqttConnection;
use log::{error, info};
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use std::{collections::HashSet, sync::Arc, time::Duration};
use tokio::sync::{mpsc, Mutex, RwLock};

/// Process incoming messages from MQTT
pub async fn process_messages(mut rx: mpsc::Receiver<(String, Vec<u8>)>) {
    while let Some((topic, payload)) = rx.recv().await {
        let payload_str = String::from_utf8_lossy(&payload);
        
        // TODO: Process message based on topic
        info!("Received message from {}: {}", topic, payload_str);
    }
}

/// Connect to MQTT broker and start event processing
pub async fn connect_mqtt(
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

/// Ensure MQTT connection exists if needed
pub async fn ensure_mqtt_connection(
    mqtt_connection: &Arc<Mutex<MqttConnection>>,
    topics: &Arc<RwLock<HashSet<String>>>,
    mqtt_options: MqttOptions,
    message_handlers: &Arc<Mutex<Vec<mpsc::Sender<(String, Vec<u8>)>>>>,
    mqtt_qos: QoS,
) -> Result<(), String> {
    let topics_read = topics.read().await;
    let topics_count = topics_read.len();
    drop(topics_read);  // Release the read lock
    
    // Check if we need a connection
    if topics_count == 0 {
        info!("No topics to subscribe to, connection not needed");
        return Ok(());
    }
    
    let mut connection = mqtt_connection.lock().await;
    
    // Create connection if needed
    if connection.client.is_none() {
        info!("Creating new MQTT connection for {} topics", topics_count);
        
        match connect_mqtt(mqtt_options, Arc::clone(topics), Arc::clone(message_handlers), mqtt_qos).await {
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