# Azure Cache for Redis configuration
# Provider version: azurerm ~> 3.0

# Random string for unique Redis cache name
resource "random_string" "redis_suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  redis_name = "${local.resource_prefix}-redis-${random_string.redis_suffix.result}"
  
  # Common tags for Redis resources
  redis_tags = merge(var.tags, {
    service     = "redis"
    environment = var.environment
    managed_by  = "terraform"
  })
}

# Azure Cache for Redis instance
resource "azurerm_redis_cache" "main" {
  name                = local.redis_name
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  
  # SKU and capacity configuration
  sku_name            = var.redis_config.sku_name
  family              = var.redis_config.family
  capacity            = var.redis_config.capacity
  
  # Enable zone redundancy for high availability
  zones = var.redis_config.zones
  
  # Redis version and security settings
  enable_non_ssl_port = var.redis_config.enable_non_ssl_port
  minimum_tls_version = var.redis_config.minimum_tls_version
  
  # Shard configuration for Premium SKU
  shard_count = var.redis_config.shard_count
  
  # Redis configuration
  redis_configuration {
    maxmemory_policy = "volatile-lru"
    
    # Premium SKU specific settings
    maxfragmentationmemory_reserved = 50
    maxmemory_reserved              = 50
    
    # Enable data persistence
    rdb_backup_enabled              = true
    rdb_backup_frequency           = 60
    rdb_backup_max_snapshot_count  = 1
    
    # Enable clustering if shard count > 0
    enable_authentication         = true
    notify_keyspace_events       = "KEA"
  }
  
  # Patch schedule for maintenance
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }
  
  # Private endpoint network configuration
  subnet_id = var.subnet_config["redis"].address_prefixes[0]
  
  tags = local.redis_tags
  
  lifecycle {
    prevent_destroy = true
  }
}

# Private endpoint for Redis
resource "azurerm_private_endpoint" "redis" {
  name                = "${local.redis_name}-pe"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints.id

  private_service_connection {
    name                           = "${local.redis_name}-privateserviceconnection"
    private_connection_resource_id = azurerm_redis_cache.main.id
    is_manual_connection          = false
    subresource_names            = ["redisCache"]
  }

  private_dns_zone_group {
    name                 = "redis-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis.id]
  }

  tags = local.redis_tags
}

# Private DNS zone for Redis
resource "azurerm_private_dns_zone" "redis" {
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.main.name
  
  tags = local.redis_tags
}

# DNS zone virtual network link
resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  name                  = "${local.redis_name}-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.redis.name
  virtual_network_id    = azurerm_virtual_network.main.id
  
  tags = local.redis_tags
}

# Diagnostic settings for Redis monitoring
resource "azurerm_monitor_diagnostic_setting" "redis" {
  name                       = "${local.redis_name}-diag"
  target_resource_id        = azurerm_redis_cache.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Outputs for Redis connection details
output "redis_host" {
  description = "The hostname of the Redis instance"
  value       = azurerm_redis_cache.main.hostname
  sensitive   = true
}

output "redis_port" {
  description = "The SSL port of the Redis instance"
  value       = azurerm_redis_cache.main.ssl_port
}

output "redis_primary_access_key" {
  description = "The primary access key for the Redis instance"
  value       = azurerm_redis_cache.main.primary_access_key
  sensitive   = true
}