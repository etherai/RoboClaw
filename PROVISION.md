# Automated Hetzner VPS Provisioning with Clawdbot

A one-command Ansible playbook that provisions a VPS in Finland (Helsinki) and automatically installs Clawdbot with full security hardening.

## What We Built

An automated infrastructure-as-code solution that:

1. **Provisions Infrastructure** - Creates a Hetzner Cloud VPS in Helsinki datacenter
2. **Installs Clawdbot** - Fully automated setup using the clawdbot-ansible playbook
3. **Security Hardening** - UFW firewall, Docker isolation, Tailscale VPN ready
4. **One Command Deploy** - Everything runs from your local machine

## Architecture

```
Local Machine                     Remote VPS (Helsinki)
├── hetzner-finland.yml    →     ├── Ubuntu 24.04 ARM
├── clawdbot-ansible/      →     ├── Docker CE
├── run-hetzner.sh         →     ├── Node.js 22 + pnpm
├── .env (API token)       →     ├── Tailscale
└── hetzner_key (SSH)      →     ├── UFW Firewall
                                 └── Clawdbot 2026.1.24-3
```

## How It Works

The playbook runs **three sequential plays**:

### Play 1: Provision VPS
```yaml
- Create SSH key in Hetzner Cloud
- Provision cax11 instance (ARM, €3.29/mo)
- Wait for SSH availability
- Add to in-memory inventory
```

### Play 2: Hello World
```yaml
- Display server information
- Create test file (/root/hello-ansible.txt)
- Verify connectivity
```

### Play 3: Install Clawdbot
```yaml
- Run clawdbot-ansible role from local machine
- Install: Docker, Node.js, Tailscale, UFW
- Create clawdbot user with systemd lingering
- Install Clawdbot via pnpm
- Configure environment
```

## File Structure

```
.
├── PROVISION.md                    # This file
├── HETZNER_SETUP.md               # Quick start guide
├── hetzner-finland.yml            # Main playbook (3 plays)
├── hetzner-requirements.yml       # Ansible Galaxy dependencies
├── run-hetzner.sh                 # Wrapper script (virtualenv + .env)
├── list-server-types.sh           # List available Hetzner instance types
├── .env                           # HCLOUD_TOKEN (gitignored)
├── .env.example                   # Template for .env
├── hetzner_key                    # Auto-generated SSH key (gitignored)
├── hetzner_key.pub                # Public key
├── finland-instance-ip.txt        # Saved IP address
├── available-server-types.txt     # Cached server type list
├── venv/                          # Python virtualenv for Ansible
└── clawdbot-ansible/              # Clawdbot installation playbook
    ├── playbook.yml               # Clawdbot installer
    ├── requirements.yml           # Ansible collections
    └── roles/clawdbot/            # Main installation role
        ├── tasks/
        │   ├── main.yml           # Task orchestration
        │   ├── system-tools.yml   # Base packages
        │   ├── tailscale.yml      # VPN setup
        │   ├── user.yml           # User creation
        │   ├── docker.yml         # Docker CE
        │   ├── firewall.yml       # UFW configuration
        │   ├── nodejs.yml         # Node.js + pnpm
        │   └── clawdbot.yml       # Clawdbot installation
        └── defaults/main.yml      # Default variables
```

## Current Server Details

**Provisioned**: 2026-02-01
**Location**: Helsinki, Finland (hel1)
**IP Address**: `65.21.149.78`
**Instance Type**: cax11 (ARM64)
**Specs**: 2 vCPU, 4GB RAM, 40GB SSD
**Cost**: €3.29/month

**Installed Software**:
- OS: Ubuntu 24.04 LTS (ARM64)
- Kernel: 6.8.0-90-generic
- Docker: Latest CE
- Node.js: v22.22.0
- pnpm: 10.28.2
- Clawdbot: 2026.1.24-3
- Tailscale: Latest (not yet connected)

**Security**:
- UFW Firewall: Enabled
  - Allowed: SSH (22), Tailscale (41641/udp)
  - Default: Deny incoming, allow outgoing
- Docker: DOCKER-USER chain configured
- User: clawdbot (non-root, sudo access)

## Usage

### First Time Setup

```bash
# 1. Get Hetzner API token
# Go to: https://console.hetzner.cloud/ → Security → API Tokens
# Create a Read & Write token

# 2. Create .env file
cat > .env <<EOF
HCLOUD_TOKEN=your-64-char-token-here
EOF

# 3. Run the playbook
./run-hetzner.sh
```

### Connect to Server

```bash
# SSH as root
ssh -i hetzner_key root@$(cat finland-instance-ip.txt)

# Or directly
ssh -i hetzner_key root@65.21.149.78

# Switch to clawdbot user
sudo su - clawdbot

# Run onboarding
clawdbot onboard --install-daemon
```

### Re-run Playbook

The playbook is **idempotent** - safe to run multiple times:

```bash
# Update existing server
./run-hetzner.sh

# Provision a new server (change server_name in yml first)
./run-hetzner.sh
```

### List Available Instance Types

```bash
# Refresh available server types
./list-server-types.sh

# View cached list
cat available-server-types.txt
```

### Teardown/Destroy Server

### List All Servers

```bash
# Load .env and run playbook with list tag
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags list
```

### Delete Specific Server

```bash
# Delete default server (finland-instance) with confirmation
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete

# Delete specific server
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete \
  -e server_name=my-other-server

# Delete server AND remove SSH key from Hetzner
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete \
  -e delete_ssh_key=true
```

### Clean Up Everything Locally

```bash
# Remove all local artifacts
rm hetzner_key hetzner_key.pub finland-instance-ip.txt
```

**What Gets Deleted:**
- ✅ Hetzner Cloud server (with confirmation prompt)
- ✅ Local IP file (finland-instance-ip.txt)
- ⚠️  SSH keys kept locally unless manually removed
- ⚠️  Hetzner SSH key kept unless `-e delete_ssh_key=true`

## Customization

Edit `hetzner-finland.yml` to customize:

```yaml
vars:
  server_name: "finland-instance"        # Change server name
  server_type: "cax11"                   # Instance size (see list-server-types.sh)
  location: "hel1"                       # Helsinki (hel1), Falkenstein (fsn1), Nuremberg (nbg1)
  image: "ubuntu-24.04"                  # OS image
  clawdbot_install_mode: "release"       # or "development"
  nodejs_version: "22.x"                 # Node.js version
```

## What Gets Installed (88 Tasks)

**System Tools (Linux)**:
- Essential packages: curl, wget, git, vim, zsh, jq, tmux, htop
- oh-my-zsh for clawdbot user
- Global git configuration

**Tailscale VPN**:
- GPG key + repository
- Tailscale package
- Service enabled (manual `tailscale up` required)

**User Management**:
- clawdbot system user created
- Home: `/home/clawdbot`
- Shell: zsh with oh-my-zsh
- Sudo: NOPASSWD access
- Systemd lingering enabled
- XDG_RUNTIME_DIR configured

**Docker**:
- Docker CE (latest)
- User added to docker group
- Daemon configured for UFW compatibility
- Service started and enabled

**Firewall (UFW)**:
- Default policies: deny incoming, allow outgoing
- Allowed: SSH (22), Tailscale (41641/udp)
- DOCKER-USER chain configured
- Docker isolation enabled

**Node.js**:
- Node.js 22.x via NodeSource
- pnpm package manager (global)
- Configured for clawdbot user

**Clawdbot**:
- Installed via: `pnpm install -g clawdbot@latest`
- Config directory: `/home/clawdbot/.clawdbot/`
- Subdirectories: sessions, credentials, data, logs
- Version: 2026.1.24-3

## Key Features

### 1. Security First
- Minimal attack surface (only SSH + Tailscale exposed)
- Docker containers can't bypass firewall
- Non-root execution
- NOPASSWD sudo for convenience (can be changed)

### 2. Fully Automated
- No manual SSH required
- Auto-generates SSH keys
- Loads credentials from .env
- Runs from local machine

### 3. Idempotent
- Safe to run multiple times
- Updates existing server
- Won't duplicate resources

### 4. ARM64 Optimized
- Uses ARM instance (cax11) for cost savings
- 33% cheaper than x86 equivalent
- Same performance for Node.js workloads

## Next Steps

### On the VPS

```bash
# 1. Connect
ssh -i hetzner_key root@65.21.149.78

# 2. Switch user
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
# As root
sudo tailscale up

# Or with custom settings
sudo tailscale up --ssh --accept-routes
```

### Optional: Add More Servers

```bash
# Edit server_name in hetzner-finland.yml
vim hetzner-finland.yml

# Change:
# server_name: "finland-instance-2"

# Run playbook
./run-hetzner.sh
```

## Costs

**Monthly Costs**:
- VPS (cax11): €3.29/month
- Bandwidth: 20TB included (€1.19/TB overage)
- **Total**: €3.29/month

**Cheaper Alternatives**:
- cx23 (x86): €2.99/month (2 vCPU, 4GB RAM)
- cpx11 (x86): €4.49/month (2 vCPU, 2GB RAM) - unavailable in hel1

**More Powerful Options**:
- cax21: €5.99/month (4 vCPU, 8GB RAM)
- cpx22: €5.99/month (2 vCPU, 4GB RAM, 80GB disk)

## Troubleshooting

### "Permission denied" error
Your API token is read-only. Create a new token with **Read & Write** permissions.

### "Server type unavailable"
The instance type doesn't exist in Helsinki. Run `./list-server-types.sh` to see available types.

### Can't connect via SSH
```bash
# Check if server is running
curl -H "Authorization: Bearer $HCLOUD_TOKEN" \
  https://api.hetzner.cloud/v1/servers

# Wait for SSH (might take 30-60 seconds after creation)
ssh -i hetzner_key -v root@$(cat finland-instance-ip.txt)
```

### Playbook fails mid-run
Re-run it. The playbook is idempotent and will resume from where it failed.

### Want to start fresh
```bash
# Delete server from Hetzner console
# Delete local files
rm finland-instance-ip.txt hetzner_key hetzner_key.pub

# Re-run
./run-hetzner.sh
```

## Technical Notes

### Why ARM (cax11)?
- 33% cheaper than x86 cpx22
- Same performance for Node.js/Docker workloads
- Native Ubuntu 24.04 ARM support
- Better power efficiency

### Why Helsinki?
- EU location (GDPR compliant)
- Low latency to Europe
- Hetzner's newest datacenter
- Full instance type availability

### Why Local Execution?
- No need to copy playbooks to remote server
- Single source of truth
- Easier to version control
- Faster iteration

### SSH Key Management
- Auto-generated on first run
- Stored locally as `hetzner_key`
- Added to `.gitignore` automatically
- Uses ed25519 (modern, secure)

## Success Metrics

```
PLAY RECAP *********************************************************************
65.21.149.78               : ok=88   changed=40   unreachable=0    failed=0
localhost                  : ok=6    changed=1    unreachable=0    failed=0

Total time: ~5 minutes
Total tasks: 94
Success rate: 100%
```

## What's Different from clawdbot-ansible

**Original clawdbot-ansible**:
- Runs ON the target machine
- Requires manual login
- Single-machine focus
- Local execution only

**Our hetzner-finland.yml**:
- Provisions infrastructure first
- Runs FROM local machine
- Multi-server capable
- Includes hello world validation
- Integrates with cloud provider

We're **using** clawdbot-ansible as a role, not replacing it.

## Teardown Strategy

We use Ansible tags to handle both listing and deletion in a single playbook:

**Design Principles:**
1. **Safety First** - Interactive confirmation required (no accidental deletions)
2. **List Before Delete** - Always check what exists before destroying
3. **Minimal Cleanup** - Keep local SSH keys by default (reusable)
4. **Ansible Native** - No shell scripts, just pure Ansible

**Playbook Structure:**
```yaml
hetzner-teardown.yml:
  tags: [list]     # List all servers
  tags: [delete]   # Delete specific server
```

**Workflow:**
```bash
# 1. List all servers
ansible-playbook hetzner-teardown.yml --tags list

# 2. Delete with confirmation
ansible-playbook hetzner-teardown.yml --tags delete

# 3. Override server name
ansible-playbook hetzner-teardown.yml --tags delete -e server_name=my-server

# 4. Delete SSH key too
ansible-playbook hetzner-teardown.yml --tags delete -e delete_ssh_key=true
```

**What Happens:**
1. Loads HCLOUD_TOKEN from .env
2. Lists all servers (if --tags list)
3. Finds target server (if --tags delete)
4. Shows details and prompts for confirmation
5. Deletes server from Hetzner
6. Optionally deletes SSH key from Hetzner
7. Removes local IP file

**Safety Features:**
- Interactive `pause` prompt (requires typing "yes")
- Shows full server details before deletion
- Fails gracefully if server not found
- Keeps local SSH keys for reuse

## Future Enhancements

Potential additions:
- [ ] Multiple server provisioning in one run
- [ ] Automated Tailscale connection
- [ ] DNS record creation
- [ ] Backup automation
- [ ] Monitoring setup (Prometheus/Grafana)
- [ ] Load balancer configuration
- [ ] Multi-region deployment
- [ ] Scheduled teardown (cost control)

## Resources

- Hetzner Cloud Console: https://console.hetzner.cloud/
- Hetzner API Docs: https://docs.hetzner.cloud/
- Clawdbot Docs: (from clawdbot-ansible/README.md)
- Ansible Docs: https://docs.ansible.com/

## Summary

We've built a production-ready, automated VPS provisioning system that:
- ✅ Provisions infrastructure as code
- ✅ Installs Clawdbot with full dependencies
- ✅ Security hardened by default
- ✅ Runs from local machine
- ✅ Idempotent and reliable
- ✅ Costs €3.29/month
- ✅ Deployed in Helsinki, Finland

**One command to production**: `./run-hetzner.sh`
