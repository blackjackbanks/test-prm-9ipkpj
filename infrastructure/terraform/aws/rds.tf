# RDS Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# Data source for RDS KMS key
data "aws_kms_key" "rds" {
  key_id = "alias/aws/rds"
}

# Random password generation for RDS admin user
resource "random_password" "db_password" {
  length  = 32
  special = true
  # Exclude special characters that might cause connection issues
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store the database password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${local.project}-${local.environment}-db-password"
  kms_key_id = data.aws_kms_key.rds.arn
  
  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db-password"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# Local variables for database configuration
locals {
  db_name = "coreos"
  db_port = 5432
  db_family = "postgres14"
  db_engine = "postgres"
  db_engine_version = "14.7"
  
  # Optimized database parameters based on technical requirements
  db_parameter_settings = {
    max_connections = "1000"
    shared_buffers = "{DBInstanceClassMemory/4096}MB"
    work_mem = "64MB"
    maintenance_work_mem = "256MB"
    effective_cache_size = "{DBInstanceClassMemory/2}MB"
    ssl = "on"
    log_min_duration_statement = "1000"
  }
}

# DB subnet group
resource "aws_db_subnet_group" "main" {
  name        = "${local.project}-${local.environment}-db-subnet-group"
  subnet_ids  = aws_subnet.database[*].id
  description = "Database subnet group for ${local.project} ${local.environment}"

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db-subnet-group"
  })
}

# DB parameter group
resource "aws_db_parameter_group" "main" {
  name        = "${local.project}-${local.environment}-db-params"
  family      = local.db_family
  description = "Database parameter group for ${local.project} ${local.environment}"

  dynamic "parameter" {
    for_each = local.db_parameter_settings
    content {
      name  = parameter.key
      value = parameter.value
    }
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db-params"
  })
}

# Security group for RDS
resource "aws_security_group" "db" {
  name        = "${local.project}-${local.environment}-db-sg"
  description = "Security group for ${local.project} ${local.environment} database"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = local.db_port
    to_port         = local.db_port
    protocol        = "tcp"
    security_groups = [aws_security_group.eks.id]
    description     = "Allow PostgreSQL access from EKS cluster"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db-sg"
  })
}

# RDS instance
resource "aws_db_instance" "main" {
  identifier = "${local.project}-${local.environment}-db"
  
  # Engine configuration
  engine               = local.db_engine
  engine_version       = local.db_engine_version
  instance_class       = var.rds_instance_class
  
  # Storage configuration
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = data.aws_kms_key.rds.arn
  
  # Database configuration
  db_name  = local.db_name
  port     = local.db_port
  username = "admin"
  password = random_password.db_password.result
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  multi_az              = true
  publicly_accessible   = false
  
  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot  = true
  
  # Monitoring configuration
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # Additional features
  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${local.project}-${local.environment}-db-final"
  
  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-db"
  })
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${local.project}-${local.environment}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_arn" {
  description = "RDS instance ARN"
  value       = aws_db_instance.main.arn
}

output "rds_security_group_id" {
  description = "Security group ID for RDS instance"
  value       = aws_security_group.db.id
}