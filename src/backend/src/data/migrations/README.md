# Database Migrations Guide

Comprehensive documentation for managing database schema migrations in the COREos platform using Flyway and Alembic.

## Table of Contents
- [Overview](#overview)
- [Migration Workflow](#migration-workflow)
- [Naming Conventions](#naming-conventions)
- [Best Practices](#best-practices)
- [Rollback Procedures](#rollback-procedures)
- [Version Control](#version-control)
- [Security Guidelines](#security-guidelines)
- [Performance Optimization](#performance-optimization)
- [CI/CD Integration](#cicd-integration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Disaster Recovery](#disaster-recovery)

## Overview

The COREos platform uses a dual migration system:
- Flyway (v9.16.3) for production-grade schema migrations
- Alembic (v1.11.1) for development and testing environments

### Key Features
- Versioned migrations with automatic dependency tracking
- Blue-green deployment support
- Automated rollback capabilities
- Migration validation and safety checks
- Performance optimization for large-scale changes

## Migration Workflow

### 1. Creating New Migrations

```bash
# Flyway format
V<timestamp>__<description>.sql

# Alembic format
alembic revision -m "description"
```

### 2. Validation Steps
- Schema compatibility check
- Data integrity verification
- Performance impact assessment
- Rollback procedure validation

### 3. Deployment Process
```bash
# Development
alembic upgrade head

# Production
flyway migrate -target=<version>
```

## Naming Conventions

### Migration Files
```
V20230815123000__add_user_preferences.sql
V20230815123100__update_integration_config.sql
```

### Version Format
- Timestamp: YYYYMMDDHHMMSS
- Description: lowercase_with_underscores
- Prefix: V for version, U for undo, R for repeatable

## Best Practices

### Writing Safe Migrations
1. Always include DOWN migrations
2. Use transactions where possible
3. Implement timeouts for long-running operations
4. Add appropriate indexes before large data changes

### Performance Considerations
```sql
-- Good: Batched updates
UPDATE users 
SET status = 'active' 
WHERE id IN (SELECT id FROM users WHERE status = 'pending' LIMIT 1000);

-- Bad: Single large transaction
UPDATE users SET status = 'active' WHERE status = 'pending';
```

## Rollback Procedures

### Standard Rollback
```bash
# Flyway
flyway undo -target=<previous_version>

# Alembic
alembic downgrade -1
```

### Emergency Rollback
1. Stop application servers
2. Execute rollback script
3. Verify data integrity
4. Restart services
5. Monitor system health

## Version Control

### Version Tracking
- Maintain version history in `schema_version` table
- Track dependencies between migrations
- Document breaking changes

### Compatibility Matrix
```
Version | Breaking Changes | Dependencies
--------|-----------------|-------------
2.1.0   | User schema     | V2.0.0
2.0.0   | None           | V1.9.0
1.9.0   | Auth tables    | V1.8.0
```

## Security Guidelines

### Sensitive Data Handling
1. Never include credentials in migration scripts
2. Use environment variables for sensitive values
3. Implement appropriate access controls
4. Audit all schema changes

### Access Control
```sql
-- Grant minimum required permissions
GRANT SELECT, INSERT ON users TO migration_user;
REVOKE ALL ON users FROM migration_user;
```

## Performance Optimization

### Large Table Migrations
1. Use batched operations
2. Implement progress tracking
3. Schedule during low-traffic periods
4. Monitor system resources

### Indexing Strategy
```sql
-- Create index before bulk operation
CREATE INDEX CONCURRENTLY idx_users_status ON users(status);

-- Perform migration
UPDATE users SET status = 'active' WHERE status = 'pending';

-- Clean up if necessary
DROP INDEX IF EXISTS idx_users_status;
```

## CI/CD Integration

### Automated Deployment
```yaml
migration_job:
  stage: deploy
  script:
    - flyway migrate -target=<version>
    - ./verify_migration.sh
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

### Validation Steps
1. Run migration in staging
2. Execute automated tests
3. Verify data integrity
4. Check performance metrics
5. Validate rollback procedure

## Monitoring

### Key Metrics
- Migration duration
- Table size changes
- Lock wait times
- Transaction volume
- Error rates

### Alert Configuration
```yaml
alerts:
  migration_duration:
    threshold: 300  # seconds
    action: notify_dba
  lock_wait:
    threshold: 60   # seconds
    action: abort_migration
```

## Troubleshooting

### Common Issues
1. Lock timeouts
2. Space constraints
3. Connection limits
4. Constraint violations

### Debug Process
```bash
# Check migration status
flyway info

# View detailed logs
flyway -X migrate

# Validate schema
flyway validate
```

## Disaster Recovery

### Emergency Procedures
1. Immediate rollback trigger points
2. Data recovery steps
3. Service restoration process
4. Incident reporting requirements

### Recovery Checklist
- [ ] Stop affected services
- [ ] Execute rollback procedure
- [ ] Verify data integrity
- [ ] Restore service operations
- [ ] Document incident
- [ ] Update migration procedures

### Contact Information
- Primary DBA: dba@coreos.com
- Secondary DBA: backup-dba@coreos.com
- Emergency Contact: emergency@coreos.com