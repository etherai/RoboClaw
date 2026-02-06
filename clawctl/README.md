# clawctl

> CLI tool for deploying and managing OpenClaw instances via Docker

**clawctl** is a command-line tool that deploys OpenClaw to remote servers using SSH and Docker. It replaces the previous Python/Ansible-based deployment system with a single Node.js command.

## What is OpenClaw?

**OpenClaw** is a self-hosted AI assistant platform that provides intelligent assistance through command-line and web interfaces. It consists of two containerized services:

1. **OpenClaw CLI** - Interactive command-line interface for direct AI interaction
2. **OpenClaw Gateway** - Long-running web service providing a browser-based dashboard

When you deploy OpenClaw with clawctl, you get:
- A complete AI assistant environment running in Docker containers
- Web dashboard accessible at http://localhost:18789 via SSH tunnel
- Device pairing system for secure multi-device access
- Interactive onboarding wizard for initial configuration
- Persistent configuration stored in `~/.openclaw/`

OpenClaw is designed for personal use, team collaboration, development/testing, and edge deployment scenarios where you want full control over your AI infrastructure.

## Features

- ✅ **One-command deployment** - `npx clawctl deploy <IP> --key <path>` does everything
- ✅ **Zero local setup** - Uses `npx` to run without installation
- ✅ **Idempotent operations** - Safe to run multiple times
- ✅ **Automatic resume** - Recovers from failures and continues where it left off
- ✅ **Auto-connect** - Opens browser and approves device pairing automatically after deployment
- ✅ **Error recovery** - `--force` and `--clean` options for handling failed deployments
- ✅ **Docker-first** - Runs OpenClaw in containers for isolation and security
- ✅ **Non-root containers** - Containers run as UID 1000 for security
- ✅ **Interactive onboarding** - Guided setup wizard via SSH tunnel

## Requirements

**Local machine:**
- Node.js 18 or higher
- SSH private key with root access to target server

**Target server:**
- Ubuntu 20.04+ or Debian 11+
- 2GB RAM (minimum), 1 vCPU, 10GB disk
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
4. Build the OpenClaw Docker image from git
5. Generate Docker Compose configuration
6. Start the containers
7. Run the interactive onboarding wizard
8. Open the web dashboard in your browser
9. Automatically approve the device pairing request
10. Create a local instance artifact for future management

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
cd roboclaw/clawctl
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
| Option | Description | Default |
|--------|-------------|---------|
| `-k, --key <path>` | SSH private key path (required) | - |
| `-n, --name <name>` | Instance name | `instance-<IP-dashed>` |
| `-u, --user <user>` | SSH username (must have root privileges) | `root` |
| `-p, --port <port>` | SSH port | `22` |
| `-b, --branch <branch>` | OpenClaw git branch | `main` |
| `--skip-onboard` | Skip interactive onboarding wizard | `false` |
| `--no-auto-connect` | Skip auto-connect to dashboard | `false` |
| `-g, --global` | Save instance artifact to `~/.clawctl/instances/` | `false` |
| `-f, --force` | Ignore partial deployment state and start fresh | `false` |
| `--clean` | Remove everything and start over | `false` |
| `-v, --verbose` | Verbose output for debugging | `false` |

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

**Skip auto-connect (manual browser access):**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --no-auto-connect
```

**Force restart from beginning:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --force
```

**Clean slate (removes all previous deployment files):**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --clean
```

**Verbose output for debugging:**
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --verbose
```

## What Happens During Deployment

The deployment process consists of 10 automated phases:

**Phase 0: Connect** - Establishes SSH connection and verifies server access

**Phase 1: Docker Setup** - Installs Docker CE and configures the Docker daemon

**Phase 2: User Setup** - Creates the `roboclaw` system user (UID 1000) with Docker access and home directory

**Phase 3: Build Image** - Clones the OpenClaw repository and builds the Docker image

**Phase 4: Compose Setup** - Generates docker-compose.yml and .env files with proper configuration

**Phase 5: Start Containers** - Starts the OpenClaw CLI and Gateway containers via Docker Compose

**Phase 6: Onboarding** - Runs the interactive `openclaw onboard` wizard via SSH PTY session

**Phase 7: Artifact** - Creates a local YAML artifact at `instances/<name>.yml` with deployment metadata

**Phase 8: Auto-Connect** - Opens SSH tunnel, launches browser, detects pairing request, and auto-approves it

Each phase is idempotent - if deployment fails, simply re-run the same command and it will resume from the failed phase.

## After Deployment

### Auto-Connect Workflow

After successful deployment, clawctl automatically:

1. **Prompts you** - "Auto-connect to OpenClaw dashboard? (Y/n)"
2. **Creates SSH tunnel** - Port forwards 18789 from the remote server to localhost
3. **Opens browser** - Launches http://localhost:18789 in your default browser
4. **Detects pairing** - Polls the gateway for new device pairing requests
5. **Auto-approves** - Automatically approves the first pairing request it detects
6. **Keeps running** - SSH tunnel stays open until you press Ctrl+C

To skip this feature, use `--no-auto-connect`.

### Manual Access

If you skipped auto-connect or need to reconnect later:

```bash
# Create SSH tunnel to the server
ssh -i ~/.ssh/mykey -L 18789:localhost:18789 root@192.168.1.100

# Open browser to http://localhost:18789
# You'll see a pairing request in the dashboard

# In another terminal, SSH to the server and approve the pairing
ssh -i ~/.ssh/mykey root@192.168.1.100
sudo su - roboclaw
openclaw devices list          # Find the device ID
openclaw devices approve <id>  # Approve the pairing request
```

### Instance Artifacts

After deployment, a YAML artifact is created at `instances/<name>.yml` containing:

- Instance metadata (name, IP, SSH details)
- Deployment timestamp and configuration
- OpenClaw git branch and commit

Example artifact:

```yaml
name: production
ip: 192.168.1.100
ssh_key: ~/.ssh/id_ed25519
ssh_user: root
ssh_port: 22
branch: main
deployed_at: 2026-02-06T12:34:56Z
```

## Error Recovery

### Automatic Resume

If deployment fails at any phase, simply re-run the same command:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

The deployment will automatically resume from the failed phase. Each phase checks if its work is already done before executing.

### Force Restart

To ignore the saved state and start fresh:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --force
```

This ignores the remote state file but preserves existing containers and files.

### Clean Slate

To remove everything and start over:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --clean
```

This removes:
- The `roboclaw` user and home directory
- All Docker containers and images
- All deployment state files

### Verbose Mode

For detailed debugging output:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --verbose
```

This shows:
- Full SSH command output
- Docker build logs
- State transitions
- Error stack traces

## Troubleshooting

Common issues and solutions:

| Issue | Cause | Solution |
|-------|-------|----------|
| "Permission denied (publickey)" | SSH key not accepted | Verify key path with `-k`, check server authorized_keys |
| "Docker daemon not running" | Phase 1 incomplete | Re-run deployment, it will resume from Phase 1 |
| "Port 18789 already in use" | Previous tunnel still open | Kill the SSH tunnel: `pkill -f "L 18789"` |
| "Unable to connect to gateway" | Gateway not started | Check container logs: `docker logs openclaw-gateway` |
| "Image build failed" | Network or git issue | Check internet connection, verify branch exists |
| "Onboarding wizard fails" | PTY session issue | Use `--skip-onboard`, run manually via SSH |

For more detailed troubleshooting, see [specs/troubleshooting-guide.md](../specs/troubleshooting-guide.md).

## Security

**Non-root Containers**
- Containers run as UID 1000 (roboclaw user), not root
- Reduces attack surface and follows Docker best practices

**Localhost-only Gateway**
- Gateway binds to 127.0.0.1:18789, not accessible externally
- Remote access requires SSH tunnel (encrypted)

**Token-based Authentication**
- Device pairing uses secure token-based authentication
- Tokens stored in `~/.openclaw/openclaw.json`

**SSH Tunnel**
- All remote web dashboard access goes through encrypted SSH tunnel
- No direct external access to the gateway

## Documentation

For complete documentation, see:
- **Quick Start:** This README
- **OpenClaw Architecture:** `specs/openclaw-architecture.md`
- **Technical Specification:** `specs/clawctl-spec.md`
- **CLI Design:** `specs/clawctl-cli-spec.md`
- **Testing Guide:** `specs/testing-guide.md`
- **Troubleshooting:** `specs/troubleshooting-guide.md`
- **Strategy & Vision:** `specs/clawctl-strategy.md`

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

See [LICENSE](LICENSE) file for details.

## Support

- **Issues:** https://github.com/openclaw/roboclaw/issues
- **Community:** [OpenClaw Discord](https://discord.gg/8DaPXhRFfv)
- **Twitter:** [@RoboClawX](https://x.com/RoboClawX)

---

**Built with ❤️ by the RoboClaw Development Team**
