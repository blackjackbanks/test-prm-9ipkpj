# Route53 DNS Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# Local variables for DNS configuration
locals {
  dns_tags = {
    Name            = "coreos-dns"
    Environment     = var.environment
    ManagedBy       = "terraform"
    Service         = "dns"
    SecurityLevel   = "critical"
    BackupEnabled   = "true"
  }
}

# Primary hosted zone for domain
resource "aws_route53_zone" "main" {
  name          = var.domain_name
  comment       = "Primary zone for COREos platform"
  force_destroy = false
  
  tags = local.dns_tags

  # Enable DNSSEC signing
  dnssec_config {
    signing_status = "SIGNING"
  }
}

# Primary A record for www subdomain with CloudFront
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }
  set_identifier = "primary"
  health_check_id = aws_route53_health_check.primary.id
}

# Secondary A record for failover region
resource "aws_route53_record" "www_secondary" {
  provider = aws.secondary
  zone_id  = aws_route53_zone.main.zone_id
  name     = "www.${var.domain_name}"
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.secondary.domain_name
    zone_id                = aws_cloudfront_distribution.secondary.hosted_zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }
  set_identifier = "secondary"
  health_check_id = aws_route53_health_check.secondary.id
}

# Apex domain record
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# Health check for primary endpoint
resource "aws_route53_health_check" "primary" {
  fqdn              = "www.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  regions = [
    "us-west-1",
    "us-east-1",
    "eu-west-1"
  ]

  tags = merge(local.dns_tags, {
    Name = "primary-health-check"
  })
}

# Health check for secondary endpoint
resource "aws_route53_health_check" "secondary" {
  fqdn              = "www-secondary.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  regions = [
    "us-west-2",
    "ap-southeast-1",
    "eu-central-1"
  ]

  tags = merge(local.dns_tags, {
    Name = "secondary-health-check"
  })
}

# DNS query logging
resource "aws_cloudwatch_log_group" "dns_logs" {
  name              = "/aws/route53/${var.domain_name}"
  retention_in_days = 90

  tags = merge(local.dns_tags, {
    Name = "dns-query-logs"
  })
}

resource "aws_route53_query_log" "main" {
  depends_on = [aws_cloudwatch_log_group.dns_logs]

  cloudwatch_log_group_arn = aws_cloudwatch_log_group.dns_logs.arn
  zone_id                  = aws_route53_zone.main.id
}

# DNSSEC KMS key
resource "aws_kms_key" "dnssec" {
  customer_master_key_spec = "ECC_NIST_P256"
  deletion_window_in_days  = 7
  key_usage               = "SIGN_VERIFY"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable Route 53 DNSSEC Service"
        Effect = "Allow"
        Principal = {
          Service = "dnssec-route53.amazonaws.com"
        }
        Action   = ["kms:DescribeKey", "kms:Sign"]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.dns_tags, {
    Name = "dnssec-kms-key"
  })
}

# DNSSEC signing configuration
resource "aws_route53_key_signing_key" "main" {
  hosted_zone_id             = aws_route53_zone.main.id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                       = "coreos-key"
}

resource "aws_route53_hosted_zone_dnssec" "main" {
  depends_on = [aws_route53_key_signing_key.main]
  hosted_zone_id = aws_route53_zone.main.id
}

# Outputs
output "route53_zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "The name servers for the Route53 hosted zone"
  value       = aws_route53_zone.main.name_servers
}

output "dnssec_signing_status" {
  description = "The DNSSEC signing status for the hosted zone"
  value       = aws_route53_hosted_zone_dnssec.main.signing_status
}