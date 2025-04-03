CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE sensor_data (
  id SERIAL,
  sensor_id TEXT NOT NULL,
  message TEXT NOT NULL,
  sensor_timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (sensor_id, sensor_timestamp)
);
SELECT create_hypertable('sensor_data', by_range('sensor_timestamp', INTERVAL '1 day'));