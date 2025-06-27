// Data Service API Client
// This module provides functions to interact with the data-service API

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || "http://localhost:3010";

interface UserResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface UserWithPasswordResponse {
  id: string;
  email: string;
  password: string;
  role: string;
}

interface CreateUserRequest {
  email: string;
  password: string;
  name?: string;
  role?: "ADMIN" | "USER";
}

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

export const dataServiceApi = {
  // Check if user exists by email
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    try {
      const response = await fetchFromDataService(`/user/email/${encodeURIComponent(email)}`);
      return await response.json();
    } catch (error) {
      if (error instanceof DataServiceError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Get user with password for authentication
  async getUserWithPassword(email: string): Promise<UserWithPasswordResponse | null> {
    try {
      const response = await fetchFromDataService(`/user/auth/${encodeURIComponent(email)}`);
      return await response.json();
    } catch (error) {
      if (error instanceof DataServiceError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Create a new user
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    const response = await fetchFromDataService("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return await response.json();
  },
};