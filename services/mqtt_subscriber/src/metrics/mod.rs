//! Metrics collection and reporting for the MQTT subscriber service
//!
//! This module contains all the functionality for tracking, calculating,
//! and reporting performance metrics for the MQTT subscriber service.

mod message_metrics;
mod ring_buffer;
mod windowed;

// Re-export the main types
pub use message_metrics::MessageMetrics;
pub use windowed::WindowedMetrics;

// Constants used across the metrics module
/// The time window duration for each metrics bucket (1 minute)
pub const WINDOW_DURATION: Duration = Duration::from_secs(60);

/// Number of windows to maintain (5 minutes total)
pub const NUM_WINDOWS: usize = 5;

// Re-export std::time for convenience
pub use std::time::{Duration, SystemTime};
