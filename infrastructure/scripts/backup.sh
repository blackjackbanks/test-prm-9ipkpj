#!/bin/bash

# COREos Platform Backup Script
# Version: 1.0.0
# Description: Automated backup script for PostgreSQL databases and application data
# Dependencies: aws-cli (2.0+), postgresql-client (14+)

set -euo pipefail
IFS=$'\n\t'

# Global Configuration
readonly BACKUP_RETENTION_DAYS=90
readonly BACKUP_PREFIX="coreos-backup"
readonly LOG_FILE="/var/log/coreos/backup.log"
readonly PARALLEL_JOBS=4
readonly MAX_RETRIES=3
readonly COMPRESSION_LEVEL=9
readonly KMS_KEY_ID="alias/coreos-backup-key"

# Timestamp format for backup naming
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly BACKUP_ID="${BACKUP_PREFIX}-${TIMESTAMP}"

# Temporary directory for backup processing
readonly TEMP_DIR=$(mktemp -d)
readonly CHECKSUM_FILE="${TEMP_DIR}/checksums.sha256"

# Log levels
declare -A LOG_LEVELS=([DEBUG]=0 [INFO]=1 [WARN]=2 [ERROR]=3)
readonly LOG_LEVEL=${LOG_LEVEL:-INFO}

# Logging function with structured output
log_message() {
    local level=$1
    local message=$2
    local metadata=${3:-"{}"}
    
    # Check if we should log this level
    [[ ${LOG_LEVELS[$level]} -ge ${LOG_LEVELS[$LOG_LEVEL]} ]] || return 0
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local log_entry=$(jq -n \
        --arg timestamp "$timestamp" \
        --arg level "$level" \
        --arg message "$message" \
        --argjson metadata "$metadata" \
        '{timestamp: $timestamp, level: $level, message: $message, metadata: $metadata}')
    
    echo "$log_entry" | tee -a "$LOG_FILE"
    
    # Push to CloudWatch Logs
    aws logs put-log-events \
        --log-group-name "/coreos/backup" \
        --log-stream-name "backup-${TIMESTAMP}" \
        --log-events "[{\"timestamp\": $(date +%s%3N), \"message\": ${log_entry}}]" \
        >/dev/null 2>&1 || true
}

# Cleanup function
cleanup() {
    log_message "INFO" "Starting cleanup of temporary files" "{\"temp_dir\": \"$TEMP_DIR\"}"
    
    # Secure deletion of temporary files
    find "$TEMP_DIR" -type f -exec shred -u {} \;
    rm -rf "$TEMP_DIR"
    
    log_message "INFO" "Cleanup completed"
}

# Error handler
error_handler() {
    local line_no=$1
    local error_code=$2
    log_message "ERROR" "Script failed" "{\"line\": $line_no, \"error_code\": $error_code}"
    cleanup
    exit 1
}

# Set up error handling
trap 'error_handler ${LINENO} $?' ERR
trap cleanup EXIT

# Backup database function
backup_database() {
    local db_host=$1
    local db_name=$2
    local s3_bucket=$3
    local s3_replica_bucket=$4
    
    local backup_file="${TEMP_DIR}/${db_name}_${TIMESTAMP}.sql.gz"
    local encrypted_file="${backup_file}.enc"
    
    log_message "INFO" "Starting database backup" "{\"database\": \"$db_name\", \"host\": \"$db_host\"}"
    
    # Perform database dump with parallel processing
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h "$db_host" \
        -U "admin" \
        -d "$db_name" \
        -j "$PARALLEL_JOBS" \
        -Z "$COMPRESSION_LEVEL" \
        -Fd \
        -f "$backup_file" \
        || return 1
    
    # Calculate checksum
    sha256sum "$backup_file" >> "$CHECKSUM_FILE"
    
    # Encrypt backup using KMS
    aws kms encrypt \
        --key-id "$KMS_KEY_ID" \
        --plaintext "fileb://${backup_file}" \
        --output text \
        --query CiphertextBlob \
        > "$encrypted_file"
    
    # Upload to primary S3 bucket
    aws s3 cp \
        "$encrypted_file" \
        "s3://${s3_bucket}/database/${BACKUP_ID}/${db_name}.sql.gz.enc" \
        --storage-class STANDARD_IA \
        --metadata "checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)"
    
    # Verify upload
    aws s3api head-object \
        --bucket "$s3_bucket" \
        --key "database/${BACKUP_ID}/${db_name}.sql.gz.enc" \
        >/dev/null 2>&1 || return 1
    
    # Upload to replica bucket
    aws s3 cp \
        "$encrypted_file" \
        "s3://${s3_replica_bucket}/database/${BACKUP_ID}/${db_name}.sql.gz.enc" \
        --storage-class STANDARD_IA \
        --metadata "checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)"
    
    log_message "INFO" "Database backup completed" "{\"database\": \"$db_name\", \"backup_id\": \"$BACKUP_ID\"}"
    return 0
}

# Cleanup old backups function
cleanup_old_backups() {
    local s3_bucket=$1
    local s3_replica_bucket=$2
    local retention_days=$3
    
    local cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d)
    
    log_message "INFO" "Starting cleanup of old backups" "{\"retention_days\": $retention_days, \"cutoff_date\": \"$cutoff_date\"}"
    
    # List and delete old backups from primary bucket
    aws s3api list-objects-v2 \
        --bucket "$s3_bucket" \
        --prefix "database/" \
        --query "Contents[?LastModified<='${cutoff_date}'].Key" \
        --output text | \
    while read -r key; do
        if [[ -n "$key" ]]; then
            aws s3 rm "s3://${s3_bucket}/${key}"
            log_message "INFO" "Deleted old backup from primary bucket" "{\"key\": \"$key\"}"
        fi
    done
    
    # List and delete old backups from replica bucket
    aws s3api list-objects-v2 \
        --bucket "$s3_replica_bucket" \
        --prefix "database/" \
        --query "Contents[?LastModified<='${cutoff_date}'].Key" \
        --output text | \
    while read -r key; do
        if [[ -n "$key" ]]; then
            aws s3 rm "s3://${s3_replica_bucket}/${key}"
            log_message "INFO" "Deleted old backup from replica bucket" "{\"key\": \"$key\"}"
        fi
    done
}

# Main execution
main() {
    log_message "INFO" "Starting backup process" "{\"backup_id\": \"$BACKUP_ID\"}"
    
    # Create temporary directory with secure permissions
    chmod 700 "$TEMP_DIR"
    
    # Get database connection details from Terraform outputs
    local db_host=$(terraform output -raw rds_endpoint)
    local db_name="coreos"
    local s3_bucket=$(terraform output -raw backup_storage_bucket_id)
    local s3_replica_bucket=$(terraform output -raw backup_storage_bucket_replica)
    
    # Perform database backup
    backup_database "$db_host" "$db_name" "$s3_bucket" "$s3_replica_bucket"
    
    # Cleanup old backups
    cleanup_old_backups "$s3_bucket" "$s3_replica_bucket" "$BACKUP_RETENTION_DAYS"
    
    # Push backup metrics to CloudWatch
    aws cloudwatch put-metric-data \
        --namespace "COREos/Backup" \
        --metric-name "BackupSuccess" \
        --value 1 \
        --timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --dimensions "Environment=production,BackupType=database"
    
    log_message "INFO" "Backup process completed successfully" "{\"backup_id\": \"$BACKUP_ID\"}"
}

# Execute main function
main

exit 0