#!/bin/bash

# Definition of Done Validation Script
# Checks code quality before completing tasks
# Usage: ./.project/scripts/validate-dod.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Symbols
CHECK="✅"
CROSS="❌"
WARNING="⚠️"

echo -e "${BLUE}🔍 Validating Definition of Done...${NC}\n"

ERRORS=0
WARNINGS=0

# ============================================================================
# FUNCTIONALITY CHECKS
# ============================================================================

echo -e "${BLUE}📋 Functionality Checks${NC}"

# Check for debug statements (PHP/Laravel)
if [ -d "app" ] || [ -d "resources" ]; then
    echo -n "  Checking for PHP debug statements... "
    DEBUG_COUNT=$(grep -r "dd(\\|dump(\\|var_dump(\\|print_r(" app/ resources/ --exclude-dir=vendor 2>/dev/null | grep -v "//" | grep -v "^\s*\*" | wc -l || echo 0)
    if [ "$DEBUG_COUNT" -gt 0 ]; then
        echo -e "${RED}${CROSS} Found ${DEBUG_COUNT} debug statements${NC}"
        grep -r "dd(\\|dump(\\|var_dump(\\|print_r(" app/ resources/ --exclude-dir=vendor 2>/dev/null | grep -v "//" | grep -v "^\s*\*" | head -5
        echo "    Remove before completion"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}${CHECK} No debug statements${NC}"
    fi
fi

# Check for console.log in JavaScript
if [ -d "resources/js" ] || [ -d "src" ]; then
    echo -n "  Checking for console.log... "
    CONSOLE_COUNT=$(find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | xargs grep -l "console\\.log\\|console\\.debug" 2>/dev/null | grep -v node_modules | wc -l || echo 0)
    if [ "$CONSOLE_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}${WARNING} Found console.log in ${CONSOLE_COUNT} files${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} No console.log statements${NC}"
    fi
fi

# Check for TODO/FIXME comments
echo -n "  Checking for TODO/FIXME... "
TODO_COUNT=$(grep -r "TODO\\|FIXME" app/ resources/ src/ --exclude-dir=vendor --exclude-dir=node_modules 2>/dev/null | wc -l || echo 0)
if [ "$TODO_COUNT" -gt 5 ]; then
    echo -e "${YELLOW}${WARNING} Found ${TODO_COUNT} TODO/FIXME comments${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}${CHECK} TODO count acceptable${NC}"
fi

echo ""

# ============================================================================
# TESTING CHECKS
# ============================================================================

echo -e "${BLUE}🧪 Testing Checks${NC}"

# Check if tests exist
echo -n "  Checking for test files... "
TEST_COUNT=$(find . -name "*Test.php" -o -name "*.test.js" -o -name "*.spec.js" -o -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | grep -v node_modules | wc -l || echo 0)
if [ "$TEST_COUNT" -eq 0 ]; then
    echo -e "${RED}${CROSS} No test files found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}${CHECK} Found ${TEST_COUNT} test files${NC}"
fi

# Run tests (Laravel)
if [ -f "artisan" ] && command -v php &> /dev/null; then
    echo "  Running PHP tests..."
    if php artisan test --stop-on-failure > /dev/null 2>&1; then
        echo -e "${GREEN}${CHECK} All PHP tests passing${NC}"
    else
        echo -e "${RED}${CROSS} PHP tests failed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Run tests (Node/Jest/Vitest)
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    if grep -q "\"test\":" package.json; then
        echo "  Running JS tests..."
        if npm test > /dev/null 2>&1; then
            echo -e "${GREEN}${CHECK} All JS tests passing${NC}"
        else
            echo -e "${RED}${CROSS} JS tests failed${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

echo ""

# ============================================================================
# PERFORMANCE CHECKS
# ============================================================================

echo -e "${BLUE}⚡ Performance Checks${NC}"

# Check for N+1 query patterns (Laravel)
if [ -d "app" ]; then
    echo -n "  Checking for potential N+1 queries... "
    N_PLUS_ONE=$(grep -r "foreach.*->get()\|foreach.*->all()" app/ --exclude-dir=vendor 2>/dev/null | grep -v "->with(" | wc -l || echo 0)
    if [ "$N_PLUS_ONE" -gt 0 ]; then
        echo -e "${YELLOW}${WARNING} Found ${N_PLUS_ONE} potential N+1 patterns${NC}"
        grep -r "foreach.*->get()\|foreach.*->all()" app/ --exclude-dir=vendor 2>/dev/null | grep -v "->with(" | head -3
        echo "    Consider using eager loading: ->with(['relation'])"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} No obvious N+1 patterns${NC}"
    fi
fi

# Check for missing indexes on migrations
if [ -d "database/migrations" ]; then
    echo -n "  Checking migrations for indexes... "
    FOREIGN_KEYS=$(grep -r "->foreign(" database/migrations/ 2>/dev/null | wc -l || echo 0)
    INDEXES=$(grep -r "->index()" database/migrations/ 2>/dev/null | wc -l || echo 0)
    
    if [ "$FOREIGN_KEYS" -gt 0 ] && [ "$INDEXES" -lt "$FOREIGN_KEYS" ]; then
        echo -e "${YELLOW}${WARNING} Possible missing indexes (FKs: ${FOREIGN_KEYS}, Indexes: ${INDEXES})${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} Index coverage looks good${NC}"
    fi
fi

echo ""

# ============================================================================
# SECURITY CHECKS
# ============================================================================

echo -e "${BLUE}🔒 Security Checks${NC}"

# Check for mass assignment vulnerabilities (Laravel)
if [ -d "app/Models" ]; then
    echo -n "  Checking models for mass assignment protection... "
    MODELS_WITHOUT_PROTECTION=$(find app/Models -name "*.php" -exec grep -L "protected \$fillable\|protected \$guarded" {} \; 2>/dev/null | wc -l || echo 0)
    if [ "$MODELS_WITHOUT_PROTECTION" -gt 0 ]; then
        echo -e "${RED}${CROSS} Found ${MODELS_WITHOUT_PROTECTION} models without protection${NC}"
        find app/Models -name "*.php" -exec grep -L "protected \$fillable\|protected \$guarded" {} \; 2>/dev/null | head -3
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}${CHECK} All models protected${NC}"
    fi
fi

# Check for raw SQL queries
if [ -d "app" ]; then
    echo -n "  Checking for raw SQL queries... "
    RAW_QUERIES=$(grep -r "DB::raw\\|->raw(" app/ --exclude-dir=vendor 2>/dev/null | wc -l || echo 0)
    if [ "$RAW_QUERIES" -gt 0 ]; then
        echo -e "${YELLOW}${WARNING} Found ${RAW_QUERIES} raw SQL queries${NC}"
        echo "    Ensure parameter binding is used"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} No raw SQL queries${NC}"
    fi
fi

# Check for secrets in .env.example
echo -n "  Checking .env.example for secrets... "
if [ -f ".env.example" ]; then
    SECRETS=$(grep -E "PASSWORD=.+|SECRET=.+|KEY=.+" .env.example 2>/dev/null | grep -v "=null" | grep -v "=$" | wc -l || echo 0)
    if [ "$SECRETS" -gt 0 ]; then
        echo -e "${RED}${CROSS} Found secrets in .env.example${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}${CHECK} No secrets in .env.example${NC}"
    fi
else
    echo -e "${YELLOW}${WARNING} No .env.example file${NC}"
fi

echo ""

# ============================================================================
# CODE QUALITY CHECKS
# ============================================================================

echo -e "${BLUE}📝 Code Quality Checks${NC}"

# Check for proper namespacing (PHP)
if [ -d "app" ]; then
    echo -n "  Checking PHP namespaces... "
    FILES_WITHOUT_NAMESPACE=$(find app/ -name "*.php" -exec grep -L "^namespace " {} \; 2>/dev/null | wc -l || echo 0)
    if [ "$FILES_WITHOUT_NAMESPACE" -gt 0 ]; then
        echo -e "${YELLOW}${WARNING} Found ${FILES_WITHOUT_NAMESPACE} files without namespace${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} All PHP files have namespaces${NC}"
    fi
fi

# Check for large files
echo -n "  Checking for large files... "
LARGE_FILES=$(find . -name "*.php" -o -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | awk '$1 > 500 {print}' | grep -v node_modules | grep -v vendor | wc -l || echo 0)
if [ "$LARGE_FILES" -gt 0 ]; then
    echo -e "${YELLOW}${WARNING} Found ${LARGE_FILES} files >500 lines${NC}"
    echo "    Consider breaking down large files"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}${CHECK} No excessively large files${NC}"
fi

echo ""

# ============================================================================
# DOCUMENTATION CHECKS
# ============================================================================

echo -e "${BLUE}📚 Documentation Checks${NC}"

# Check if current-task.md exists and is updated
echo -n "  Checking current task file... "
if [ -f ".project/current-task.md" ]; then
    if grep -q "actual_hours: 0" .project/current-task.md 2>/dev/null; then
        echo -e "${YELLOW}${WARNING} Task file not updated with actual time${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} Task file updated${NC}"
    fi
elif [ -d ".project/current-task" ]; then
    echo -e "${GREEN}${CHECK} Task directory exists${NC}"
else
    echo -e "${YELLOW}${WARNING} No current-task.md found${NC}"
fi

# Check if README exists
echo -n "  Checking README.md... "
if [ ! -f "README.md" ]; then
    echo -e "${YELLOW}${WARNING} No README.md found${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    LINES=$(wc -l < README.md)
    if [ "$LINES" -lt 10 ]; then
        echo -e "${YELLOW}${WARNING} README too short (${LINES} lines)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} README exists${NC}"
    fi
fi

echo ""

# ============================================================================
# GIT CHECKS
# ============================================================================

echo -e "${BLUE}📦 Git Checks${NC}"

if command -v git &> /dev/null && [ -d ".git" ]; then
    # Check for uncommitted changes
    echo -n "  Checking for uncommitted changes... "
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}${WARNING} Uncommitted changes detected${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}${CHECK} All changes committed${NC}"
    fi
    
    # Check commit message format
    echo -n "  Checking last commit message... "
    LAST_COMMIT=$(git log -1 --pretty=%B 2>/dev/null || echo "")
    if [ -n "$LAST_COMMIT" ]; then
        if echo "$LAST_COMMIT" | grep -qE "^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:"; then
            echo -e "${GREEN}${CHECK} Follows convention${NC}"
        else
            echo -e "${YELLOW}${WARNING} Doesn't follow convention${NC}"
            echo "    Use: type(scope): description"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
else
    echo "  Not a git repository"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Validation Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}${CHECK} All checks passed! Ready to complete task.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Update current-task.md with actual time"
    echo "  2. Update context.md with session summary"
    echo "  3. Move current-task.md to completed/"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}${WARNING} ${WARNINGS} warnings found${NC}"
    echo "Task can be completed but consider addressing warnings."
    exit 0
else
    echo -e "${RED}${CROSS} ${ERRORS} errors and ${WARNINGS} warnings found${NC}"
    echo ""
    echo "Please fix errors before completing the task."
    exit 1
fi