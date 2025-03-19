//! Time-windowed metrics collection

use crate::metrics::Duration;
use crate::metrics::SystemTime;

/// Metrics for a specific time window (e.g., one minute)
#[derive(Debug, Clone)]
pub struct WindowedMetrics {
    /// Start time of this window
    pub start_time: SystemTime,
    /// End time of this window (may be ongoing)
    pub end_time: SystemTime,

    /// Number of messages received in this window
    pub messages_received: usize,
    /// Number of messages processed in this window
    pub messages_processed: usize,
    /// Number of messages dropped in this window
    pub messages_dropped: usize,
    /// Number of processing errors in this window
    pub processing_errors: usize,

    /// Total message size in this window (for averaging)
    pub total_message_size: usize,
    /// Total processing time in this window (for averaging)
    pub total_processing_time: Duration,

    /// Maximum message size seen in this window
    pub max_message_size: usize,
    /// Maximum processing time seen in this window
    pub max_processing_time: Duration,
}

impl Default for WindowedMetrics {
    fn default() -> Self {
        let now = SystemTime::now();
        Self {
            start_time: now,
            end_time: now,
            messages_received: 0,
            messages_processed: 0,
            messages_dropped: 0,
            processing_errors: 0,
            total_message_size: 0,
            total_processing_time: Duration::from_secs(0),
            max_message_size: 0,
            max_processing_time: Duration::from_secs(0),
        }
    }
}

impl WindowedMetrics {
    /// Create a new window metrics instance
    pub fn new(start_time: SystemTime) -> Self {
        Self {
            start_time,
            end_time: start_time,
            ..Default::default()
        }
    }

    /// Update window with a received message
    pub fn record_message_received(&mut self, size: usize, timestamp: SystemTime) {
        self.messages_received += 1;
        self.total_message_size += size;
        self.max_message_size = self.max_message_size.max(size);
        self.end_time = timestamp;
    }

    /// Update window with a processed message
    pub fn record_message_processed(&mut self, processing_time: Duration) {
        self.messages_processed += 1;
        self.total_processing_time += processing_time;
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

    // /// Calculate the message throughput for this window
    // pub fn throughput(&self) -> f64 {
    //     let window_duration = match self.end_time.duration_since(self.start_time) {
    //         Ok(duration) => duration,
    //         Err(_) => return 0.0, // Handle time going backwards (rare but possible)
    //     };

    //     if window_duration.as_secs() == 0 {
    //         return 0.0;
    //     }

    //     self.messages_received as f64 / window_duration.as_secs_f64()
    // }

    // /// Calculate the average message size
    // pub fn average_message_size(&self) -> usize {
    //     if self.messages_received == 0 {
    //         0
    //     } else {
    //         self.total_message_size / self.messages_received
    //     }
    // }

    // /// Calculate the average processing time
    // pub fn average_processing_time(&self) -> Duration {
    //     if self.messages_processed == 0 {
    //         Duration::from_secs(0)
    //     } else {
    //         Duration::from_nanos(
    //             (self.total_processing_time.as_nanos() / self.messages_processed as u128) as u64,
    //         )
    //     }
    // }
}
