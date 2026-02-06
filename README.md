# RoboClaw

> Community-built deployment system for self-hosted OpenClaw AI assistants

**Join the community:** [OpenClaw Discord](https://discord.gg/8DaPXhRFfv) | Follow [@RoboClawX](https://x.com/RoboClawX) for updates

---

## What is This?

**RoboClaw** is a community-developed deployment automation system that provisions self-hosted **OpenClaw** instances to remote servers. OpenClaw is an AI assistant platform that provides intelligent assistance through command-line and web interfaces.

Made by the community, for the community. Deploy a complete OpenClaw instance to any Ubuntu/Debian server with a single command.

## Quick Start

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519
```

That's it! This single command deploys OpenClaw to your server in ~3-5 minutes.

See the [clawctl README](clawctl/README.md) for detailed documentation.

## What Gets Deployed

When you run `npx clawctl deploy`, the following is automatically installed on your server:

- **Docker containers** running OpenClaw CLI and Gateway services
- **Dedicated `roboclaw` system user** (UID 1000) for non-root security
- **Web dashboard** accessible via SSH tunnel at http://localhost:18789
- **Interactive onboarding** wizard for initial configuration
- **Persistent data** stored in `~/.openclaw/` directory

## Requirements

**Local machine:**
- Node.js 18 or higher
- SSH private key with root access to target server

**Target server:**
- Ubuntu 20.04+ or Debian 11+
- 2GB RAM, 1 vCPU, 10GB disk (minimum)
- Root SSH access
- Internet connection

## Project Structure

```
RoboClaw/
├── clawctl/               # Modern Node.js deployment tool (recommended)
├── ansible-deployment/    # Legacy Python/Ansible system (deprecated)
├── website/               # Project landing page
├── specs/                 # Technical specifications
└── instances/             # Deployment artifacts (created at runtime)
```

## Community

RoboClaw is built by the community, for the community. We welcome contributions, feedback, and collaboration.

**Get Involved:**
- **Discord:** [Join OpenClaw Discord](https://discord.gg/8DaPXhRFfv) - Chat with contributors and users
- **Twitter:** [@RoboClawX](https://x.com/RoboClawX) - Follow for updates and announcements
- **Issues:** [GitHub Issues](https://github.com/openclaw/roboclaw/issues) - Report bugs, request features
- **Pull Requests:** Contributions are welcome! See our codebase to get started

Whether you're fixing bugs, adding features, improving documentation, or helping other users - your contributions make RoboClaw better for everyone.

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

See [LICENSE](LICENSE) for the full license text.

We chose AGPL-3.0 to ensure RoboClaw remains free and open source for the community forever. This license requires anyone who modifies and deploys this software over a network to share their changes back with the community, ensuring everyone benefits from improvements.

---

**For complete documentation, see the [clawctl README](clawctl/README.md).**
