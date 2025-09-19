import { Sequelize } from "sequelize";

const DATABASE_URL_TIMESCALE = process.env.DATABASE_URL_TIMESCALE;

if (!DATABASE_URL_TIMESCALE) {
  throw new Error("DATABASE_URL_TIMESCALE is not set in the environment variables. Please check the .env file.");
}

// TimescaleDB connection configuration
const sequelize = new Sequelize(
  DATABASE_URL_TIMESCALE,
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
