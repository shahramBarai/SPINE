FROM flink:1.20.3-scala_2.12-java17

# Switch to root to perform system-level installations
USER root

# Install Python + pip
RUN apt-get update -y && \
    apt-get install -y python3 python3-pip python3-dev python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Ensure python command points to python3
RUN ln -s /usr/bin/python3 /usr/bin/python

# Create venv and install deps there
WORKDIR /opt/pyFlink
RUN python3 -m venv .venv && \
    .venv/bin/pip install --upgrade pip && \
    .venv/bin/pip install apache-flink==1.20.3
ENV PATH="/opt/pyFlink/.venv/bin:${PATH}"

# Download Flink connector libs
WORKDIR /opt/flink/lib
RUN wget https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.3.0-1.20/flink-sql-connector-kafka-3.3.0-1.20.jar && \
    wget https://repo.maven.apache.org/maven2/org/apache/flink/flink-connector-jdbc/3.1.2-1.18/flink-connector-jdbc-3.1.2-1.18.jar && \
    wget https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.10/postgresql-42.7.10.jar

# Set working directory and switch back to flink user
WORKDIR /opt/flink
USER flink
