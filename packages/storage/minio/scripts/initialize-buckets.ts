import { env } from "@spine/shared";
import {
    initFileStorage,
    getMinioClient,
    BUCKET_NAME_LIST,
} from "../src/db/minio";

// DATABASE_URL_MINIO="username:password@host:port/databasename"
const [credentials, db] = env.DATABASE_URL_MINIO.split("@");
const [user, password] = credentials.split(":");
const [host, port] = db.split("/")[0].split(":");

async function main() {
    // Initialize MinIO client
    initFileStorage({ host, port: parseInt(port), user, password });
    const minioClient = getMinioClient();

    // Get all existing buckets from MinIO
    const existingBuckets: { name: string; creationDate: Date }[] =
        await minioClient.listBuckets();
    // Filter out the buckets that already exist
    const newBuckets: string[] = BUCKET_NAME_LIST.filter(
        (bucket: string) => !existingBuckets.find((b) => b.name === bucket)
    );

    // Create new buckets
    for (const bucketName of newBuckets) {
        await minioClient.makeBucket(bucketName);
    }

    // Log existing and new buckets
    console.log(
        "Existing buckets:",
        existingBuckets.map((b) => b.name)
    );
    console.log("New buckets:", newBuckets);

    const allBuckets = [...existingBuckets.map((b) => b.name), ...newBuckets];
    const allBucketsWithPolicy: { bucketName: string; policy: string }[] = [];
    for (const bucketName of allBuckets) {
        try {
            const policy = await minioClient.getBucketPolicy(bucketName);
            console.log(policy);
            allBucketsWithPolicy.push({ bucketName, policy });
        } catch (_error) {
            console.log("No policy found for bucket:", bucketName);
        }
    }
    console.log("All buckets with policies:", allBucketsWithPolicy);
}

main();
