# RoboClaw

> 🚧 **PROJECT NOT FUNCTIONAL** — This project is currently in early development and is **not in a functional state**.
>
> **Want to get involved?** Join the [OpenClaw Discord community](https://discord.gg/8DaPXhRFfv) where active development is happening in the voice chat channels! This is where the community is building RoboClaw together.

Deploy your own OpenClaw instance in minutes. Free, secure, and fully reversible. *(Coming soon)*

## Quick Start

```bash
# 1. Deploy OpenClaw to your server via SSH
roboclaw deploy --ssh user@your-server-ip

# Example output:
# ✓ Connected via SSH
# ✓ Running Ansible playbook...
# ✓ OpenClaw installed
# ✓ RoboClaw features configured
# ✓ Your personal OpenClaw is ready!
# 🎉 Dashboard: https://your-server-ip:3000

# 2. Connect to your server and onboard RoboClaw
ssh user@your-server-ip
sudo su - roboclaw
openclaw onboard --install-daemon
```

## What You Get

- **Your Data Stays on Your Server** — Full control over your data
- **Your Secrets Stay on Your Computer** — API keys and passwords never leave your machine
- **No Vendor Lock-In** — Works with any cloud provider (AWS, DigitalOcean, Linode, Hetzner, or even your home server)
- **Automatic Backups** — Your configurations are automatically backed up
- **Activity Logging** — See everything your AI agents do
- **Secure Password Storage** — Credentials are encrypted and stored safely

## How It Works

RoboClaw uses SSH and Ansible to deploy [OpenClaw](https://github.com/openclaw/openclaw) to your server. Powered by [openclaw/clawdbot-ansible](https://github.com/openclaw/clawdbot-ansible).

1. **Connect to your VPS** — Uses your SSH credentials to access your server
2. **Provision the Server** — Installs Docker, Node.js, and other dependencies
3. **Install OpenClaw** — Deploys the latest OpenClaw version
4. **Configure Security** — Sets up firewall rules and creates dedicated user accounts
5. **Enable RoboClaw Features** — Configures automatic updates, backups, and activity logging

Everything runs from your local machine. No manual SSH configuration required.

## Requirements

- A VPS or server with SSH access
- Ubuntu 24.04 (recommended) or similar Linux distribution
- Python 3.12+ (for Ansible)
- SSH key or password authentication

## Post-Installation

After deploying, connect to your server and run the onboarding wizard:

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Switch to the roboclaw user
sudo su - roboclaw

# 3. Run onboarding wizard
openclaw onboard --install-daemon

# This will:
# - Configure messaging provider (WhatsApp/Telegram/Discord/Slack/Matrix)
# - Create roboclaw.json config
# - Install systemd service
# - Start the daemon
```

## Security

- **Firewall Protection** — UFW blocks all incoming traffic except SSH (22)
- **Docker Isolation** — Containers are isolated and can't bypass the firewall
- **Non-root User** — OpenClaw runs as a dedicated `roboclaw` user
- **SSH Key Authentication** — Supports ed25519 and RSA keys
- **Encrypted Credentials** — API tokens and passwords are stored securely

## Join the Community

**🎙️ Active Development in Progress!**

RoboClaw is being built live in the OpenClaw Discord community. Join us in the voice chat channels to:
- Watch development happen in real-time
- Contribute ideas and feedback
- Help shape the project
- Connect with other community members

**Links:**
- **Discord**: [discord.gg/8DaPXhRFfv](https://discord.gg/8DaPXhRFfv) — Join the voice chat!
- **GitHub**: [github.com/hintjen/roboclaw](https://github.com/hintjen/roboclaw)
- **Website**: [roboclaw.ai](https://roboclaw.ai)

## Coming Soon

- **RoboClaw UI** — Visual deployment interface (currently shown on website)
- **RoboClaw Cloud** — Managed hosting with zero infrastructure hassle
- **Community Marketplace** — Browse and deploy workflows, plugins, and skills from the OpenClaw community

## Documentation

Coming soon

## License

AGPL-3.0

## Support

- For deployment issues, join our [Discord](https://discord.gg/8DaPXhRFfv)
- For OpenClaw issues, see the [OpenClaw repository](https://github.com/openclaw/openclaw)

---

Made with Love by [Hintjen](https://github.com/hintjen). Powered by ClawFleet and [OpenClaw](https://github.com/openclaw/openclaw).
