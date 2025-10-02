#!/usr/bin/env bash
set -e

echo "📦 Setting up Node.js / Web environment..."

# Check Node/npm
node -v || echo "⚠️ Node.js not installed!"
npm -v  || echo "⚠️ npm not installed!"

# Install project dependencies (lean mode)
if [ -f package-lock.json ]; then
  npm ci --prefer-offline --no-audit --no-fund
else
  npm install --prefer-offline --no-audit --no-fund
fi

# Clear cache to save space
npm cache clean --force || true

# Run lint if eslint config exists
if [ -f .eslintrc.js ] || [ -f .eslintrc.json ]; then
  echo "🔍 Running ESLint..."
  npx eslint . || true
fi

# Build if needed
if [ -f package.json ]; then
  if npm run | grep -q "build"; then
    echo "⚒️ Running build..."
    npm run build
  fi
fi

# Run tests if available
if npm run | grep -q "test"; then
  echo "🧪 Running tests..."
  npm test || true
fi

# Optional: cleanup heavy dirs after
rm -rf node_modules .npm || true

echo "✅ Node.js environment ready!"
