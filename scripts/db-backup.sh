#!/usr/bin/env bash
# Database backup script for Velnari
# Usage:
#   ./scripts/db-backup.sh                    # uses env vars
#   DB_HOST=localhost DB_NAME=velnari ./scripts/db-backup.sh
#
# Cron example (daily at 2 AM):
#   0 2 * * * /path/to/velnari-police/scripts/db-backup.sh >> /var/log/velnari-backup.log 2>&1

set -euo pipefail

# Config from env vars (same as .env)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-velnari}"
DB_NAME="${DB_NAME:-velnari_dev}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

# Ensure backup dir exists
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup of ${DB_NAME}@${DB_HOST}:${DB_PORT}..."

# Run pg_dump with compression
PGPASSWORD="${DB_PASS:-}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${BACKUP_DIR}/${FILENAME} (${SIZE})"

# Prune old backups
PRUNED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$PRUNED" -gt 0 ]; then
  echo "[$(date -Iseconds)] Pruned ${PRUNED} backup(s) older than ${RETENTION_DAYS} days"
fi

echo "[$(date -Iseconds)] Done."
