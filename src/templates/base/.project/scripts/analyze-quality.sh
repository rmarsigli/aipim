#!/bin/bash

# Configuration
PROMPT_FILE=".project/prompts/code-quality-analysis.md"
REPORT_DIR=".project/quality-reports"
NOW=$(date +%Y-%m-%d)
MANUAL_MODE=0

# Arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --manual) MANUAL_MODE=1 ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

# Check if prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: Prompt template not found at $PROMPT_FILE"
    exit 1
fi

# Detect Project Details
PROJECT_NAME=$(basename $(pwd))
FILE_COUNT=$(find . -maxdepth 2 -not -path '*/.*' -type f | wc -l)

# Simple Language Detection
if [ -f "composer.json" ]; then
    LANGUAGE="PHP (Laravel/Symfony)"
elif [ -f "package.json" ]; then
    LANGUAGE="JavaScript/TypeScript (Node.js)"
elif [ -f "go.mod" ]; then
    LANGUAGE="Go"
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    LANGUAGE="Python"
else
    LANGUAGE="Unknown"
fi

# Read and Process Prompt
PROMPT_CONTENT=$(cat "$PROMPT_FILE")
PROMPT_CONTENT="${PROMPT_CONTENT//\{PROJECT_NAME\}/$PROJECT_NAME}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{DETECTED_LANGUAGE\}/$LANGUAGE}"
PROMPT_CONTENT="${PROMPT_CONTENT//\{FILE_COUNT\}/$FILE_COUNT}"

# Execution
echo "========================================"
echo "      CODE QUALITY ANALYZER"
echo "========================================"
echo "Project:  $PROJECT_NAME"
echo "Language: $LANGUAGE"
echo "Files:    $FILE_COUNT"
echo "========================================"
echo ""

if [ "$MANUAL_MODE" -eq 1 ]; then
    echo "--- COPY THE TEXT BELOW ---"
    echo ""
    echo "$PROMPT_CONTENT"
    echo ""
    echo "---------------------------"
    echo "Instructions:"
    echo "1. Copy the prompt above."
    echo "2. Paste it into Claude/GPT-4."
    echo "3. Save the response to: $REPORT_DIR/$NOW.md"
else
    # Future: Call API here
    echo "Use --manual to print the prompt for manual usage."
    # echo "$PROMPT_CONTENT" | xclip -selection clipboard (Optional)
fi
