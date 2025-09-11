#!/bin/bash

# Kafka Topic Management Script
# Manages Kafka topics for both development and production environments

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT="dev"
ACTION="list"
TOPIC_NAME=""
PARTITIONS=1
REPLICATION_FACTOR=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to get bootstrap servers based on environment
get_bootstrap_servers() {
    local env=$1
    case $env in
        "dev")
            echo "localhost:9092"
            ;;
        "prod")
            echo "localhost:9092,localhost:9093,localhost:9094"
            ;;
        *)
            log_error "Unknown environment: $env"
            exit 1
            ;;
    esac
}

# Function to get container name based on environment
get_container_name() {
    local env=$1
    case $env in
        "dev")
            echo "kafka-dev"
            ;;
        "prod")
            echo "kafka-1"
            ;;
        *)
            log_error "Unknown environment: $env"
            exit 1
            ;;
    esac
}

# Function to check if Kafka is running
check_kafka_running() {
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if ! docker ps | grep -q "$container_name"; then
        log_error "Kafka container '$container_name' is not running in $ENVIRONMENT environment"
        log_info "Please start Kafka first using the deploy script"
        exit 1
    fi
}

# Function to list topics
list_topics() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    log_info "Listing topics in $ENVIRONMENT environment..."
    
    docker exec "$container_name" kafka-topics \
        --bootstrap-server "$bootstrap_servers" \
        --list
}

# Function to describe topics
describe_topics() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -n "$TOPIC_NAME" ]]; then
        log_info "Describing topic '$TOPIC_NAME' in $ENVIRONMENT environment..."
        docker exec "$container_name" kafka-topics \
            --bootstrap-server "$bootstrap_servers" \
            --describe \
            --topic "$TOPIC_NAME"
    else
        log_info "Describing all topics in $ENVIRONMENT environment..."
        docker exec "$container_name" kafka-topics \
            --bootstrap-server "$bootstrap_servers" \
            --describe
    fi
}

# Function to create a topic
create_topic() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required for creation"
        exit 1
    fi
    
    # Set default replication factor based on environment
    if [[ $ENVIRONMENT == "prod" && $REPLICATION_FACTOR -eq 1 ]]; then
        REPLICATION_FACTOR=3
        log_info "Setting replication factor to 3 for production environment"
    fi
    
    log_info "Creating topic '$TOPIC_NAME' with $PARTITIONS partitions and replication factor $REPLICATION_FACTOR..."
    
    # Build the create command
    local create_cmd="kafka-topics --bootstrap-server $bootstrap_servers --create --topic $TOPIC_NAME --partitions $PARTITIONS --replication-factor $REPLICATION_FACTOR"
    
    # Add production-specific configurations
    if [[ $ENVIRONMENT == "prod" ]]; then
        create_cmd="$create_cmd --config cleanup.policy=delete --config retention.ms=2592000000 --config compression.type=snappy --config min.insync.replicas=2"
    else
        create_cmd="$create_cmd --config cleanup.policy=delete --config retention.ms=604800000"
    fi
    
    docker exec "$container_name" $create_cmd
    
    log_success "Topic '$TOPIC_NAME' created successfully"
}

# Function to delete a topic
delete_topic() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required for deletion"
        exit 1
    fi
    
    log_warning "This will permanently delete topic '$TOPIC_NAME' and all its data!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_info "Deleting topic '$TOPIC_NAME'..."
    
    docker exec "$container_name" kafka-topics \
        --bootstrap-server "$bootstrap_servers" \
        --delete \
        --topic "$TOPIC_NAME"
    
    log_success "Topic '$TOPIC_NAME' deleted successfully"
}

# Function to alter topic configuration
alter_topic() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required for alteration"
        exit 1
    fi
    
    log_info "Altering topic '$TOPIC_NAME' to have $PARTITIONS partitions..."
    
    docker exec "$container_name" kafka-topics \
        --bootstrap-server "$bootstrap_servers" \
        --alter \
        --topic "$TOPIC_NAME" \
        --partitions "$PARTITIONS"
    
    log_success "Topic '$TOPIC_NAME' altered successfully"
}

# Function to show topic configurations
show_config() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required to show configuration"
        exit 1
    fi
    
    log_info "Showing configuration for topic '$TOPIC_NAME'..."
    
    docker exec "$container_name" kafka-configs \
        --bootstrap-server "$bootstrap_servers" \
        --describe \
        --entity-type topics \
        --entity-name "$TOPIC_NAME"
}

# Function to produce test messages
produce_messages() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required for producing messages"
        exit 1
    fi
    
    log_info "Starting console producer for topic '$TOPIC_NAME'"
    log_info "Type messages and press Enter. Use Ctrl+C to exit."
    
    docker exec -it "$container_name" kafka-console-producer \
        --bootstrap-server "$bootstrap_servers" \
        --topic "$TOPIC_NAME"
}

# Function to consume test messages
consume_messages() {
    local bootstrap_servers=$(get_bootstrap_servers $ENVIRONMENT)
    local container_name=$(get_container_name $ENVIRONMENT)
    
    if [[ -z "$TOPIC_NAME" ]]; then
        log_error "Topic name is required for consuming messages"
        exit 1
    fi
    
    log_info "Starting console consumer for topic '$TOPIC_NAME'"
    log_info "Use Ctrl+C to exit."
    
    docker exec -it "$container_name" kafka-console-consumer \
        --bootstrap-server "$bootstrap_servers" \
        --topic "$TOPIC_NAME" \
        --from-beginning
}

# Function to create IoT platform topics
create_iot_topics() {
    log_info "Creating IoT Platform topics for $ENVIRONMENT environment..."
    
    if [[ $ENVIRONMENT == "dev" ]]; then
        # Development topics (single partition, single replica)
        topics=(
            "sensor-data:1:1"
            "device-events:1:1"
            "system-logs:1:1"
            "user-activity:1:1"
            "notifications:1:1"
            "test-topic:1:1"
        )
    else
        # Production topics (multiple partitions, replicated)
        topics=(
            "sensor-data:12:3"
            "device-events:6:3"
            "system-logs:3:3"
            "user-activity:6:3"
            "notifications:3:3"
            "metrics:6:3"
            "audit-logs:3:3"
        )
    fi
    
    for topic_config in "${topics[@]}"; do
        IFS=':' read -r name parts repl <<< "$topic_config"
        TOPIC_NAME="$name"
        PARTITIONS="$parts"
        REPLICATION_FACTOR="$repl"
        create_topic
    done
    
    # Create DLQ topics
    log_info "Creating Dead Letter Queue topics..."
    if [[ $ENVIRONMENT == "dev" ]]; then
        dlq_topics=(
            "sensor-data.dlq:1:1"
            "device-events.dlq:1:1"
        )
    else
        dlq_topics=(
            "sensor-data.dlq:3:3"
            "sensor-data.dlq.validation_error:3:3"
            "sensor-data.dlq.processing_error:3:3"
            "sensor-data.dlq.poison:1:3"
            "device-events.dlq:3:3"
            "system-logs.dlq:3:3"
        )
    fi
    
    for topic_config in "${dlq_topics[@]}"; do
        IFS=':' read -r name parts repl <<< "$topic_config"
        TOPIC_NAME="$name"
        PARTITIONS="$parts"
        REPLICATION_FACTOR="$repl"
        create_topic
    done
    
    log_success "IoT Platform topics created successfully"
}

# Function to show usage
show_usage() {
    echo "Kafka Topic Management Script"
    echo
    echo "Usage: $0 [OPTIONS] ACTION [TOPIC_NAME]"
    echo
    echo "Actions:"
    echo "  list                List all topics"
    echo "  describe            Describe topics (all or specific)"
    echo "  create              Create a new topic"
    echo "  delete              Delete a topic"
    echo "  alter               Alter topic (increase partitions)"
    echo "  config              Show topic configuration"
    echo "  produce             Start console producer"
    echo "  consume             Start console consumer"
    echo "  create-iot-topics   Create all IoT platform topics"
    echo
    echo "Options:"
    echo "  -e, --env ENV       Environment (dev|prod) [default: dev]"
    echo "  -p, --partitions N  Number of partitions [default: 1]"
    echo "  -r, --replication N Replication factor [default: 1 for dev, 3 for prod]"
    echo "  -h, --help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0 list                                    # List topics in dev"
    echo "  $0 -e prod list                           # List topics in prod"
    echo "  $0 create sensor-data                     # Create topic with defaults"
    echo "  $0 -p 3 -r 2 create user-events          # Create with 3 partitions, replication 2"
    echo "  $0 describe sensor-data                   # Describe specific topic"
    echo "  $0 delete old-topic                       # Delete topic"
    echo "  $0 produce sensor-data                    # Start producer"
    echo "  $0 consume sensor-data                    # Start consumer"
    echo "  $0 create-iot-topics                      # Create all IoT topics"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--partitions)
            PARTITIONS="$2"
            shift 2
            ;;
        -r|--replication)
            REPLICATION_FACTOR="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        list|describe|create|delete|alter|config|produce|consume|create-iot-topics)
            ACTION="$1"
            shift
            ;;
        *)
            if [[ -z "$TOPIC_NAME" ]]; then
                TOPIC_NAME="$1"
            else
                log_error "Unknown option or extra argument: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'dev' or 'prod'"
    exit 1
fi

# Check if Kafka is running
check_kafka_running

# Execute the requested action
case $ACTION in
    "list")
        list_topics
        ;;
    "describe")
        describe_topics
        ;;
    "create")
        create_topic
        ;;
    "delete")
        delete_topic
        ;;
    "alter")
        alter_topic
        ;;
    "config")
        show_config
        ;;
    "produce")
        produce_messages
        ;;
    "consume")
        consume_messages
        ;;
    "create-iot-topics")
        create_iot_topics
        ;;
    *)
        log_error "Unknown action: $ACTION"
        show_usage
        exit 1
        ;;
esac
