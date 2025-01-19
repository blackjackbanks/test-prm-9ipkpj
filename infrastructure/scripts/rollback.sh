#!/usr/bin/env bash

# COREos Platform Rollback Script v1.0.0
# Handles zero-downtime rollbacks across multiple regions with service mesh integration
# Dependencies:
# - kubectl v1.25+
# - istioctl v1.18+
# - aws-cli v2.0+

set -euo pipefail
IFS=$'\n\t'

# Global variables with defaults
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE="coreos"
PREVIOUS_VERSION=${PREVIOUS_VERSION}
AWS_REGION=${AWS_REGION:-us-west-2}
ROLLBACK_TIMEOUT=600
HEALTH_CHECK_INTERVAL=5
TRAFFIC_SHIFT_STEP=10

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate rollback prerequisites
validate_rollback_prerequisites() {
    log_info "Validating rollback prerequisites..."

    # Verify AWS credentials and region
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials not configured properly"
        return 1
    fi

    # Check kubectl connectivity
    if ! kubectl get ns "${NAMESPACE}" &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        return 1
    }

    # Verify previous version exists
    if [[ -z "${PREVIOUS_VERSION}" ]]; then
        log_error "PREVIOUS_VERSION not specified"
        return 1
    }

    # Check if previous version images exist
    local images=(
        "coreos-backend:${PREVIOUS_VERSION}"
        "coreos-web:${PREVIOUS_VERSION}"
    )
    for image in "${images[@]}"; do
        if ! aws ecr describe-images --repository-name "${image%%:*}" --image-ids imageTag="${PREVIOUS_VERSION}" &>/dev/null; then
            log_error "Image ${image} not found in ECR"
            return 1
        fi
    done

    # Verify cluster health
    if ! kubectl get nodes | grep -q "Ready"; then
        log_error "Cluster nodes not in Ready state"
        return 1
    }

    log_info "Prerequisites validation completed successfully"
    return 0
}

# Rollback deployment with traffic shifting
rollback_deployment() {
    local deployment_name=$1
    local previous_version=$2
    local traffic_percentage=$3

    log_info "Rolling back deployment ${deployment_name} to version ${previous_version}"

    # Create rollback snapshot
    kubectl get deployment "${deployment_name}" -n "${NAMESPACE}" -o yaml > "/tmp/${deployment_name}_rollback_snapshot.yaml"

    # Update deployment image
    kubectl set image deployment/"${deployment_name}" \
        "${deployment_name}=${deployment_name}:${previous_version}" \
        -n "${NAMESPACE}" --record

    # Wait for rollout to begin
    if ! kubectl rollout status deployment/"${deployment_name}" -n "${NAMESPACE}" --timeout="${ROLLBACK_TIMEOUT}s"; then
        log_error "Rollback failed for ${deployment_name}"
        return 1
    }

    # Verify pod health
    local attempts=0
    while [[ $attempts -lt 12 ]]; do
        if kubectl get pods -n "${NAMESPACE}" -l "app=${deployment_name}" | grep -q "Running"; then
            log_info "New pods are running for ${deployment_name}"
            break
        fi
        sleep 5
        ((attempts++))
    done

    return 0
}

# Rollback service mesh configuration
rollback_service_mesh() {
    local previous_version=$1
    local traffic_rules=$2

    log_info "Rolling back service mesh configuration"

    # Backup current mesh config
    istioctl proxy-config all -n "${NAMESPACE}" > "/tmp/mesh_config_backup.yaml"

    # Apply canary routing
    local current_traffic=100
    while [[ $current_traffic -gt 0 ]]; do
        local new_traffic=$((current_traffic - TRAFFIC_SHIFT_STEP))
        
        # Update virtual service for gradual traffic shift
        cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: coreos-virtualservice
  namespace: ${NAMESPACE}
spec:
  hosts:
  - ${DOMAIN_NAME}
  http:
  - route:
    - destination:
        host: backend-service
        subset: current
      weight: ${current_traffic}
    - destination:
        host: backend-service
        subset: previous
      weight: $((100 - current_traffic))
EOF

        # Verify health after traffic shift
        sleep "${HEALTH_CHECK_INTERVAL}"
        if ! verify_rollback; then
            log_error "Health check failed during traffic shift"
            return 1
        fi

        current_traffic=$new_traffic
    done

    return 0
}

# Verify system health after rollback
verify_rollback() {
    log_info "Verifying system health post-rollback"

    # Check deployment status
    local deployments=("coreos-backend" "coreos-web")
    for deployment in "${deployments[@]}"; do
        if ! kubectl rollout status deployment/"${deployment}" -n "${NAMESPACE}" --timeout=30s &>/dev/null; then
            log_error "Deployment ${deployment} not healthy"
            return 1
        fi
    done

    # Verify pod health
    if ! kubectl get pods -n "${NAMESPACE}" | grep -q "Running"; then
        log_error "Pods not in Running state"
        return 1
    }

    # Check service endpoints
    local endpoints=("/health" "/metrics")
    for endpoint in "${endpoints[@]}"; do
        if ! curl -sf "https://${DOMAIN_NAME}${endpoint}" &>/dev/null; then
            log_error "Endpoint ${endpoint} not responding"
            return 1
        fi
    done

    # Verify metrics
    if ! kubectl exec -n "${NAMESPACE}" -c istio-proxy \
        "$(kubectl get pod -n "${NAMESPACE}" -l app=coreos-backend -o jsonpath='{.items[0].metadata.name}')" \
        -- pilot-agent request GET stats | grep -q "cluster.outbound"; then
        log_error "Service mesh metrics not available"
        return 1
    fi

    log_info "System health verification completed successfully"
    return 0
}

# Main rollback function
main() {
    log_info "Starting rollback process for COREos platform"

    # Validate prerequisites
    if ! validate_rollback_prerequisites; then
        log_error "Prerequisites validation failed"
        exit 1
    fi

    # Rollback deployments
    local deployments=(
        "coreos-backend"
        "coreos-web"
    )

    for deployment in "${deployments[@]}"; do
        if ! rollback_deployment "${deployment}" "${PREVIOUS_VERSION}" "${TRAFFIC_SHIFT_STEP}"; then
            log_error "Failed to rollback ${deployment}"
            exit 1
        fi
    done

    # Rollback service mesh
    if ! rollback_service_mesh "${PREVIOUS_VERSION}" "{}"; then
        log_error "Failed to rollback service mesh configuration"
        exit 1
    fi

    # Final health verification
    if ! verify_rollback; then
        log_error "Final health verification failed"
        exit 1
    fi

    log_info "Rollback completed successfully"
    return 0
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi