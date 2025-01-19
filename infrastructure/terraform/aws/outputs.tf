# COREos AWS Infrastructure Outputs Configuration
# Provider Version: hashicorp/aws ~> 5.0

# VPC Outputs
output "vpc_id" {
  description = "ID of the created VPC for network configuration and security group setup"
  value       = aws_vpc.main.id
  sensitive   = false
}

output "public_subnet_ids" {
  description = "IDs of public subnets for load balancer and ingress configuration"
  value       = aws_subnet.public[*].id
  sensitive   = false
}

output "private_subnet_ids" {
  description = "IDs of private subnets for application and service deployment"
  value       = aws_subnet.private[*].id
  sensitive   = false
}

output "database_subnet_ids" {
  description = "IDs of database subnets for RDS and ElastiCache configuration"
  value       = aws_subnet.database[*].id
  sensitive   = false
}

# EKS Outputs
output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane access and Kubernetes configuration"
  value       = aws_eks_cluster.main.endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster for CI/CD pipeline configuration"
  value       = aws_eks_cluster.main.name
  sensitive   = false
}

output "eks_cluster_certificate_authority" {
  description = "Certificate authority data for EKS cluster authentication"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

# RDS Outputs
output "rds_endpoint" {
  description = "Connection endpoint for RDS instance database access"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "Port number for RDS instance connections"
  value       = aws_db_instance.main.port
  sensitive   = false
}

# ElastiCache Outputs
output "elasticache_endpoint" {
  description = "Primary endpoint for ElastiCache cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "elasticache_reader_endpoint" {
  description = "Reader endpoint for ElastiCache cluster"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
  sensitive   = true
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = aws_lb.main.dns_name
  sensitive   = false
}

# Security Group Outputs
output "eks_security_group_id" {
  description = "Security group ID for EKS cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  sensitive   = false
}

output "rds_security_group_id" {
  description = "Security group ID for RDS instances"
  value       = aws_security_group.rds.id
  sensitive   = false
}

# IAM Role Outputs
output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
  sensitive   = false
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = aws_iam_role.eks_node_group.arn
  sensitive   = false
}

# Route53 Outputs
output "route53_zone_id" {
  description = "ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
  sensitive   = false
}

output "route53_name_servers" {
  description = "Name servers for the Route53 hosted zone"
  value       = aws_route53_zone.main.name_servers
  sensitive   = false
}

# KMS Outputs
output "kms_key_id" {
  description = "ID of the KMS key used for encryption"
  value       = aws_kms_key.main.key_id
  sensitive   = true
}

# CloudWatch Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for application logs"
  value       = aws_cloudwatch_log_group.app_logs.name
  sensitive   = false
}

# Tags Output
output "resource_tags" {
  description = "Common tags applied to all resources"
  value       = local.tags
  sensitive   = false
}