#!/bin/bash
# pain-to-tasks.sh
# usage: .project/scripts/pain-to-tasks.sh

TASK_FILE=".project/current-task.md"
BACKLOG_DIR=".project/backlog"
COUNTER=$(date +%s) # Using timestamp to avoid collision

echo "Scanning $TASK_FILE for pain points..."

if [ ! -f "$TASK_FILE" ]; then
    echo "Error: $TASK_FILE not found."
    exit 1
fi

# Extract pain points: lines starting with "- [ ]" inside the Pain Points section
# We process line by line.
IN_PAIN_SECTION=0
PAIN_CATEGORY="Unknown"

while IFS= read -r line; do
    if [[ "$line" =~ ^##\ Pain\ Points ]]; then
        IN_PAIN_SECTION=1
        continue
    fi

    # Optional: Exit scanning if next main section starts
    if [[ $IN_PAIN_SECTION -eq 1 && "$line" =~ ^##\  ]]; then
        IN_PAIN_SECTION=0
    fi

    if [[ $IN_PAIN_SECTION -eq 1 ]]; then
        # Detect category
        if [[ "$line" =~ ^###\ Category:\ (.*) ]]; then
            PAIN_CATEGORY="${BASH_REMATCH[1]}"
        fi

        # Detect pain item
        if [[ "$line" =~ ^-\ \[\ \]\ (.*) ]]; then
            DESCRIPTION="${BASH_REMATCH[1]}"
            
            # Read next 3 lines for metadata (Impact, Frequency)
            # This is a simple approximation. For robust parsing, we might need a better parser.
            # But relying on the template format is usually "good enough" for this context.
            
            # Generate Task ID
            TASK_ID="PAIN-${COUNTER}"
            COUNTER=$((COUNTER + 1))
            
            # Default Priority
            PRIORITY="P3"
            
            # Extract basic slug
            SLUG=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-30)
            
            FILENAME="${BACKLOG_DIR}/${TASK_ID}-${SLUG}.md"
            
            echo "converts: '$DESCRIPTION' -> $FILENAME"

            cat > "$FILENAME" <<EOF
---
title: "Fix: ${DESCRIPTION}"
priority: P3
tags: [pain-point, ${PAIN_CATEGORY,,}]
---

# Pain Point

**Source:** Discovered in \`current-task.md\` under Category: ${PAIN_CATEGORY}

## Description
${DESCRIPTION}

## Action
Refine this task, determine root cause, and implement fix.
EOF
            
            # Mark as processed in current-task (rudimentary)
            # sed -i "s/- \[ \] $DESCRIPTION/- [x] $DESCRIPTION (Task Created: $TASK_ID)/" "$TASK_FILE"
        fi
    fi
done < "$TASK_FILE"

echo "Done."
