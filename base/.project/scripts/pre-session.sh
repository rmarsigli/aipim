#!/bin/bash

# Pre-session Check Script
# Estimates token usage and identifies optimization opportunities
# Usage: ./.project/scripts/pre-session.sh

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Pre-Session Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# 1. CONTEXT FILE SIZE
# ============================================================================

if [ -f ".project/context.md" ]; then
    CONTEXT_LINES=$(wc -l < .project/context.md)
    CONTEXT_WORDS=$(wc -w < .project/context.md)
    CONTEXT_TOKENS=$(echo "$CONTEXT_WORDS * 1.3" | bc | cut -d. -f1)
    
    if [ $CONTEXT_LINES -gt 200 ]; then
        echo -e "${YELLOW}⚠️  context.md: ${CONTEXT_LINES} lines (target: <200)${NC}"
        echo "   Consider archiving old sessions:"
        echo "   ${BLUE}mkdir -p .project/context-archive/${NC}"
        echo "   ${BLUE}mv .project/context.md .project/context-archive/\$(date +%Y-%m).md${NC}"
        echo ""
    else
        echo -e "${GREEN}✓${NC} context.md: ${CONTEXT_LINES} lines (good)"
    fi
else
    echo -e "${RED}✗${NC} context.md not found"
    CONTEXT_TOKENS=0
fi

# ============================================================================
# 2. TOKEN ESTIMATION
# ============================================================================

echo ""
echo -e "${BLUE}📊 Token Estimation${NC}"
echo ""

# System prompt
if [ -f "CLAUDE.md" ]; then
    PROMPT_WORDS=$(wc -w < CLAUDE.md)
    PROMPT_TOKENS=$(echo "$PROMPT_WORDS * 1.3" | bc | cut -d. -f1)
    echo "   System prompt:    ~${PROMPT_TOKENS} tokens"
elif [ -f "CLAUDE-compact.md" ]; then
    PROMPT_WORDS=$(wc -w < CLAUDE-compact.md)
    PROMPT_TOKENS=$(echo "$PROMPT_WORDS * 1.3" | bc | cut -d. -f1)
    echo "   System prompt:    ~${PROMPT_TOKENS} tokens"
else
    PROMPT_TOKENS=0
    echo "   System prompt:    not found"
fi

# Context
echo "   Context file:     ~${CONTEXT_TOKENS} tokens"

# Task
if [ -f ".project/current-task.md" ]; then
    TASK_WORDS=$(wc -w < .project/current-task.md)
    TASK_TOKENS=$(echo "$TASK_WORDS * 1.3" | bc | cut -d. -f1)
    echo "   Task file:        ~${TASK_TOKENS} tokens"
elif [ -d ".project/current-task" ]; then
    TASK_WORDS=$(find .project/current-task -name "*.md" -exec cat {} \; | wc -w)
    TASK_TOKENS=$(echo "$TASK_WORDS * 1.3" | bc | cut -d. -f1)
    echo "   Task directory:   ~${TASK_TOKENS} tokens"
else
    TASK_TOKENS=0
    echo "   Task file:        not found"
fi

# Calculate base
BASE_TOKENS=$((PROMPT_TOKENS + CONTEXT_TOKENS + TASK_TOKENS))
echo "   ─────────────────────────────"
echo "   Base total:       ~${BASE_TOKENS} tokens"
echo ""
echo "   Typical session adds:"
echo "   + Code context:   ~15,000 tokens"
echo "   + Conversation:   ~30,000 tokens"
echo "   ─────────────────────────────"
ESTIMATED_TOTAL=$((BASE_TOKENS + 45000))
echo "   Estimated total:  ~${ESTIMATED_TOTAL} tokens"
echo ""

# Budget warning
if [ $ESTIMATED_TOTAL -gt 150000 ]; then
    echo -e "${RED}⚠️  High token usage expected (>150k)${NC}"
    echo "   Consider optimizing before session"
elif [ $ESTIMATED_TOTAL -gt 100000 ]; then
    echo -e "${YELLOW}⚠️  Moderate token usage (100-150k)${NC}"
else
    echo -e "${GREEN}✓${NC} Token usage looks good (<100k)"
fi

# ============================================================================
# 3. GIT STATUS
# ============================================================================

echo ""
echo -e "${BLUE}📦 Git Status${NC}"
echo ""

if [ -d ".git" ]; then
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️  Uncommitted changes detected${NC}"
        echo ""
        git status --short | head -10
        if [ $(git status --porcelain | wc -l) -gt 10 ]; then
            echo "   ... and $(($(git status --porcelain | wc -l) - 10)) more files"
        fi
        echo ""
        echo "   Consider committing before session"
    else
        echo -e "${GREEN}✓${NC} Working tree clean"
    fi
    
    # Current branch
    BRANCH=$(git branch --show-current)
    echo "   Current branch: ${BRANCH}"
else
    echo "   Not a git repository"
fi

# ============================================================================
# 4. LARGE FILES WARNING
# ============================================================================

echo ""
echo -e "${BLUE}📁 Large Files (>50KB)${NC}"
echo ""

LARGE_FILES=$(find . -type f \( -name "*.php" -o -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) \
    -size +50k \
    -not -path "*/vendor/*" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    2>/dev/null | head -5)

if [ -n "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠️  Found large files:${NC}"
    echo ""
    echo "$LARGE_FILES" | while read file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "   ${SIZE}  ${file}"
    done
    echo ""
    echo "   Tip: Use view tool with line ranges instead of loading entire file"
    echo "   Example: view ${file}:1:100"
else
    echo -e "${GREEN}✓${NC} No large files found"
fi

# ============================================================================
# 5. SESSION INFO
# ============================================================================

echo ""
echo -e "${BLUE}📌 Session Info${NC}"
echo ""

if [ -f ".project/context.md" ]; then
    LAST_SESSION=$(grep "^session:" .project/context.md | head -1 | awk '{print $2}')
    NEXT_SESSION=$((LAST_SESSION + 1))
    echo "   Last session:     #${LAST_SESSION}"
    echo "   Next session:     #${NEXT_SESSION}"
    
    # Next action
    NEXT_ACTION=$(grep "next_action:" .project/context.md | head -1 | cut -d'"' -f2)
    if [ -n "$NEXT_ACTION" ]; then
        echo "   Next action:      ${NEXT_ACTION}"
    fi
else
    echo "   Session info:     Not available"
fi

# ============================================================================
# 6. QUICK TIPS
# ============================================================================

echo ""
echo -e "${BLUE}💡 Quick Tips${NC}"
echo ""

# Tip based on context size
if [ $CONTEXT_LINES -gt 200 ]; then
    echo "   • Archive old context sessions to save ~3k tokens"
fi

# Tip based on uncommitted changes
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "   • Commit changes before session for cleaner context"
fi

# Tip based on estimated tokens
if [ $BASE_TOKENS -gt 5000 ]; then
    echo "   • Base tokens are high - consider using CLAUDE-compact.md"
fi

# General tips
echo "   • Load files selectively (max 3-4 at a time)"
echo "   • Use view tool with line ranges for large files"
echo "   • Clear conversation every 5-10 turns to save tokens"

# ============================================================================
# 7. READY CHECK
# ============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ISSUES=0

# Check critical files
[ ! -f ".project/context.md" ] && ISSUES=$((ISSUES + 1))
[ ! -f ".project/current-task.md" ] && [ ! -d ".project/current-task" ] && ISSUES=$((ISSUES + 1))

if [ $ISSUES -eq 0 ] && [ $ESTIMATED_TOTAL -lt 150000 ]; then
    echo -e "${GREEN}✅ Ready to start session${NC}"
    echo ""
    echo "Start with:"
    echo -e "${BLUE}\"Follow session start protocol and continue development\"${NC}"
elif [ $ISSUES -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Ready but token usage is high${NC}"
    echo ""
    echo "Consider optimizing before starting"
else
    echo -e "${YELLOW}⚠️  Missing critical files${NC}"
    echo ""
    echo "Setup required before starting session"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""