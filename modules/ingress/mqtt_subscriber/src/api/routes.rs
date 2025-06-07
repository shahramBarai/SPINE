//! API route definitions

use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use super::handlers::{
    get_metrics, get_topics, health_check, subscribe_to_topic, unsubscribe_from_topic, AppState,
};

/// Define API documentation
#[derive(OpenApi)]
#[openapi(
    paths(
        super::handlers::health_check,
        super::handlers::get_topics,
        super::handlers::subscribe_to_topic,
        super::handlers::unsubscribe_from_topic,
        super::handlers::get_metrics
    ),
    components(
        schemas(super::models::SubscribeRequest, super::models::ApiResponse, super::models::TopicsResponse, super::models::MetricsResponse)
    ),
    tags(
        (name = "MQTT Subscriber", description = "MQTT Subscriber API endpoints")
    ),
    info(
        title = "MQTT Subscriber API",
        version = "1.0.0",
        description = "API for subscribing to and managing MQTT topics",
        license(
            name = "MIT",
            url = "https://opensource.org/licenses/MIT"
        ),
        contact(
            name = "API Developer",
            email = "developer@example.com"
        )
    )
)]
struct ApiDoc;

/// Create and configure the API router
pub fn create_router(state: Arc<AppState>) -> Router {
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // API documentation
    let openapi = ApiDoc::openapi();

    // Create API router
    Router::new()
        .route("/health", get(health_check))
        .route("/topics", get(get_topics))
        .route("/metrics", get(get_metrics))
        .route("/subscribe", post(subscribe_to_topic))
        .route("/unsubscribe/{topic}", delete(unsubscribe_from_topic))
        .merge(SwaggerUi::new("/docs").url("/api-docs/openapi.json", openapi))
        .layer(cors)
        .with_state(state)
}
