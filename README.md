# Hetzner VPS Provisioning with Clawdbot

One-command provisioning of VPS instances in Finland with automated Clawdbot installation.

## Quick Start

```bash
# 1. Get Hetzner API token from https://console.hetzner.cloud/
#    Project → Security → API Tokens → Generate (Read & Write)

# 2. Create .env file
echo 'HCLOUD_TOKEN=your-64-char-token-here' > .env

# 3. Provision VPS
./run-hetzner.sh

# 4. Connect
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)
```

## Commands

### Provision New Server

```bash
# Fast install (DEFAULT) - essentials only (~2-3 minutes)
./run-hetzner.sh

# Full install - includes oh-my-zsh, extra tools (~10-15 minutes)
./run-hetzner.sh full
```

**Fast install includes:**
- Ubuntu 24.04 ARM (2 vCPU, 4GB RAM, 40GB SSD)
- Docker CE
- Node.js 22 + pnpm
- Tailscale VPN
- UFW firewall (SSH + Tailscale only)
- Clawdbot latest version
- Cost: €3.29/month
- **Time: ~2-3 minutes**

**Full install adds:**
- oh-my-zsh (zsh framework)
- 46 extra system tools (debugging, networking)
- Git aliases and config
- Vim configuration
- **Time: ~10-15 minutes**

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
```

## Configuration

Edit `hetzner-finland.yml` to customize:

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

### Optional: Connect Tailscale

```bash
# As root on the VPS
sudo tailscale up

# Or with SSH enabled
sudo tailscale up --ssh
```

## File Structure

```
.
├── README.md                    # This file (quick start)
├── PROVISION.md                 # Detailed technical documentation
├── HETZNER_SETUP.md            # Setup guide
├── run-hetzner.sh              # Main script (provision/list/delete)
├── hetzner-finland.yml         # Provision playbook
├── hetzner-teardown.yml        # Teardown playbook
├── list-server-types.sh        # List instance types
├── .env                        # Your API token (gitignored)
├── .env.example                # Template
├── hetzner_key                 # SSH private key (auto-generated, gitignored)
├── hetzner_key.pub             # SSH public key
└── finland-instance-ip.txt     # Server IP address
```

## Requirements

- Python 3.12+
- Hetzner Cloud account with API token
- No Ansible installation needed (uses virtualenv)

## How It Works

1. **Provision Play**: Creates VPS in Helsinki, uploads SSH key
2. **Configure Play**: Runs hello world, verifies connectivity
3. **Install Play**: Runs clawdbot-ansible role from local machine
   - Installs Docker, Node.js, Tailscale, UFW
   - Creates clawdbot user
   - Installs Clawdbot via pnpm

Everything runs from your local machine. No manual SSH required.

## Security

- **Firewall**: UFW blocks all incoming except SSH (22) and Tailscale (41641/udp)
- **Docker Isolation**: DOCKER-USER chain prevents containers bypassing firewall
- **Non-root**: Runs as dedicated `clawdbot` user
- **SSH Key**: Auto-generated ed25519 key, gitignored
- **API Token**: Stored in .env, gitignored

## Troubleshooting

### "Permission denied" when provisioning
Your API token is read-only. Create a new token with **Read & Write** permissions.

### "Server type unavailable"
Run `./list-server-types.sh` to see available types in Helsinki.

### Can't SSH to server
```bash
# Wait 30-60 seconds after provisioning
# Test with verbose output
ssh -i hetzner_key -v root@$(cat finland-instance-ip.txt)
```

### Playbook fails mid-run
Re-run it. The playbook is idempotent (safe to run multiple times).

### Want to start fresh
```bash
# Delete server
./run-hetzner.sh delete

# Remove local files
rm hetzner_key hetzner_key.pub finland-instance-ip.txt

# Provision again
./run-hetzner.sh
```

## Examples

### Provision Multiple Servers

```bash
# Edit server name in hetzner-finland.yml
vim hetzner-finland.yml
# Change: server_name: "finland-instance-2"

# Run provisioning
./run-hetzner.sh

# List all servers
./run-hetzner.sh list
```

### Use Different Instance Type

```bash
# See available types
./list-server-types.sh

# Edit hetzner-finland.yml
vim hetzner-finland.yml
# Change: server_type: "cax21"  # 4 vCPU, 8GB RAM

# Provision
./run-hetzner.sh
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
./run-hetzner.sh                          # Provision
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)
sudo su - clawdbot
clawdbot onboard --install-daemon
```
