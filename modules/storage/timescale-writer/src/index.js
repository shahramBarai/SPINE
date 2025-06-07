import { startConsumer } from "./kafka/consumer.js";

// TODO: Add a health check endpoint
try {
  await startConsumer();
} catch (error) {
  console.error(error);
}
