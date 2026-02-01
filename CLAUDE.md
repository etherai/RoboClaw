# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an infrastructure-as-code project that automates provisioning of Hetzner Cloud VPS instances with Clawdbot pre-installed. The project uses Ansible playbooks executed from your local machine to create, configure, and manage remote VPS instances in Helsinki, Finland.

## Common Commands

### Provisioning

```bash
# Provision and install Clawdbot (~2-3 minutes)
./run-hetzner.sh

# List all servers in your Hetzner account
./run-hetzner.sh list

# Delete server (with confirmation prompt)
./run-hetzner.sh delete

# Delete specific server
./run-hetzner.sh delete -e server_name=my-server

# Delete server AND remove SSH key from Hetzner
./run-hetzner.sh delete -e delete_ssh_key=true
```

### Manual Ansible Execution

```bash
# Activate virtualenv and load credentials
source venv/bin/activate && source .env

# Run playbooks directly
ansible-playbook hetzner-finland-fast.yml
ansible-playbook hetzner-teardown.yml --tags list
ansible-playbook hetzner-teardown.yml --tags delete
```

### Utility Commands

```bash
# List available Hetzner instance types and prices
./list-server-types.sh

# View cached instance types
cat available-server-types.txt

# Connect to provisioned server
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)

# Clean up local files
rm hetzner_key hetzner_key.pub finland-instance-ip.txt
```

## Architecture

### Execution Model

All Ansible playbooks run **from your local machine**, not on the remote server. This is infrastructure-as-code: the local machine orchestrates remote provisioning and configuration.

### Three-Play Architecture

The main playbooks use a three-play pattern:

1. **Play 1: Provision Infrastructure** (runs on localhost)
   - Creates SSH key in Hetzner Cloud
   - Provisions VPS instance
   - Waits for SSH availability
   - Adds server to in-memory inventory

2. **Play 2: Hello World** (runs on remote VPS)
   - Verifies connectivity
   - Optional validation tasks

3. **Play 3: Install Software** (runs on remote VPS)
   - Installs Docker, Node.js, UFW
   - Creates clawdbot user
   - Installs Clawdbot via pnpm

### Installation

**Fast Install** (`hetzner-finland-fast.yml`):
- Inline tasks, no external roles
- Installs essentials: Docker, Node.js, UFW, Clawdbot
- ~2-3 minutes total
- Perfect for production deployments

### Key Files

- `run-hetzner.sh` - Main wrapper script (handles virtualenv, .env loading, command routing)
- `hetzner-finland-fast.yml` - Provision + inline install playbook
- `hetzner-teardown.yml` - Server deletion (tags: list, delete)
- `list-server-types.sh` - Queries Hetzner API for available instance types
- `.env` - Contains HCLOUD_TOKEN (gitignored)
- `hetzner_key` / `hetzner_key.pub` - Auto-generated SSH keys (gitignored)
- `finland-instance-ip.txt` - Saved IP address of provisioned server
- `instances/` - Directory containing YAML artifacts of provisioned instances
- `clawdbot-ansible/` - Git submodule with Clawdbot installation playbook (reference only)

## Configuration

### Environment Variables

The `.env` file must contain:
```bash
HCLOUD_TOKEN=your-64-char-hetzner-api-token
```

Optional: `SSH_PUBLIC_KEY` (auto-generated if not provided)

### Customizing Playbooks

Edit variables in `hetzner-finland-fast.yml`:

```yaml
vars:
  server_name: "finland-instance"        # Server name in Hetzner
  server_type: "cax11"                   # Instance type (ARM, €3.29/mo)
  location: "hel1"                       # Helsinki datacenter
  image: "ubuntu-24.04"                  # OS image
  clawdbot_install_mode: "release"       # or "development"
  nodejs_version: "22.x"                 # Node.js version
```

Instance types: Run `./list-server-types.sh` to see available types and pricing

### Git Submodule

The `clawdbot-ansible/` directory is a git submodule pointing to the official Clawdbot Ansible installer. To update:

```bash
cd clawdbot-ansible
git pull origin main
cd ..
git add clawdbot-ansible
git commit -m "Update clawdbot-ansible submodule"
```

## Security Model

- **Firewall**: UFW blocks all incoming except SSH (22)
- **Docker Isolation**: DOCKER-USER chain prevents containers from bypassing firewall
- **Non-root**: Clawdbot runs as dedicated `clawdbot` user with NOPASSWD sudo
- **SSH Keys**: Auto-generated ed25519 keys, stored locally and gitignored
- **API Token**: Stored in .env, gitignored

## Workflow Examples

### First-Time Setup

```bash
# 1. Get API token from Hetzner console
# 2. Create .env file
echo 'HCLOUD_TOKEN=your-token-here' > .env
# 3. Run provisioning (SSH key auto-generated)
./run-hetzner.sh
# 4. Connect and configure Clawdbot
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)
sudo su - clawdbot
clawdbot onboard --install-daemon
```

### Provisioning Multiple Servers

```bash
# Edit server_name in playbook
vim hetzner-finland-fast.yml  # Change server_name to "finland-instance-2"
# Run provisioning
./run-hetzner.sh
# List all servers
./run-hetzner.sh list
```

### Re-running Playbooks

All playbooks are **idempotent** - safe to run multiple times. They will update existing resources without duplicating.

### Instance Artifacts

After each successful provisioning, a YAML artifact is automatically saved to `instances/<server-name>.yml`. This artifact contains:

- Instance metadata (name, IP address, server type, location, image)
- Provisioning timestamp and install mode
- Installed software versions (OS, Docker, Node.js, pnpm, Clawdbot)
- Configuration details (clawdbot user, home directory, config directory)
- Firewall configuration (enabled, allowed ports)
- SSH key file paths

These artifacts serve as:
- **Documentation**: Track what was installed and when
- **Inventory**: Manage multiple instances
- **Audit trail**: Record of infrastructure changes (including deletions)
- **Reference**: Quick lookup of instance details without SSHing
- **Lifecycle tracking**: Artifacts are updated (not deleted) when instances are torn down

**Deletion tracking**: When you delete a server using `./run-hetzner.sh delete`, the artifact is:
- Renamed from `<server-name>.yml` to `<server-name>_deleted.yml`
- Updated with `deleted_at` timestamp - When the instance was deleted
- Updated with `status: deleted` flag - Marks the instance as no longer active

This preserves the full lifecycle history and makes it easy to distinguish active from deleted instances.

Example usage:
```bash
# View active instance details
cat instances/finland-instance.yml

# View deleted instance details
cat instances/finland-instance_deleted.yml

# List all instances (active and deleted)
ls instances/

# List only active instances
ls instances/*.yml | grep -v "_deleted.yml"

# List only deleted instances
ls instances/*_deleted.yml

# Remove artifacts for deleted instances
rm instances/*_deleted.yml
```

## Troubleshooting

### Common Issues

**"Permission denied" when provisioning**
- Your API token is read-only. Create a new token with Read & Write permissions.

**"Server type unavailable"**
- The instance type doesn't exist in the selected location. Run `./list-server-types.sh`.

**Can't SSH to server**
- Wait 30-60 seconds after provisioning for SSH to become available
- Test with: `ssh -i hetzner_key -v root@$(cat finland-instance-ip.txt)`

**Playbook fails mid-run**
- Re-run it. The playbook is idempotent and will resume from where it failed.

### Python/Ansible Setup

The project uses a Python virtualenv in `venv/`:
- Created automatically by `run-hetzner.sh` on first run
- Contains Ansible and required collections
- Automatically activated by `run-hetzner.sh`

To recreate:
```bash
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
ansible-galaxy collection install -r hetzner-requirements.yml
```

## Project Dependencies

- Python 3.12+
- Ansible (installed in virtualenv)
- Hetzner Cloud Ansible collection (installed via ansible-galaxy)
- Hetzner Cloud account with API token
- Git (for cloning and submodule management)

## Related Documentation

- **README.md** - Quick start guide and common commands
- **PROVISION.md** - Detailed technical documentation and architecture
- **HETZNER_SETUP.md** - Original setup guide
- **clawdbot-ansible/README.md** - Clawdbot installation details
- **clawdbot-ansible/AGENTS.md** - AI agent guidelines for Clawdbot development

## Design Principles

1. **Local Execution** - All Ansible runs from local machine, not on remote server
2. **Infrastructure as Code** - VPS creation, configuration, and deletion fully automated
3. **Idempotent** - All playbooks safe to run multiple times
4. **Security First** - Minimal exposed ports, firewall enabled by default
5. **Cost Optimized** - Uses ARM instances (cax11) for 33% cost savings vs x86
6. **Fast and Lightweight** - Inline tasks, essentials only (~2-3 minutes)
