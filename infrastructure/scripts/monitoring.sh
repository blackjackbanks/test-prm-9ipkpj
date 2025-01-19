#!/bin/bash

# COREos Monitoring Stack Management Script
# Version: 1.0.0
# Purpose: Manages deployment and maintenance of Prometheus, Grafana, and Jaeger monitoring stack

set -euo pipefail

# Global variables from specification
MONITORING_NAMESPACE="coreos-monitoring"
PROMETHEUS_RETENTION_DAYS="15"
JAEGER_RETENTION_DAYS="7"
HEALTH_CHECK_TIMEOUT="30"
MAX_RETRIES="3"
BACKUP_RETENTION_DAYS="30"
LOG_LEVEL="INFO"

# Logging function with timestamp and level
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message"
}

# Enhanced health check function for monitoring components
check_monitoring_health() {
    local component="$1"
    local timeout="${2:-$HEALTH_CHECK_TIMEOUT}"
    local status=0

    log "INFO" "Checking health of $component..."

    case "$component" in
        "prometheus")
            # Check Prometheus health
            if ! kubectl -n "$MONITORING_NAMESPACE" get pods -l app.kubernetes.io/name=prometheus --no-headers | grep -q "Running"; then
                log "ERROR" "Prometheus pods not running"
                status=1
            fi
            
            # Verify metrics endpoint
            if ! curl -s --max-time "$timeout" "http://prometheus:9090/-/healthy" > /dev/null; then
                log "ERROR" "Prometheus metrics endpoint not responding"
                status=1
            fi
            ;;

        "grafana")
            # Check Grafana health
            if ! kubectl -n "$MONITORING_NAMESPACE" get pods -l app.kubernetes.io/name=grafana --no-headers | grep -q "Running"; then
                log "ERROR" "Grafana pods not running"
                status=1
            fi
            
            # Verify API health
            if ! curl -s --max-time "$timeout" "http://grafana:3000/api/health" > /dev/null; then
                log "ERROR" "Grafana API not responding"
                status=1
            fi
            ;;

        "jaeger")
            # Check Jaeger health
            if ! kubectl -n "$MONITORING_NAMESPACE" get pods -l app.kubernetes.io/name=jaeger --no-headers | grep -q "Running"; then
                log "ERROR" "Jaeger pods not running"
                status=1
            fi
            
            # Verify query service
            if ! curl -s --max-time "$timeout" "http://jaeger-query:16686/api/traces" > /dev/null; then
                log "ERROR" "Jaeger query service not responding"
                status=1
            fi
            ;;

        *)
            log "ERROR" "Unknown component: $component"
            return 2
            ;;
    esac

    return $status
}

# Deploy or update monitoring stack
deploy_monitoring_stack() {
    local namespace="$1"
    local version="$2"
    local backup_first="${3:-false}"
    local status=0

    log "INFO" "Deploying monitoring stack version $version to namespace $namespace"

    # Create backup if requested
    if [[ "$backup_first" == "true" ]]; then
        log "INFO" "Creating backup before deployment"
        if ! kubectl -n "$namespace" get configmap -o yaml > "backup-$(date +%Y%m%d-%H%M%S).yaml"; then
            log "ERROR" "Backup creation failed"
            return 1
        fi
    fi

    # Apply namespace and RBAC
    kubectl apply -f ../kubernetes/base/namespace.yaml

    # Deploy Prometheus
    log "INFO" "Deploying Prometheus"
    kubectl apply -f ../kubernetes/monitoring/prometheus.yaml
    if ! check_monitoring_health "prometheus"; then
        log "ERROR" "Prometheus deployment failed"
        status=1
    fi

    # Deploy Grafana
    log "INFO" "Deploying Grafana"
    kubectl apply -f ../kubernetes/monitoring/grafana.yaml
    if ! check_monitoring_health "grafana"; then
        log "ERROR" "Grafana deployment failed"
        status=1
    fi

    # Deploy Jaeger
    log "INFO" "Deploying Jaeger"
    kubectl apply -f ../kubernetes/monitoring/jaeger.yaml
    if ! check_monitoring_health "jaeger"; then
        log "ERROR" "Jaeger deployment failed"
        status=1
    fi

    return $status
}

# Rotate monitoring credentials
rotate_monitoring_credentials() {
    local component="$1"
    local force_rotation="${2:-false}"
    local status=0

    log "INFO" "Rotating credentials for $component"

    # Create backup of current credentials
    kubectl -n "$MONITORING_NAMESPACE" get secrets -o yaml > "secrets-backup-$(date +%Y%m%d-%H%M%S).yaml"

    case "$component" in
        "grafana")
            # Generate new admin password
            local new_password=$(openssl rand -base64 32)
            kubectl -n "$MONITORING_NAMESPACE" create secret generic grafana-admin-credentials \
                --from-literal=admin-password="$new_password" \
                --dry-run=client -o yaml | kubectl apply -f -
            
            # Restart Grafana pods
            kubectl -n "$MONITORING_NAMESPACE" rollout restart deployment grafana
            ;;

        "prometheus")
            # Generate new TLS certificates
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout prometheus.key -out prometheus.crt \
                -subj "/CN=prometheus.$MONITORING_NAMESPACE.svc"
            
            kubectl -n "$MONITORING_NAMESPACE" create secret tls prometheus-tls \
                --cert=prometheus.crt --key=prometheus.key \
                --dry-run=client -o yaml | kubectl apply -f -
            
            # Clean up temporary files
            rm -f prometheus.key prometheus.crt
            ;;

        *)
            log "ERROR" "Unknown component: $component"
            return 1
            ;;
    esac

    return $status
}

# Cleanup monitoring data
cleanup_monitoring_data() {
    local dry_run="${1:-true}"
    local retention_override="${2:-$PROMETHEUS_RETENTION_DAYS}"
    local status=0

    log "INFO" "Starting monitoring data cleanup (dry-run: $dry_run)"

    # Prometheus data cleanup
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "Would clean up Prometheus data older than $retention_override days"
    else
        kubectl -n "$MONITORING_NAMESPACE" exec -it prometheus-0 -- curl -X POST \
            http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
        
        # Verify cleanup
        if ! kubectl -n "$MONITORING_NAMESPACE" exec -it prometheus-0 -- curl -s \
            http://localhost:9090/api/v1/status/tsdb | jq -r '.data.headStats.numSeries' > /dev/null; then
            log "ERROR" "Prometheus data cleanup verification failed"
            status=1
        fi
    fi

    # Jaeger data cleanup
    if [[ "$dry_run" == "true" ]]; then
        log "INFO" "Would clean up Jaeger traces older than $JAEGER_RETENTION_DAYS days"
    else
        kubectl -n "$MONITORING_NAMESPACE" exec -it jaeger-0 -- jaeger-admin cleanup \
            --retention-days "$JAEGER_RETENTION_DAYS"
    fi

    return $status
}

# Main execution
main() {
    local command="$1"
    shift

    case "$command" in
        "health")
            check_monitoring_health "$@"
            ;;
        "deploy")
            deploy_monitoring_stack "$@"
            ;;
        "rotate-credentials")
            rotate_monitoring_credentials "$@"
            ;;
        "cleanup")
            cleanup_monitoring_data "$@"
            ;;
        *)
            log "ERROR" "Unknown command: $command"
            echo "Usage: $0 {health|deploy|rotate-credentials|cleanup} [args...]"
            exit 1
            ;;
    esac
}

# Execute main if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ $# -lt 1 ]]; then
        echo "Usage: $0 {health|deploy|rotate-credentials|cleanup} [args...]"
        exit 1
    fi
    main "$@"
fi