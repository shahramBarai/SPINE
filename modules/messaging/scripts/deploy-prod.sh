#!/bin/bash

# Production Kafka Deployment Script
# Deploys multi-broker Kafka cluster with high availability and fault tolerance

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV="prod"

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

# Function to check system resources
check_system_resources() {
    log_info "Checking system resources..."
    
    # Check available memory (minimum 8GB recommended)
    local available_memory=$(free -g | awk '/^Mem:/{print $2}')
    if [[ $available_memory -lt 8 ]]; then
        log_warning "System has less than 8GB RAM. Production deployment may be unstable."
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check available disk space (minimum 50GB recommended)
    local available_disk=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $available_disk -lt 50 ]]; then
        log_warning "Less than 50GB disk space available. Consider cleaning up disk space."
    fi
    
    log_success "System resources checked"
}

# Function to create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    directories=(
        "$PROJECT_DIR/kafka/configs/prod"
        "$PROJECT_DIR/kafka/logs/prod"
        "$PROJECT_DIR/kafka/data/prod"
        "$PROJECT_DIR/kafka/security"
        "$PROJECT_DIR/kafka/connectors"
        "$PROJECT_DIR/monitoring/prometheus/data"
        "$PROJECT_DIR/monitoring/grafana/data"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            chmod 755 "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "All directories created"
}

# Function to check if production environment is already running
check_existing_deployment() {
    log_info "Checking for existing production deployment..."
    
    if docker ps -q -f name=kafka-1 >/dev/null 2>&1; then
        log_warning "Production Kafka cluster is already running"
        read -p "Do you want to stop and redeploy? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping existing deployment..."
            docker-compose -f "$PROJECT_DIR/docker-compose.prod.yml" down
            log_success "Stopped existing deployment"
        else
            log_info "Keeping existing deployment"
            exit 0
        fi
    fi
}

# Function to set production environment variables
set_prod_environment() {
    log_info "Setting production environment variables..."
    
    export COMPOSE_PROJECT_NAME="iot-platform-prod"
    export KAFKA_HEAP_OPTS="-Xmx2G -Xms2G"
    export KAFKA_LOG_LEVEL="WARN"
    export ENVIRONMENT="production"
    export KAFKA_JVM_PERFORMANCE_OPTS="-server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35"
    
    log_success "Production environment variables set"
}

# Function to deploy production Kafka cluster
deploy_kafka_prod() {
    log_info "Deploying production Kafka cluster..."
    
    cd "$PROJECT_DIR"
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose -f docker-compose.prod.yml pull
    
    # Start services in order (controllers first, then brokers)
    log_info "Starting Kafka production cluster..."
    docker-compose -f docker-compose.prod.yml up -d kafka-1 kafka-2 kafka-3
    
    # Wait a bit for brokers to start
    sleep 30
    
    # Start supporting services
    log_info "Starting supporting services..."
    docker-compose -f docker-compose.prod.yml up -d schema-registry-1 kafka-connect-1 kafka-lb
    
    log_success "Production Kafka cluster deployed"
}

# Function to wait for Kafka cluster to be ready
wait_for_kafka_cluster() {
    log_info "Waiting for Kafka cluster to be ready..."
    
    local max_attempts=60
    local attempt=1
    local brokers=("kafka-1:29092" "kafka-2:29092" "kafka-3:29092")
    
    while [[ $attempt -le $max_attempts ]]; do
        local ready_brokers=0
        
        for broker in "${brokers[@]}"; do
            if docker exec kafka-1 kafka-broker-api-versions --bootstrap-server "$broker" >/dev/null 2>&1; then
                ((ready_brokers++))
            fi
        done
        
        if [[ $ready_brokers -eq ${#brokers[@]} ]]; then
            log_success "All Kafka brokers are ready!"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $ready_brokers/${#brokers[@]} brokers ready, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Kafka cluster failed to start within expected time"
    return 1
}

# Function to create production topics
create_prod_topics() {
    log_info "Creating production topics..."
    
    # Define production topics with appropriate partitions and replication
    topics=(
        "sensor-data:12:3"
        "device-events:6:3"
        "system-logs:3:3"
        "user-activity:6:3"
        "notifications:3:3"
        "metrics:6:3"
        "audit-logs:3:3"
    )
    
    for topic_config in "${topics[@]}"; do
        IFS=':' read -r topic_name partitions replication <<< "$topic_config"
        
        log_info "Creating topic: $topic_name (partitions: $partitions, replication: $replication)"
        
        docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092 \
            --create \
            --topic "$topic_name" \
            --partitions "$partitions" \
            --replication-factor "$replication" \
            --if-not-exists \
            --config cleanup.policy=delete \
            --config retention.ms=2592000000 \
            --config compression.type=snappy \
            --config min.insync.replicas=2
    done
    
    # Create DLQ topics
    log_info "Creating Dead Letter Queue topics..."
    dlq_topics=(
        "sensor-data.dlq:3:3"
        "sensor-data.dlq.validation_error:3:3"
        "sensor-data.dlq.processing_error:3:3"
        "sensor-data.dlq.poison:1:3"
        "device-events.dlq:3:3"
        "system-logs.dlq:3:3"
    )
    
    for topic_config in "${dlq_topics[@]}"; do
        IFS=':' read -r topic_name partitions replication <<< "$topic_config"
        
        log_info "Creating DLQ topic: $topic_name"
        
        docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092 \
            --create \
            --topic "$topic_name" \
            --partitions "$partitions" \
            --replication-factor "$replication" \
            --if-not-exists \
            --config cleanup.policy=delete \
            --config retention.ms=7776000000 \
            --config compression.type=gzip
    done
    
    log_success "Production topics created"
}

# Function to configure topic permissions and ACLs
configure_topic_security() {
    log_info "Configuring topic security and ACLs..."
    
    # Note: This is a placeholder for ACL configuration
    # In a real production environment, you would configure:
    # - User authentication (SASL/SCRAM or mTLS)
    # - Authorization ACLs for topics
    # - SSL/TLS encryption
    
    log_info "Topic security configuration skipped (implement based on requirements)"
}

# Function to perform cluster health checks
perform_health_checks() {
    log_info "Performing cluster health checks..."
    
    # Check broker status
    log_info "Checking broker status..."
    docker exec kafka-1 kafka-broker-api-versions --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092
    
    # Check cluster metadata
    log_info "Checking cluster metadata..."
    docker exec kafka-1 kafka-metadata-shell --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log
    
    # Check topic list
    log_info "Verifying topics..."
    docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092 --list
    
    # Check consumer groups
    log_info "Checking consumer groups..."
    docker exec kafka-1 kafka-consumer-groups --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092 --list
    
    log_success "Health checks completed"
}

# Function to show deployment status
show_deployment_status() {
    log_info "Production Kafka Deployment Status:"
    echo
    
    # Show running containers
    echo "Running Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=kafka-
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=schema-registry-
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter name=kafka-connect-
    echo
    
    # Show cluster information
    log_info "Cluster Information:"
    docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:29092,kafka-2:29092,kafka-3:29092 --describe --exclude-internal
    echo
    
    # Show access URLs
    log_info "Access URLs:"
    echo "  Kafka Bootstrap Servers: kafka-1:9092,kafka-2:9093,kafka-3:9094"
    echo "  Load Balanced Kafka: localhost:9095"
    echo "  HAProxy Stats: http://localhost:8404/stats"
    echo "  Schema Registry: http://localhost:8081"
    echo "  Kafka Connect: http://localhost:8083"
    echo
}

# Function to show usage information
show_usage() {
    echo "Production Kafka Deployment Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -s, --status      Show deployment status only"
    echo "  -c, --clean       Clean deployment (stop and remove volumes)"
    echo "  -m, --monitoring  Deploy with monitoring stack"
    echo "  --health-check    Perform health checks only"
    echo
    echo "Examples:"
    echo "  $0                    # Deploy production Kafka"
    echo "  $0 --status          # Show current status"
    echo "  $0 --monitoring      # Deploy with Prometheus/Grafana"
    echo "  $0 --clean           # Clean deployment"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    cd "$PROJECT_DIR"
    
    # Deploy monitoring services
    docker-compose -f docker-compose.monitoring.yml up -d
    
    log_success "Monitoring stack deployed"
    log_info "Prometheus: http://localhost:9090"
    log_info "Grafana: http://localhost:3000 (admin/admin)"
    log_info "AlertManager: http://localhost:9093"
}

# Function to clean deployment
clean_deployment() {
    log_info "Cleaning production deployment..."
    
    cd "$PROJECT_DIR"
    
    # Stop and remove containers
    docker-compose -f docker-compose.prod.yml down -v
    docker-compose -f docker-compose.monitoring.yml down -v
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Production deployment cleaned"
}

# Main deployment function
main() {
    log_info "Starting Kafka Production Deployment"
    log_info "====================================="
    
    check_docker
    check_docker_compose
    check_system_resources
    create_directories
    check_existing_deployment
    set_prod_environment
    deploy_kafka_prod
    
    if wait_for_kafka_cluster; then
        create_prod_topics
        configure_topic_security
        perform_health_checks
        show_deployment_status
        
        log_success "Production Kafka cluster is ready!"
        log_info "Cluster is accessible via load balancer at localhost:9095"
        log_info "Individual brokers: localhost:9092, localhost:9093, localhost:9094"
    else
        log_error "Failed to deploy production Kafka cluster"
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
        -m|--monitoring)
            DEPLOY_MONITORING=true
            shift
            ;;
        --health-check)
            perform_health_checks
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run main function
main

# Deploy monitoring if requested
if [[ ${DEPLOY_MONITORING:-false} == true ]]; then
    deploy_monitoring
fi
