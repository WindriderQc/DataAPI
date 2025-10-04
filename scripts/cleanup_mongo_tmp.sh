#!/usr/bin/env bash
# If script was invoked with /bin/sh (which may not support 'pipefail'), re-exec under bash.
if [ -z "${BASH_VERSION-}" ]; then
  exec /usr/bin/env bash "$0" "$@"
fi
set -euo pipefail

# cleanup_mongo_tmp.sh
# Safely list and remove old mongodb-memory-server temp directories under /tmp
# Usage:
#   ./cleanup_mongo_tmp.sh [--age MINUTES] [--yes] [--dry-run] [--list-only]
# Examples:
#   ./cleanup_mongo_tmp.sh --age 30          # interactive, targets dirs older than 30 minutes
#   ./cleanup_mongo_tmp.sh --age 10 --yes    # delete without prompting
#   ./cleanup_mongo_tmp.sh --list-only       # only list candidate dirs
#   ./cleanup_mongo_tmp.sh --dry-run         # shows what would be removed

AGE_MINUTES=60
DRY_RUN=1
AUTO_YES=0
LIST_ONLY=0

print_usage(){
  sed -n '1,120p' "$0" | sed -n '1,40p'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --age|-a)
      AGE_MINUTES="$2"; shift 2;;
    --yes|-y)
      AUTO_YES=1; DRY_RUN=0; shift;;
    --dry-run)
      DRY_RUN=1; shift;;
    --no-dry-run)
      DRY_RUN=0; shift;;
    --list-only)
      LIST_ONLY=1; DRY_RUN=1; shift;;
    --help|-h)
      print_usage; exit 0;;
    *)
      echo "Unknown arg: $1"; print_usage; exit 1;;
  esac
done

echo "[cleanup_mongo_tmp] Searching for /tmp/mongo-mem-* older than ${AGE_MINUTES} minutes"

if ! command -v find >/dev/null 2>&1; then
  echo "find is required but not available. Aborting."; exit 1
fi


# gather candidates safely (handles spaces/newlines in names)
CANDIDATES=()
while IFS= read -r -d '' dir; do
  CANDIDATES+=("$dir")
done < <(find /tmp -maxdepth 1 -type d -name 'mongo-mem-*' -mmin +${AGE_MINUTES} -print0 2>/dev/null)

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  echo "No /tmp/mongo-mem-* directories older than ${AGE_MINUTES} minutes were found."
  exit 0
fi

echo "Found ${#CANDIDATES[@]} candidate(s):"
TOTAL_SIZE=0
for d in "${CANDIDATES[@]}"; do
  size=$(du -sh "$d" 2>/dev/null | awk '{print $1}') || size="?"
  printf "  %s  (%s)\n" "$d" "$size"
done

if [[ $LIST_ONLY -eq 1 ]]; then
  echo "List-only mode: no changes will be made."; exit 0
fi

# helper to check if a directory is in use by any process
is_in_use(){
  local dir="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof +D "$dir" >/dev/null 2>&1; then
      return 0
    else
      return 1
    fi
  elif command -v fuser >/dev/null 2>&1; then
    if fuser -sm "$dir" >/dev/null 2>&1; then
      return 0
    else
      return 1
    fi
  else
    # cannot determine; warn and assume not in use
    echo "Warning: neither lsof nor fuser available; cannot conclusively check if $dir is in use."
    return 1
  fi
}

for d in "${CANDIDATES[@]}"; do
  echo
  echo "Evaluating: $d"
  if is_in_use "$d"; then
    echo "  Skipping $d — it appears to be in use by a running process."; continue
  fi
  size_readable=$(du -sh "$d" 2>/dev/null | awk '{print $1}') || size_readable="?"
  echo "  Size: $size_readable"

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "  Dry-run: would remove $d"
    continue
  fi

  if [[ $AUTO_YES -eq 1 ]]; then
    echo "  Removing $d (auto-yes)"
    rm -rf "$d" && echo "  Removed $d" || echo "  Failed to remove $d (permission denied?)"
    continue
  fi

  read -p "  Remove $d ? [y/N]: " ans
  case "$ans" in
    [Yy]* ) rm -rf "$d" && echo "  Removed $d" || echo "  Failed to remove $d" ;;
    * ) echo "  Skipping $d" ;;
  esac
done

echo "Done."
