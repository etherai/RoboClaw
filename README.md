# Hetzner VPS Provisioning with Clawdbot

One-command provisioning of VPS instances in Finland with automated Clawdbot installation.

## Quick Start

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

# 6. Onboard Clawdbot
sudo su - clawdbot
clawdbot onboard --install-daemon
```

## Commands

### Provision New Server

```bash
# Provision and install Clawdbot (~2-3 minutes)
./run-hetzner.sh
```

**Install includes:**
- Ubuntu 24.04 ARM (2 vCPU, 4GB RAM, 40GB SSD)
- Docker CE
- Node.js 22 + pnpm
- UFW firewall (SSH only)
- Clawdbot latest version
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
- Clawdbot installation
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
  clawdbot_install_mode: "release"       # or "development"
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
      clawdbot: 2026.1.24-3
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
- Software versions (Docker, Node.js, pnpm, Clawdbot)
- Clawdbot user and directory structure
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

After provisioning, connect and configure Clawdbot:

```bash
# 1. SSH into server
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)

# 2. Switch to clawdbot user
sudo su - clawdbot

# 3. Run onboarding wizard
clawdbot onboard --install-daemon

# This will:
# - Configure messaging provider (WhatsApp/Telegram/Signal)
# - Create clawdbot.json config
# - Install systemd service
# - Start the daemon
```

## File Structure

```
.
├── README.md                    # This file (quick start)
├── PROVISION.md                 # Detailed technical documentation
├── HETZNER_SETUP.md            # Setup guide
├── CLAUDE.md                   # Guide for Claude Code
├── run-hetzner.sh              # Main script (provision/list/delete)
├── validate-instance.sh        # Validation script
├── hetzner-finland-fast.yml    # Provision playbook
├── hetzner-teardown.yml        # Teardown playbook
├── list-server-types.sh        # List instance types
├── .env                        # Your API token (gitignored)
├── .env.example                # Template
├── hetzner_key                 # SSH private key (auto-generated, gitignored)
├── hetzner_key.pub             # SSH public key
├── finland-instance-ip.txt     # Server IP address
└── instances/                  # Instance artifacts (YAML)
```

## Requirements

- Python 3.12+
- Hetzner Cloud account with API token
- No Ansible installation needed (uses virtualenv)

## How It Works

1. **Provision Play**: Creates VPS in Helsinki, uploads SSH key
2. **Configure Play**: Runs hello world, verifies connectivity
3. **Install Play**: Installs software stack from local machine
   - Docker, Node.js, pnpm, UFW firewall
   - Creates clawdbot user with Docker access
   - Installs Clawdbot via pnpm
   - Saves artifact to `instances/<server-name>.yml`
4. **Validation** (optional): Verifies installation with 17 automated checks

Everything runs from your local machine. No manual SSH required.

## Security

- **Firewall**: UFW blocks all incoming except SSH (22)
- **Docker Isolation**: DOCKER-USER chain prevents containers bypassing firewall
- **Non-root**: Runs as dedicated `clawdbot` user
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
# - Clawdbot installation
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

## Examples

### Provision Multiple Servers

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
- **clawdbot-ansible/**: Clawdbot installation playbook (submodule)

## Resources

- Hetzner Cloud Console: https://console.hetzner.cloud/
- Hetzner API Docs: https://docs.hetzner.cloud/
- Hetzner Pricing: https://www.hetzner.com/cloud
- Ansible Docs: https://docs.ansible.com/

## License

See clawdbot-ansible for Clawdbot licensing.

## Support

For issues with:
- **Provisioning/teardown**: Check PROVISION.md
- **Clawdbot**: See clawdbot-ansible/README.md
- **Hetzner API**: Check Hetzner Cloud Console

---

**TLDR:**
```bash
echo 'HCLOUD_TOKEN=your-token' > .env
./run-hetzner.sh                          # Provision (~2-3 min)
./validate-instance.sh                     # Validate (17 checks)
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)
sudo su - clawdbot
clawdbot onboard --install-daemon
```
