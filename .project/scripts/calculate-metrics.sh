#!/bin/bash
#
# calculate-metrics.sh
# Calculate productivity and quality metrics from completed tasks
#
# Usage:
#   ./calculate-metrics.sh                  # Show summary report
#   ./calculate-metrics.sh --format=markdown  # Output markdown for context.md
#   ./calculate-metrics.sh --period=week    # Calculate for current week only
#   ./calculate-metrics.sh --period=month   # Calculate for current month only
#

# Disabled strict mode - debug shows it causes exit 1 in WSL environment
# set -euo pipefail

# Configuration
COMPLETED_DIR="${COMPLETED_DIR:-.project/completed}"
CURRENT_TASK="${CURRENT_TASK:-.project/current-task.md}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FORMAT="summary"
PERIOD="all"
for arg in "$@"; do
    case $arg in
        --format=*)
            FORMAT="${arg#*=}"
            ;;
        --period=*)
            PERIOD="${arg#*=}"
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --format=summary|markdown   Output format (default: summary)"
            echo "  --period=all|week|month     Time period (default: all)"
            echo "  --help                      Show this help"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

# Utility: Extract YAML field from markdown file
extract_field() {
    local file="$1"
    local field="$2"
    local value
    value=$(grep -oP "^${field}: \K.*" "$file" 2>/dev/null || echo "0")
    # Remove quotes if present
    value="${value//\"/}"
    echo "$value"
}

# Utility: Get date range for period
get_date_range() {
    local period="$1"
    case $period in
        week)
            # Last 7 days
            date -d "7 days ago" +%Y-%m-%d
            ;;
        month)
            # Last 30 days
            date -d "30 days ago" +%Y-%m-%d
            ;;
        *)
            # All time
            echo "1970-01-01"
            ;;
    esac
}

# Check if completed directory exists
if [[ ! -d "$COMPLETED_DIR" ]]; then
    echo -e "${YELLOW}No completed tasks found at: $COMPLETED_DIR${NC}"
    exit 0
fi

# Initialize metrics
total_estimated="0"
total_actual="0"
task_count=0
blocker_count=0
declare -A blocker_types
tasks_this_week=0
tasks_this_month=0

# Date cutoffs
cutoff_date=$(get_date_range "$PERIOD")
week_cutoff=$(date -d "7 days ago" +%Y-%m-%d)
month_cutoff=$(date -d "30 days ago" +%Y-%m-%d)

# Process completed tasks
for task_file in "$COMPLETED_DIR"/*.md; do
    [[ ! -f "$task_file" ]] && continue

    # Extract metrics from frontmatter
    estimated=$(extract_field "$task_file" "estimated_hours")
    actual=$(extract_field "$task_file" "actual_hours")
    created=$(extract_field "$task_file" "created" | cut -d'T' -f1)

    # Skip if no actual hours (task not completed properly)
    if [[ "$actual" == "0" || "$actual" == "0.0" ]]; then
        continue
    fi

    # Apply date filter
    if [[ "$created" < "$cutoff_date" ]]; then
        continue
    fi

    # Accumulate totals (using bc for decimal support)
    total_estimated=$(echo "$total_estimated + $estimated" | bc)
    total_actual=$(echo "$total_actual + $actual" | bc)
    ((task_count++))

    # Count tasks this week/month
    if [[ "$created" > "$week_cutoff" ]]; then
        ((tasks_this_week++))
    fi
    if [[ "$created" > "$month_cutoff" ]]; then
        ((tasks_this_month++))
    fi

    # Parse blockers
    blocker_line=$(grep -oP "^blockers: \K.*" "$task_file" 2>/dev/null || echo "[]")
    if [[ "$blocker_line" != "[]" && "$blocker_line" != "" ]]; then
        ((blocker_count++))
        # Extract blocker type (simple heuristic: first word)
        blocker_type=$(echo "$blocker_line" | grep -oP '\w+' | head -n1 || echo "Other")
        blocker_types["$blocker_type"]=$((${blocker_types["$blocker_type"]:-0} + 1))
    fi
done

# Calculate derived metrics
estimate_accuracy="0.00"
avg_task_size="0.0"
if [[ $task_count -gt 0 ]]; then
    # Use bc for decimal comparison
    if [[ $(echo "$total_estimated > 0" | bc) -eq 1 ]]; then
        estimate_accuracy=$(echo "scale=2; $total_actual / $total_estimated" | bc)
    fi
    avg_task_size=$(echo "scale=1; $total_actual / $task_count" | bc)
fi

# Find most common blocker type
most_common_blocker="None"
max_blocker_count=0
for blocker_type in "${!blocker_types[@]}"; do
    count=${blocker_types[$blocker_type]}
    if [[ $count -gt $max_blocker_count ]]; then
        max_blocker_count=$count
        most_common_blocker="$blocker_type"
    fi
done

# Check active blockers in current task
active_blockers=0
if [[ -f "$CURRENT_TASK" ]]; then
    current_blocker=$(grep -oP "^blockers: \K.*" "$CURRENT_TASK" 2>/dev/null || echo "[]")
    if [[ "$current_blocker" != "[]" && "$current_blocker" != "" ]]; then
        active_blockers=1
    fi
fi

# Output based on format
if [[ "$FORMAT" == "markdown" ]]; then
    # Markdown format for context.md
    echo "## Metrics"
    echo ""
    echo "<!-- Auto-updated: $(date -Iseconds) -->"
    echo ""
    echo "**Productivity:**"
    echo "- Tasks completed this week: $tasks_this_week"
    echo "- Tasks completed this month: $tasks_this_month"
    echo "- Estimate accuracy: $estimate_accuracy (actual/estimated avg)"
    echo "- Velocity trend: → Stable <!-- Update manually by comparing weeks -->"
    echo ""
    echo "**Quality:**"
    echo "- Test coverage: N/A <!-- Update from coverage reports -->"
    echo "- Bugs reported this week: 0 <!-- Track manually -->"
    echo "- Bugs reported this month: 0 <!-- Track manually -->"
    echo "- Code quality warnings: 0 <!-- Update from linter -->"
    echo ""
    echo "**Time Distribution:**"
    echo "- Development: 60% <!-- Track from task phase breakdowns -->"
    echo "- Testing: 20%"
    echo "- Documentation: 10%"
    echo "- Debugging: 10%"
    echo ""
    echo "**Blockers:**"
    echo "- Most common type: $most_common_blocker ($max_blocker_count occurrences)"
    echo "- Average resolution time: N/A <!-- Calculate from blocker timestamps -->"
    echo "- Active blockers: $active_blockers"
    echo ""
    echo "**Trends (Last 30 Days):**"
    echo "- Tasks completed: $tasks_this_month"
    echo "- Average task size: ${avg_task_size}h"
    echo "- Rework rate: N/A <!-- Track tasks requiring fixes -->"
else
    # Summary format (human-readable)
    echo -e "${BLUE}=== AIPIM Metrics Report ===${NC}"
    echo -e "${GREEN}Period: $PERIOD${NC}"
    echo ""
    echo -e "${YELLOW}Productivity:${NC}"
    echo "  Tasks completed (total): $task_count"
    echo "  Tasks this week: $tasks_this_week"
    echo "  Tasks this month: $tasks_this_month"
    echo "  Total estimated hours: $total_estimated"
    echo "  Total actual hours: $total_actual"
    echo "  Estimate accuracy: $estimate_accuracy (1.0 = perfect, >1.0 = over, <1.0 = under)"
    echo "  Average task size: ${avg_task_size}h"
    echo ""
    echo -e "${YELLOW}Blockers:${NC}"
    echo "  Total tasks with blockers: $blocker_count"
    echo "  Most common type: $most_common_blocker ($max_blocker_count occurrences)"
    echo "  Active blockers: $active_blockers"
    echo ""
    echo -e "${BLUE}Tip: Use --format=markdown to copy into context.md${NC}"
fi
