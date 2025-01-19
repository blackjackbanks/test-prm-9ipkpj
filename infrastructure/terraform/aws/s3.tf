# S3 Bucket Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# Import required provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for bucket configuration
locals {
  bucket_prefix = "${local.project}-${var.environment}"
  retention_days = 2555  # 7 years retention
  app_storage_transition_days = 90
  backup_storage_transition_days = 30
  replica_region = "us-west-2"
}

# Application Storage Bucket
resource "aws_s3_bucket" "app_storage_bucket" {
  bucket = "${local.bucket_prefix}-app-storage"
  force_destroy = false

  tags = merge(local.tags, {
    Purpose = "Application Storage"
    DataClassification = "Confidential"
  })
}

# Backup Storage Bucket
resource "aws_s3_bucket" "backup_storage_bucket" {
  bucket = "${local.bucket_prefix}-backup-storage"
  force_destroy = false

  tags = merge(local.tags, {
    Purpose = "Backup Storage"
    DataClassification = "Critical"
  })
}

# Backup Storage Replica Bucket (Cross-Region)
resource "aws_s3_bucket" "backup_storage_bucket_replica" {
  provider = aws.replica
  bucket = "${local.bucket_prefix}-backup-storage-replica"
  force_destroy = false

  tags = merge(local.tags, {
    Purpose = "Backup Storage Replica"
    DataClassification = "Critical"
  })
}

# Enable versioning for application storage
resource "aws_s3_bucket_versioning" "app_storage_versioning" {
  bucket = aws_s3_bucket.app_storage_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable versioning for backup storage
resource "aws_s3_bucket_versioning" "backup_storage_versioning" {
  bucket = aws_s3_bucket.backup_storage_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption configuration for app storage
resource "aws_s3_bucket_server_side_encryption_configuration" "app_storage_encryption" {
  bucket = aws_s3_bucket.app_storage_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Server-side encryption configuration for backup storage
resource "aws_s3_bucket_server_side_encryption_configuration" "backup_storage_encryption" {
  bucket = aws_s3_bucket.backup_storage_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rules for application storage
resource "aws_s3_bucket_lifecycle_rule" "app_storage_lifecycle" {
  bucket = aws_s3_bucket.app_storage_bucket.id
  id = "app-storage-lifecycle"
  enabled = true

  transition {
    days = local.app_storage_transition_days
    storage_class = "STANDARD_IA"
  }

  transition {
    days = 180
    storage_class = "INTELLIGENT_TIERING"
  }

  noncurrent_version_transition {
    days = 30
    storage_class = "GLACIER"
  }

  expiration {
    days = local.retention_days
  }
}

# Lifecycle rules for backup storage
resource "aws_s3_bucket_lifecycle_rule" "backup_storage_lifecycle" {
  bucket = aws_s3_bucket.backup_storage_bucket.id
  id = "backup-storage-lifecycle"
  enabled = true

  transition {
    days = local.backup_storage_transition_days
    storage_class = "GLACIER"
  }

  expiration {
    days = local.retention_days
  }
}

# Cross-region replication role
resource "aws_iam_role" "replication_role" {
  name = "${local.bucket_prefix}-s3-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

# Replication configuration for backup storage
resource "aws_s3_bucket_replication_configuration" "backup_replication" {
  depends_on = [
    aws_s3_bucket_versioning.backup_storage_versioning
  ]

  role   = aws_iam_role.replication_role.arn
  bucket = aws_s3_bucket.backup_storage_bucket.id

  rule {
    id = "backup-replication-rule"
    status = "Enabled"

    destination {
      bucket = aws_s3_bucket.backup_storage_bucket_replica.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# Block public access for application storage
resource "aws_s3_bucket_public_access_block" "app_storage_public_access_block" {
  bucket = aws_s3_bucket.app_storage_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Block public access for backup storage
resource "aws_s3_bucket_public_access_block" "backup_storage_public_access_block" {
  bucket = aws_s3_bucket.backup_storage_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "app_storage_bucket_id" {
  value = aws_s3_bucket.app_storage_bucket.id
  description = "ID of the application storage bucket"
}

output "app_storage_bucket_arn" {
  value = aws_s3_bucket.app_storage_bucket.arn
  description = "ARN of the application storage bucket"
}

output "backup_storage_bucket_id" {
  value = aws_s3_bucket.backup_storage_bucket.id
  description = "ID of the backup storage bucket"
}

output "backup_storage_bucket_arn" {
  value = aws_s3_bucket.backup_storage_bucket.arn
  description = "ARN of the backup storage bucket"
}