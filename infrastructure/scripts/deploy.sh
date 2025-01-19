#!/usr/bin/env bash

# COREos Platform Deployment Script
# Version: 1.0.0
# Description: Enterprise-grade deployment automation for COREos platform with enhanced
# security, monitoring, and deployment strategies

set -euo pipefail
IFS=$'\n\t'

# Global Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE="coreos"
DOMAIN_NAME=${DOMAIN_NAME}
AWS_REGION=${AWS_REGION:-us-west-2}
SECURITY_SCAN_ENABLED="true"
CANARY_PERCENTAGE="10"
HEALTH_CHECK_RETRIES="5"
DEPLOYMENT_TIMEOUT="600"

# Tool Versions
readonly KUBECTL_VERSION="v1.25.0"  # Minimum required version
readonly ISTIO_VERSION="1.18.0"     # Required for service mesh
readonly AWS_CLI_VERSION="2.0.0"    # Required for AWS operations
readonly TRIVY_VERSION="0.40.0"     # Required for security scanning

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Enhanced prerequisite validation
validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "istioctl" "aws" "trivy")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool $tool is not installed"
            return 1
        fi
    done

    # Validate kubectl version
    local kubectl_version
    kubectl_version=$(kubectl version --client -o json | jq -r '.clientVersion.gitVersion')
    if [[ ! "$kubectl_version" =~ ^v1\.(2[5-9]|[3-9][0-9]) ]]; then
        log_error "kubectl version $kubectl_version is below minimum required version $KUBECTL_VERSION"
        return 1
    fi

    # Verify AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "Invalid AWS credentials or insufficient permissions"
        return 1
    }

    # Validate cluster connectivity
    if ! kubectl auth can-i get deployments -n "$NAMESPACE" &> /dev/null; then
        log_error "Insufficient cluster permissions"
        return 1
    }

    # Verify required environment variables
    local required_vars=("DOMAIN_NAME" "AWS_REGION")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            return 1
        fi
    done

    log_info "Prerequisites validation completed successfully"
    return 0
}

# Infrastructure deployment with security hardening
deploy_infrastructure() {
    local env="$1"
    log_info "Deploying infrastructure for environment: $env"

    # Create and configure namespace with security policies
    kubectl apply -f ../kubernetes/base/namespace.yaml

    # Configure network policies
    kubectl apply -f ../kubernetes/security/network-policies.yaml

    # Setup service mesh with mTLS
    istioctl install --set profile=default \
        --set values.global.proxy.privileged=false \
        --set values.global.proxy.enableCoreDump=false \
        --set values.global.proxy.holdApplicationUntilProxyStarts=true

    # Deploy Istio Gateway
    envsubst < ../kubernetes/istio/gateway.yaml | kubectl apply -f -

    # Configure monitoring and logging
    kubectl apply -f ../kubernetes/monitoring/

    log_info "Infrastructure deployment completed"
    return 0
}

# Enhanced security scanning
security_scan() {
    local manifest="$1"
    log_info "Performing security scan on $manifest"

    if [[ "$SECURITY_SCAN_ENABLED" == "true" ]]; then
        trivy config --severity HIGH,CRITICAL "$manifest"
        local scan_exit_code=$?
        
        if [[ $scan_exit_code -ne 0 ]]; then
            log_error "Security scan failed for $manifest"
            return 1
        fi
    fi

    return 0
}

# Application deployment with zero-downtime strategies
deploy_applications() {
    local env="$1"
    local version="$2"
    log_info "Deploying applications version $version to $env"

    # Scan deployment manifests
    security_scan "../kubernetes/backend/deployment.yaml"
    security_scan "../kubernetes/web/deployment.yaml"

    # Deploy backend with canary strategy
    if [[ "$env" == "production" ]]; then
        # Create canary deployment
        yq w ../kubernetes/backend/deployment.yaml "metadata.name" "coreos-backend-canary" | \
        yq w - "spec.replicas" "1" | \
        kubectl apply -f -

        # Update virtual service for traffic splitting
        envsubst < ../kubernetes/istio/virtualservice.yaml | kubectl apply -f -

        # Gradually increase traffic
        for percentage in 10 25 50 75 100; do
            log_info "Increasing canary traffic to $percentage%"
            kubectl patch virtualservice coreos-virtualservice -n "$NAMESPACE" \
                --type=json \
                -p="[{'op': 'replace', 'path': '/spec/http/0/route/1/weight', 'value': $percentage}]"
            
            sleep 30
            if ! health_check "coreos-backend-canary"; then
                log_error "Canary deployment failed health check"
                rollback_deployment "backend"
                return 1
            fi
        done
    else
        # Direct deployment for non-production
        kubectl apply -f ../kubernetes/backend/deployment.yaml
    fi

    # Deploy frontend with blue-green strategy
    if [[ "$env" == "production" ]]; then
        # Deploy new version (green)
        kubectl apply -f ../kubernetes/web/deployment.yaml

        # Wait for green deployment to be ready
        if ! kubectl rollout status deployment/coreos-web -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"; then
            log_error "Frontend deployment failed"
            rollback_deployment "web"
            return 1
        fi

        # Switch traffic to green deployment
        kubectl patch service coreos-web -n "$NAMESPACE" \
            --type=json \
            -p="[{'op': 'replace', 'path': '/spec/selector/version', 'value': '$version'}]"
    else
        kubectl apply -f ../kubernetes/web/deployment.yaml
    fi

    log_info "Application deployment completed successfully"
    return 0
}

# Enhanced health checking
health_check() {
    local service_name="$1"
    local retries="$HEALTH_CHECK_RETRIES"
    
    while ((retries > 0)); do
        if kubectl get pods -n "$NAMESPACE" -l "app=$service_name" -o jsonpath='{.items[*].status.containerStatuses[*].ready}' | grep -q "true"; then
            # Check additional health metrics
            if kubectl exec -n "$NAMESPACE" deploy/"$service_name" -- curl -s localhost:8000/health | grep -q "healthy"; then
                return 0
            fi
        fi
        ((retries--))
        sleep 10
    done

    return 1
}

# Main deployment orchestration
main() {
    log_info "Starting COREos platform deployment"

    # Validate prerequisites
    if ! validate_prerequisites; then
        log_error "Prerequisites validation failed"
        exit 1
    fi

    # Deploy infrastructure
    if ! deploy_infrastructure "$ENVIRONMENT"; then
        log_error "Infrastructure deployment failed"
        exit 1
    fi

    # Deploy applications
    local version
    version=$(git describe --tags --always)
    if ! deploy_applications "$ENVIRONMENT" "$version"; then
        log_error "Application deployment failed"
        exit 1
    }

    log_info "Deployment completed successfully"
    return 0
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi