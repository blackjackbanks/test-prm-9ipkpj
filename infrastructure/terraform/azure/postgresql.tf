# Random string for unique PostgreSQL server name
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Azure PostgreSQL Flexible Server with enhanced security and HA
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = local.postgresql_name
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = local.postgresql_version
  delegated_subnet_id    = var.subnet_config["db"].address_prefixes[0]
  private_dns_zone_id    = azurerm_private_dns_zone.postgresql.id
  administrator_login    = local.postgresql_admin
  administrator_password = random_password.postgresql_admin_password.result
  zone                   = "1"
  tags                   = local.common_tags

  storage_mb = var.postgresql_config.storage_mb

  sku_name = var.postgresql_config.sku_name

  backup_retention_days        = var.postgresql_config.backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_config.geo_redundant_backup

  high_availability {
    mode                      = var.postgresql_config.high_availability.mode
    standby_availability_zone = var.postgresql_config.high_availability.standby_availability_zone
  }

  maintenance_window {
    day_of_week  = 0
    start_hour   = 2
    start_minute = 0
  }

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = true
  }

  identity {
    type = "SystemAssigned"
  }
}

# Random password generation for PostgreSQL admin
resource "random_password" "postgresql_admin_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_special      = 2
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
}

# Private DNS Zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgresql" {
  name                = "privatelink.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Private DNS Zone Virtual Network Link
resource "azurerm_private_dns_zone_virtual_network_link" "postgresql" {
  name                  = "${local.resource_prefix}-postgresql-dns-link"
  private_dns_zone_name = azurerm_private_dns_zone.postgresql.name
  resource_group_name   = azurerm_resource_group.main.name
  virtual_network_id    = azurerm_virtual_network.main.id
  tags                  = local.common_tags
}

# Diagnostic settings for PostgreSQL
resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "${local.postgresql_name}-diag"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "PostgreSQLLogs"
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  enabled_log {
    category = "PostgreSQLFlexibleServerLogs"
    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Store PostgreSQL admin credentials in Key Vault
resource "azurerm_key_vault_secret" "postgresql_admin_password" {
  name         = "${local.postgresql_name}-admin-password"
  value        = random_password.postgresql_admin_password.result
  key_vault_id = azurerm_key_vault.main.id

  content_type = "text/plain"
  tags         = local.common_tags
}

# PostgreSQL Firewall Rules
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Outputs
output "postgresql_server_id" {
  description = "The ID of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.main.id
  sensitive   = true
}

output "postgresql_server_fqdn" {
  description = "The FQDN of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = true
}

output "postgresql_database_name" {
  description = "The name of the default PostgreSQL database"
  value       = "postgres"
  sensitive   = true
}

output "postgresql_connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${local.postgresql_admin}@${azurerm_postgresql_flexible_server.main.name}:${random_password.postgresql_admin_password.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/postgres"
  sensitive   = true
}