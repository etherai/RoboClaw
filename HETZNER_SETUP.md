# Hetzner Finland Instance Setup

Quick guide to create a server in Helsinki, Finland using Ansible.

## Prerequisites

1. **Hetzner Cloud Account**
   - Sign up at https://console.hetzner.cloud/
   - Create a project

2. **API Token**
   - Go to your project → Security → API Tokens
   - Generate a new token with Read & Write permissions
   - Save it securely

3. **SSH Key**
   - Generate if you don't have one: `ssh-keygen -t ed25519 -C "your@email.com"`
   - Your public key is at `~/.ssh/id_ed25519.pub`

## Installation

```bash
# Install Ansible (if not already installed)
pip3 install ansible

# Install Hetzner collection
ansible-galaxy collection install -r hetzner-requirements.yml
```

## Usage

```bash
# 1. Make sure your .env file has HCLOUD_TOKEN set
#    (See .env.example for format)

# 2. Run the playbook (credentials loaded from .env automatically)
./cli/cli/run-hetzner.sh

# 3. Connect to your server (IP saved to finland-instance-ip.txt)
ssh root@$(cat finland-instance-ip.txt)
```

**Note**: Your `.env` file is automatically added to `.gitignore` to prevent token leaks.

## Customization

Edit `hetzner-finland.yml` to change:
- `server_type`: Instance size (cx22, cx32, cx42, etc.)
- `server_name`: Your server's name
- `image`: OS image (ubuntu-24.04, debian-12, rocky-9, etc.)

## Pricing

Default `cx22` instance costs ~€5.28/month:
- 2 vCPU
- 4GB RAM
- 40GB NVMe SSD
- 20TB traffic

Smaller options:
- `cx11`: €4.15/month (1 vCPU, 2GB RAM)
- `cx21`: €4.71/month (2 vCPU, 4GB RAM)

## Teardown

```bash
# List all servers
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags list

# Delete server (with confirmation prompt)
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete

# Delete specific server
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete -e server_name=my-server

# Delete server and SSH key
source .env && source venv/bin/activate && \
  ansible-playbook hetzner-teardown.yml --tags delete -e delete_ssh_key=true

# Clean up local files
rm hetzner_key hetzner_key.pub finland-instance-ip.txt
```
