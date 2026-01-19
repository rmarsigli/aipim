#!/bin/bash
# task-velocity.sh
# Calculates task velocity and predicts completion based on Progress Log in current-task.md

TASK_FILE=".project/current-task.md"

if [ ! -f "$TASK_FILE" ]; then
    echo "Error: $TASK_FILE not found."
    exit 1
fi

echo "📊 Task Velocity Analysis"
echo "---------------------------"

# 1. Total Scope
TOTAL_BOXES=$(grep -c "\- \[ \]" "$TASK_FILE")
COMPLETED_BOXES=$(grep -c "\- \[x\]" "$TASK_FILE")
ALL_BOXES=$((TOTAL_BOXES + COMPLETED_BOXES))
echo "Task Scope: ${COMPLETED_BOXES}/${ALL_BOXES} items completed ($(( 100 * COMPLETED_BOXES / ALL_BOXES ))%)"
echo ""

# 2. Daily Velocity Analysis
echo "Daily Progress:"

# We need to parse the Progress Log section
# Format expected:
# ### YYYY-MM-DD (Xh)
# **Velocity:** Y items/h

# Extract lines starting with ### Date and **Velocity**
# We'll use a temp file to process
grep -E "^### [0-9]{4}-[0-9]{2}-[0-9]{2}|^\*\*Velocity:\*\*" "$TASK_FILE" > /tmp/velocity_data

PREV_VELOCITY=0
COUNT=0
TOTAL_VELOCITY=0

while read -r line; do
    if [[ "$line" =~ ^###\ ([0-9]{4}-[0-9]{2}-[0-9]{2})\ \(([0-9.]+)h\) ]]; then
        DATE="${BASH_REMATCH[1]}"
        HOURS="${BASH_REMATCH[2]}"
    elif [[ "$line" =~ \*\*Velocity:\*\*\ ([0-9.]+)\ items/h ]]; then
        VELOCITY="${BASH_REMATCH[1]}"
        
        # Calculate trend
        TREND=""
        if (( $(echo "$PREV_VELOCITY > 0" | bc -l) )); then
             DIFF=$(echo "$VELOCITY - $PREV_VELOCITY" | bc -l)
             if (( $(echo "$DIFF > 0.5" | bc -l) )); then
                TREND="↗️ Speeding Up"
             elif (( $(echo "$DIFF < -0.5" | bc -l) )); then
                TREND="↘️ Slowing Down"
             else
                TREND="→ Stable"
             fi
        fi
        
        echo "  $DATE: $HOURS h | Velocity: $VELOCITY items/h $TREND"
        
        PREV_VELOCITY=$VELOCITY
        TOTAL_VELOCITY=$(echo "$TOTAL_VELOCITY + $VELOCITY" | bc -l)
        COUNT=$((COUNT + 1))
    fi
done < /tmp/velocity_data

echo ""

# 3. Projection
if [ "$COUNT" -gt 0 ]; then
    AVG_VELOCITY=$(echo "$TOTAL_VELOCITY / $COUNT" | bc -l)
    REMAINING_ITEMS=$((ALL_BOXES - COMPLETED_BOXES))
    
    if (( $(echo "$AVG_VELOCITY > 0" | bc -l) )); then
        EST_HOURS=$(echo "$REMAINING_ITEMS / $AVG_VELOCITY" | bc -l)
        printf "Average Velocity: %.2f items/h\n" "$AVG_VELOCITY"
        printf "Remaining Items: %d\n" "$REMAINING_ITEMS"
        printf "Projected Time to Complete: %.1f hours\n" "$EST_HOURS"
    else
        echo "Velocity is 0. Cannot project completion."
    fi
else
    echo "No Progress Log entries found yet."
fi

rm /tmp/velocity_data
