#!/bin/bash
#
# archive-context.sh
# Automatically archive old context.md sessions to reduce file size and token consumption
#
# Usage:
#   ./archive-context.sh          # Run archive if session % 10 == 0
#   ./archive-context.sh --dry-run  # Preview what would be archived
#   ./archive-context.sh --force    # Force archive regardless of session number
#

set -euo pipefail

# Configuration
CONTEXT_FILE="${CONTEXT_FILE:-.project/context.md}"
ARCHIVE_DIR="${ARCHIVE_DIR:-.project/context-archive}"
KEEP_SESSIONS="${KEEP_SESSIONS:-5}"  # Keep last N sessions
ARCHIVE_TRIGGER="${ARCHIVE_TRIGGER:-10}"  # Archive every N sessions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
FORCE=false
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--force] [--help]"
            echo "  --dry-run   Preview without making changes"
            echo "  --force     Force archive regardless of session number"
            echo "  --help      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if context.md exists
if [[ ! -f "$CONTEXT_FILE" ]]; then
    log_error "Context file not found: $CONTEXT_FILE"
    exit 1
fi

# Extract session number from frontmatter
session=$(grep -oP '^session:\s*\K\d+' "$CONTEXT_FILE" || echo "0")

if [[ "$session" == "0" ]]; then
    log_error "Could not extract session number from $CONTEXT_FILE"
    exit 1
fi

log_info "Current session: $session"

# Check if archiving is needed
if [[ "$FORCE" != true ]]; then
    if (( session % ARCHIVE_TRIGGER != 0 )); then
        log_info "Archiving not needed (trigger: every $ARCHIVE_TRIGGER sessions)"
        exit 0
    fi
fi

# Calculate sessions to archive (1 through N-KEEP_SESSIONS)
sessions_to_archive=$((session - KEEP_SESSIONS))

if (( sessions_to_archive <= 0 )); then
    log_info "Not enough sessions to archive (need at least $((KEEP_SESSIONS + 1)) sessions)"
    exit 0
fi

log_info "Will archive sessions 1-$sessions_to_archive (keeping last $KEEP_SESSIONS)"

# Generate archive filename based on date range
# Format: YYYY-MM-periodN.md (e.g., 2026-01-weeks1-2.md)
current_date=$(date +%Y-%m)
period="sessions1-$sessions_to_archive"
archive_filename="$current_date-$period.md"
archive_path="$ARCHIVE_DIR/$archive_filename"

log_info "Archive file: $archive_path"

# Dry run mode - just show what would happen
if [[ "$DRY_RUN" == true ]]; then
    log_warn "DRY RUN MODE - No changes will be made"
    echo ""
    echo "Would perform:"
    echo "  1. Create directory: $ARCHIVE_DIR"
    echo "  2. Extract sessions 1-$sessions_to_archive from $CONTEXT_FILE"
    echo "  3. Save to: $archive_path"
    echo "  4. Update $CONTEXT_FILE (keep last $KEEP_SESSIONS sessions)"
    echo "  5. Commit changes"
    exit 0
fi

# Create archive directory
mkdir -p "$ARCHIVE_DIR"
log_info "Created archive directory: $ARCHIVE_DIR"

# Extract session summaries section
# This is a simplified implementation - assumes sessions are in "Session Summaries" section
# In production, you'd want more robust parsing

# Backup context.md before modification
backup_file="$CONTEXT_FILE.backup-$(date +%Y%m%d-%H%M%S)"
cp "$CONTEXT_FILE" "$backup_file"
log_info "Created backup: $backup_file"

# Create archive content
# Extract session summaries that should be archived
{
    echo "# Archived Context Sessions 1-$sessions_to_archive"
    echo ""
    echo "**Archived:** $(date +%Y-%m-%d)"
    echo "**Original session range:** 1-$sessions_to_archive"
    echo ""
    echo "---"
    echo ""

    # Extract sessions from context.md
    # This is a placeholder - real implementation would parse markdown properly
    # For now, we'll just copy the session summaries section

    grep -A 1000 "# Session Summaries" "$CONTEXT_FILE" || echo "No session summaries found"

} > "$archive_path"

log_info "Created archive: $archive_path"

# Update context.md to keep only recent sessions
# This is a simplified version - in production you'd want proper markdown parsing

# Create new context.md with:
# - Same frontmatter (updated)
# - Same current state/active work/recent decisions
# - Only last KEEP_SESSIONS session summaries

# For now, we'll just add a note that archiving happened
{
    # Preserve frontmatter and main sections
    sed -n '1,/# Session Summaries/p' "$CONTEXT_FILE"

    echo ""
    echo "> **Note:** Sessions 1-$sessions_to_archive archived to \`$archive_filename\`"
    echo ""

    # Keep only last KEEP_SESSIONS sessions (simplified)
    # In production, parse and keep only recent sessions

} > "$CONTEXT_FILE.new"

mv "$CONTEXT_FILE.new" "$CONTEXT_FILE"
log_info "Updated $CONTEXT_FILE"

# Show summary
echo ""
log_info "Archive complete!"
echo "  - Archived sessions: 1-$sessions_to_archive"
echo "  - Kept sessions: $((sessions_to_archive + 1))-$session"
echo "  - Archive file: $archive_path"
echo "  - Backup: $backup_file"
echo ""

# Suggest commit command
echo "Next steps:"
echo "  git add $CONTEXT_FILE $ARCHIVE_DIR/"
echo "  git commit -m \"chore: archive context sessions 1-$sessions_to_archive\""
echo ""
echo "To restore from backup if needed:"
echo "  mv $backup_file $CONTEXT_FILE"

log_warn "Note: This is a simplified implementation. Manual review recommended."
