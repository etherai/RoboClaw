# Changelog

All notable changes to clawctl will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-05

### Added
- **Auto-connect feature**: After successful deployment, clawctl now offers to automatically:
  - Create an SSH tunnel for port forwarding (18789)
  - Open the dashboard in your default browser
  - Watch for device pairing requests
  - Auto-approve the first pairing request from your browser
  - Keep the tunnel open until you press Ctrl+C
- New `--no-auto-connect` flag to skip the auto-connect prompt entirely
- Interactive Y/n prompt after deployment completes
- Cross-platform browser opening support (macOS, Linux, Windows/WSL)
- Automatic polling for new pairing requests (2-second intervals, 60-second timeout)
- Graceful Ctrl+C handling that cleans up the SSH tunnel

### Technical Details
- New module: `src/lib/auto-connect.ts`
- Updated `src/commands/deploy.ts` to call auto-connect after Phase 10
- Updated `src/lib/types.ts` to add `noAutoConnect` field to `DeploymentConfig`
- Updated `src/lib/config.ts` to handle the `--no-auto-connect` flag
- Updated `src/index.ts` to register the new CLI option

### User Experience Flow
```
✅ Deployment complete!

┌─ Auto-connect to Dashboard ─────────────────────────────────┐
│ Would you like to open the dashboard now?                   │
└─────────────────────────────────────────────────────────────┘
  [Y/n]: Y

→ Creating SSH tunnel on port 18789...
✓ Tunnel established (PID 12345)
→ Opening browser at http://localhost:18789...
✓ Browser opened
→ Waiting for device pairing request...
  (press Ctrl+C to skip)
✓ New pairing request detected
→ Auto-approving device...
✓ Device approved!

Dashboard is ready!
  Tunnel will stay open. Press Ctrl+C to exit.
```

## [1.0.0] - 2026-02-04

### Added
- Initial release of clawctl
- 10-phase deployment orchestration for OpenClaw instances
- SSH-based remote deployment via Docker
- Automatic Docker CE installation on Ubuntu 24.04
- Dedicated deployment user creation (`roboclaw`)
- State management with resume capability
- Interactive onboarding wizard support
- Instance artifact generation (YAML)
- Configuration loading from multiple sources (CLI > env > files > defaults)
- Comprehensive error handling and validation
- Verbose logging mode

### Features
- Deploy OpenClaw to remote Ubuntu 24.04 servers
- Automatic Docker and system package installation
- Git-based image building from OpenClaw repository
- Docker Compose file generation with environment variables
- PTY-based interactive sessions for onboarding
- Idempotent deployment phases
- Resume failed deployments from last checkpoint
- Clean and force deployment modes

### Commands
- `deploy <IP>` - Deploy OpenClaw to a remote server

### Options
- `-k, --key <path>` - SSH private key path (required)
- `-n, --name <name>` - Instance name (default: instance-<IP-dashed>)
- `-u, --user <user>` - SSH username (default: root)
- `-p, --port <port>` - SSH port (default: 22)
- `-b, --branch <branch>` - OpenClaw git branch (default: main)
- `--skip-onboard` - Skip onboarding wizard
- `-g, --global` - Save artifact to ~/.clawctl/instances/
- `-f, --force` - Ignore partial deployment state
- `--clean` - Remove everything and start fresh
- `-v, --verbose` - Verbose output
