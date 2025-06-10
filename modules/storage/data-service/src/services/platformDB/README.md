# Platform Database Services

This directory contains services that manage platform metadata stored in PostgreSQL. These services handle the core configuration, user management, and system coordination that drives the entire IoT platform.

## Service Overview

Platform services manage referential integrity, user permissions, and system coordination across all platform components.

### Core Services

- **[userService.ts](userService.ts)** - User account lifecycle and authentication
- **[projectService.ts](projectService.ts)** - Project management and member coordination
- **[pipelineService.ts](pipelineService.ts)** - Flink pipeline lifecycle management
- **[kafkaTopicService.ts](kafkaTopicService.ts)** - Kafka topic configuration and metadata
- **[schemaService.ts](schemaService.ts)** - Schema versioning and governance
- **[connectorService.ts](connectorService.ts)** - Ingress connector configuration
- **[validatorService.ts](validatorService.ts)** - Data validation rules and strategies

## Service Responsibilities

### UserService

- User account lifecycle management
- Authentication and session handling
- Project membership queries
- Role-based access patterns

### ProjectService

- Project creation and configuration
- Member management and permissions
- Project-scoped resource queries
- Collaborative workspace coordination

### PipelineService

- Flink pipeline metadata management
- Pipeline activation/deactivation lifecycle
- Version control and change tracking
- Project-pipeline associations

### KafkaTopicService

- Topic registration and metadata
- Schema attachment and validation
- Topic lifecycle management
- Stage and format categorization

### SchemaService

- Schema version control and evolution
- Usage tracking and dependency analysis
- Format validation and type checking
- Schema comparison and migration support

### ConnectorService

- Ingress connector configuration
- Endpoint management and validation
- Protocol-specific parameter handling
- Schema binding and topic routing

### ValidatorService

- Data validation rule definition
- Error handling strategy configuration
- Validation chain orchestration
- Quality assurance statistics

## Common Patterns

All platform services follow consistent interface patterns:

```typescript
// Standard CRUD operations
getAllXxx(): Promise<Xxx[]>
getXxxById(id: string): Promise<Xxx | null>
createXxx(data: CreateXxxData): Promise<Xxx>
updateXxx(id: string, data: UpdateXxxData): Promise<Xxx>
deleteXxx(id: string): Promise<void>

// Existence checks
xxxExists(identifier: string): Promise<boolean>

// Relationship queries
getXxxByYyy(yyyId: string): Promise<Xxx[]>
attachXxxToYyy(xxxId: string, yyyId: string): Promise<Xxx>
detachXxxFromYyy(xxxId: string): Promise<Xxx>
```

## Transaction Management

Platform services coordinate complex operations using database transactions:

```typescript
// Example: Project creation with initial member
async createProjectWithOwner(projectData: CreateProjectData, ownerId: string) {
  return await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({ data: projectData })
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: ownerId,
        role: 'OWNER'
      }
    })
    return project
  })
}
```

## Error Handling

Platform services implement consistent error handling:

```typescript
interface PlatformServiceError {
  code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR";
  message: string;
  details?: any;
}
```

These services form the foundation of the platform's metadata management, ensuring data integrity and coordinating system-wide operations.
