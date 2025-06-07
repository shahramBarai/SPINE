//! Main metrics aggregation and calculation

use crate::metrics::ring_buffer::RingBuffer;
use crate::metrics::{Duration, SystemTime, WindowedMetrics, NUM_WINDOWS, WINDOW_DURATION};

/// Message processing metrics with sliding windows
///
/// IMPORTANT: Only the last completed one-minute window is included in metrics.
/// The current window (up to one minute of the most recent data) is excluded.
///
/// This approach provides stable metrics by using only complete windows,
/// at the tradeoff of not including the very latest data (max 1 minute lag).
///
/// Historical metrics can be implemented in the future by increasing NUM_WINDOWS.
#[derive(Debug, Clone)]
pub struct MessageMetrics {
    current_window: WindowedMetrics, // Current window being accumulated
    windows: RingBuffer<WindowedMetrics>, // Historical windows (ring buffer, oldest first)

    // Time window in seconds
    pub window_time_sec: u64,
    // Last message time
    pub last_message_time: Option<SystemTime>,
}

impl MessageMetrics {
    /// Create a new metrics instance
    pub fn new() -> Self {
        Self {
            current_window: WindowedMetrics::new(SystemTime::now()),
            windows: RingBuffer::new(NUM_WINDOWS),
            window_time_sec: WINDOW_DURATION.as_secs() * NUM_WINDOWS as u64,
            last_message_time: None,
        }
    }

    /// Record a new message received
    pub fn record_message_received(&mut self, size: usize, timestamp: SystemTime) {
        // Update global timestamp tracking
        self.last_message_time = Some(timestamp);

        // Check if we need to rotate to a new window
        if let Ok(elapsed) = timestamp.duration_since(self.current_window.start_time) {
            if elapsed >= WINDOW_DURATION {
                // Rotate to a new window
                let completed_window =
                    std::mem::replace(&mut self.current_window, WindowedMetrics::new(timestamp));
                self.windows.push(completed_window);
            }
        }

        // Update the current window
        self.current_window.record_message_received(size, timestamp);
    }

    /// Record a message as processed
    pub fn record_message_processed(&mut self, processing_time: Duration) {
        self.current_window
            .record_message_processed(processing_time);
    }

    /// Record a message as dropped
    pub fn record_message_dropped(&mut self) {
        self.current_window.record_message_dropped();
    }

    /// Record a processing error
    pub fn record_processing_error(&mut self) {
        self.current_window.record_processing_error();
    }

    // Combined metrics access methods

    /// Get the last message time or None if no messages have been received
    pub fn window_last_message_time(&self) -> Option<SystemTime> {
        if self.windows.is_empty() {
            self.last_message_time
        } else {
            Some(self.windows.get(self.windows.len() - 1).unwrap().end_time)
        }
    }

    /// Get the total number of messages received across all windows
    pub fn window_messages_received(&self) -> usize {
        self.windows
            .iter()
            .map(|w| w.messages_received)
            .sum::<usize>()
    }

    /// Get the total number of messages processed across all windows
    pub fn window_messages_processed(&self) -> usize {
        self.windows
            .iter()
            .map(|w| w.messages_processed)
            .sum::<usize>()
    }

    /// Get the total number of messages dropped across all windows
    pub fn window_messages_dropped(&self) -> usize {
        self.windows
            .iter()
            .map(|w| w.messages_dropped)
            .sum::<usize>()
    }

    /// Get the total number of processing errors across all windows
    pub fn window_processing_errors(&self) -> usize {
        self.windows
            .iter()
            .map(|w| w.processing_errors)
            .sum::<usize>()
    }

    /// Get the maximum message size seen in any window
    pub fn window_max_message_size(&self) -> usize {
        self.windows
            .iter()
            .map(|w| w.max_message_size)
            .max()
            .unwrap_or(0)
    }

    /// Get the average message size across all windows
    pub fn window_average_message_size(&self) -> usize {
        let total_size = self
            .windows
            .iter()
            .map(|w| w.total_message_size)
            .sum::<usize>();
        let total_messages = self.window_messages_received();

        if total_messages == 0 {
            return 0;
        }
        total_size / total_messages
    }

    /// Get the maximum processing time seen in any window
    pub fn window_max_processing_time(&self) -> Duration {
        self.windows
            .iter()
            .map(|w| w.max_processing_time)
            .max_by_key(|d| d.as_nanos())
            .unwrap_or_else(|| Duration::from_secs(0))
    }

    /// Get the average processing time across all windows
    pub fn window_average_processing_time(&self) -> Duration {
        let total_time: Duration = self.windows.iter().fold(Duration::from_secs(0), |acc, w| {
            acc + w.total_processing_time
        });
        let total_processed = self.window_messages_processed();

        if total_processed == 0 {
            Duration::from_secs(0)
        } else {
            Duration::from_nanos((total_time.as_nanos() / total_processed as u128) as u64)
        }
    }

    /// Get the combined throughput across all active windows
    pub fn window_throughput(&self) -> f64 {
        // No data, no throughput
        if self.windows.iter().next().is_none() {
            return 0.0;
        }

        // Get all completed windows
        let windows: Vec<&WindowedMetrics> = self.windows.iter().collect();

        // Find total messages
        let total_messages: usize = self.window_messages_received();

        // If we have data, calculate based on wall clock time
        if total_messages > 0 {
            // Find time range from start of first window to end of last
            let start_time = windows[0].start_time;
            let end_time = windows[windows.len() - 1].end_time;

            if let Ok(duration) = end_time.duration_since(start_time) {
                if duration.as_secs() > 0 {
                    return total_messages as f64 / duration.as_secs_f64();
                }
            }
        }

        // Default if we can't calculate
        0.0
    }
}
