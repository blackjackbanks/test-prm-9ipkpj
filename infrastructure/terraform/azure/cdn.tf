# Azure CDN Profile and Endpoint configuration for COREos platform
# Provider version: azurerm ~> 3.0

locals {
  cdn_name      = "${local.resource_prefix}-cdn"
  endpoint_name = "${local.resource_prefix}-endpoint"

  # Define cache optimization rules for different content types
  cache_rules = {
    images = {
      duration = "7.00:00:00"  # 7 days
      types    = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    }
    static = {
      duration = "1.00:00:00"  # 1 day
      types    = ["text/css", "text/javascript", "application/javascript", "application/json"]
    }
    html = {
      duration = "0.00:05:00"  # 5 minutes
      types    = ["text/html"]
    }
  }
}

# CDN Profile resource with Standard Microsoft SKU for global edge presence
resource "azurerm_cdn_profile" "main" {
  name                = local.cdn_name
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  sku                = "Standard_Microsoft"
  tags                = local.common_tags
}

# CDN Endpoint configuration with optimized delivery settings
resource "azurerm_cdn_endpoint" "main" {
  name                          = local.endpoint_name
  profile_name                  = azurerm_cdn_profile.main.name
  resource_group_name          = azurerm_resource_group.main.name
  location                      = var.location
  optimization_type            = "GeneralWebDelivery"
  is_compression_enabled       = true
  is_http_allowed              = false
  is_https_allowed             = true
  querystring_caching_behaviour = "IgnoreQueryString"

  # Origin configuration pointing to web application
  origin {
    name       = "web-origin"
    host_name  = var.web_app_hostname
    http_port  = 80
    https_port = 443
  }

  # Content types to enable compression for optimal delivery
  content_types_to_compress = [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/json",
    "application/xml",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/svg+xml",
    "application/x-font-ttf",
    "application/x-font-opentype",
    "application/font-woff",
    "application/font-woff2"
  ]

  # Global delivery rules for security headers and HTTPS
  global_delivery_rule {
    cache_expiration_action {
      behavior = "SetIfMissing"
      duration = "1.00:00:00"  # Default 1 day cache
    }

    modify_response_header_action {
      action = "Append"
      name   = "Strict-Transport-Security"
      value  = "max-age=31536000; includeSubDomains"
    }

    modify_response_header_action {
      action = "Append"
      name   = "X-Content-Type-Options"
      value  = "nosniff"
    }

    modify_response_header_action {
      action = "Append"
      name   = "X-Frame-Options"
      value  = "DENY"
    }
  }

  # Cache rules for different content types
  delivery_rule {
    name  = "CacheImages"
    order = 1

    cache_expiration_action {
      behavior = "Override"
      duration = local.cache_rules.images.duration
    }

    conditions {
      condition_type   = "FileExtension"
      operator        = "Any"
      match_values    = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    }
  }

  delivery_rule {
    name  = "CacheStaticAssets"
    order = 2

    cache_expiration_action {
      behavior = "Override"
      duration = local.cache_rules.static.duration
    }

    conditions {
      condition_type   = "FileExtension"
      operator        = "Any"
      match_values    = [".css", ".js", ".json"]
    }
  }

  delivery_rule {
    name  = "CacheHTML"
    order = 3

    cache_expiration_action {
      behavior = "Override"
      duration = local.cache_rules.html.duration
    }

    conditions {
      condition_type   = "FileExtension"
      operator        = "Equal"
      match_values    = [".html"]
    }
  }

  tags = local.common_tags
}

# Output the CDN profile ID for reference
output "cdn_profile_id" {
  description = "The ID of the CDN profile"
  value       = azurerm_cdn_profile.main.id
}

# Output the CDN endpoint hostname for DNS configuration
output "cdn_endpoint_hostname" {
  description = "The hostname of the CDN endpoint"
  value       = azurerm_cdn_endpoint.main.fqdn
}