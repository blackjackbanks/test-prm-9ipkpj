# Output definitions for Azure infrastructure with enhanced security controls
# Provider: hashicorp/azurerm ~> 3.0

# Resource Group outputs
output "resource_group_name" {
  description = "The name of the resource group containing all COREos infrastructure resources"
  value       = azurerm_resource_group.main.name
  sensitive   = false
}

output "location" {
  description = "The Azure region where COREos infrastructure is deployed"
  value       = azurerm_resource_group.main.location
  sensitive   = false
}

# AKS outputs with enhanced security
output "aks_cluster_id" {
  description = <<-EOT
    The ID of the AKS cluster. 
    This is a sensitive value that should only be used for authorized system integrations.
    Security Classification: Restricted
  EOT
  value       = azurerm_kubernetes_cluster.main.id
  sensitive   = true
}

output "aks_kube_config" {
  description = <<-EOT
    Raw kubeconfig for the AKS cluster.
    WARNING: Contains sensitive authentication information.
    Security Classification: Confidential
    Data Protection: Required
  EOT
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

# PostgreSQL outputs with connection details
output "postgresql_server_fqdn" {
  description = <<-EOT
    The fully qualified domain name of the PostgreSQL server.
    Format: <server-name>.postgres.database.azure.com
    Security Classification: Internal
  EOT
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = false
}

output "postgresql_server_id" {
  description = <<-EOT
    The ID of the PostgreSQL server.
    WARNING: This value should be treated as sensitive infrastructure data.
    Security Classification: Restricted
  EOT
  value       = azurerm_postgresql_flexible_server.main.id
  sensitive   = true
}

# Network outputs
output "vnet_id" {
  description = <<-EOT
    The ID of the Virtual Network.
    Used for network integration and security group associations.
    Format: /subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Network/virtualNetworks/{vnetName}
  EOT
  value       = azurerm_virtual_network.main.id
  sensitive   = false
}

output "subnet_ids" {
  description = <<-EOT
    Map of subnet names to their IDs.
    Contains network segment identifiers for each component:
    - aks: Kubernetes cluster subnet
    - db: Database subnet
    Format: {
      "aks" = "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Network/virtualNetworks/{vnetName}/subnets/{subnetName}"
    }
  EOT
  value = {
    for k, v in azurerm_subnet.subnets : k => v.id
  }
  sensitive = false
}