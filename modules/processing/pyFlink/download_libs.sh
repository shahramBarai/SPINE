#!/bin/bash

set -euo pipefail

mkdir -p ./lib

curl -fSL --retry 3 --retry-delay 5 -o ./lib/flink-sql-connector-kafka-3.1.0-1.18.jar https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.1.0-1.18/flink-sql-connector-kafka-3.1.0-1.18.jar
curl -fSL --retry 3 --retry-delay 5 -o ./lib/flink-connector-jdbc-3.1.2-1.18.jar https://repo.maven.apache.org/maven2/org/apache/flink/flink-connector-jdbc/3.1.2-1.18/flink-connector-jdbc-3.1.2-1.18.jar
curl -fSL --retry 3 --retry-delay 5 -o ./lib/postgresql-42.7.3.jar https://jdbc.postgresql.org/download/postgresql-42.7.3.jar

echo "Libs downloaded successfully"