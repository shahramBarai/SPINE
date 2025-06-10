# Service Layer Architecture

The Data Service implements a **service layer pattern** that encapsulates business logic for each storage backend. This organization aligns with the platform's domain-based modularity principle, creating clear boundaries between different data concerns while maintaining a unified access interface.

## Design Philosophy

The service layer serves several critical architectural functions:

- **Business Logic Encapsulation**: Complex operations are abstracted behind clean interfaces
- **Database Abstraction**: Services hide implementation details from API routes
- **Consistent Error Handling**: Standardized error responses across all operations
- **Transaction Management**: Coordinated operations across related entities
- **Schema Validation**: Type-safe operations with generated Prisma types

## Service Organization

The service layer is organized by database backend, creating clear domain boundaries:

```
services/
├── platformDB/          # PostgreSQL Services (Platform Metadata)
│   └── README.md              # Platform services documentation
├── timescaleDB/         # TimescaleDB Services (Time-Series Data)
│   └── README.md              # Time-series services documentation
├── minIO/               # MinIO Services (File Storage)
│   └── README.md              # File storage services documentation
└── index.ts             # Main service exports
```

### Service Domains

- **[Platform Services](platformDB/)** - Core metadata, user management, and system coordination
- **[TimescaleDB Services](timescaleDB/)** - Time-series data operations and analytics
- **[MinIO Services](minIO/)** - File storage, lifecycle management, and binary assets

## Service Interface Patterns

All services follow consistent interface patterns to ensure predictable behavior:

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

// Business logic operations
activateXxx(id: string, userId: string): Promise<Xxx>
validateXxx(data: XxxData): Promise<ValidationResult>
```

## Error Handling Strategy

Services implement consistent error handling that propagates meaningful information to API consumers:

```typescript
// Service-level error types
interface ServiceError {
  code: "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR";
  message: string;
  details?: any;
}

// Standard error responses
const EntityNotFoundError = (entity: string, id: string) => ({
  code: "NOT_FOUND" as const,
  message: `${entity} with ID ${id} not found`,
});

const ValidationError = (field: string, reason: string) => ({
  code: "VALIDATION_ERROR" as const,
  message: `Validation failed for ${field}: ${reason}`,
});
```

## Transaction Management

Services coordinate complex operations across multiple entities using database transactions:

```typescript
// Example: Cross-entity operations with transaction safety
async performComplexOperation(data: OperationData) {
  return await prisma.$transaction(async (tx) => {
    const primaryEntity = await tx.primaryEntity.create({ data: data.primary })
    const relatedEntity = await tx.relatedEntity.create({
      data: { ...data.related, primaryId: primaryEntity.id }
    })
    return { primaryEntity, relatedEntity }
  })
}
```

## Service Dependencies

Services maintain clear dependency relationships:

- **Platform Services**: May depend on other platform services for validation and coordination
- **TimescaleDB Services**: Independent operations, consuming from Kafka streams
- **MinIO Services**: Coordinate with platform services for metadata while managing file content independently

## Integration Patterns

### Cross-Domain Coordination

Services coordinate across storage domains when needed:

```typescript
// Example: File upload with metadata tracking
async uploadWithMetadata(fileData: Buffer, metadata: FileMetadata) {
  // Store file in MinIO
  const fileResult = await minIOService.uploadFile(bucket, fileName, fileData)

  // Track metadata in PostgreSQL
  const metadataResult = await platformService.createFileMetadata({
    ...metadata,
    objectKey: fileResult.objectKey,
    size: fileResult.size
  })

  return { file: fileResult, metadata: metadataResult }
}
```

### Event-Driven Integration

Services integrate with the platform's event-driven architecture:

```typescript
// Example: Publishing platform events
async createEntityWithEvent(data: CreateEntityData, userId: string) {
  const entity = await this.createEntity(data)

  // Publish event for other modules
  await eventService.publishEvent({
    type: 'ENTITY_CREATED',
    entityId: entity.id,
    userId,
    timestamp: new Date()
  })

  return entity
}
```

This service layer organization ensures maintainable, testable, and modular business logic that aligns with the platform's architectural principles while providing consistent interfaces across all storage domains.
