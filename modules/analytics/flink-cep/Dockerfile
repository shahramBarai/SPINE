FROM flink:1.20.0-scala_2.12-java11

# Install Python
RUN apt-get update -y && \
    apt-get install -y python3 python3-pip python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Set Python as the default python version
RUN ln -s /usr/bin/python3 /usr/bin/python && \
    ln -s /usr/bin/pip3 /usr/bin/pip

WORKDIR /opt/flink/job

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the job script
COPY cep_job.py .

# Entry point that keeps container running for manual job submission
CMD ["tail", "-f", "/dev/null"] 