# Azure Kubernetes Service (AKS) configuration for COREos platform
# Provider: hashicorp/azurerm ~> 3.0

# User Assigned Identity for AKS
resource "azurerm_user_assigned_identity" "aks" {
  name                = "${local.resource_prefix}-aks-identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.common_tags
}

# AKS Cluster with advanced features
resource "azurerm_kubernetes_cluster" "main" {
  name                = var.aks_cluster_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = var.aks_cluster_name
  kubernetes_version  = "1.25"
  sku_tier            = "Standard"
  
  # System node pool configuration
  default_node_pool {
    name                = "system"
    vm_size             = "Standard_D4s_v3"
    node_count          = 3
    availability_zones  = ["1", "2", "3"]
    max_pods            = 50
    enable_auto_scaling = true
    min_count          = 3
    max_count          = 5
    vnet_subnet_id     = lookup(var.subnet_config, "aks", null) != null ? azurerm_subnet.subnets["aks"].id : null
    
    node_labels = {
      "nodepool-type" = "system"
      "environment"   = var.environment
    }

    upgrade_settings {
      max_surge = "33%"
    }
  }

  # Identity configuration
  identity {
    type = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks.id]
  }

  # Network configuration
  network_profile {
    network_plugin     = "azure"
    network_policy     = "calico"
    load_balancer_sku = "standard"
    outbound_type     = "userDefinedRouting"
    service_cidr      = "172.16.0.0/16"
    dns_service_ip    = "172.16.0.10"
    docker_bridge_cidr = "172.17.0.1/16"
  }

  # Azure AD integration
  azure_active_directory_role_based_access_control {
    managed                = true
    azure_rbac_enabled    = true
    admin_group_object_ids = []
  }

  # Monitoring configuration
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  # Security configuration
  api_server_access_profile {
    authorized_ip_ranges = ["0.0.0.0/0"] # Should be restricted in production
    enable_private_cluster = true
  }

  auto_scaler_profile {
    balance_similar_node_groups = true
    expander                   = "random"
    max_graceful_termination_sec = 600
    max_node_provisioning_time   = "15m"
    max_unready_nodes            = 3
    max_unready_percentage       = 45
    new_pod_scale_up_delay       = "10s"
    scale_down_delay_after_add   = "10m"
    scale_down_delay_after_delete = "10s"
    scale_down_delay_after_failure = "3m"
    scan_interval                = "10s"
    scale_down_unneeded         = "10m"
    scale_down_utilization_threshold = 0.5
  }

  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [21, 22, 23]
    }
  }

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      kubernetes_version,
      default_node_pool[0].node_count
    ]
  }
}

# Additional node pools
resource "azurerm_kubernetes_cluster_node_pool" "additional" {
  for_each = var.aks_node_pool_config

  name                  = each.key
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size              = each.value.vm_size
  node_count           = each.value.node_count
  availability_zones   = each.value.availability_zones
  max_pods             = each.value.max_pods
  enable_auto_scaling  = each.value.enable_auto_scaling
  min_count           = each.value.min_count
  max_count           = each.value.max_count
  vnet_subnet_id      = lookup(var.subnet_config, "aks", null) != null ? azurerm_subnet.subnets["aks"].id : null

  node_labels = each.value.node_labels
  node_taints = each.value.node_taints

  tags = merge(local.common_tags, {
    "NodePool" = each.key
  })

  lifecycle {
    ignore_changes = [
      node_count
    ]
  }
}

# Diagnostic settings for AKS
resource "azurerm_monitor_diagnostic_setting" "aks" {
  name                       = "${local.resource_prefix}-aks-diag"
  target_resource_id         = azurerm_kubernetes_cluster.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "kube-apiserver"
  }

  enabled_log {
    category = "kube-controller-manager"
  }

  enabled_log {
    category = "kube-scheduler"
  }

  enabled_log {
    category = "kube-audit"
  }

  enabled_log {
    category = "cluster-autoscaler"
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
output "cluster_id" {
  description = "The ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
  sensitive   = true
}

output "kube_config" {
  description = "The kubeconfig for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "node_resource_group" {
  description = "The resource group containing AKS cluster nodes"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}