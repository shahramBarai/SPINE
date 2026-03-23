FROM flink:2.0

# Switch to root to perform system-level installations
USER root

# Install Python + pip
RUN apt-get update -y && \
    apt-get install -y python3 python3-pip python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Ensure python command points to python3
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /opt/flink/

# Install Python dependencies (--break-system-packages flag is needed for Flink 2.2.0)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Download Flink connector libs
COPY download_libs.sh .
RUN chmod +x download_libs.sh && ./download_libs.sh

# Switch back to default Flink user for runtime security
USER flink
