#!/bin/bash
# Database backup script — run via cron: 0 2 * * * /app/scripts/backup-db.sh
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
FILENAME="collabos_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup: $FILENAME"

pg_dump "$DATABASE_URL" \
  --no-password \
  --format=custom \
  --compress=9 \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup created: ${BACKUP_DIR}/${FILENAME} ($(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Upload to S3-compatible storage
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${S3_BACKUP_BUCKET}/db-backups/${FILENAME}" \
    --endpoint-url "${S3_ENDPOINT:-}" \
    --region "${S3_REGION:-auto}"
  echo "[$(date)] Backup uploaded to S3: ${S3_BACKUP_BUCKET}/db-backups/${FILENAME}"
fi

# Remove old local backups
find "$BACKUP_DIR" -name "collabos_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION_DAYS} days"

echo "[$(date)] Backup complete"
