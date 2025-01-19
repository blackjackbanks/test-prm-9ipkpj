# Provider configuration with enhanced security features
# Azure Provider version ~> 3.0
terraform {
  required_version = "~> 1.5"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "coreos"
    container_name      = "tfstate"
    key                = "azure.tfstate"
    use_azuread_auth    = true
    use_microsoft_graph = true
  }
}

# Configure Azure Provider with enhanced security features
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
    virtual_machine {
      delete_os_disk_on_deletion = true
    }
  }
  skip_provider_registration = false
}

# Local variables for resource naming and tagging
locals {
  resource_prefix = "coreos-${var.environment}"
  common_tags = {
    Environment     = var.environment
    Project        = "COREos"
    ManagedBy      = "Terraform"
    CostCenter     = "Infrastructure"
    BackupPolicy   = "Required"
    SecurityLevel  = "High"
    ComplianceLevel = "Standard"
  }
}

# Random string for unique resource naming
resource "random_string" "unique" {
  length  = 8
  special = false
  upper   = false
}

# Resource Group with enhanced security
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.location
  tags     = merge(local.common_tags, var.tags)

  lifecycle {
    prevent_destroy = true
  }
}

# Resource Group Lock
resource "azurerm_management_lock" "resource_group" {
  name       = "${local.resource_prefix}-lock"
  scope      = azurerm_resource_group.main.id
  lock_level = "CanNotDelete"
  notes      = "Protected resource group for COREos infrastructure"
}

# Log Analytics Workspace for monitoring
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${local.resource_prefix}-law"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags
}

# Application Insights for monitoring
resource "azurerm_application_insights" "main" {
  name                = "${local.resource_prefix}-appinsights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.main.id
  tags                = local.common_tags
}

# Key Vault for secrets management
resource "azurerm_key_vault" "main" {
  name                        = "${local.resource_prefix}-kv-${random_string.unique.result}"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 90
  purge_protection_enabled    = true
  sku_name                    = "premium"
  tags                        = local.common_tags

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = []
  }
}

# Storage Account for general purpose storage
resource "azurerm_storage_account" "main" {
  name                     = "${replace(local.resource_prefix, "-", "")}sa${random_string.unique.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  min_tls_version         = "TLS1_2"
  tags                     = local.common_tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 30
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }
}

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}

# Outputs for reference by other modules
output "resource_group_id" {
  value       = azurerm_resource_group.main.id
  description = "Resource Group ID"
  sensitive   = true
}

output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Resource Group Name"
}

output "location" {
  value       = azurerm_resource_group.main.location
  description = "Azure Region Location"
}

output "key_vault_id" {
  value       = azurerm_key_vault.main.id
  description = "Key Vault ID"
  sensitive   = true
}

output "log_analytics_workspace_id" {
  value       = azurerm_log_analytics_workspace.main.id
  description = "Log Analytics Workspace ID"
}

output "storage_account_id" {
  value       = azurerm_storage_account.main.id
  description = "Storage Account ID"
  sensitive   = true
}

output "application_insights_instrumentation_key" {
  value       = azurerm_application_insights.main.instrumentation_key
  description = "Application Insights Instrumentation Key"
  sensitive   = true
}