# RoboClaw Deployment Automation

Automated deployment system for provisioning VPS instances and installing OpenClaw.

**Two deployment modes:**
1. **Deploy to existing servers** - Use any server with SSH access (recommended for testing)
2. **Hetzner Cloud provisioning** - Provision new VPS instances automatically

## Quick Start - Deploy to Existing Server

```bash
# 1. One-time setup (requires Python 3.12+)
./setup.sh

# 2. Create inventory from your server IP
./create-inventory.sh <YOUR_SERVER_IP> inventory.ini

# 3. Deploy OpenClaw and auto-onboard
INSTANCE_NAME_OVERRIDE=my-server ./run-deploy.sh \
  -k ~/.ssh/your_key \
  -i inventory.ini

# That's it! The script will:
# - Deploy OpenClaw + dependencies (~3-5 min)
# - Create instance artifact
# - Drop you into interactive onboarding wizard
```

**What `./setup.sh` does:**
- Detects Python 3.12+ (checks python3.12, python3, python, pyenv)
- Creates virtual environment if needed
- Installs all Python dependencies
- Installs Ansible Hetzner collection
- Provides helpful errors if Python 3.12+ not found

## Quick Start - Hetzner Cloud Provisioning

```bash
# 1. Get Hetzner API token from https://console.hetzner.cloud/
#    Project → Security → API Tokens → Generate (Read & Write)

# 2. Create .env file
echo 'HCLOUD_TOKEN=your-64-char-token-here' > .env

# 3. Provision VPS (~2-3 minutes)
./run-hetzner.sh

# 4. Validate installation (17 checks)
./validate-instance.sh

# 5. Connect
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)

# 6. Onboard RoboClaw
sudo su - roboclaw
openclaw onboard --install-daemon
```

## Commands

### Deploy to Existing Server (CLI)

#### Deploy with Auto-Onboard (Recommended)

```bash
# Deploy to any server with SSH access
# By default, automatically launches 'openclaw onboard' after deployment
./run-deploy.sh -k <ssh-key> -i <inventory-file>

# With custom instance name
INSTANCE_NAME_OVERRIDE=production ./run-deploy.sh \
  -k ~/.ssh/prod-key \
  -i prod-inventory.ini
```

**What gets installed:**
- Ubuntu 24.04 (x86 or ARM)
- Docker CE
- Node.js 22 + pnpm
- UFW firewall (SSH only)
- OpenClaw latest version
- Gemini CLI
- ttyd (browser terminal)
- **Time: ~3-5 minutes**

#### Skip Auto-Onboard

```bash
# Deploy without launching onboarding wizard
./run-deploy.sh -k <key> -i <inventory> --skip-onboard

# Connect and onboard later
./connect-instance.sh <instance-name> onboard
```

#### Create Inventory File

```bash
# Generate Ansible inventory from IP address
./create-inventory.sh <IP> [output-file]

# Example
./create-inventory.sh 1.2.3.4 production.ini
```

#### Connect to Instance

```bash
# Connect and run onboarding wizard
./connect-instance.sh <instance-name> onboard

# Connect to interactive shell
./connect-instance.sh <instance-name>

# Connect with custom IP/key
./connect-instance.sh --ip 1.2.3.4 --key ~/.ssh/key onboard
```

### Provision New Server (Hetzner Cloud)

```bash
# Provision and install RoboClaw (~2-3 minutes)
./run-hetzner.sh
```

**Install includes:**
- Ubuntu 24.04 ARM (2 vCPU, 4GB RAM, 40GB SSD)
- Docker CE
- Node.js 22 + pnpm
- UFW firewall (SSH only)
- OpenClaw latest version
- Cost: €3.29/month
- **Time: ~2-3 minutes**

### Validate Instance

```bash
# Validate provisioning was successful
./validate-instance.sh
```

Runs 17 checks including:
- SSH connectivity
- Software versions
- RoboClaw installation
- Firewall configuration
- Docker setup

### List Servers

```bash
# Show all servers in your Hetzner account
./run-hetzner.sh list
```

### Delete Server

```bash
# Delete default server (finland-instance) with confirmation prompt
./run-hetzner.sh delete

# Delete specific server
./run-hetzner.sh delete -e server_name=my-server

# Delete server AND remove SSH key from Hetzner
./run-hetzner.sh delete -e delete_ssh_key=true
```

### Clean Up Local Files

```bash
# Remove SSH keys and IP file
rm hetzner_key hetzner_key.pub finland-instance-ip.txt

# Remove deleted instance artifacts (optional - preserves history by default)
rm instances/*_deleted.yml
```

## Configuration

Edit `hetzner-finland-fast.yml` to customize:

```yaml
vars:
  server_name: "finland-instance"        # Server name
  server_type: "cax11"                   # Instance type (see available-server-types.txt)
  location: "hel1"                       # Helsinki (hel1), Falkenstein (fsn1), Nuremberg (nbg1)
  image: "ubuntu-24.04"                  # OS image
  roboclaw_install_mode: "release"       # or "development"
```

### Available Instance Types

```bash
# List all available instance types and prices
./list-server-types.sh
cat available-server-types.txt
```

**Popular options:**
- `cax11` (ARM): €3.29/mo - 2 vCPU, 4GB RAM, 40GB disk (default)
- `cx23` (x86): €2.99/mo - 2 vCPU, 4GB RAM, 40GB disk
- `cax21` (ARM): €5.99/mo - 4 vCPU, 8GB RAM, 80GB disk
- `cpx22` (x86): €5.99/mo - 2 vCPU, 4GB RAM, 80GB disk

## Instance Artifacts

After successful provisioning, a YAML artifact is automatically created in `instances/<server-name>.yml` containing:

- Instance metadata (name, IP, server type, location)
- Installed software versions (Docker, Node.js, pnpm, Clawdbot)
- Configuration details (clawdbot user, firewall rules)
- Provisioning timestamp and install mode
- Deletion timestamp (added when server is deleted)

**The validation script uses these artifacts** to verify that the actual server state matches what was provisioned.

**Lifecycle tracking:** When you delete a server using `./run-hetzner.sh delete`, the artifact is:
- Renamed from `<server-name>.yml` to `<server-name>_deleted.yml`
- Updated with `deleted_at` timestamp
- Updated with `status: deleted` flag

This preserves the history of your instances and makes it easy to distinguish active from deleted instances.

Example artifact (active instance) - `instances/finland-instance.yml`:
```yaml
instances:
  - name: finland-instance
    ip: 65.21.149.78
    server_type: cax11
    location: hel1
    provisioned_at: 2026-01-31T23:20:00Z
    install_mode: fast
    software:
      os: Ubuntu 24.04
      docker: Docker version 29.2.0, build 0b9d198
      nodejs: v22.22.0
      pnpm: 10.28.2
      roboclaw: 2026.1.24-3
    firewall:
      ufw_enabled: true
```

Example artifact (deleted instance) - `instances/finland-instance_deleted.yml`:
```yaml
instances:
  - name: finland-instance
    ip: 65.21.149.78
    provisioned_at: 2026-01-31T23:20:00Z
    deleted_at: 2026-02-01T06:47:30Z
    install_mode: fast
    status: deleted
```

## Validate Provisioning

After provisioning, validate that everything was installed correctly:

```bash
# Validate default instance (finland-instance)
./validate-instance.sh

# Validate specific instance
./validate-instance.sh my-server

# Show help
./validate-instance.sh --help
```

The validation script checks:
- SSH connectivity
- OS and kernel versions
- Software versions (Docker, Node.js, pnpm, RoboClaw)
- RoboClaw user and directory structure
- Docker group membership and access
- UFW firewall configuration
- Docker daemon status

Example output:
```
✓ All validation checks passed!

Instance: finland-instance
IP Address: 65.21.149.78
Checks Passed: 17
Checks Failed: 0
```

## Post-Installation

After provisioning, connect and configure RoboClaw:

```bash
# 1. SSH into server
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)

# 2. Switch to roboclaw user
sudo su - roboclaw

# 3. Run onboarding wizard
openclaw onboard --install-daemon

# This will:
# - Configure messaging provider (WhatsApp/Telegram/Signal)
# - Create roboclaw.json config
# - Install systemd service
# - Start the daemon
```

## File Structure

```
.
├── README.md                    # This file (quick start)
├── PROVISION.md                 # Detailed technical documentation
├── HETZNER_SETUP.md            # Setup guide
├── ROBOCLAW_GUIDE.md           # RoboClaw integration guide
├── run-deploy.sh               # Deploy to existing servers (CLI)
├── connect-instance.sh         # Connect to instances and run OpenClaw
├── create-inventory.sh         # Generate inventory files from IP
├── cleanup-ssh-key.yml         # Manage SSH keys in Hetzner
├── run-hetzner.sh              # Provision new Hetzner servers
├── validate-instance.sh        # Validation script
├── hetzner-finland-fast.yml    # Hetzner provision playbook
├── hetzner-teardown.yml        # Teardown playbook
├── reconfigure.yml             # Software installation playbook
├── list-server-types.sh        # List instance types
├── .env                        # Your API token (gitignored)
├── .env.example                # Template
├── venv/                       # Python virtual environment
├── requirements.txt            # Python dependencies
├── hetzner_key                 # SSH private key (auto-generated, gitignored)
├── hetzner_key.pub             # SSH public key
├── ssh-keys/                   # SSH keys for deployments
├── finland-instance-ip.txt     # Server IP address
├── roboclaw/                   # RoboClaw source code (submodule)
└── instances/                  # Instance artifacts (YAML)
```

## Requirements

**For CLI deployment (run-deploy.sh):**
- Python 3.12+ (required for Ansible 13+)
- SSH access to target server(s)

**For Hetzner provisioning (run-hetzner.sh):**
- Python 3.12+
- Hetzner Cloud account with API token

### Automatic Setup

```bash
# One command to install everything
./setup.sh

# That's it! The script will:
# - Find Python 3.12+ (checks python3.12, python3, python, pyenv)
# - Create virtual environment
# - Install all dependencies
# - Install Ansible collections
```

If you don't have Python 3.12+, the script will show you how to install it:
- **pyenv** (recommended): `pyenv install 3.12.0`
- **apt** (Ubuntu/Debian): `sudo apt install python3.12 python3.12-venv`
- **brew** (macOS): `brew install python@3.12`

The deployment scripts automatically check prerequisites and suggest running `./setup.sh` if anything is missing.

## How It Works

1. **Provision Play**: Creates VPS in Helsinki, uploads SSH key
2. **Configure Play**: Runs hello world, verifies connectivity
3. **Install Play**: Installs software stack from local machine
   - Docker, Node.js, pnpm, UFW firewall
   - Creates roboclaw user with Docker access
   - Installs RoboClaw via pnpm
   - Saves artifact to `instances/<server-name>.yml`
4. **Validation** (optional): Verifies installation with 17 automated checks

Everything runs from your local machine. No manual SSH required.

## Security

- **Firewall**: UFW blocks all incoming except SSH (22)
- **Docker Isolation**: DOCKER-USER chain prevents containers bypassing firewall
- **Non-root**: Runs as dedicated `roboclaw` user
- **SSH Key**: Auto-generated ed25519 key, gitignored
- **API Token**: Stored in .env, gitignored

## Troubleshooting

### Check if provisioning was successful
```bash
# Run validation to diagnose issues
./validate-instance.sh

# Shows exactly which checks pass/fail:
# - SSH connectivity
# - Software versions
# - RoboClaw installation
# - Firewall configuration
# - Docker setup
```

### "Permission denied" when provisioning
Your API token is read-only. Create a new token with **Read & Write** permissions.

### "Server type unavailable"
Run `./list-server-types.sh` to see available types in Helsinki.

### Can't SSH to server
```bash
# Wait 30-60 seconds after provisioning
# Test with verbose output
ssh -i hetzner_key -v root@$(cat finland-instance-ip.txt)

# Or use validation script
./validate-instance.sh
```

### Playbook fails mid-run
Re-run it. The playbook is idempotent (safe to run multiple times).

```bash
# After re-running, validate the instance
./run-hetzner.sh
./validate-instance.sh
```

### Want to start fresh
```bash
# Delete server
./run-hetzner.sh delete
# This renames the artifact to finland-instance_deleted.yml

# Remove local files (optional)
rm hetzner_key hetzner_key.pub finland-instance-ip.txt

# Remove deleted instance artifacts (optional)
rm instances/*_deleted.yml

# Provision again
./run-hetzner.sh

# Validate
./validate-instance.sh
```

## Complete Workflows

### Deploy to Existing Server - Complete Example

```bash
# 1. One-time setup (requires Python 3.12+)
./setup.sh

# 2. Create inventory from your server IP
./create-inventory.sh 192.168.1.100 production.ini

# 3. Deploy and auto-onboard
INSTANCE_NAME_OVERRIDE=production ./run-deploy.sh \
  -k ~/.ssh/prod-key \
  -i production.ini

# The script will:
# - Check prerequisites (Python 3.12+, Ansible, dependencies)
# - Deploy OpenClaw + all dependencies
# - Create artifact at ./instances/production.yml
# - Automatically launch 'openclaw onboard' wizard
# - Drop you into interactive configuration

# 4. Later, reconnect if needed
./connect-instance.sh production onboard
```

### Deploy Multiple Servers

```bash
# Server 1
./create-inventory.sh 192.168.1.100 server1.ini
INSTANCE_NAME_OVERRIDE=server1 ./run-deploy.sh -k key -i server1.ini

# Server 2
./create-inventory.sh 192.168.1.101 server2.ini
INSTANCE_NAME_OVERRIDE=server2 ./run-deploy.sh -k key -i server2.ini

# List all instances
ls -la ./instances/
```

## Examples

### Provision Multiple Servers (Hetzner)

```bash
# Edit server name in hetzner-finland-fast.yml
vim hetzner-finland-fast.yml
# Change: server_name: "finland-instance-2"

# Run provisioning
./run-hetzner.sh

# Validate the new instance
./validate-instance.sh finland-instance-2

# List all servers
./run-hetzner.sh list
```

### Use Different Instance Type

```bash
# See available types
./list-server-types.sh

# Edit hetzner-finland-fast.yml
vim hetzner-finland-fast.yml
# Change: server_type: "cax21"  # 4 vCPU, 8GB RAM

# Provision
./run-hetzner.sh

# Validate
./validate-instance.sh
```

### Validate Provisioning

```bash
# Check if provisioning was successful
./validate-instance.sh

# Example successful output:
# ✓ All validation checks passed!
# Instance: finland-instance
# Checks Passed: 17
# Checks Failed: 0

# Validate a specific instance
./validate-instance.sh my-server

# If validation fails, it shows which checks failed
# Then you can re-provision or fix specific issues
```

### Delete Specific Server

```bash
# List servers first
./run-hetzner.sh list

# Delete by name
./run-hetzner.sh delete -e server_name=finland-instance-2
```

## Documentation

- **README.md** (this file): Quick start and common commands
- **PROVISION.md**: Detailed technical documentation, architecture, design decisions
- **HETZNER_SETUP.md**: Original setup guide
- **roboclaw/**: RoboClaw source code (submodule)

## Resources

- Hetzner Cloud Console: https://console.hetzner.cloud/
- Hetzner API Docs: https://docs.hetzner.cloud/
- Hetzner Pricing: https://www.hetzner.com/cloud
- Ansible Docs: https://docs.ansible.com/

## License

See roboclaw/ for RoboClaw licensing.

## Support

For issues with:
- **Provisioning/teardown**: Check PROVISION.md
- **RoboClaw**: See roboclaw/README.md
- **Hetzner API**: Check Hetzner Cloud Console

---

## TLDR

**Deploy to existing server (recommended):**
```bash
# One-time setup
./setup.sh

# Deploy with auto-onboard
./create-inventory.sh <IP> inventory.ini
INSTANCE_NAME_OVERRIDE=my-server ./run-deploy.sh -k ~/.ssh/key -i inventory.ini
# ↑ Automatically launches 'openclaw onboard' wizard
```

**Or provision new Hetzner server:**
```bash
echo 'HCLOUD_TOKEN=your-token' > .env
./run-hetzner.sh                          # Provision (~2-3 min)
./validate-instance.sh                     # Validate (17 checks)
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)
sudo su - roboclaw
openclaw onboard --install-daemon
```
