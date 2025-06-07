// scripts/init-timescale.ts
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL_TIMESCALE,
  });

  await client.connect();
  console.log("🔌 Connected to TimescaleDB");

  // Create TimescaleDB extension first
  await client.query("CREATE EXTENSION IF NOT EXISTS timescaledb;");
  console.log("✨ TimescaleDB extension enabled");

  const hypertableName = "sensor_readings";
  const timeColumn = "sensor_timestamp";

  const check = await client.query(
    `
    SELECT hypertable_name FROM timescaledb_information.hypertables
    WHERE hypertable_name = $1
  `,
    [hypertableName]
  );

  if (check.rowCount === 0) {
    console.log(`📈 Creating hypertable "${hypertableName}"...`);
    await client.query(
      `SELECT create_hypertable($1, $2, chunk_time_interval => INTERVAL '1 day');`,
      [hypertableName, timeColumn]
    );

    console.log("✅ Hypertable created!");
  } else {
    console.log("⚠️ Hypertable already exists.");
  }

  const chunkInterval = await client.query(
    `
    SELECT d.interval_length
    FROM _timescaledb_catalog.dimension d
    JOIN _timescaledb_catalog.hypertable h ON d.hypertable_id = h.id
    WHERE h.table_name = $1
  `,
    [hypertableName]
  );

  const interval = chunkInterval.rows?.[0]?.interval_length;
  console.log(
    "📦 Chunk interval:",
    interval,
    "microseconds ≈",
    interval / 1000 / 1000,
    "seconds"
  );

  await client.end();
}

main().catch((err) => {
  console.error("❌ Error initializing TimescaleDB:", err);
  process.exit(1);
});
