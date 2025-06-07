import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { logger } from "./logger";

// Get Flink REST API URL from environment variable
const FLINK_REST_URL =
  process.env.FLINK_REST_URL || "http://flink-jobmanager:8081";

// Helper function to make requests to the Flink REST API
export async function flinkRequest(
  path: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse> {
  const url = `${FLINK_REST_URL}${path}`;

  try {
    logger.debug(`Making request to Flink API: ${url}`, {
      method: options.method || "GET",
    });
    const response = await axios({
      url,
      method: options.method || "GET",
      ...options,
    });
    return response;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      logger.error(`Flink API error: ${error.response.status}`, {
        url,
        status: error.response.status,
        data: error.response.data,
      });
      throw new Error(
        `Flink API error: ${JSON.stringify(error.response.data)}`
      );
    }
    logger.error(`Error communicating with Flink API`, { url, error });
    throw error;
  }
}
