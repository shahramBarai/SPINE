import { Readable } from "stream";

async function readStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
            continue;
        }

        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
}

async function readStreamToText(stream: Readable): Promise<string> {
    return (await readStreamToBuffer(stream)).toString("utf-8");
}

export { readStreamToBuffer, readStreamToText };
