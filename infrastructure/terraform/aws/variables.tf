# AWS Infrastructure Variables Configuration
# Version: 1.0.0
# Provider Version: hashicorp/aws ~> 5.0

# Environment Configuration
variable "environment" {
  type        = string
  description = "Environment name for deployment (e.g., dev, staging, prod)"
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Region Configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for deployment"
  default     = "us-west-2"
  validation {
    condition     = contains(["us-west-2", "us-east-1", "eu-west-1"], var.aws_region)
    error_message = "AWS region must be one of: us-west-2, us-east-1, eu-west-1"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr)
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# EKS Configuration
variable "eks_cluster_version" {
  type        = string
  description = "Kubernetes version for EKS cluster"
  default     = "1.25"
  validation {
    condition     = can(regex("^1\\.(2[5-9]|30)$", var.eks_cluster_version))
    error_message = "EKS cluster version must be 1.25 or higher"
  }
}

# High Availability Configuration
variable "high_availability_config" {
  type = object({
    multi_az              = bool
    backup_retention_days = number
    replica_count         = number
    failover_enabled      = bool
  })
  description = "High availability configuration for all services"
  default = {
    multi_az              = true
    backup_retention_days = 30
    replica_count         = 3
    failover_enabled      = true
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  type = object({
    metrics_retention_days    = number
    log_retention_days       = number
    detailed_monitoring      = bool
    alarm_evaluation_periods = number
  })
  description = "Monitoring and alerting configuration"
  default = {
    metrics_retention_days    = 90
    log_retention_days       = 365
    detailed_monitoring      = true
    alarm_evaluation_periods = 3
  }
}

# Security Configuration
variable "security_config" {
  type = object({
    encryption_enabled     = bool
    ssl_enabled           = bool
    key_rotation_enabled  = bool
    audit_logging_enabled = bool
  })
  description = "Security and compliance configuration"
  default = {
    encryption_enabled     = true
    ssl_enabled           = true
    key_rotation_enabled  = true
    audit_logging_enabled = true
  }
  validation {
    condition     = var.security_config.encryption_enabled == true
    error_message = "Encryption must be enabled for production environments"
  }
}

# Resource Tagging Configuration
variable "resource_tags" {
  type        = map(string)
  description = "Common tags for all resources"
  default = {
    Project     = "COREos"
    ManagedBy   = "Terraform"
    Environment = "var.environment"
  }
}