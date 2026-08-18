import { FusekiClient } from "./fuseki";
import { env } from "@spine/shared";

// DATABASE_URL_FUSEKI="username:password@host:port/databasename"
const ErrorMessages =
    "Invalid DATABASE_URL_FUSEKI format. Expected format: username:password@host:port/databasename";

const [credentials, db] = env.DATABASE_URL_FUSEKI.split("@");

if (!credentials || !db) {
    throw new Error(ErrorMessages);
}
const [hostPort, dbName] = db.split("/");
if (!hostPort || !dbName) {
    throw new Error(ErrorMessages);
}
const [user, password] = credentials.split(":");
const [host, port] = hostPort.split(":");

if (!user || !password || !host || !port) {
    throw new Error(ErrorMessages);
}

const fusekiClient = new FusekiClient(`http://${host}:${port}`, user, password);

export { fusekiClient };
