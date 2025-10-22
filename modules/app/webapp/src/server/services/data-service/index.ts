const DATA_SERVICE_URL =
  process.env.DATA_SERVICE_URL || "http://localhost:3010";

class DataServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "DataServiceError";
  }
}

async function fetchFromDataService(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${DATA_SERVICE_URL}/api/platform${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new DataServiceError(response.status, error);
  }

  return response;
}

export { fetchFromDataService };