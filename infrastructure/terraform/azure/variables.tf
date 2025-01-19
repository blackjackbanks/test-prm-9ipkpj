# Environment and Location
variable "environment" {
  type        = string
  description = "Environment name for resource naming and tagging (e.g., dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  type        = string
  description = "Azure region for primary deployment (e.g., eastus2)"
  validation {
    condition     = can(regex("^[a-z]+[a-z0-9]+$", var.location))
    error_message = "Location must be a valid Azure region name."
  }
}

# AKS Configuration
variable "aks_cluster_name" {
  type        = string
  description = "Name of the AKS cluster"
  validation {
    condition     = can(regex("^[a-z0-9-]{3,45}$", var.aks_cluster_name))
    error_message = "AKS cluster name must be 3-45 characters long and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "aks_node_pool_config" {
  type = map(object({
    vm_size                = string
    node_count            = number
    min_count             = number
    max_count             = number
    enable_auto_scaling   = bool
    availability_zones    = list(string)
    node_labels           = map(string)
    node_taints           = list(string)
    max_pods              = number
  }))
  description = "Configuration for AKS node pools including VM sizes and counts"

  validation {
    condition     = length(var.aks_node_pool_config) > 0
    error_message = "At least one node pool configuration must be provided."
  }
}

# PostgreSQL Configuration
variable "postgresql_config" {
  type = object({
    sku_name            = string
    storage_mb          = number
    backup_retention_days = number
    geo_redundant_backup = bool
    auto_grow_enabled   = bool
    version            = string
    ssl_enforcement_enabled = bool
    high_availability  = object({
      mode             = string
      standby_availability_zone = string
    })
  })
  description = "Configuration for PostgreSQL including SKU, storage, and HA settings"
}

# Redis Configuration
variable "redis_config" {
  type = object({
    sku_name            = string
    family             = string
    capacity           = number
    enable_non_ssl_port = bool
    minimum_tls_version = string
    shard_count        = number
    zones              = list(string)
  })
  description = "Configuration for Redis Cache including SKU and capacity"
}

# Network Configuration
variable "vnet_address_space" {
  type        = list(string)
  description = "Address space for virtual network"
  validation {
    condition     = length(var.vnet_address_space) > 0
    error_message = "At least one address space must be provided for the virtual network."
  }
}

variable "subnet_config" {
  type = map(object({
    address_prefixes  = list(string)
    service_endpoints = list(string)
    delegation       = object({
      name    = string
      actions = list(string)
    })
  }))
  description = "Configuration for subnet address spaces and service endpoints"
}

# Resource Tagging
variable "tags" {
  type        = map(string)
  description = "Additional resource tags beyond common tags"
  default     = {}
}

# Default values for development environment
locals {
  default_aks_node_pool = {
    system = {
      vm_size             = "Standard_D4s_v3"
      node_count         = 3
      min_count          = 3
      max_count          = 5
      enable_auto_scaling = true
      availability_zones = ["1", "2", "3"]
      node_labels        = {
        "nodepool-type" = "system"
        "environment"   = var.environment
      }
      node_taints       = []
      max_pods          = 110
    }
  }

  default_postgresql_config = {
    sku_name            = "GP_Gen5_4"
    storage_mb          = 102400
    backup_retention_days = 7
    geo_redundant_backup = false
    auto_grow_enabled   = true
    version            = "14"
    ssl_enforcement_enabled = true
    high_availability  = {
      mode             = "ZoneRedundant"
      standby_availability_zone = "2"
    }
  }

  default_redis_config = {
    sku_name            = "Premium"
    family             = "P"
    capacity           = 1
    enable_non_ssl_port = false
    minimum_tls_version = "1.2"
    shard_count        = 1
    zones              = ["1", "2", "3"]
  }

  default_subnet_config = {
    aks = {
      address_prefixes  = ["10.0.0.0/16"]
      service_endpoints = ["Microsoft.Sql", "Microsoft.AzureCosmosDB", "Microsoft.KeyVault"]
      delegation       = {
        name    = "aks-delegation"
        actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
      }
    }
    db = {
      address_prefixes  = ["10.1.0.0/16"]
      service_endpoints = ["Microsoft.Sql"]
      delegation       = null
    }
  }
}