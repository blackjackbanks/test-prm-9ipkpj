# Azure Virtual Network configuration for COREos platform
# Provider version: hashicorp/azurerm ~> 3.0

# DDoS Protection Plan
resource "azurerm_network_ddos_protection_plan" "main" {
  name                = "${local.resource_prefix}-ddos-plan"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Virtual Network with enhanced security features
resource "azurerm_virtual_network" "main" {
  name                = "${local.resource_prefix}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = var.vnet_address_space
  
  ddos_protection_plan {
    id     = azurerm_network_ddos_protection_plan.main.id
    enable = true
  }

  tags = merge(local.common_tags, {
    "NetworkTier" = "Core"
    "SecurityZone" = "High"
  })
}

# Subnet configuration with service endpoints and security features
resource "azurerm_subnet" "subnets" {
  for_each = var.subnet_config

  name                 = "${local.resource_prefix}-${each.key}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = each.value.address_prefixes
  service_endpoints    = each.value.service_endpoints

  private_endpoint_network_policies_enabled     = true
  private_link_service_network_policies_enabled = true

  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = delegation.value.name
      service_delegation {
        name    = "Microsoft.ContainerInstance/containerGroups"
        actions = delegation.value.actions
      }
    }
  }
}

# Network Security Groups with enhanced security rules
resource "azurerm_network_security_group" "subnets" {
  for_each = var.subnet_config

  name                = "${local.resource_prefix}-${each.key}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # Allow internal VNet communication
  security_rule {
    name                       = "AllowVnetInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range         = "*"
    destination_port_range    = "*"
    source_address_prefix     = "VirtualNetwork"
    destination_address_prefix = "VirtualNetwork"
  }

  # Deny all internet inbound by default
  security_rule {
    name                       = "DenyInternetInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range         = "*"
    destination_port_range    = "*"
    source_address_prefix     = "Internet"
    destination_address_prefix = "VirtualNetwork"
  }

  tags = merge(local.common_tags, {
    "NetworkTier" = "Security"
    "Component"   = each.key
  })
}

# Associate NSGs with subnets
resource "azurerm_subnet_network_security_group_association" "subnets" {
  for_each = var.subnet_config

  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.subnets[each.key].id
}

# Network Watcher Flow Logs
resource "azurerm_network_watcher_flow_log" "subnets" {
  for_each = var.subnet_config

  network_watcher_name = "NetworkWatcher_${azurerm_resource_group.main.location}"
  resource_group_name  = "NetworkWatcherRG"

  network_security_group_id = azurerm_network_security_group.subnets[each.key].id
  storage_account_id        = azurerm_storage_account.main.id
  enabled                   = true
  version                   = 2

  retention_policy {
    enabled = true
    days    = 30
  }

  traffic_analytics {
    enabled               = true
    workspace_id          = azurerm_log_analytics_workspace.main.workspace_id
    workspace_region      = azurerm_log_analytics_workspace.main.location
    workspace_resource_id = azurerm_log_analytics_workspace.main.id
    interval_in_minutes   = 10
  }
}

# Diagnostic settings for Virtual Network
resource "azurerm_monitor_diagnostic_setting" "vnet" {
  name                       = "${local.resource_prefix}-vnet-diag"
  target_resource_id         = azurerm_virtual_network.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "VMProtectionAlerts"
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}

# Outputs
output "vnet_id" {
  description = "The ID of the Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "The name of the Virtual Network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet names to their IDs"
  value = {
    for k, v in azurerm_subnet.subnets : k => v.id
  }
}

output "nsg_ids" {
  description = "Map of NSG names to their IDs"
  value = {
    for k, v in azurerm_network_security_group.subnets : k => v.id
  }
}