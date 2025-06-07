from pyflink.datastream import StreamExecutionEnvironment, TimeCharacteristic
from pyflink.datastream.connectors.kafka import KafkaSource, KafkaOffsetsInitializer, KafkaSink, KafkaRecordSerializationSchema
from pyflink.common.serialization import SimpleStringSchema
from pyflink.common import WatermarkStrategy, Time, Duration
from pyflink.datastream.functions import MapFunction
from pyflink.common.typeinfo import Types
from pyflink.datastream.functions import ProcessFunction
from pyflink.datastream.cep import CEP, PatternStream, Pattern

import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cep-job")

# Kafka configuration
KAFKA_BROKERS = "kafka:9092"
SOURCE_TOPIC = "smartlab-sensor-data"
SINK_TOPIC = "detected-events"

class SensorReading:
    def __init__(self, sensor_id, message, sensor_timestamp, temp=None, co2=None):
        self.sensor_id = sensor_id
        self.message = message
        self.timestamp = sensor_timestamp
        self.temp = temp
        self.co2 = co2
        
    def __str__(self):
        return f"SensorReading(sensor_id={self.sensor_id}, temp={self.temp}, co2={self.co2})"

class JsonToSensorReadingMapFunction(MapFunction):
    def map(self, json_str):
        try:
            data = json.loads(json_str)
            
            sensor_id = data.get('sensor_id', '')
            message = data.get('message', '')
            
            # Extract timestamp
            sensor_timestamp = 0
            if 'sensor_timestamp' in data:
                timestamp_data = data['sensor_timestamp']
                if isinstance(timestamp_data, dict) and 'secs_since_epoch' in timestamp_data:
                    sensor_timestamp = timestamp_data['secs_since_epoch'] * 1000
                else:
                    sensor_timestamp = int(timestamp_data)
            
            # Try to extract temperature and CO2 values from the message
            temp = None
            co2 = None
            
            try:
                msg_data = json.loads(message)
                if 'temp' in msg_data:
                    temp = float(msg_data['temp'])
                if 'co2' in msg_data:
                    co2 = float(msg_data['co2'])
            except:
                # If message is not in JSON format, try to extract based on common patterns
                if "temperature" in message.lower():
                    parts = message.split()
                    for i, part in enumerate(parts):
                        if "temperature" in part.lower() and i+1 < len(parts):
                            try:
                                temp = float(parts[i+1].replace("°C", "").strip())
                            except:
                                pass
                
                if "co2" in message.lower() or "co₂" in message.lower():
                    parts = message.split()
                    for i, part in enumerate(parts):
                        if "co2" in part.lower() or "co₂" in part.lower() and i+1 < len(parts):
                            try:
                                co2 = float(parts[i+1].replace("ppm", "").strip())
                            except:
                                pass
            
            return SensorReading(sensor_id, message, sensor_timestamp, temp, co2)
        except Exception as e:
            logger.error(f"Error parsing sensor data: {e}")
            return None

def match_to_json(match):
    try:
        start_event = match['temp'][0]
        end_event = match['co2'][0]
        
        return json.dumps({
            'pattern': 'high_temp_followed_by_high_co2',
            'temp_sensor_id': start_event.sensor_id,
            'temp_value': start_event.temp,
            'temp_timestamp': start_event.timestamp,
            'co2_sensor_id': end_event.sensor_id,
            'co2_value': end_event.co2,
            'co2_timestamp': end_event.timestamp,
            'time_between_events_ms': end_event.timestamp - start_event.timestamp
        })
    except Exception as e:
        logger.error(f"Error creating alert message: {e}")
        return json.dumps({'error': str(e)})

def main():
    # Set up the execution environment
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(4)
    env.set_stream_time_characteristic(TimeCharacteristic.EventTime)
    
    # Configure Kafka source
    source = KafkaSource.builder() \
        .set_bootstrap_servers(KAFKA_BROKERS) \
        .set_topics(SOURCE_TOPIC) \
        .set_group_id("flink-cep-consumer") \
        .set_starting_offsets(KafkaOffsetsInitializer.latest()) \
        .set_value_only_deserializer(SimpleStringSchema()) \
        .build()
    
    # Create a watermark strategy with 5 seconds of out-of-orderness allowed
    watermark_strategy = WatermarkStrategy.for_bounded_out_of_orderness(Duration.of_seconds(5)) \
        .with_timestamp_assigner(lambda event, timestamp: event.timestamp)
    
    # Read from Kafka, parse messages, and assign timestamps/watermarks
    parsed_stream = env.from_source(
        source,
        WatermarkStrategy.no_watermarks(),
        "Kafka Source"
    ).map(
        JsonToSensorReadingMapFunction(),
        output_type=Types.PICKLED_BYTE_ARRAY()
    ).filter(
        lambda x: x is not None and x.temp is not None or x.co2 is not None
    ).assign_timestamps_and_watermarks(
        watermark_strategy
    )
    
    # Define the pattern:
    # Temperature > 28°C followed by CO2 > 1000 ppm within 5 minutes
    pattern = Pattern.begin("temp") \
        .where(lambda event: event.temp is not None and event.temp > 28.0) \
        .next("co2") \
        .where(lambda event: event.co2 is not None and event.co2 > 1000.0) \
        .within(Time.minutes(5))
    
    # Apply the pattern to the stream
    pattern_stream = CEP.pattern(parsed_stream, pattern)
    
    # Process matches
    alerts = pattern_stream.select(
        match_to_json
    )
    
    # Configure Kafka sink
    sink = KafkaSink.builder() \
        .set_bootstrap_servers(KAFKA_BROKERS) \
        .set_record_serializer(
            KafkaRecordSerializationSchema.builder()
                .set_topic(SINK_TOPIC)
                .set_value_serialization_schema(SimpleStringSchema())
                .build()
        ) \
        .build()
    
    # Send alerts to Kafka
    alerts.sink_to(sink)
    
    # Execute the job
    logger.info("Starting Flink CEP job")
    env.execute("Temperature and CO2 Pattern Detection")

if __name__ == '__main__':
    main() 