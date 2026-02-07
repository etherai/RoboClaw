# RoboClaw Deployment Workflow Specification

## Overview

RoboClaw provides a one-command deployment system for installing OpenClaw on existing servers. The deployment process automatically handles all dependencies, configuration, and setup, requiring only an IP address and SSH key from the user.

**Last Updated:** 2026-02-03
**Version:** 2.0 (One-Command Deployment)

## Quick Summary

```bash
# Deploy OpenClaw to any server with SSH access
./cli/run-deploy.sh <IP> -k <ssh-key> -n <instance-name>
```

This single command:
- Auto-detects and installs Python 3.12+ environment
- Creates virtual environment if needed
- Installs Ansible and all dependencies
- Generates temporary Ansible inventory
- Deploys OpenClaw and dependencies to the server
- Creates instance artifact for future connections
- Launches interactive onboarding wizard

## Architecture

### Component Organization

```
RoboClaw/
├── cli/                        # All CLI scripts and playbooks
│   ├── run-deploy.sh          # Main deployment orchestrator
│   ├── setup.sh               # Standalone setup (optional)
│   ├── connect-instance.sh    # Connect to deployed instances
│   ├── reconfigure.yml        # Ansible playbook for software installation
│   └── ansible.cfg            # Ansible configuration
├── instances/                  # Instance artifacts (deployment metadata)
├── venv/                       # Python virtual environment
└── requirements.txt            # Python dependencies
```

### Execution Flow

```
User runs command
    ↓
run-deploy.sh starts
    ↓
Auto-setup phase
    ├─ Detect Python 3.12+
    ├─ Create venv (if needed)
    ├─ Install dependencies (if needed)
    └─ Install Ansible collections (if needed)
    ↓
Argument parsing
    ├─ Parse IP/SSH key/name
    ├─ Resolve paths relative to project root
    └─ Generate temporary inventory (if using IP)
    ↓
Ansible deployment
    ├─ Run reconfigure.yml playbook
    ├─ Install Docker, Node.js, pnpm
    ├─ Create roboclaw user
    ├─ Install OpenClaw via pnpm
    └─ Configure firewall
    ↓
Post-deployment
    ├─ Create instance artifact
    ├─ Clean up temporary files
    └─ Launch onboarding wizard (optional)
```

## Core Features

### 1. Auto-Setup

**Purpose:** Eliminate manual environment setup steps.

**Implementation:**
- `auto_setup()` function runs before deployment
- Detects Python 3.12+ from multiple sources (python3.12, python3, python, pyenv)
- Creates virtual environment at `../venv/` relative to cli/ directory
- Installs dependencies from `../requirements.txt`
- Installs Ansible collections (hetzner.hcloud)
- Only errors if Python 3.12+ is not found

**Detection Order:**
1. `python3.12` command
2. `python3` command (if version >= 3.12)
3. `python` command (if version >= 3.12)
4. `~/.pyenv/versions/3.12.0/bin/python3` (pyenv)

**Exit Conditions:**
- ✅ Success: Environment ready, continues to deployment
- ❌ Failure: Python 3.12+ not found, shows installation instructions

### 2. Direct IP Support

**Purpose:** Allow deployment without creating inventory files.

**Implementation:**
- Accept IP as positional argument: `./cli/run-deploy.sh <IP> ...`
- Alternative: `--ip <address>` flag
- Validate IP format: `^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$`
- Generate temporary inventory at `../instances/.temp-inventory-<name>.ini`
- Format:
  ```ini
  [servers]
  <IP> ansible_user=root
  ```
- Clean up temporary inventory after deployment (success or failure)

**Backward Compatibility:**
- Original `-i/--inventory` flag still works
- Environment variable `INVENTORY_PATH` still supported

### 3. Instance Naming

**Purpose:** Allow custom naming for deployed instances.

**Flags:**
- `-n/--name <name>`: Specify instance name
- `INSTANCE_NAME_OVERRIDE`: Environment variable (legacy)

**Default Behavior:**
- If no name provided: `instance-<IP-with-dashes>`
- Example: IP `192.168.1.100` → name `instance-192-168-1-100`

**Priority Order:**
1. `-n/--name` flag (highest priority)
2. `INSTANCE_NAME_OVERRIDE` environment variable
3. Auto-generated from IP (default)

### 4. Path Resolution

**Challenge:** Scripts run from cli/ directory but users provide paths relative to project root.

**Solution:**
1. Store original directory: `ORIGINAL_DIR="$(pwd)"`
2. Change to script directory: `cd "$(dirname "$0")"`
3. Resolve user paths before use:
   ```bash
   # For SSH keys and inventory files
   if [[ ! "$PATH" = /* ]]; then
       PATH="$ORIGINAL_DIR/$PATH"
   fi
   ```

**Path Types:**
- User-provided (SSH keys, inventory): Resolved relative to `$ORIGINAL_DIR`
- Internal (venv, instances, playbooks): Relative to script directory (`../` or `./`)

### 5. Instance Artifacts

**Purpose:** Store deployment metadata for future connections.

**Location:** `../instances/<instance-name>.yml`

**Format:**
```yaml
# Instance deployed via run-deploy.sh on 2026-02-03T20:00:00Z
instances:
  - name: production
    ip: 192.168.1.100
    deployed_at: 2026-02-03T20:00:00Z
    deployment_method: run-deploy.sh
    inventory_file: ../instances/.temp-inventory-production.ini
    ssh:
      key_file: "/absolute/path/to/ssh-keys/key"
      public_key_file: "/absolute/path/to/ssh-keys/key.pub"
```

**Usage:**
- `connect-instance.sh` reads artifacts to connect
- `validate-instance.sh` reads artifacts to validate
- Provides connection history and audit trail

### 6. Auto-Onboarding

**Purpose:** Streamline post-deployment setup.

**Default Behavior:**
- After successful deployment, automatically runs `./cli/connect-instance.sh <name> onboard`
- Launches interactive OpenClaw configuration wizard
- Configures messaging providers, credentials, systemd service

**Opt-Out:**
- `--skip-onboard` or `--no-onboard` flags
- Deployment completes without launching wizard
- Shows manual command: `./cli/connect-instance.sh <name> onboard`

## Command-Line Interface

### run-deploy.sh

**Syntax:**
```bash
./cli/run-deploy.sh <IP> -k <ssh-key> [options]
./cli/run-deploy.sh --ip <IP> -k <ssh-key> [options]
./cli/run-deploy.sh -k <ssh-key> -i <inventory> [options]  # Legacy
```

**Required Arguments:**
- IP address (positional or `--ip`) OR inventory file (`-i`)
- SSH private key (`-k/--ssh-key`)

**Optional Arguments:**
- `-n/--name <name>`: Instance name (default: instance-<IP>)
- `--skip-onboard`: Skip automatic onboarding wizard
- `--no-onboard`: Alias for --skip-onboard
- Any additional Ansible arguments (passed through)

**Environment Variables:**
- `SSH_PRIVATE_KEY_PATH`: Alternative to `-k` flag
- `INVENTORY_PATH`: Alternative to `-i` flag
- `INSTANCE_NAME_OVERRIDE`: Alternative to `-n` flag

**Examples:**
```bash
# Basic deployment
./cli/run-deploy.sh 192.168.1.100 -k ~/.ssh/id_ed25519

# With custom name
./cli/run-deploy.sh 192.168.1.100 -k ~/.ssh/key -n production

# Skip onboarding
./cli/run-deploy.sh 192.168.1.100 -k key -n test --skip-onboard

# Using inventory file (legacy)
./cli/run-deploy.sh -k key -i hosts.ini

# With Ansible arguments
./cli/run-deploy.sh 192.168.1.100 -k key --tags docker,nodejs -v
```

### connect-instance.sh

**Syntax:**
```bash
./cli/connect-instance.sh <instance-name> [command]
./cli/connect-instance.sh --ip <IP> --key <path> [command]
```

**Usage:**
```bash
# Connect and run onboarding wizard
./cli/connect-instance.sh production onboard

# Interactive shell
./cli/connect-instance.sh production

# Custom IP/key
./cli/connect-instance.sh --ip 192.168.1.100 --key ~/.ssh/key onboard
```

### setup.sh

**Syntax:**
```bash
./cli/setup.sh
```

**Purpose:** Standalone environment setup (optional, since run-deploy.sh auto-sets up).

**Usage Scenarios:**
- Pre-setup before deployment
- Manual environment configuration
- CI/CD pipeline preparation

## Deployment Phases

### Phase 1: Environment Setup (Auto)

**Duration:** ~10-30 seconds (first run), ~1 second (subsequent)

**Tasks:**
1. Detect Python 3.12+ binary
2. Create virtual environment if missing
3. Activate virtual environment
4. Upgrade pip
5. Install requirements.txt dependencies
6. Install Ansible collections

**Output:**
```
Setting up environment...

Checking for Python 3.12+...
✓ Found Python 3.12.0

✓ Environment ready
```

### Phase 2: Argument Processing

**Duration:** <1 second

**Tasks:**
1. Parse command-line arguments
2. Resolve SSH key path relative to original directory
3. Validate SSH key exists
4. Generate temporary inventory (if using IP) or validate inventory file
5. Set instance name (from flag, env var, or IP)

**Validations:**
- SSH key file exists and is readable
- IP address format is valid (if provided)
- Inventory file exists (if provided)

### Phase 3: Ansible Deployment

**Duration:** ~3-5 minutes

**Tasks (reconfigure.yml):**
1. Gather facts from target server
2. Update apt cache
3. Create roboclaw system user
4. Add roboclaw to sudoers with NOPASSWD
5. Enable lingering for roboclaw user
6. Install Docker CE
7. Add roboclaw to docker group
8. Install Node.js 22 via nodesource
9. Install pnpm globally
10. Configure UFW firewall (SSH only)
11. Install OpenClaw via pnpm
12. Install Gemini CLI
13. Configure .bashrc for roboclaw user
14. Verify installations

**Server Requirements:**
- Ubuntu 24.04 (x86 or ARM)
- Root SSH access
- Internet connectivity

**Installed Software:**
- Docker CE latest
- Node.js 22.x
- pnpm latest
- OpenClaw (latest release)
- Gemini CLI
- UFW firewall

### Phase 4: Post-Deployment

**Duration:** ~1-2 seconds

**Tasks:**
1. Parse inventory file to extract host info
2. Create instance artifact YAML file
3. Store deployment metadata
4. Clean up temporary inventory (if generated)
5. Display success message
6. Launch onboarding wizard (unless --skip-onboard)

**Artifact Storage:**
- Location: `../instances/<instance-name>.yml`
- Contents: IP, name, timestamp, SSH keys, deployment method
- Format: YAML (human-readable, machine-parsable)

## Error Handling

### Pre-Deployment Errors

**Python 3.12+ Not Found:**
```
❌ Error: Python 3.12+ not found

Install Python 3.12+ using one of these methods:

Using pyenv (recommended):
  pyenv install 3.12.0

Using apt (Ubuntu/Debian):
  sudo apt update
  sudo apt install python3.12 python3.12-venv

Using brew (macOS):
  brew install python@3.12
```

**SSH Key Not Found:**
```
Error: SSH key file not found: ./ssh-keys/key
```

**Invalid IP Format:**
```
Error: Invalid IP address format: 192.168.1
```

**Missing Required Argument:**
```
Error: SSH key not provided. Use -k/--ssh-key or set SSH_PRIVATE_KEY_PATH
```

### Deployment Errors

**Ansible Playbook Failure:**
- Exit with Ansible error code
- Display: `❌ Deployment failed with exit code: <code>`
- Clean up temporary inventory
- Artifact NOT created (deployment incomplete)

**SSH Connection Failure:**
- Ansible displays connection error
- Common causes: Wrong IP, firewall blocking SSH, incorrect SSH key
- User can retry with corrected parameters

**Mid-Run Failure:**
- Playbook is idempotent (safe to re-run)
- Re-running continues from failed task
- User can re-run same command to retry

## File Organization

### Scripts Location: cli/

**Why cli/ directory:**
- Cleaner project root
- Clear separation of CLI tools vs. data/config
- Better organization for future growth
- Follows common open-source patterns

**Directory Structure:**
```
cli/
├── run-deploy.sh           # Main deployment orchestrator
├── setup.sh                # Environment setup
├── connect-instance.sh     # Connect to instances
├── create-inventory.sh     # Generate inventory files
├── run-hetzner.sh          # Hetzner provisioning
├── validate-instance.sh    # Validation script
├── list-server-types.sh    # List instance types
├── quick-validate.sh       # Quick validation
├── reconfigure.yml         # Software installation playbook
├── hetzner-finland-fast.yml # Hetzner provision playbook
├── hetzner-teardown.yml    # Teardown playbook
├── openclaw-service.yml    # Service management
├── validate-openclaw.yml   # OpenClaw validation
├── cleanup-ssh-key.yml     # SSH key management
└── ansible.cfg             # Ansible configuration
```

### Data Locations

**Virtual Environment:** `venv/` (project root)
- Created by setup scripts
- Shared across all CLI tools
- Contains Python, Ansible, dependencies

**Instance Artifacts:** `instances/` (project root)
- YAML files for each deployed instance
- Persist across deployments
- Used by connect and validate scripts

**SSH Keys:** `ssh-keys/` (project root, user-managed)
- User-provided SSH private keys
- Referenced by deployment commands
- Not created by deployment system

**Temporary Files:** `instances/.temp-inventory-*.ini`
- Auto-generated inventory files
- Deleted after deployment completes
- Not committed to git

## Dependencies

### System Requirements

**Local Machine:**
- Python 3.12+ (any source: system, pyenv, etc.)
- Bash shell
- Git (for cloning repository)
- SSH client

**Target Server:**
- Ubuntu 24.04 LTS (x86_64 or ARM64)
- Root SSH access
- Internet connectivity (for downloading packages)
- Minimum 2GB RAM, 1 vCPU, 10GB disk

### Python Dependencies (requirements.txt)

```
ansible>=10.8.0
ansible-core>=2.18.1
python-dateutil>=2.9.0
```

### Ansible Collections

```
hetzner.hcloud
```

## Security Considerations

### SSH Key Management

**Best Practices:**
- Use dedicated SSH keys for deployment (not shared)
- Store SSH keys with appropriate permissions (0600)
- Use ed25519 keys (modern, secure)
- Never commit SSH keys to git

**Key Storage:**
- Recommended: `~/.ssh/` or project `ssh-keys/` directory
- Auto-resolved: Relative or absolute paths supported
- Absolute paths stored in artifacts for consistency

### Firewall Configuration

**UFW Rules (deployed to server):**
- Default: Deny all incoming
- Allow: SSH (port 22)
- Docker isolation: DOCKER-USER chain prevents bypass

**Security Features:**
- Non-root execution (roboclaw user)
- Docker group membership (no sudo needed for Docker)
- StrictHostKeyChecking disabled for automation (acceptable for deployment)

### Credential Handling

**During Deployment:**
- SSH keys stay on local machine
- No credentials stored on server by deployment
- Ansible uses SSH key for authentication

**Post-Deployment:**
- OpenClaw onboarding prompts for API keys
- Credentials stored encrypted on server
- No credential transmission to local machine

## Testing & Validation

### Pre-Deployment Testing

```bash
# Test auto-setup (without deploying)
./cli/setup.sh

# Validate SSH connectivity
ssh -i ~/.ssh/key root@192.168.1.100 echo "Connection OK"

# Test inventory generation
./cli/create-inventory.sh 192.168.1.100 test.ini
```

### Post-Deployment Validation

```bash
# Run comprehensive validation
./cli/validate-instance.sh <instance-name>

# Manual checks
ssh -i <key> root@<ip>
docker --version
node --version
pnpm --version
openclaw --version
```

### Test Scenarios

**Happy Path:**
1. Fresh server with root SSH access
2. Valid SSH key
3. First deployment to IP
4. Auto-onboard completes successfully

**Edge Cases:**
- Re-deploying to same IP (idempotent)
- Multiple instances to different IPs
- Deployment without onboarding (--skip-onboard)
- Using inventory file instead of direct IP
- Relative vs absolute SSH key paths

## Future Enhancements

### Potential Improvements

1. **Multi-Server Deployment:**
   - Deploy to multiple IPs in one command
   - Parallel deployment support
   - Inventory file with multiple hosts

2. **Custom Playbooks:**
   - Allow user-provided Ansible playbooks
   - Plugin system for custom installation steps
   - Environment-specific configurations

3. **Progress Indicators:**
   - Real-time deployment progress
   - Task-level status updates
   - Estimated time remaining

4. **Rollback Support:**
   - Snapshot before deployment
   - Rollback to previous state on failure
   - Deployment version history

5. **Configuration Management:**
   - Config file for defaults (instance type, region, etc.)
   - Profile support (dev, staging, production)
   - Template-based deployments

## Changelog

### Version 2.0 (2026-02-03) - One-Command Deployment

**Added:**
- Auto-setup functionality integrated into run-deploy.sh
- Direct IP address support (no inventory file needed)
- Instance naming via -n/--name flag
- Path resolution for user-provided arguments
- Organized scripts into cli/ directory

**Changed:**
- Simplified workflow from 3 steps to 1 command
- Updated all documentation for new paths
- Enhanced error messages with actionable suggestions

**Improved:**
- Better path handling for relative/absolute paths
- Cleaner project structure with cli/ organization
- More robust environment detection

### Version 1.0 (2026-01-31) - Initial Release

**Features:**
- Manual setup via setup.sh
- Inventory file creation via create-inventory.sh
- Deployment via run-deploy.sh
- Auto-onboarding support
- Instance artifact creation
- Hetzner Cloud provisioning

## Related Documentation

- [README.md](../README.md) - Quick start guide and common commands
- [PROVISION.md](../PROVISION.md) - Detailed technical documentation
- [HETZNER_SETUP.md](../HETZNER_SETUP.md) - Hetzner Cloud setup guide

## Appendix

### Complete Deployment Example

```bash
# 1. Clone repository
git clone https://github.com/hintjen/RoboClaw
cd RoboClaw

# 2. Deploy to server (auto-setup happens automatically)
./cli/run-deploy.sh 192.168.1.100 -k ~/.ssh/my-key -n production

# Output:
# Setting up environment...
# ✓ Found Python 3.12.0
# ✓ Environment ready
#
# Deploying OpenClaw to servers in: ../instances/.temp-inventory-production.ini
# Using SSH key: /home/user/.ssh/my-key
#
# [Ansible playbook runs...]
#
# ✅ Deployment complete!
# 🚀 Launching OpenClaw interactive wizard...

# 3. Complete onboarding in interactive wizard
# [Wizard configures messaging provider, API keys, etc.]

# 4. Later: reconnect to instance
./cli/connect-instance.sh production

# 5. Later: validate instance
./cli/validate-instance.sh production
```

### Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Python 3.12+ not found | Install via pyenv, apt, or brew |
| SSH key not found | Check path, use absolute path |
| Invalid IP format | Verify IP address is correct |
| Ansible connection failed | Check SSH access, firewall, key |
| Deployment mid-run failure | Re-run same command (idempotent) |
| Want to skip onboarding | Add --skip-onboard flag |
| Need to use inventory file | Use -i flag instead of IP |

---

**Document Status:** Production
**Maintained By:** RoboClaw Development Team
**Last Review:** 2026-02-03
