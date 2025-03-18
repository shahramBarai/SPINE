//! Shared data models for the MQTT subscriber service

use rumqttc::QoS;
use std::time::{Duration, Instant, SystemTime};

/// MQTT Message with metadata
#[derive(Debug)]
#[allow(dead_code)] // Silence warning about unused fields
pub struct MqttMessage {
    pub topic: String,
    pub payload: Vec<u8>,
    pub qos: QoS,
    pub retain: bool,
    pub received_at: Instant,  // Kept for internal timing
    pub timestamp: SystemTime, // Added for absolute timestamp
}

/// Message processing metrics
///
/// TODO: In the future, implement sliding window metrics using a RingBuffer
/// to track metrics over different time periods (1m, 5m, 15m, 1h)
#[derive(Debug, Clone)]
pub struct MessageMetrics {
    // Counter metrics
    pub messages_received: usize,
    pub messages_processed: usize,
    pub messages_dropped: usize,
    pub processing_errors: usize,

    // Performance metrics
    pub throughput: f64,                   // Messages per second
    pub average_message_size: usize,       // Average message size in bytes
    pub max_message_size: usize,           // Largest message seen
    pub average_processing_time: Duration, // Average processing time
    pub max_processing_time: Duration,     // Max processing time seen

    // Time tracking
    pub first_message_time: Option<SystemTime>,
    pub last_message_time: Option<SystemTime>,

    // Internal state for calculations
    total_message_size: usize,
    total_processing_time: Duration,
    last_throughput_calculation: Instant,
    recent_message_count: usize,
}

impl MessageMetrics {
    /// Create a new metrics instance
    pub fn new() -> Self {
        Self {
            messages_received: 0,
            messages_processed: 0,
            messages_dropped: 0,
            processing_errors: 0,

            throughput: 0.0,
            average_message_size: 0,
            max_message_size: 0,
            average_processing_time: Duration::from_secs(0),
            max_processing_time: Duration::from_secs(0),

            first_message_time: None,
            last_message_time: None,

            total_message_size: 0,
            total_processing_time: Duration::from_secs(0),
            last_throughput_calculation: Instant::now(),
            recent_message_count: 0,
        }
    }

    /// Record a new message received
    pub fn record_message_received(&mut self, size: usize, timestamp: SystemTime) {
        self.messages_received += 1;
        self.recent_message_count += 1;

        // Update message size statistics
        self.total_message_size += size;
        self.average_message_size = if self.messages_received > 0 {
            self.total_message_size / self.messages_received
        } else {
            0
        };
        self.max_message_size = self.max_message_size.max(size);

        // Update timestamps
        if self.first_message_time.is_none() {
            self.first_message_time = Some(timestamp);
        }
        self.last_message_time = Some(timestamp);

        // Calculate throughput every second
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_throughput_calculation);

        if elapsed >= Duration::from_secs(1) {
            self.throughput = self.recent_message_count as f64 / elapsed.as_secs_f64();
            self.recent_message_count = 0;
            self.last_throughput_calculation = now;
        }

        // Add the safety check
        self.check_and_reset_if_needed();
    }

    /// Record a message as processed
    pub fn record_message_processed(&mut self, processing_time: Duration) {
        self.messages_processed += 1;

        // Update processing time statistics
        self.total_processing_time += processing_time;
        self.average_processing_time = if self.messages_processed > 0 {
            Duration::from_nanos(
                (self.total_processing_time.as_nanos() / self.messages_processed as u128) as u64,
            )
        } else {
            Duration::from_secs(0)
        };

        self.max_processing_time = if processing_time > self.max_processing_time {
            processing_time
        } else {
            self.max_processing_time
        };
    }

    /// Record a message as dropped
    pub fn record_message_dropped(&mut self) {
        self.messages_dropped += 1;
    }

    /// Record a processing error
    pub fn record_processing_error(&mut self) {
        self.processing_errors += 1;
    }

    // Check if we're approaching usize max value
    pub fn check_and_reset_if_needed(&mut self) {
        const RESET_THRESHOLD: usize = usize::MAX - 1000;

        // If any counter is getting close to overflow, log and reset stats
        if self.messages_received > RESET_THRESHOLD
            || self.messages_processed > RESET_THRESHOLD
            || self.total_message_size > RESET_THRESHOLD
        {
            // Log that we're resetting for safety
            log::warn!(
                "Metrics counters approaching maximum values, resetting to prevent overflow"
            );

            // Reset counters but keep performance metrics and timestamps
            self.messages_received = 0;
            self.messages_processed = 0;
            self.messages_dropped = 0;
            self.processing_errors = 0;
            self.total_message_size = 0;

            // Don't reset throughput, average sizes, or timestamps
            // as they remain valid
        }
    }
}
