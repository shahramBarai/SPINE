import type { SchemaVersion } from "@server/clients/schemaRegistryClient";

/** Saves a schema version to disk as <subject>-v<version>.<type>. */
function downloadSchema(version: SchemaVersion) {
    const blob = new Blob([version.schema], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${version.subject}-v${version.version}.${version.schemaType.toLowerCase()}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

export { downloadSchema };
