// MinIO configuration
interface MinioConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    nodeEnv?: string;
}

export { type MinioConfig };
