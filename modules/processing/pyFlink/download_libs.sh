#!/bin/bash

mkdir -p ./lib

curl -o ./lib/flink-sql-connector-kafka-4.0.0-2.0.jar https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/4.0.0-2.0/flink-sql-connector-kafka-4.0.0-2.0.jar
curl -o ./lib/flink-connector-jdbc-4.0.0-2.0.jar https://repo.maven.apache.org/maven2/org/apache/flink/flink-connector-jdbc/4.0.0-2.0/flink-connector-jdbc-4.0.0-2.0.jar
curl -o ./lib/postgresql-42.7.10.jar https://jdbc.postgresql.org/download/postgresql-42.7.10.jar

echo "Libs downloaded successfully"