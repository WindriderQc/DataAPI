#!/bin/bash

# Test script for DataAPI Janitor endpoints
# Usage: ./test-janitor.sh [API_KEY] [BASE_URL]

API_KEY=${1:-$DATAAPI_API_KEY}
BASE_URL=${2:-"http://localhost:3003"}
TEST_DIR="/tmp/janitor_test_$(date +%s)"

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY is required. Set DATAAPI_API_KEY env var or pass as first argument."
  exit 1
fi

echo "=== Setting up test environment in $TEST_DIR ==="
mkdir -p "$TEST_DIR/subdir"
echo "This is file A" > "$TEST_DIR/fileA.txt"
echo "This is file A" > "$TEST_DIR/fileA_copy.txt" # Duplicate
echo "This is file B" > "$TEST_DIR/fileB.txt"
echo "This is a temp file" > "$TEST_DIR/subdir/temp_file.tmp"

# Set mtime of temp file to 8 days ago to trigger cleanup policy
touch -d "8 days ago" "$TEST_DIR/subdir/temp_file.tmp"

echo "=== 1. Testing /analyze ==="
echo "Sending request to $BASE_URL/api/v1/janitor/analyze..."
curl -s -X POST "$BASE_URL/api/v1/janitor/analyze" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"path\": \"$TEST_DIR\"}" | jq .

echo -e "\n\n=== 2. Testing /suggest ==="
echo "Sending request to $BASE_URL/api/v1/janitor/suggest..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/janitor/suggest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"path\": \"$TEST_DIR\", \"policies\": [\"delete_duplicates\", \"remove_temp_files\"]}")

echo "$RESPONSE" | jq .

# Extract a file to delete from suggestions (if any)
FILE_TO_DELETE=$(echo "$RESPONSE" | jq -r '.suggestions[0].files[0] // empty')

if [ -n "$FILE_TO_DELETE" ] && [ "$FILE_TO_DELETE" != "null" ]; then
  echo -e "\n\n=== 3. Testing /execute (Dry Run) ==="
  echo "Attempting to delete: $FILE_TO_DELETE"
  curl -s -X POST "$BASE_URL/api/v1/janitor/execute" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"files\": [\"$FILE_TO_DELETE\"], \"dry_run\": true}" | jq .
else
  echo "No suggestions found to test execution."
fi

echo -e "\n\n=== Cleanup ==="
rm -rf "$TEST_DIR"
echo "Test directory removed."
