#!/usr/bin/env bash

set -e # Exit immediately if a command exits with a non-zero status.
set -o pipefail # The return value of a pipeline is the status of the last command to exit with a non-zero status.

echo "📦 Starting Node.js development environment setup..."

# --- 1. Check for required tools ---
echo "🔎 Checking for Node.js and npm..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install it to continue."
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install it to continue."
    exit 1
fi
echo "✅ Node.js and npm are available."
echo "   - Node version: $(node -v)"
echo "   - npm version: $(npm -v)"

# --- 2. Install Dependencies ---
echo "📦 Installing npm dependencies..."
if [ -f package-lock.json ]; then
  # Use 'npm ci' for faster, more reliable builds in CI/CD or for clean installs.
  npm ci --prefer-offline --no-audit --no-fund
else
  # Fallback to 'npm install' if no lock file is present.
  npm install --prefer-offline --no-audit --no-fund
fi
echo "✅ Dependencies installed successfully."

#3. --- Run Linter ---
if [ -f .eslintrc.js ] || [ -f .eslintrc.json ]; then
  echo "🔍 Running ESLint to check code quality..."
  npx eslint .
  echo "✅ ESLint check passed."
fi

# --- 4. Run Tests ---
echo "🧪 Running test suite..."
npm test
echo "✅ All tests passed."


# Create or overwrite the .env file
ENV_FILE=".env"
echo "# Generated from current environment" > "$ENV_FILE"

# Loop through each environment variable and write to .env
printenv | while IFS='=' read -r key value; do
  # Check if value contains spaces or special characters
  if [[ "$value" =~ [[:space:]] || "$value" =~ [^a-zA-Z0-9_/:.-] ]]; then
    # Escape double quotes and wrap in quotes
    escaped_value=$(printf '%s' "$value" | sed 's/"/\\"/g')
    echo "${key}=\"${escaped_value}\"" >> "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
done

# Print the contents of the .env file to console
echo -e "\n✅ .env file created. Here's what's inside:\n"
cat "$ENV_FILE"


echo "🎉 Development environment is ready!"