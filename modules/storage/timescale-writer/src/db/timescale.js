import { Sequelize } from "sequelize";

const POSTGRES_USER = process.env.POSTGRES_USER || "postgres";
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || "password";
const POSTGRES_HOST = process.env.POSTGRES_HOST || "timescaledb";
const POSTGRES_PORT = process.env.POSTGRES_PORT || 5432;
const POSTGRES_DB = process.env.POSTGRES_DB || "myllypuro-campus";

// TimescaleDB connection configuration
const sequelize = new Sequelize(
  `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
  {
    dialect: "postgres",
    protocol: "postgres",
    logging: false,
  }
);

// Authenticate the connection
sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

// CREATE TABLE sensor_data (
//   id SERIAL,
//   sensor_id TEXT NOT NULL,
//   message TEXT NOT NULL,
//   sensor_timestamp TIMESTAMPTZ NOT NULL,
//   PRIMARY KEY (sensor_id, sensor_timestamp)
// );
export const SensorData = sequelize.define(
  "sensor_data",
  {
    sensor_id: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    message: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    sensor_timestamp: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  },
  {
    timestamps: false, // Disable automatic timestamps
    freezeTableName: true,
  }
);
