#!/bin/bash

# Schema Registry Management Script
# Manages Avro schemas for the IoT Platform messaging module

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT="dev"
ACTION="list"
SUBJECT_NAME=""
SCHEMA_FILE=""
COMPATIBILITY_LEVEL="BACKWARD"

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

# Function to get Schema Registry URL based on environment
get_schema_registry_url() {
    local env=$1
    case $env in
        "dev"|"prod")
            echo "http://localhost:8081"
            ;;
        *)
            log_error "Unknown environment: $env"
            exit 1
            ;;
    esac
}

# Function to check if Schema Registry is running
check_schema_registry_running() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if ! curl -s "$schema_registry_url" >/dev/null 2>&1; then
        log_error "Schema Registry is not running at $schema_registry_url"
        log_info "Please start the messaging module first using the deploy script"
        exit 1
    fi
}

# Function to list all subjects
list_subjects() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    log_info "Listing all subjects in $ENVIRONMENT environment..."
    
    curl -s "$schema_registry_url/subjects" | jq -r '.[]' 2>/dev/null || {
        curl -s "$schema_registry_url/subjects"
    }
}

# Function to get subject versions
get_subject_versions() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required"
        exit 1
    fi
    
    log_info "Getting versions for subject '$SUBJECT_NAME'..."
    
    curl -s "$schema_registry_url/subjects/$SUBJECT_NAME/versions" | jq -r '.[]' 2>/dev/null || {
        curl -s "$schema_registry_url/subjects/$SUBJECT_NAME/versions"
    }
}

# Function to get latest schema for a subject
get_latest_schema() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required"
        exit 1
    fi
    
    log_info "Getting latest schema for subject '$SUBJECT_NAME'..."
    
    curl -s "$schema_registry_url/subjects/$SUBJECT_NAME/versions/latest" | jq '.' 2>/dev/null || {
        curl -s "$schema_registry_url/subjects/$SUBJECT_NAME/versions/latest"
    }
}

# Function to register a schema
register_schema() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required for registration"
        exit 1
    fi
    
    if [[ -z "$SCHEMA_FILE" ]]; then
        log_error "Schema file is required for registration"
        exit 1
    fi
    
    if [[ ! -f "$SCHEMA_FILE" ]]; then
        log_error "Schema file not found: $SCHEMA_FILE"
        exit 1
    fi
    
    log_info "Registering schema from '$SCHEMA_FILE' for subject '$SUBJECT_NAME'..."
    
    # Read and escape the schema file
    local escaped_schema=$(jq -c . "$SCHEMA_FILE" | jq -R .)
    
    # Create the registration payload
    local payload=$(jq -n --argjson schema "$escaped_schema" '{schema: $schema}')
    
    # Register the schema
    local response=$(curl -s -X POST \
        -H "Content-Type: application/vnd.schemaregistry.v1+json" \
        --data "$payload" \
        "$schema_registry_url/subjects/$SUBJECT_NAME/versions")
    
    # Check if registration was successful
    if echo "$response" | jq -e '.id' >/dev/null 2>&1; then
        local schema_id=$(echo "$response" | jq -r '.id')
        log_success "Schema registered successfully with ID: $schema_id"
    else
        log_error "Failed to register schema"
        echo "Response: $response"
        exit 1
    fi
}

# Function to check schema compatibility
check_compatibility() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required for compatibility check"
        exit 1
    fi
    
    if [[ -z "$SCHEMA_FILE" ]]; then
        log_error "Schema file is required for compatibility check"
        exit 1
    fi
    
    if [[ ! -f "$SCHEMA_FILE" ]]; then
        log_error "Schema file not found: $SCHEMA_FILE"
        exit 1
    fi
    
    log_info "Checking compatibility for schema '$SCHEMA_FILE' with subject '$SUBJECT_NAME'..."
    
    # Read and escape the schema file
    local escaped_schema=$(jq -c . "$SCHEMA_FILE" | jq -R .)
    
    # Create the compatibility check payload
    local payload=$(jq -n --argjson schema "$escaped_schema" '{schema: $schema}')
    
    # Check compatibility
    local response=$(curl -s -X POST \
        -H "Content-Type: application/vnd.schemaregistry.v1+json" \
        --data "$payload" \
        "$schema_registry_url/compatibility/subjects/$SUBJECT_NAME/versions/latest")
    
    # Parse response
    if echo "$response" | jq -e '.is_compatible' >/dev/null 2>&1; then
        local is_compatible=$(echo "$response" | jq -r '.is_compatible')
        if [[ "$is_compatible" == "true" ]]; then
            log_success "Schema is compatible"
        else
            log_warning "Schema is NOT compatible"
            echo "Response: $response"
        fi
    else
        log_error "Failed to check compatibility"
        echo "Response: $response"
        exit 1
    fi
}

# Function to delete a subject
delete_subject() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required for deletion"
        exit 1
    fi
    
    log_warning "This will permanently delete subject '$SUBJECT_NAME' and all its versions!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_info "Deleting subject '$SUBJECT_NAME'..."
    
    local response=$(curl -s -X DELETE "$schema_registry_url/subjects/$SUBJECT_NAME")
    
    if echo "$response" | jq -e '.[]' >/dev/null 2>&1; then
        log_success "Subject '$SUBJECT_NAME' deleted successfully"
        echo "Deleted versions: $(echo "$response" | jq -r '.[]' | tr '\n' ' ')"
    else
        log_error "Failed to delete subject"
        echo "Response: $response"
        exit 1
    fi
}

# Function to set compatibility level
set_compatibility() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        log_error "Subject name is required to set compatibility"
        exit 1
    fi
    
    log_info "Setting compatibility level to '$COMPATIBILITY_LEVEL' for subject '$SUBJECT_NAME'..."
    
    local payload=$(jq -n --arg compatibility "$COMPATIBILITY_LEVEL" '{compatibility: $compatibility}')
    
    local response=$(curl -s -X PUT \
        -H "Content-Type: application/vnd.schemaregistry.v1+json" \
        --data "$payload" \
        "$schema_registry_url/config/$SUBJECT_NAME")
    
    if echo "$response" | jq -e '.compatibility' >/dev/null 2>&1; then
        log_success "Compatibility level set to: $(echo "$response" | jq -r '.compatibility')"
    else
        log_error "Failed to set compatibility level"
        echo "Response: $response"
        exit 1
    fi
}

# Function to get compatibility level
get_compatibility() {
    local schema_registry_url=$(get_schema_registry_url $ENVIRONMENT)
    
    if [[ -z "$SUBJECT_NAME" ]]; then
        # Get global compatibility
        log_info "Getting global compatibility level..."
        curl -s "$schema_registry_url/config" | jq -r '.compatibilityLevel' 2>/dev/null || {
            curl -s "$schema_registry_url/config"
        }
    else
        # Get subject-specific compatibility
        log_info "Getting compatibility level for subject '$SUBJECT_NAME'..."
        curl -s "$schema_registry_url/config/$SUBJECT_NAME" | jq -r '.compatibilityLevel' 2>/dev/null || {
            curl -s "$schema_registry_url/config/$SUBJECT_NAME"
        }
    fi
}

# Function to create IoT platform schema files and register them
register_iot_schemas() {
    log_info "Creating and registering IoT Platform schemas for $ENVIRONMENT environment..."
    
    # Create schema directory if it doesn't exist
    local schema_dir="$PROJECT_DIR/schema-registry/schemas"
    mkdir -p "$schema_dir"
    
    # Define IoT platform schemas
    declare -A schemas=(
        ["sensor-data"]='{
  "type": "record",
  "name": "SensorData",
  "namespace": "com.iotplatform.messaging",
  "fields": [
    {"name": "sensor_id", "type": "string"},
    {"name": "timestamp", "type": "long"},
    {"name": "value", "type": "double"},
    {"name": "unit", "type": "string"},
    {"name": "location", "type": ["null", "string"], "default": null},
    {"name": "metadata", "type": ["null", {"type": "map", "values": "string"}], "default": null}
  ]
}'
        ["device-events"]='{
  "type": "record",
  "name": "DeviceEvent",
  "namespace": "com.iotplatform.messaging",
  "fields": [
    {"name": "device_id", "type": "string"},
    {"name": "event_type", "type": {"type": "enum", "name": "EventType", "symbols": ["CONNECTED", "DISCONNECTED", "ERROR", "MAINTENANCE", "UPDATE"]}},
    {"name": "timestamp", "type": "long"},
    {"name": "description", "type": ["null", "string"], "default": null},
    {"name": "severity", "type": {"type": "enum", "name": "Severity", "symbols": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]}, "default": "MEDIUM"}
  ]
}'
        ["system-logs"]='{
  "type": "record",
  "name": "SystemLog",
  "namespace": "com.iotplatform.messaging",
  "fields": [
    {"name": "service", "type": "string"},
    {"name": "level", "type": {"type": "enum", "name": "LogLevel", "symbols": ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"]}},
    {"name": "message", "type": "string"},
    {"name": "timestamp", "type": "long"},
    {"name": "correlation_id", "type": ["null", "string"], "default": null},
    {"name": "user_id", "type": ["null", "string"], "default": null}
  ]
}'
    )
    
    for schema_name in "${!schemas[@]}"; do
        local schema_file="$schema_dir/${schema_name}.avsc"
        
        # Write schema to file
        echo "${schemas[$schema_name]}" > "$schema_file"
        
        # Register schema
        SUBJECT_NAME="${schema_name}-value"
        SCHEMA_FILE="$schema_file"
        register_schema
        
        log_success "Registered schema: $schema_name"
    done
    
    log_success "All IoT Platform schemas registered successfully"
}

# Function to show usage
show_usage() {
    echo "Schema Registry Management Script"
    echo
    echo "Usage: $0 [OPTIONS] ACTION [ARGUMENTS]"
    echo
    echo "Actions:"
    echo "  list                           List all subjects"
    echo "  versions SUBJECT               List versions for a subject"
    echo "  get SUBJECT                    Get latest schema for subject"
    echo "  register SUBJECT SCHEMA_FILE   Register a new schema"
    echo "  check-compatibility SUBJECT SCHEMA_FILE  Check schema compatibility"
    echo "  delete SUBJECT                 Delete a subject"
    echo "  set-compatibility SUBJECT LEVEL          Set compatibility level"
    echo "  get-compatibility [SUBJECT]   Get compatibility level"
    echo "  register-iot-schemas           Register all IoT platform schemas"
    echo
    echo "Options:"
    echo "  -e, --env ENV          Environment (dev|prod) [default: dev]"
    echo "  -c, --compatibility LEVEL     Compatibility level (BACKWARD, FORWARD, FULL, NONE) [default: BACKWARD]"
    echo "  -h, --help             Show this help message"
    echo
    echo "Examples:"
    echo "  $0 list                                      # List all subjects"
    echo "  $0 register sensor-data ./schemas/sensor-data.avsc  # Register schema"
    echo "  $0 get sensor-data-value                     # Get latest schema"
    echo "  $0 check-compatibility sensor-data-value ./schemas/sensor-data-v2.avsc"
    echo "  $0 set-compatibility sensor-data-value FULL # Set compatibility"
    echo "  $0 register-iot-schemas                      # Register all IoT schemas"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--compatibility)
            COMPATIBILITY_LEVEL="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        list|versions|get|register|check-compatibility|delete|set-compatibility|get-compatibility|register-iot-schemas)
            ACTION="$1"
            shift
            
            # Parse action-specific arguments
            case $ACTION in
                "versions"|"get"|"delete"|"set-compatibility"|"get-compatibility")
                    if [[ $# -gt 0 && "$1" != -* ]]; then
                        SUBJECT_NAME="$1"
                        shift
                    fi
                    ;;
                "register"|"check-compatibility")
                    if [[ $# -gt 0 && "$1" != -* ]]; then
                        SUBJECT_NAME="$1"
                        shift
                    fi
                    if [[ $# -gt 0 && "$1" != -* ]]; then
                        SCHEMA_FILE="$1"
                        shift
                    fi
                    ;;
            esac
            ;;
        *)
            log_error "Unknown option or argument: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be 'dev' or 'prod'"
    exit 1
fi

# Check if Schema Registry is running
check_schema_registry_running

# Execute the requested action
case $ACTION in
    "list")
        list_subjects
        ;;
    "versions")
        get_subject_versions
        ;;
    "get")
        get_latest_schema
        ;;
    "register")
        register_schema
        ;;
    "check-compatibility")
        check_compatibility
        ;;
    "delete")
        delete_subject
        ;;
    "set-compatibility")
        set_compatibility
        ;;
    "get-compatibility")
        get_compatibility
        ;;
    "register-iot-schemas")
        register_iot_schemas
        ;;
    *)
        log_error "Unknown action: $ACTION"
        show_usage
        exit 1
        ;;
esac
