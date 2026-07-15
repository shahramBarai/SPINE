/**
 * Encodes a string to Base64 format.
 *
 * @param value The string to encode.
 * @returns The Base64-encoded string.
 */
function base64Encode(value: string): string {
    const alphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const bytes = new TextEncoder().encode(value);
    let output = "";

    for (let index = 0; index < bytes.length; index += 3) {
        const byte1 = bytes[index] ?? 0;
        const byte2 = bytes[index + 1] ?? 0;
        const byte3 = bytes[index + 2] ?? 0;
        const hasByte2 = index + 1 < bytes.length;
        const hasByte3 = index + 2 < bytes.length;

        const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

        output += alphabet[(chunk >> 18) & 63];
        output += alphabet[(chunk >> 12) & 63];
        output += hasByte2 ? alphabet[(chunk >> 6) & 63] : "=";
        output += hasByte3 ? alphabet[chunk & 63] : "=";
    }

    return output;
}

/**
 * Converts a URI to a simplified ID by extracting the last segment after '#' or '/'.
 *
 * @param uri The URI string to convert.
 * @returns A simplified ID extracted from the URI.
 */
function uri_to_id(uri: string): string {
    if (uri.includes("#")) {
        return uri.split("#").pop() || uri;
    }
    if (uri.includes("/")) {
        return uri.split("/").pop() || uri;
    }
    return uri;
}

/**
 * Escapes a string for embedding as a SPARQL string literal, including the
 * surrounding double quotes.
 *
 * @param value The raw string to escape.
 * @returns The value formatted as a quoted SPARQL string literal.
 */
function sparqlStringLiteral(value: string): string {
    const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
    return `"${escaped}"`;
}

export { base64Encode, uri_to_id, sparqlStringLiteral };
