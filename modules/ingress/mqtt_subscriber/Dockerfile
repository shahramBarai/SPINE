# Define the Rust version and the application name
ARG RUST_VERSION=1.83.0
ARG APP_NAME=mqtt-subscriber

# ----- BUILD STAGE -----
FROM rust:${RUST_VERSION}-alpine3.21 AS build
# Set the working directory
WORKDIR /app

# Install dependencies (compilation tools and libraries)
RUN apk add build-base musl-dev \
    zlib-dev zlib-static \
    bash protoc --no-cache
# Copy the source code
COPY ./mqtt_subscriber .
# Build the application in release mode
RUN cargo install --path .


# ----- RUNTIME STAGE -----
FROM alpine:3.21 as runtime

# Install dependencies (ca-certificates for SSL, bash for shell, and update-ca-certificates for certificate management)
RUN apk add --no-cache ca-certificates bash

# Copy the built binary
COPY --from=build /usr/local/cargo/bin/mqtt_subscriber /usr/local/bin/mqtt_subscriber

# Expose the API port
EXPOSE 3000

# Run the application
CMD ["mqtt_subscriber"]