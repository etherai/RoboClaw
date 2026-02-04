# clawctl

> CLI tool for deploying and managing OpenClaw instances via Docker

**clawctl** is a command-line tool that deploys OpenClaw to remote servers using SSH and Docker. It replaces the previous Python/Ansible-based deployment system with a single Node.js command.

## Features

- ✅ **One-command deployment** - `npx clawctl deploy <IP> --key <path>` does everything
- ✅ **Zero local setup** - Uses `npx` to run without installation
- ✅ **Idempotent operations** - Safe to run multiple times
- ✅ **Resume capability** - Automatically resumes from failure point
- ✅ **Docker-first** - Runs OpenClaw in containers for isolation and security
- ✅ **Non-root containers** - Containers run as UID 1000 for security
- ✅ **Interactive onboarding** - Guided setup wizard via SSH tunnel

## Requirements

- **Local machine:**
  - Node.js 18 or higher
  - SSH private key with root access to target server

- **Target server:**
  - Ubuntu 20.04+ or Debian 11+
  - SSH access as root user
  - Internet connection (to download Docker and OpenClaw)

## Quick Start

Deploy OpenClaw to a remote server:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519
```

This single command will:
1. Connect to the server via SSH
2. Install Docker and dependencies
3. Create a dedicated `roboclaw` system user
4. Build the OpenClaw Docker image
5. Run the interactive onboarding wizard
6. Start the OpenClaw gateway daemon
7. Create a local instance artifact for future management

## Installation

### Option 1: npx (Recommended)

No installation needed! Just use `npx`:

```bash
npx clawctl deploy <IP> --key <path>
```

### Option 2: Global Install

Install globally for faster access:

```bash
npm install -g clawctl
clawctl deploy <IP> --key <path>
```

### Option 3: Local Development

Clone the repository and build from source:

```bash
git clone https://github.com/openclaw/roboclaw.git
cd roboclaw
npm install
npm run build
node dist/index.js deploy <IP> --key <path>
```

## Usage

### Deploy Command

```bash
npx clawctl deploy <ip> [options]
```

**Arguments:**
- `<ip>` - Target server IP address (required)

**Options:**
- `-k, --key <path>` - SSH private key path (required)
- `-n, --name <name>` - Instance name (default: `instance-<IP-dashed>`)
- `-u, --user <user>` - SSH username (default: `root`, must have root privileges)
- `-p, --port <port>` - SSH port (default: `22`)
- `-b, --branch <branch>` - OpenClaw git branch (default: `main`)
- `--skip-onboard` - Skip interactive onboarding wizard
- `-g, --global` - Save instance artifact to `~/.clawctl/instances/`
- `-f, --force` - Ignore partial deployment state and start fresh
- `--clean` - Remove everything and start over
- `-v, --verbose` - Verbose output for debugging

### Examples

**Basic deployment:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519
```

**With custom instance name:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --name production
```

**Deploy a specific branch:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --branch feature/new-ui
```

**Skip onboarding (for automation):**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --skip-onboard
```

**Verbose output:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --verbose
```

## Documentation

For complete documentation, see:
- **Quick Start:** This README
- **Strategy & Vision:** `specs/clawctl-strategy.md`
- **Technical Specification:** `specs/clawctl-spec.md`
- **CLI Design:** `specs/clawctl-cli-spec.md`

## License

Apache-2.0 - See [LICENSE](LICENSE) file for details

## Support

- **Issues:** https://github.com/openclaw/roboclaw/issues
- **Community:** [OpenClaw Discord](https://discord.gg/8DaPXhRFfv)
- **Twitter:** [@RoboClawX](https://x.com/RoboClawX)

---

**Built with ❤️ by the RoboClaw Development Team**
