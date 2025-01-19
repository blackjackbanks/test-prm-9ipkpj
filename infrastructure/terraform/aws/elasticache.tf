# ElastiCache Redis Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# SNS Topic for Redis notifications
resource "aws_sns_topic" "redis_notifications" {
  name = "${local.project}-${local.environment}-redis-notifications"
  
  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-redis-notifications"
  })
}

# ElastiCache subnet group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.project}-${local.environment}-redis-subnet"
  description = "Subnet group for Redis cluster in ${local.environment}"
  subnet_ids  = aws_subnet.private[*].id
  
  tags = local.tags
}

# ElastiCache parameter group with optimized settings
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis7"
  name        = "${local.project}-${local.environment}-redis-params"
  description = "Redis parameter group for ${local.project} ${local.environment}"

  # Memory management
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Event notification
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  # Connection management
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  # Memory sampling
  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  # Memory defragmentation
  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "active-defrag-threshold-lower"
    value = "10"
  }

  parameter {
    name  = "active-defrag-threshold-upper"
    value = "100"
  }

  tags = local.tags
}

# ElastiCache replication group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.project}-${local.environment}-redis"
  description         = "Redis replication group for ${local.project} ${local.environment}"
  
  # Node configuration
  node_type           = var.elasticache_node_type
  num_cache_clusters  = var.elasticache_num_cache_nodes
  port                = 6379

  # Network configuration
  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  # High availability settings
  automatic_failover_enabled = true
  multi_az_enabled          = true

  # Engine configuration
  engine                        = "redis"
  engine_version               = "7.0"
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true

  # Maintenance settings
  maintenance_window           = "sun:05:00-sun:09:00"
  snapshot_retention_limit     = 7
  snapshot_window             = "00:00-05:00"
  auto_minor_version_upgrade  = true

  # Monitoring
  notification_topic_arn      = aws_sns_topic.redis_notifications.arn

  tags = local.tags
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${local.project}-${local.environment}-redis-sg"
  description = "Security group for Redis cluster in ${local.environment}"
  vpc_id      = aws_vpc.main.id

  # Inbound rule for Redis access from private subnets
  ingress {
    description = "Redis from private subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [for subnet in aws_subnet.private : subnet.cidr_block]
  }

  # Outbound rule allowing all traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-redis-sg"
  })
}

# Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port number"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}