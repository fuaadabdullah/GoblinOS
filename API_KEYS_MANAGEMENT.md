# API Keys Management

This document explains how to securely manage API keys for GoblinOS and GoblinOS Desktop.

## 🔐 Security First

**NEVER commit API keys to git!** All sensitive files are in `.gitignore`:
- `.env`
- `api_keys_setup.sh`
- `*.key`, `*.pem`
- `secrets.yaml` (use `secrets.enc.yaml` for encrypted versions)

## 📋 Three Methods for Managing API Keys

### Method 1: Environment Variables (Recommended for Development)

**Best for**: Local development, testing

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your actual keys**:
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Load environment variables**:
   ```bash
   # Option A: Use a tool like direnv (auto-loads .env)
   direnv allow

   # Option B: Source manually
   export $(cat .env | xargs)

   # Option C: Use with specific command
   env $(cat .env | xargs) pnpm dev
   ```

### Method 2: Shell Configuration Script (Recommended for Persistent Setup)

**Best for**: Daily use, multiple projects

1. **Copy the example**:
   ```bash
   cp api_keys_setup.sh.example api_keys_setup.sh
   chmod 600 api_keys_setup.sh  # Restrict permissions
   ```

2. **Edit with your actual keys**:
   ```bash
   nano api_keys_setup.sh
   ```

3. **Add to your shell profile** (`~/.zshrc` or `~/.bashrc`):
   ```bash
   # Add this line to the bottom of your ~/.zshrc
   source ~/ForgeMonorepo/GoblinOS/api_keys_setup.sh
   ```

4. **Reload shell**:
   ```bash
   source ~/.zshrc
   ```

5. **Verify setup**:
   ```bash
   goblin-keys  # Check which keys are set
   goblin-test  # Test API key validity
   ```

### Method 3: Encrypted Secrets with SOPS (Recommended for Production)

**Best for**: Team projects, CI/CD, production

1. **Install SOPS**:
   ```bash
   brew install sops age
   ```

2. **Generate an age key**:
   ```bash
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   ```

3. **Create `.sops.yaml` config**:
   ```yaml
   creation_rules:
     - path_regex: secrets\.yaml$
       age: age1...  # Your public key from keys.txt
   ```

4. **Create and encrypt secrets**:
   ```bash
   # Create secrets.yaml with your keys
   cat > secrets.yaml << EOF
   api_keys:
     openai: sk-proj-...
     anthropic: sk-ant-...
     gemini: AIza...
   EOF

   # Encrypt it
   sops -e -i secrets.yaml
   ```

5. **Decrypt and load**:
   ```bash
   # Decrypt to environment
   eval $(sops -d secrets.yaml | yq -r 'to_entries | .[] | "export \(.key)=\(.value)"')
   ```

## 🔑 Required API Keys

### OpenAI (GPT-4, GPT-3.5)
- **Get key**: https://platform.openai.com/api-keys
- **Format**: `sk-proj-...`
- **Variable**: `OPENAI_API_KEY`
- **Cost**: Pay-per-use (see [pricing](https://openai.com/pricing))

### Anthropic (Claude 3.5)
- **Get key**: https://console.anthropic.com/settings/keys
- **Format**: `sk-ant-...`
- **Variable**: `ANTHROPIC_API_KEY`
- **Cost**: Pay-per-use (see [pricing](https://www.anthropic.com/pricing))

### Google Gemini (Gemini Pro/Flash)
- **Get key**: https://makersuite.google.com/app/apikey
- **Format**: `AIza...`
- **Variable**: `GEMINI_API_KEY`
- **Cost**: Free tier available, then pay-per-use

### DeepSeek (Optional)
- **Get key**: https://platform.deepseek.com/api_keys
- **Format**: `sk-...`
- **Variable**: `DEEPSEEK_API_KEY`
- **Cost**: Varies by model

### Ollama (Local - No Key Required)
- **Install**: `brew install ollama`
- **Start**: `ollama serve`
- **Pull model**: `ollama pull qwen2.5:3b`
- **Cost**: FREE ✅

## 🎯 Usage Examples

### GoblinOS Desktop (Tauri App)

```bash
# Set keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="AIza..."

# Run dev server
cd GoblinOS/desktop
TMPDIR=/tmp pnpm dev
```

The app will automatically detect available providers based on environment variables.

### GoblinOS CLI

```bash
# Check which providers are available
node bin/goblin ask --help

# Use specific provider
node bin/goblin ask dregg-embercode "Build the project" --provider=openai

# Fallback to Ollama if no cloud keys
node bin/goblin ask vanta-lumin "Design a modal" --provider=ollama
```

### GoblinOS Runtime Server

```bash
# Start with all providers
cd packages/goblin-runtime
pnpm server

# Check health and available providers
curl http://localhost:3001/api/health
```

## ✅ Verification Checklist

After setting up keys, verify everything works:

- [ ] Keys are in `.gitignore` (check with `git status`)
- [ ] Keys are set in environment (check with `echo $OPENAI_API_KEY`)
- [ ] File permissions are secure (`chmod 600 api_keys_setup.sh`)
- [ ] Keys work with API (run `goblin-test`)
- [ ] Ollama is running for fallback (`ollama list`)

## 🚨 Security Best Practices

### DO ✅
- Use environment variables for keys
- Encrypt secrets with SOPS for team projects
- Set restrictive file permissions (`chmod 600`)
- Rotate keys regularly (every 90 days)
- Use separate keys for dev/staging/prod
- Monitor API usage and costs
- Revoke keys immediately if compromised

### DON'T ❌
- Commit `.env` or `api_keys_setup.sh` to git
- Share keys in Slack/Discord/email
- Use production keys in development
- Log full API keys (mask them: `sk-...****`)
- Store keys in code or config files
- Use the same key across multiple projects

## 🔄 Key Rotation

Rotate keys every 90 days:

1. **Generate new key** from provider dashboard
2. **Update in your config**:
   ```bash
   nano api_keys_setup.sh
   # or
   nano .env
   ```
3. **Test new key**:
   ```bash
   source api_keys_setup.sh
   goblin-test
   ```
4. **Revoke old key** from provider dashboard
5. **Update team** (if using SOPS, re-encrypt and share)

## 📊 Cost Monitoring

Track API costs to avoid surprises:

### GoblinOS Desktop
- View costs in the app's cost panel
- Get summary: Uses `get_cost_summary` command
- See breakdown by provider and model

### Shell Command
```bash
# Check environment variable threshold
echo $COST_ALERT_THRESHOLD  # Default: 10.00 USD
```

### Provider Dashboards
- **OpenAI**: https://platform.openai.com/usage
- **Anthropic**: https://console.anthropic.com/settings/billing
- **Gemini**: https://makersuite.google.com/app/billing

## 🆘 Troubleshooting

### Keys not loading
```bash
# Check if file is sourced
which goblin-keys

# Re-source the file
source api_keys_setup.sh

# Check environment
env | grep API_KEY
```

### "Provider not found" error
```bash
# List available providers
goblin-keys

# Make sure key is actually set (not placeholder)
echo $OPENAI_API_KEY  # Should NOT be "sk-proj-..."
```

### Permission denied
```bash
# Fix file permissions
chmod 600 api_keys_setup.sh
chmod 600 .env
```

### API returns 401 Unauthorized
```bash
# Test key validity
goblin-test

# Check key format (must not have spaces/newlines)
echo -n $OPENAI_API_KEY | wc -c  # Should be ~50+ chars
```

## 📚 Additional Resources

- [GoblinOS Desktop Integration Summary](desktop/INTEGRATION_SUMMARY.md)
- [Secrets Management Script](tools/secrets_manage.sh)
- [SOPS Documentation](https://github.com/mozilla/sops)
- [Age Encryption](https://github.com/FiloSottile/age)

## 🤝 Team Setup

For teams using GoblinOS:

1. **Share the setup template** (not actual keys):
   ```bash
   git add api_keys_setup.sh.example
   git commit -m "Add API keys setup template"
   ```

2. **Each team member** gets their own keys:
   - Create personal `api_keys_setup.sh` (gitignored)
   - Or use SOPS with team's age keys

3. **Document in onboarding**:
   - Link to this README
   - Provide team's SOPS age public key (if used)
   - Set up cost alerts

## 📝 Example Workflow

Complete workflow for a new developer:

```bash
# 1. Clone repo
git clone https://github.com/ForgeMonorepo.git
cd ForgeMonorepo/GoblinOS

# 2. Set up API keys
cp api_keys_setup.sh.example api_keys_setup.sh
nano api_keys_setup.sh  # Add your keys
chmod 600 api_keys_setup.sh

# 3. Add to shell profile
echo "source $(pwd)/api_keys_setup.sh" >> ~/.zshrc
source ~/.zshrc

# 4. Verify setup
goblin-keys
goblin-test

# 5. Start Ollama (local fallback)
brew install ollama
ollama serve
ollama pull qwen2.5:3b

# 6. Run GoblinOS Desktop
cd desktop
TMPDIR=/tmp pnpm dev

# 7. Test in the app
# Should see all providers with valid keys in the provider selector
```

---

**Last Updated**: November 7, 2025
**Security Level**: Production-Ready
**Tested With**: GoblinOS Desktop v1.0.0
