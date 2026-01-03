#!/bin/bash
# Setup automated backups via cron

CRON_FILE="/tmp/agentx-backup-cron"

cat > "$CRON_FILE" <<EOF
# AgentX Automated Backups

# MongoDB backup - Daily at 2 AM
0 2 * * * cd /home/yb/codes/AgentX && ./scripts/backup-mongodb.sh >> /var/log/agentx-backup.log 2>&1

# Qdrant backup - Daily at 3 AM
0 3 * * * cd /home/yb/codes/AgentX && ./scripts/backup-qdrant.sh >> /var/log/agentx-backup.log 2>&1

# Workflow git commit - Every 6 hours
0 */6 * * * cd /home/yb/codes/AgentX && ./scripts/commit-workflows.sh >> /var/log/agentx-backup.log 2>&1
EOF

crontab "$CRON_FILE"
rm "$CRON_FILE"

echo "✅ Backup cron jobs installed"
echo "View with: crontab -l"
