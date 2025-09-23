# 📚 Developer Guide

This guide contains detailed technical standards and best practices for contributing code to SPINE.

**Note:** This guide is a work in progress and will be updated regularly.

## Table of Contents

- [🛠️ Development Setup](#development-setup)
- [🗂️ Project Structure](#project-structure)
- [🧩 Coding Standards](#coding-standards)
- [🧪 Testing Guidelines](#testing-guidelines)
- [🔧 API Design](#api-design)
- [💾 Database Guidelines](#database-guidelines)
- [🚀 Performance Considerations](#performance-considerations)
- [🔒 Security Best Practices](#security-best-practices)

## 🛠️ Development Setup

### 1. Using Dev Container

SPINE includes VS Code Dev Container configuration for a consistent development environment.

****Note:** Currently, it runs the [webapp](./modules/app/webapp) service and the core modules [messaging](./modules/messaging) and [storage](./modules/storage) to get you started.

1. Install [VS Code](https://code.visualstudio.com/) and [Remote Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Open the project in VS Code
3. Click "Reopen in Container" when prompted (or press `Ctrl+Shift+P` and type `Remote-Containers: Reopen in Container` then select it).

After the container is built (it will take a few minutes), you need to run the following command to start the services:

```bash
# Install dependencies
pnpm install

# Generate Prisma clients
pnpm db:generate 

# Start the webapp service
pnpm dev
```

You can then access the webapp at `http://localhost:3000`.

### 2. Manual Development Setup

1. **Using Docker Compose:**
You can also run each module separately using Docker Compose (check module's README for more details) or using the profiles in the `docker-compose.yml` file.

    ```bash
    # Core modules (messaging, storage)
    docker compose up -d
    
    # Core + ingress
    docker compose --profile ingress up -d

    # Core + analytics
    docker compose --profile analytics up -d

    # Core + app
    docker compose --profile app up -d

    # Core + egress
    docker compose --profile egress up -d

    # Full platform
    docker compose --profile full up -d

    # You can also combine profiles (e.g. core + ingress + analytics)
    docker compose --profile ingress --profile analytics up -d
    ```

2. **Running Specific Service Locally:** Also, you can run specific service locally if you want to test it (check service's README file for more details).

## 🗂️ Project Structure

SPINE follows a modular microservices architecture. For detailed setup instructions, see [Architecture Guide](./architecture.md).

### Service Structure

Each service should follow this structure:

```
[module_name]/[service_name]/
├── src/                 # Source code
├── tests/              # Test files
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── fixtures/       # Test data and mocks
├── package.json        # Dependencies and scripts
└── README.md           # Service-specific documentation
```

## 🧩 Coding Standards

### TypeScript/Node.js (Backend Services)

#### General Principles

- Use **strict TypeScript** configuration
- Prefer **functional programming** patterns
- Use **early returns** for better readability
- Follow **explicit over implicit** approach

#### Naming Conventions

```typescript
// Variables and functions: camelCase
const userData = { name: "John" };
const handleUserCreate = async () => {
  /* ... */
};

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Types and interfaces: PascalCase
interface UserRequest {
  email: string;
  name: string;
}

// Event handlers: prefix with 'handle'
const handleUserLogin = (event: LoginEvent) => {
  /* ... */
};

// Boolean variables: descriptive prefixes
const isLoading = false;
const hasError = true;
const canEdit = user.role === "admin";
```

#### Function Guidelines

```typescript
// Good: Use early returns
const validateUser = (user: User): ValidationResult => {
  if (!user.email) {
    return { valid: false, error: "Email required" };
  }

  if (!user.name) {
    return { valid: false, error: "Name required" };
  }

  return { valid: true };
};

// Good: Async/await over Promises
const fetchUserData = async (id: string): Promise<User | null> => {
  try {
    const user = await userRepository.findById(id);
    return user;
  } catch (error) {
    logger.error("Failed to fetch user", { id, error });
    return null;
  }
};

// Avoid: Nested callbacks or complex promise chains
```

#### Error Handling

```typescript
// Use custom error types
class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Handle errors consistently
const createUser = async (data: CreateUserRequest): Promise<User> => {
  if (!data.email) {
    throw new ValidationError("Email is required", "email");
  }

  try {
    return await userService.create(data);
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw new Error("Failed to create user");
    }
    throw error;
  }
};
```

### React/Next.js 15 (Frontend)

#### Component Guidelines

```tsx
// Good: Use Server Components by default
export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div>
      <h1>Users</h1>
      <UserList users={users} />
    </div>
  );
}

// Use client components only when necessary
("use client");
import { useState } from "react";
import { useActionState } from "react";

export function InteractiveUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return <form action={formAction}>{/* form content */}</form>;
}
```

#### Next.js 15 Patterns

```tsx
// Use async request APIs
import { cookies, headers } from "next/headers";

export async function ServerComponent() {
  const cookieStore = await cookies();
  const headersList = await headers();

  // Component logic
}

// Use useActionState instead of deprecated useFormState
("use client");
import { useActionState } from "react";

export function FormComponent() {
  const [state, formAction] = useActionState(serverAction, initialState);
  // Component logic
}
```

### Rust (Ingress Services)

#### Naming and Structure

```rust
// Functions and variables: snake_case
async fn process_sensor_data(data: SensorReading) -> Result<(), ProcessingError> {
    let processed_data = transform_reading(data)?;
    send_to_kafka(processed_data).await
}

// Types and structs: PascalCase
#[derive(Debug, Clone)]
pub struct SensorReading {
    pub device_id: String,
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}

// Constants: UPPER_SNAKE_CASE
const MAX_BUFFER_SIZE: usize = 1024;
```

#### Error Handling

```rust
// Use Result types for error handling
#[derive(Debug, thiserror::Error)]
pub enum ProcessingError {
    #[error("Invalid sensor data: {message}")]
    InvalidData { message: String },
    #[error("Network error: {0}")]
    NetworkError(#[from] std::io::Error),
    #[error("Serialization failed: {0}")]
    SerializationError(#[from] serde_json::Error),
}

// Implement proper error context
async fn process_sensor_batch(
    readings: Vec<SensorReading>
) -> Result<(), ProcessingError> {
    for reading in readings {
        let processed = transform_reading(reading)
            .map_err(|e| ProcessingError::InvalidData {
                message: format!("Failed to transform reading: {}", e)
            })?;

        send_processed_data(processed).await?;
    }

    Ok(())
}
```

#### Async Patterns

```rust
// Use Tokio channels for backpressure
use tokio::sync::mpsc;

async fn sensor_processor() -> Result<(), Box<dyn std::error::Error>> {
    let (tx, mut rx) = mpsc::channel::<SensorReading>(100); // bounded channel

    // Spawn background task
    let processor_handle = tokio::spawn(async move {
        while let Some(reading) = rx.recv().await {
            if let Err(e) = process_reading(reading).await {
                eprintln!("Processing error: {}", e);
            }
        }
    });

    // Main processing loop
    // ...

    processor_handle.await?;
    Ok(())
}
```

## 🧪 Testing Guidelines

### Test Organization

```
tests/
├── unit/
│   ├── services/       # Service unit tests
│   ├── utils/          # Utility function tests
│   └── components/     # Component tests
├── integration/
│   ├── api/           # API integration tests
│   └── database/      # Database tests
└── fixtures/
    ├── data/          # Test data
    └── mocks/         # Mock implementations
```

### Unit Testing

```typescript
// Use descriptive test names
describe("UserService", () => {
  describe("createUser", () => {
    it("should create user with valid data", async () => {
      // Arrange
      const userData = {
        email: "test@example.com",
        name: "Test User",
      };

      // Act
      const result = await userService.create(userData);

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        email: userData.email,
        name: userData.name,
        createdAt: expect.any(Date),
      });
    });

    it("should throw ValidationError for invalid email", async () => {
      // Arrange
      const invalidData = {
        email: "invalid-email",
        name: "Test User",
      };

      // Act & Assert
      await expect(userService.create(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      jest
        .spyOn(userRepository, "create")
        .mockRejectedValue(new DatabaseError("Connection failed"));

      const userData = { email: "test@example.com", name: "Test User" };

      // Act & Assert
      await expect(userService.create(userData)).rejects.toThrow(
        "Failed to create user"
      );
    });
  });
});
```

### Integration Testing

```typescript
// Test API endpoints
describe("POST /api/users", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should create user and return 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: {
        email: "test@example.com",
        name: "Test User",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      id: expect.any(String),
      email: "test@example.com",
      name: "Test User",
    });
  });
});
```

### Test Quality Standards

- **Coverage**: Aim for 80%+ code coverage
- **Test types**: Unit tests for logic, integration tests for APIs
- **Mocking**: Mock external dependencies and database calls
- **Assertions**: Use descriptive assertions and meaningful error messages
- **Setup/Teardown**: Clean up resources after tests

## 🔧 API Design

### REST API Guidelines

```typescript
// Use consistent HTTP methods
// GET /api/users - List users
// GET /api/users/:id - Get specific user
// POST /api/users - Create user
// PUT /api/users/:id - Update user (full)
// PATCH /api/users/:id - Update user (partial)
// DELETE /api/users/:id - Delete user

// Use consistent response formats
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Example endpoint implementation
export const createUser = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userData = request.body as CreateUserRequest;
    const user = await userService.create(userData);

    return reply.code(201).send({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return reply.code(400).send({
        success: false,
        error: {
          message: error.message,
          code: "VALIDATION_ERROR",
        },
      });
    }

    // Log unexpected errors
    request.log.error(error);

    return reply.code(500).send({
      success: false,
      error: {
        message: "Internal server error",
      },
    });
  }
};
```

### tRPC Procedures

```typescript
// Define input/output schemas
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

const userOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.date(),
});

// Create procedures
export const userRouter = router({
  create: publicProcedure
    .input(createUserSchema)
    .output(userOutputSchema)
    .mutation(async ({ input }) => {
      return await userService.create(input);
    }),

  list: publicProcedure.query(async () => {
    return await userService.findAll();
  }),
});
```

## 💾 Database Guidelines

### Prisma Schema Design

```prisma
// Use descriptive names
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  projects  ProjectMember[]

  @@map("users")
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relationships
  members     ProjectMember[]
  sensors     Sensor[]

  @@map("projects")
}
```

### TimescaleDB for Time-Series Data

```sql
-- Use hypertables for time-series data
CREATE TABLE sensor_readings (
    id SERIAL,
    device_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    metadata JSONB
);

-- Convert to hypertable
SELECT create_hypertable('sensor_readings', 'timestamp');

-- Create appropriate indexes
CREATE INDEX idx_sensor_readings_device_timestamp
ON sensor_readings (device_id, timestamp DESC);
```

### Query Optimization

```typescript
// Use select to limit returned fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
});

// Use pagination for large datasets
const users = await prisma.user.findMany({
  skip: page * limit,
  take: limit,
  orderBy: { createdAt: "desc" },
});

// Use database transactions for consistency
await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  await tx.projectMember.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: "OWNER",
    },
  });
});
```

## 🚀 Performance Considerations

### Backend Optimization

```typescript
// Use caching for frequently accessed data
import { LRUCache } from "lru-cache";

const userCache = new LRUCache<string, User>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

export const getUserById = async (id: string): Promise<User | null> => {
  // Check cache first
  const cached = userCache.get(id);
  if (cached) return cached;

  // Fetch from database
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    userCache.set(id, user);
  }

  return user;
};

// Use connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
```

### Frontend Optimization

```tsx
// Use React.memo for expensive components
const UserList = React.memo(({ users }: { users: User[] }) => {
  return (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
});

// Use useMemo for expensive calculations
const ExpensiveComponent = ({ data }: { data: DataPoint[] }) => {
  const processedData = useMemo(() => {
    return data.map((point) => expensiveCalculation(point));
  }, [data]);

  return <Chart data={processedData} />;
};
```

## 🔒 Security Best Practices

### Input Validation

```typescript
// Always validate input
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(72),
});

// Sanitize user input
import DOMPurify from "isomorphic-dompurify";

const sanitizedContent = DOMPurify.sanitize(userInput);
```

### Authentication & Authorization

```typescript
// Use proper session management
import { getServerSession } from "next-auth";

export const requireAuth = async () => {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
};

// Implement role-based access control
export const requireRole = (requiredRole: Role) => {
  return async (req: Request) => {
    const user = await requireAuth();
    if (user.role !== requiredRole) {
      throw new Error("Forbidden");
    }
    return user;
  };
};
```

### Environment Variables

```typescript
// Never log secrets
const sensitiveConfig = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  apiKey: process.env.API_KEY,
};

// Use validation for environment variables
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

export const env = envSchema.parse(process.env);
```

---

This guide provides the foundation for maintaining code quality and consistency across the SPINE project. For questions or clarifications, please open an issue or reach out to the maintainers.
