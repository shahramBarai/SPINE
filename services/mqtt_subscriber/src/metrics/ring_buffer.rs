//! Implementation of a fixed-size circular buffer for metrics

/// A simple ring buffer implementation for our time windows
#[derive(Debug, Clone)]
pub struct RingBuffer<T> {
    buffer: Vec<T>,
    capacity: usize,
    position: usize,
    count: usize,
}

impl<T> RingBuffer<T>
where
    T: Default + Clone,
{
    /// Create a new ring buffer with the specified capacity
    pub fn new(capacity: usize) -> Self {
        assert!(
            capacity > 0,
            "RingBuffer capacity must be greater than zero"
        );
        Self {
            buffer: vec![T::default(); capacity],
            capacity,
            position: 0,
            count: 0,
        }
    }

    /// Add an item to the ring buffer
    pub fn push(&mut self, item: T) {
        self.buffer[self.position] = item;
        self.position = (self.position + 1) % self.capacity;
        if self.count < self.capacity {
            self.count += 1;
        }
    }

    /// Get a reference to the item at the specified index, with 0 being the oldest item
    pub fn get(&self, index: usize) -> Option<&T> {
        let actual_index = (self.position + self.capacity - self.count + index) % self.capacity;

        Some(&self.buffer[actual_index])
    }

    /// Get an iterator over the items in the buffer from oldest to newest
    pub fn iter(&self) -> impl Iterator<Item = &T> {
        (0..self.count).map(move |i| self.get(i).unwrap())
    }

    /// Get the number of items in the buffer
    pub fn len(&self) -> usize {
        self.count
    }

    // /// Check if the buffer is empty
    // pub fn is_empty(&self) -> bool {
    //     self.count == 0
    // }

    // /// Check if the buffer is full
    // pub fn is_full(&self) -> bool {
    //     self.count == self.capacity
    // }

    // /// Clear the buffer
    // pub fn clear(&mut self) {
    //     for i in 0..self.capacity {
    //         self.buffer[i] = T::default();
    //     }
    //     self.position = 0;
    //     self.count = 0;
    // }
}
