import { Readable } from "stream";

async function readStreamToText(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
            continue;
        }

        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
}

export { readStreamToText };
