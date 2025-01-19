# Azure Storage configuration for COREos platform
# Provider version: hashicorp/azurerm ~> 3.0

# Random suffix for globally unique storage account name
resource "random_string" "storage_suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  storage_account_name = "coreos${var.environment}${random_string.storage_suffix.result}"
  container_names     = ["files", "backups", "templates", "artifacts"]
  retention_days     = 2555  # 7 years retention
  min_tls_version    = "TLS1_2"
}

# Primary storage account with GRS replication and enhanced security
resource "azurerm_storage_account" "main" {
  name                          = local.storage_account_name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  account_tier                  = "Standard"
  account_replication_type      = "GRS"
  enable_https_traffic_only     = true
  min_tls_version              = local.min_tls_version
  allow_nested_items_to_be_public = false

  network_rules {
    default_action             = "Deny"
    ip_rules                  = []
    virtual_network_subnet_ids = []
    bypass                    = ["AzureServices"]
  }

  blob_properties {
    versioning_enabled       = true
    change_feed_enabled      = true
    last_access_time_enabled = true

    delete_retention_policy {
      days = 7
    }

    container_delete_retention_policy {
      days = 7
    }

    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "HEAD", "POST", "PUT"]
      allowed_origins    = ["https://*.coreos.com"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }

  identity {
    type = "SystemAssigned"
  }

  lifecycle {
    prevent_destroy = true
  }

  tags = merge(var.common_tags, {
    service = "storage"
    tier    = "data"
  })
}

# Storage containers for different data types
resource "azurerm_storage_container" "containers" {
  for_each              = toset(local.container_names)
  name                  = each.value
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"

  lifecycle {
    prevent_destroy = true
  }
}

# Lifecycle management policy for retention
resource "azurerm_storage_management_policy" "lifecycle" {
  storage_account_id = azurerm_storage_account.main.id

  rule {
    name    = "retentionRule"
    enabled = true
    filters {
      blob_types = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days    = 90
        tier_to_archive_after_days = 365
        delete_after_days          = local.retention_days
      }
      snapshot {
        delete_after_days = 90
      }
      version {
        delete_after_days = 90
      }
    }
  }
}

# Diagnostic settings for monitoring
resource "azurerm_monitor_diagnostic_setting" "storage" {
  name                       = "${local.storage_account_name}-diagnostics"
  target_resource_id         = azurerm_storage_account.main.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  metric {
    category = "Transaction"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "Capacity"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Private endpoint for secure access
resource "azurerm_private_endpoint" "storage" {
  name                = "${local.storage_account_name}-endpoint"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "${local.storage_account_name}-connection"
    private_connection_resource_id = azurerm_storage_account.main.id
    is_manual_connection          = false
    subresource_names            = ["blob"]
  }

  tags = merge(var.common_tags, {
    service = "storage"
    tier    = "network"
  })
}

# Outputs for reference by other resources
output "storage_account_name" {
  description = "The name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "storage_account_key" {
  description = "The primary access key for the storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "container_names" {
  description = "The names of the storage containers"
  value       = [for container in azurerm_storage_container.containers : container.name]
}

output "primary_blob_endpoint" {
  description = "The primary blob endpoint URL"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "private_endpoint_ip" {
  description = "The private IP address of the storage private endpoint"
  value       = azurerm_private_endpoint.storage.private_service_connection[0].private_ip_address
}