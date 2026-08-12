#!/bin/bash
# 每日数据库备份：dump → gzip → 上传 OSS → 清理本地旧文件
#
# 安装到 crontab（每天凌晨 3 点）：
#   0 3 * * * cd /opt/jewelry && ./scripts/backup-db.sh >> /var/log/jewelry-backup.log 2>&1
#
# 依赖：ossutil 已配置好凭据（ossutil config）
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-/var/backups/jewelry}
RETAIN_DAYS=${RETAIN_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/jewelry-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# 通过 compose 在 db 容器内执行，无需宿主机安装 postgresql-client
docker compose exec -T db pg_dump -U postgres -d jewelry \
  --no-owner --no-privileges --clean --if-exists \
  | gzip > "$FILE"

# dump 失败时 gzip 仍会产出一个极小的文件，用大小做一次基本校验
if [ "$(stat -c%s "$FILE")" -lt 1024 ]; then
  echo "备份文件异常小（$(stat -c%s "$FILE") 字节），判定为失败：$FILE" >&2
  exit 1
fi

if [ -n "${OSS_BACKUP_PATH:-}" ]; then
  ossutil cp "$FILE" "$OSS_BACKUP_PATH/" >/dev/null
  echo "已上传 $OSS_BACKUP_PATH/$(basename "$FILE")"
fi

find "$BACKUP_DIR" -name 'jewelry-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete

echo "备份完成：$FILE ($(du -h "$FILE" | cut -f1))"
