# clawctl Strategy Document

## Overview

This document describes the strategic direction for RoboClaw's deployment tooling, transitioning from the current Python/Ansible-based approach to a pure Node.js CLI tool distributed via npm.

**Last Updated:** 2026-02-04
**Version:** 1.0 (Draft)
**Status:** Proposed

## Vision

**One command to deploy OpenClaw anywhere:**

```bash
npx clawctl 192.168.1.100 --key ~/.ssh/mykey
```

A user with an SSH key and a server IP address should be able to deploy a fully functional OpenClaw instance with zero local setup required.

## Motivation

### Current State Problems

The existing deployment system has several friction points:

1. **Python Dependency**: Users must have Python 3.12+ installed, which varies across operating systems and can conflict with system Python
2. **Virtual Environment**: Requires creating and managing a Python virtual environment
3. **Ansible Learning Curve**: Understanding Ansible playbooks is necessary for troubleshooting or customization
4. **Multiple Languages**: The codebase mixes Shell, Python, YAML (Ansible), and Node.js (website), increasing cognitive load
5. **Setup Steps**: Even with auto-setup, users need to clone the repo and understand the directory structure

### Why Node.js/npm?

1. **Universal Runtime**: Node.js is ubiquitous in the developer ecosystem; many users already have it installed
2. **npx Zero-Install**: `npx clawctl` downloads and runs the tool without permanent installation
3. **Single Language**: Consolidates tooling to JavaScript/TypeScript, matching the website codebase
4. **Existing SSH Code**: The `website/lib/ssh-provisioner.ts` already implements SSH patterns we can reuse
5. **Cross-Platform**: Node.js works identically on macOS, Linux, and Windows

## Strategic Goals

### Goal 1: Minimal Prerequisites

**Target**: A user needs only Node.js 18+ and root SSH access to deploy OpenClaw.

- No Python installation required
- No virtual environment management
- No Ansible knowledge needed
- No repository cloning for basic usage
- Root SSH access to target server (required for Docker installation)

### Goal 2: Single Command Deployment

**Target**: `npx clawctl <IP> --key <path>` handles everything.

- Installs Docker on the target server if missing
- Creates the `roboclaw` system user
- Builds or pulls the OpenClaw Docker image
- Launches the interactive onboarding wizard
- Creates local instance artifacts for future connections

### Goal 3: Docker-First Architecture

**Target**: OpenClaw runs in containers, not natively installed.

Benefits:
- **Isolation**: OpenClaw doesn't affect host system packages
- **Reproducibility**: Same container image runs identically everywhere
- **Security**: Non-root container user (UID 1000)
- **Updates**: Replace container image without touching host config
- **Rollback**: Instant rollback by switching image tags

### Goal 4: Developer Experience

**Target**: The tool should be pleasant to use and easy to understand.

- Clear progress indicators during deployment
- Helpful error messages with remediation steps
- Verbose mode for troubleshooting
- Consistent CLI patterns (POSIX-style flags)
- Instance artifacts for easy reconnection

### Goal 5: Maintainability

**Target**: A single TypeScript codebase for all CLI tooling.

- Shared code between CLI and website (SSH utilities, types)
- Strong typing catches errors at compile time
- Modern ES modules for clean imports
- Published to npm for versioned distribution

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Machine                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              npx clawctl                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ CLI      │ │ SSH      │ │ Compose          │  │   │
│  │  │ Parser   │ │ Client   │ │ Generator        │  │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         │ SSH (port 22)                  │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Target Server                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker Engine                        │   │
│  │                                                   │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐    │   │
│  │  │ openclaw-cli    │  │ openclaw-gateway    │    │   │
│  │  │ (interactive)   │  │ (daemon)            │    │   │
│  │  │ runs as SSH UID │  │ runs as SSH UID     │    │   │
│  │  └─────────────────┘  └─────────────────────┘    │   │
│  │                                                   │   │
│  │  Volumes:                                         │   │
│  │  ├─ ${USER_HOME}/.openclaw                       │   │
│  │  └─ ${USER_HOME}/.roboclaw                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  SSH user (e.g., ubuntu, admin, deploy)                 │
└─────────────────────────────────────────────────────────┘
```

### Deployment Phases

| Phase | Description | Tools Used |
|-------|-------------|------------|
| 1. Connect | SSH to target server | ssh2 library |
| 2. Bootstrap | Install Docker, create roboclaw user | apt-get, useradd, usermod |
| 3. Build | Clone OpenClaw, build Docker image | git, docker build |
| 4. Configure | Upload docker-compose.yml and .env | SFTP |
| 5. Onboard & Launch | Run onboarding wizard, start gateway daemon | docker compose |
| 6. Artifact | Save instance metadata locally | YAML file |

## Design Principles

### Principle 1: Convention Over Configuration

The tool should work with sensible defaults. Advanced users can override, but beginners shouldn't need to think about options.

**Defaults:**
- SSH user: `root` (required - must have root privileges)
- SSH port: `22`
- Instance name: `instance-<IP-dashed>`
- Image: Build from `main` branch
- Onboarding: Enabled (interactive wizard)

### Principle 2: Fail Fast, Fail Clearly

When something goes wrong, the user should immediately know:
1. What failed
2. Why it might have failed
3. How to fix it

**Example Error:**
```
Error: SSH connection failed after 3 attempts

Details:
  Host: 192.168.1.100
  Port: 22

Possible causes:
  1. Server is not reachable (check network/firewall)
  2. SSH key is not authorized for this server

To debug:
  ssh -i ~/.ssh/mykey root@192.168.1.100
```

### Principle 3: Idempotent Operations

Running the deployment twice should not break anything. Each step should:
- Check if work is already done
- Skip if nothing to do
- Update if configuration changed

### Principle 4: Local State, Remote Execution

- All configuration and artifacts live on the user's machine
- The server runs containers with mounted volumes
- No state on the server that can't be recreated

## Migration Path

### From Current Ansible Approach

1. **Phase 1 (Now)**: Create strategy and spec documents
2. **Phase 2**: Implement core CLI with Docker deployment
3. **Phase 3**: Test on fresh Ubuntu 24.04 servers
4. **Phase 4**: Update documentation, deprecate Ansible scripts
5. **Phase 5**: Publish to npm as `roboclaw`

### Backward Compatibility

- Existing `instances/*.yml` files will work with new CLI
- Ansible scripts remain in `cli/` for reference/emergency rollback
- Website deployment flow can adopt new patterns later

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Prerequisites | Node.js only | Reduces barrier to entry |
| Commands needed | 1 | Simplicity is key |
| Config files | 0 | Zero config for basic use |
| Error clarity | Actionable | Users can self-serve |
| Deployment | Fully automated | One command does everything |

## Open Questions

1. **npm package name**: Using `clawctl` - already reserved on npm ✅
2. **OpenClaw Docker image registry**: When will images be published to Docker Hub?
3. **Multi-architecture support**: Should we build for both amd64 and arm64?
4. **CI/CD integration**: Should the CLI support non-interactive mode for automation?
5. **Website integration**: Should the website use this CLI or keep separate deployment logic?

## Related Documents

- [deployment-workflow.md](./deployment-workflow.md) - Current Ansible-based workflow
- [docker-openclaw.md](./docker-openclaw.md) - Docker containerization specification
- [clawctl-spec.md](./clawctl-spec.md) - Technical implementation specification

---

**Document Status:** Draft
**Maintained By:** RoboClaw Development Team
**Next Steps:** Create technical specification document with implementation details
