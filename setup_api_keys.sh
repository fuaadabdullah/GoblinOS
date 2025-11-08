#!/usr/bin/env zsh
# Quick API Keys Setup Helper
# This script guides you through setting up API keys for GoblinOS

set -e

echo "🔐 GoblinOS API Keys Setup Helper"
echo "=================================="
echo ""

# Check if already set up
if [[ -f "api_keys_setup.sh" ]]; then
  echo "⚠️  api_keys_setup.sh already exists!"
  echo ""
  read "REPLY?Do you want to recreate it? (y/N): "
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled"
    exit 0
  fi
fi

# Copy example file
echo "📋 Creating api_keys_setup.sh from example..."
cp api_keys_setup.sh.example api_keys_setup.sh
chmod 600 api_keys_setup.sh
echo "✅ File created with secure permissions (600)"
echo ""

# Guide user through adding keys
echo "📝 Now let's add your API keys..."
echo ""

# OpenAI
echo "🤖 OpenAI (GPT-4, GPT-3.5)"
echo "   Get your key from: https://platform.openai.com/api-keys"
read "OPENAI_KEY?   Paste your OpenAI API key (or press Enter to skip): "
if [[ -n "$OPENAI_KEY" ]]; then
  sed -i '' "s|export OPENAI_API_KEY=\"sk-proj-...\"|export OPENAI_API_KEY=\"$OPENAI_KEY\"|g" api_keys_setup.sh
  echo "   ✅ OpenAI key added"
else
  echo "   ⏭️  Skipped"
fi
echo ""

# Anthropic
echo "🧠 Anthropic (Claude 3.5)"
echo "   Get your key from: https://console.anthropic.com/settings/keys"
read "ANTHROPIC_KEY?   Paste your Anthropic API key (or press Enter to skip): "
if [[ -n "$ANTHROPIC_KEY" ]]; then
  sed -i '' "s|export ANTHROPIC_API_KEY=\"sk-ant-...\"|export ANTHROPIC_API_KEY=\"$ANTHROPIC_KEY\"|g" api_keys_setup.sh
  echo "   ✅ Anthropic key added"
else
  echo "   ⏭️  Skipped"
fi
echo ""

# Gemini
echo "✨ Google Gemini"
echo "   Get your key from: https://makersuite.google.com/app/apikey"
read "GEMINI_KEY?   Paste your Gemini API key (or press Enter to skip): "
if [[ -n "$GEMINI_KEY" ]]; then
  sed -i '' "s|export GEMINI_API_KEY=\"AIza...\"|export GEMINI_API_KEY=\"$GEMINI_KEY\"|g" api_keys_setup.sh
  echo "   ✅ Gemini key added"
else
  echo "   ⏭️  Skipped"
fi
echo ""

# DeepSeek
echo "🔍 DeepSeek (Optional)"
echo "   Get your key from: https://platform.deepseek.com/api_keys"
read "DEEPSEEK_KEY?   Paste your DeepSeek API key (or press Enter to skip): "
if [[ -n "$DEEPSEEK_KEY" ]]; then
  sed -i '' "s|export DEEPSEEK_API_KEY=\"sk-...\"|export DEEPSEEK_API_KEY=\"$DEEPSEEK_KEY\"|g" api_keys_setup.sh
  echo "   ✅ DeepSeek key added"
else
  echo "   ⏭️  Skipped"
fi
echo ""

# Update paths if needed
echo "📁 Updating paths to match your system..."
CURRENT_DIR=$(pwd)
sed -i '' "s|export GOBLINOS_CONFIG=\"\${HOME}/ForgeMonorepo/GoblinOS/goblins.yaml\"|export GOBLINOS_CONFIG=\"${CURRENT_DIR}/goblins.yaml\"|g" api_keys_setup.sh
echo "   ✅ Paths updated"
echo ""

# Offer to add to shell profile
echo "🐚 Shell Profile Setup"
echo "   To automatically load keys on terminal start, add to ~/.zshrc"
echo ""
read "REPLY?   Add to ~/.zshrc? (y/N): "
if [[ $REPLY =~ ^[Yy]$ ]]; then
  SHELL_CONFIG="$HOME/.zshrc"

  # Check if already added
  if grep -q "api_keys_setup.sh" "$SHELL_CONFIG" 2>/dev/null; then
    echo "   ⚠️  Already in $SHELL_CONFIG"
  else
    echo "" >> "$SHELL_CONFIG"
    echo "# GoblinOS API Keys" >> "$SHELL_CONFIG"
    echo "source ${CURRENT_DIR}/api_keys_setup.sh" >> "$SHELL_CONFIG"
    echo "   ✅ Added to $SHELL_CONFIG"
  fi
else
  echo "   ℹ️  You can manually add this line to ~/.zshrc later:"
  echo "      source ${CURRENT_DIR}/api_keys_setup.sh"
fi
echo ""

# Load keys for immediate use
echo "🔄 Loading keys for current session..."
source api_keys_setup.sh
echo ""

# Check Ollama
echo "🦙 Checking Ollama (local, free provider)..."
if command -v ollama &> /dev/null; then
  if pgrep -x "ollama" > /dev/null; then
    echo "   ✅ Ollama is running"

    # Check if model is pulled
    if ollama list | grep -q "qwen2.5:3b"; then
      echo "   ✅ Model qwen2.5:3b is pulled"
    else
      echo "   ⚠️  Model qwen2.5:3b not found"
      read "REPLY?   Pull qwen2.5:3b now? (y/N): "
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        ollama pull qwen2.5:3b
        echo "   ✅ Model pulled"
      fi
    fi
  else
    echo "   ⚠️  Ollama is not running"
    echo "   Start with: ollama serve"
  fi
else
  echo "   ⚠️  Ollama is not installed"
  echo "   Install with: brew install ollama"
fi
echo ""

# Summary
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "Available commands:"
echo "  goblin-keys    - Check which keys are set"
echo "  goblin-test    - Test API key validity"
echo "  goblin-clear   - Clear keys from environment"
echo ""
echo "Next steps:"
echo "  1. Run 'goblin-keys' to verify setup"
echo "  2. Run 'goblin-test' to test API connectivity"
echo "  3. Start GoblinOS Desktop:"
echo "     cd desktop && TMPDIR=/tmp pnpm dev"
echo ""
echo "Documentation:"
echo "  - API_KEYS_MANAGEMENT.md (comprehensive guide)"
echo "  - desktop/INTEGRATION_SUMMARY.md (provider details)"
echo ""
