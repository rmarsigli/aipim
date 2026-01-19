#!/bin/bash

# Configuration
BACKLOG_DIR=".project/backlog"
ARCHIVE_DIR=".project/backlog/archived"
NOW=$(date +%s)
STALE_DAYS=28
BLOCKED_DAYS=14

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Metrics
total_tasks=0
stale_tasks=0
blocked_tasks=0
healthy_tasks=0

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}       BACKLOG HEALTH REPORT            ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if backlog directory exists
if [ ! -d "$BACKLOG_DIR" ]; then
    echo -e "${RED}Error: Backlog directory not found at $BACKLOG_DIR${NC}"
    exit 1
fi

# Iterate through tasks
for task in "$BACKLOG_DIR"/*.md; do
    [ -e "$task" ] || continue
    
    total_tasks=$((total_tasks + 1))
    filename=$(basename "$task")
    
    # Extract metadata
    created=$(grep -oP 'created: \K.*' "$task" | head -1 | tr -d '"')
    updated=$(grep -oP 'last_updated: \K.*' "$task" | head -1 | tr -d '"')
    status=$(grep -oP 'status: \K.*' "$task" | head -1)
    
    # Parse dates (handle different formats if needed, assuming ISO 8601 subset)
    # Using 'date -d' which works on GNU date (Linux). macOS users might need 'gdate' or different formatting.
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # BSD date (macOS)
        updated_ts=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$updated" +%s 2>/dev/null)
        if [ -z "$updated_ts" ]; then
            updated_ts=$(date -j -f "%Y-%m-%d" "$updated" +%s 2>/dev/null)
        fi
    else
        # GNU date (Linux)
        updated_ts=$(date -d "$updated" +%s 2>/dev/null)
    fi
    
    # Fallback to file mtime if parsing fails
    if [ -z "$updated_ts" ]; then
         if [[ "$OSTYPE" == "darwin"* ]]; then
            updated_ts=$(stat -f %m "$task")
         else
            updated_ts=$(stat -c %Y "$task")
         fi
    fi
    
    age_days=$(( (NOW - updated_ts) / 86400 ))
    
    # Analysis
    is_stale=0
    is_blocked=0
    
    if [ "$status" == "blocked" ]; then
        # For blocked tasks, check how long they've been updated (proxy for blocked duration)
        if (( age_days > BLOCKED_DAYS )); then
            is_blocked=1
            blocked_tasks=$((blocked_tasks + 1))
            echo -e "${RED}[BLOCKED]${NC} $filename (Blocked for ${age_days} days)"
        fi
    elif (( age_days > STALE_DAYS )); then
        is_stale=1
        stale_tasks=$((stale_tasks + 1))
        echo -e "${YELLOW}[STALE]${NC}   $filename (No update for ${age_days} days)"
    else
        healthy_tasks=$((healthy_tasks + 1))
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}               SUMMARY                  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Total Tasks: $total_tasks"
echo -e "Healthy:     ${GREEN}$healthy_tasks${NC}"
echo -e "Stale:       ${YELLOW}$stale_tasks${NC} (> $STALE_DAYS days)"
echo -e "Blocked:     ${RED}$blocked_tasks${NC} (> $BLOCKED_DAYS days inactive)"
echo ""

# Recommendations
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           RECOMMENDATIONS              ${NC}"
echo -e "${BLUE}========================================${NC}"

if (( stale_tasks > 0 )); then
    echo -e "1. ${YELLOW}Archive stale tasks:${NC}"
    echo "   mkdir -p $ARCHIVE_DIR"
    echo "   mv .project/backlog/TXXX-name.md $ARCHIVE_DIR/"
fi

if (( blocked_tasks > 0 )); then
    echo -e "2. ${RED}Unblock critical items:${NC}"
    echo "   Review blocked tasks and either resolve blocker or move to icebox."
fi

if (( stale_tasks == 0 && blocked_tasks == 0 )); then
    echo -e "${GREEN}Backlog is healthy! Great job.${NC}"
fi

echo ""
