# Azure DNS configuration for COREos platform
# Provider version: azurerm ~> 3.0

# Data source for existing resource group
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# Local variables for DNS configuration
locals {
  dns_tags = {
    Environment        = var.environment
    Service           = "DNS"
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    BackupEnabled     = "True"
    MonitoringEnabled = "True"
  }

  # DNS monitoring settings
  monitoring_config = {
    metrics_enabled    = true
    logs_enabled      = true
    retention_days    = 90
    alert_thresholds = {
      query_volume_threshold = 10000
      latency_threshold_ms  = 100
    }
  }
}

# Primary DNS zone resource
resource "azurerm_dns_zone" "main" {
  name                = var.domain_name
  resource_group_name = data.azurerm_resource_group.main.name
  tags                = local.dns_tags

  soa_record {
    email         = "dns-admin.${var.domain_name}"
    expire_time   = 2419200  # 28 days
    minimum_ttl   = 300      # 5 minutes
    refresh_time  = 3600     # 1 hour
    retry_time    = 300      # 5 minutes
    ttl           = 3600     # 1 hour
  }

  # DNSSEC configuration if enabled
  dynamic "dnssec_config" {
    for_each = var.enable_dnssec ? [1] : []
    content {
      state = "On"
      key_signing_key {
        algorithm = "RSASHA256"
        key_length = 2048
      }
      zone_signing_key {
        algorithm = "RSASHA256"
        key_length = 1024
      }
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

# A record for root domain pointing to Front Door
resource "azurerm_dns_a_record" "root" {
  name                = "@"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  ttl                = 300
  target_resource_id = var.front_door_profile_id

  tags = local.dns_tags
}

# WWW CNAME record pointing to CDN endpoint
resource "azurerm_dns_cname_record" "www" {
  name                = "www"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  ttl                = 300
  record             = var.cdn_endpoint_hostname

  tags = local.dns_tags
}

# API subdomain for backend services
resource "azurerm_dns_a_record" "api" {
  name                = "api"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  ttl                = 300
  target_resource_id = var.api_gateway_profile_id

  tags = local.dns_tags
}

# TXT record for domain verification
resource "azurerm_dns_txt_record" "verification" {
  name                = "@"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  ttl                = 300

  record {
    value = "v=spf1 include:_spf.${var.domain_name} -all"
  }

  tags = local.dns_tags
}

# MX records for email routing
resource "azurerm_dns_mx_record" "mail" {
  name                = "@"
  zone_name           = azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_resource_group.main.name
  ttl                = 3600

  record {
    preference = 10
    exchange   = "mail1.${var.domain_name}"
  }

  record {
    preference = 20
    exchange   = "mail2.${var.domain_name}"
  }

  tags = local.dns_tags
}

# Diagnostic settings for DNS monitoring
resource "azurerm_monitor_diagnostic_setting" "dns" {
  name                       = "dns-diagnostics"
  target_resource_id        = azurerm_dns_zone.main.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  log {
    category = "DnsZoneOperation"
    enabled  = true

    retention_policy {
      enabled = true
      days    = local.monitoring_config.retention_days
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = local.monitoring_config.retention_days
    }
  }
}

# Outputs for DNS configuration
output "dns_zone_id" {
  description = "The ID of the DNS Zone"
  value       = azurerm_dns_zone.main.id
}

output "name_servers" {
  description = "The name servers for the DNS Zone"
  value       = azurerm_dns_zone.main.name_servers
}

output "dns_zone_status" {
  description = "The status of the DNS Zone including DNSSEC"
  value = {
    name           = azurerm_dns_zone.main.name
    id             = azurerm_dns_zone.main.id
    dnssec_enabled = var.enable_dnssec
    name_servers   = azurerm_dns_zone.main.name_servers
  }
}