# COREos AWS Infrastructure Configuration
# Provider Version: hashicorp/aws ~> 5.0
# Terraform Version: >= 1.5.0

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket = "coreos-terraform-state-${var.environment}"
    key    = "aws/${var.environment}/terraform.tfstate"
    region = "${var.aws_region}"
    
    # Enhanced security features
    encrypt        = true
    dynamodb_table = "coreos-terraform-locks-${var.environment}"
    kms_key_id     = "${var.state_encryption_key_arn}"
    
    # State file versioning and replication
    versioning = true
    replication_configuration {
      role = "${var.replication_role_arn}"
      rules {
        destination {
          bucket = "coreos-terraform-state-${var.environment}-replica"
          region = "${var.aws_secondary_region}"
        }
        status = "Enabled"
      }
    }
  }
}

# Local variables for resource naming and tagging
locals {
  project           = "coreos"
  environment       = var.environment
  region           = var.aws_region
  secondary_region = var.aws_secondary_region

  # Common tags for all resources
  tags = {
    Project             = "coreos"
    Environment         = var.environment
    ManagedBy          = "terraform"
    Owner              = "platform-team"
    CostCenter         = "platform-${var.environment}"
    SecurityCompliance = "required"
    BackupRequired     = "true"
    DataClassification = "confidential"
  }
}

# Primary region provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.tags
  }
  
  allowed_account_ids = [var.aws_account_id]
}

# Secondary region provider configuration for high availability
provider "aws" {
  alias  = "secondary"
  region = var.aws_secondary_region
  
  default_tags {
    tags = local.tags
  }
  
  allowed_account_ids = [var.aws_account_id]
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for available AZs in primary region
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for available AZs in secondary region
data "aws_availability_zones" "secondary" {
  provider = aws.secondary
  state    = "available"
}

# KMS key for encryption at rest
resource "aws_kms_key" "main" {
  description             = "KMS key for ${local.project}-${local.environment}"
  deletion_window_in_days = 30
  enable_key_rotation    = true

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-kms"
  })
}

# KMS key alias
resource "aws_kms_alias" "main" {
  name          = "alias/${local.project}-${local.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# S3 bucket for application assets
resource "aws_s3_bucket" "assets" {
  bucket = "${local.project}-assets-${local.environment}-${random_string.suffix.result}"

  tags = merge(local.tags, {
    Name = "${local.project}-assets-${local.environment}"
  })
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.main.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudWatch log group for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/${local.project}/${local.environment}/applications"
  retention_in_days = 90

  tags = merge(local.tags, {
    Name = "${local.project}-${local.environment}-app-logs"
  })
}

# Output values for other modules
output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "kms_key_arn" {
  description = "KMS Key ARN for encryption"
  value       = aws_kms_key.main.arn
}

output "assets_bucket" {
  description = "S3 bucket name for application assets"
  value       = aws_s3_bucket.assets.id
}

output "log_group_name" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.app_logs.name
}