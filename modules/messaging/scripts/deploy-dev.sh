#!/bin/bash

# Development Kafka Deployment Script
# Deploys single-broker Kafka cluster for local development

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV="dev"

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

# Function to check if Docker is running
check_docker() {
    log_info "Checking Docker availability..."
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    log_info "Checking Docker Compose availability..."
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    log_success "Docker Compose is available"
}

# Function to create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    directories=(
        "$PROJECT_DIR/kafka/configs/dev"
        "$PROJECT_DIR/kafka/logs/dev"
        "$PROJECT_DIR/kafka/data/dev"
        "$PROJECT_DIR/kafka/connectors"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "All directories created"
}

# Function to check if development environment is already running
check_existing_deployment() {
    log_info "Checking for existing development deployment..."
    
    if docker ps -q -f name=kafka-dev >/dev/null 2>&1; then
        log_warning "Development Kafka is already running"
        read -p "Do you want to stop and redeploy? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping existing deployment..."
            docker-compose -f "$PROJECT_DIR/docker-compose.dev.yml" down
            log_success "Stopped existing deployment"
        else
            log_info "Keeping existing deployment"
            exit 0
        fi
    fi
}

# Function to set development environment variables
set_dev_environment() {
    log_info "Setting development environment variables..."
    
    export COMPOSE_PROJECT_NAME="iot-platform-dev"
    export KAFKA_HEAP_OPTS="-Xmx512M -Xms512M"
    export KAFKA_LOG_LEVEL="INFO"
    export ENVIRONMENT="development"
    
    log_success "Development environment variables set"
}

# Function to deploy development Kafka
deploy_kafka_dev() {
    log_info "Deploying development Kafka cluster..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose -f docker-compose.dev.yml pull
    
    # Start services
    log_info "Starting Kafka development services..."
    docker-compose -f docker-compose.dev.yml up -d
    
    log_success "Development Kafka cluster deployed"
}

# Function to wait for Kafka to be ready
wait_for_kafka() {
    log_info "Waiting for Kafka to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker exec kafka-dev kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; then
            log_success "Kafka is ready!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: Kafka not ready yet, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Kafka failed to start within expected time"
    return 1
}

# Function to create development topics
create_dev_topics() {
    log_info "Creating development topics..."
    
    # Define development topics
    topics=(
        "sensor-data:1:1"
        "device-events:1:1"
        "system-logs:1:1"
        "test-topic:1:1"
    )
    
    for topic_config in "${topics[@]}"; do
        IFS=':' read -r topic_name partitions replication <<< "$topic_config"
        
        log_info "Creating topic: $topic_name (partitions: $partitions, replication: $replication)"
        
        docker exec kafka-dev kafka-topics --bootstrap-server localhost:9092 \
            --create \
            --topic "$topic_name" \
            --partitions "$partitions" \
            --replication-factor "$replication" \
            --if-not-exists \
            --config cleanup.policy=delete \
            --config retention.ms=604800000 # 7 days
    done
    
    log_success "Development topics created"
}

# Function to show deployment status
show_deployment_status() {
    log_info "Development Kafka Deployment Status:"
    echo
    
    # Show running containers
    echo "Running Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=kafka-dev
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=schema-registry-dev
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=kafka-ui-dev
    echo
    
    # Show topics
    log_info "Available Topics:"
    docker exec kafka-dev kafka-topics --bootstrap-server localhost:9092 --list
    echo
    
    # Show access URLs
    log_info "Access URLs:"
    echo "  Kafka Bootstrap Server: localhost:9092"
    echo "  Schema Registry: http://localhost:8081"
    echo "  Kafka UI: http://localhost:8080"
    echo "  Kafka Connect: http://localhost:8083"
    echo
}

# Function to show usage information
show_usage() {
    echo "Development Kafka Deployment Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -s, --status   Show deployment status only"
    echo "  -c, --clean    Clean deployment (stop and remove volumes)"
    echo
    echo "Examples:"
    echo "  $0                 # Deploy development Kafka"
    echo "  $0 --status       # Show current status"
    echo "  $0 --clean        # Clean deployment"
}

# Function to clean deployment
clean_deployment() {
    log_info "Cleaning development deployment..."
    
    cd "$PROJECT_DIR"
    
    # Stop and remove containers
    docker-compose -f docker-compose.dev.yml down -v
    
    # Remove unused volumes
    docker volume prune -f
    
    log_success "Development deployment cleaned"
}

# Main deployment function
main() {
    log_info "Starting Kafka Development Deployment"
    log_info "======================================"
    
    check_docker
    check_docker_compose
    create_directories
    check_existing_deployment
    set_dev_environment
    deploy_kafka_dev
    
    if wait_for_kafka; then
        create_dev_topics
        show_deployment_status
        
        log_success "Development Kafka cluster is ready!"
        log_info "You can now start developing with Kafka on localhost:9092"
    else
        log_error "Failed to deploy development Kafka cluster"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -s|--status)
            show_deployment_status
            exit 0
            ;;
        -c|--clean)
            clean_deployment
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function if no arguments provided
main
