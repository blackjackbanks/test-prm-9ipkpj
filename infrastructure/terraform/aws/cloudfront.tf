# AWS CloudFront Configuration for COREos Platform
# Provider Version: hashicorp/aws ~> 5.0

# Provider configuration for ACM certificate in us-east-1
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}

# Local variables for CloudFront configuration
locals {
  cdn_tags = {
    Name          = "coreos-cdn"
    Environment   = var.environment
    ManagedBy     = "terraform"
    Service       = "content-delivery"
    SecurityLevel = "high"
  }
}

# Origin Access Identity for S3 bucket access
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for COREos web application secure S3 access"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.app_storage_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.main.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.app_storage_bucket.arn}/*"
      }
    ]
  })
}

# CloudFront distribution configuration
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  http_version       = "http2and3"
  price_class        = "PriceClass_All"
  comment            = "COREos web application distribution with enhanced security"
  default_root_object = "index.html"
  aliases            = [var.domain_name, "www.${var.domain_name}"]

  # Origin configuration
  origin {
    domain_name = aws_s3_bucket.app_storage_bucket.regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.app_storage_bucket.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.app_storage_bucket.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # WAF integration
  web_acl_id = aws_wafv2_web_acl.main.arn

  # Access logging
  logging_config {
    include_cookies = true
    bucket         = aws_s3_bucket.logs.bucket_domain_name
    prefix         = "cdn/"
  }

  tags = local.cdn_tags
}

# Security headers policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "coreos-security-headers"
  
  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
      override = true
    }
    
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    
    content_type_options {
      override = true
    }
    
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# Cache policy for static assets
resource "aws_cloudfront_cache_policy" "static_assets" {
  name        = "coreos-static-assets"
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

# Outputs
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.main.id
  description = "The ID of the CloudFront distribution"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "The domain name of the CloudFront distribution"
}

output "cloudfront_hosted_zone_id" {
  value       = aws_cloudfront_distribution.main.hosted_zone_id
  description = "The CloudFront Route 53 zone ID"
}