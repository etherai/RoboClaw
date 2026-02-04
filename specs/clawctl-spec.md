# clawctl Technical Specification

## Overview

This document specifies the technical implementation of the `clawctl` npm package, a CLI tool for deploying OpenClaw to remote servers via Docker containers.

**Last Updated:** 2026-02-04
**Version:** 1.0 (Draft)
**Status:** Proposed

## Table of Contents

- [Quick Summary](#quick-summary)
- [Package Structure](#package-structure)
- [Command-Line Interface](#command-line-interface)
- [Architecture](#architecture)
- [Deployment Flow](#deployment-flow)
- [Docker Configuration](#docker-configuration)
- [SSH Operations](#ssh-operations)
- [Error Handling](#error-handling)
- [Instance Artifacts](#instance-artifacts)
- [Dependencies](#dependencies)
- [Implementation Phases](#implementation-phases)

## Quick Summary

**Current Approach (Ansible):**
```bash
# 3-step process
./cli/setup.sh                                    # Setup Python/Ansible
./cli/create-inventory.sh 192.168.1.100 prod.ini # Create inventory
./cli/run-deploy.sh prod.ini                      # Deploy with Ansible
```

**Proposed Approach (npx):**
```bash
# 1-step process (requires root SSH access)
npx clawctl 192.168.1.100 --key ~/.ssh/mykey
```

**Prerequisites:**
- Node.js 18+ on local machine
- SSH access to target server as root user
- Target server running Ubuntu 20.04+ or Debian 11+

## Package Structure

### npm Package Configuration

**Package Name:** `clawctl`
**Entry Point:** `dist/index.js` (compiled from TypeScript)
**Type:** ES Module (`"type": "module"`)
**Node Version:** >=18.0.0

### Directory Layout

```
clawctl/
├── package.json              # npm package manifest
├── tsconfig.json             # TypeScript configuration
├── .npmignore                # Files to exclude from npm publish
├── README.md                 # Package documentation
├── src/                      # TypeScript source files
│   ├── index.ts              # CLI entry point (commander setup)
│   ├── commands/
│   │   ├── deploy.ts         # Main deployment orchestration
│   │   └── config.ts         # Configuration management commands
│   ├── lib/
│   │   ├── ssh-client.ts     # SSH connection and command execution
│   │   ├── docker-setup.ts   # Docker installation logic
│   │   ├── user-setup.ts     # System user creation
│   │   ├── image-builder.ts  # Docker image build from git
│   │   ├── compose.ts        # Docker Compose file generation
│   │   ├── interactive.ts    # PTY session for onboarding
│   │   ├── logger.ts         # Console output formatting
│   │   ├── artifact.ts       # Instance artifact management
│   │   ├── config.ts         # Configuration loading and resolution
│   │   └── types.ts          # TypeScript type definitions
│   └── templates/
│       ├── docker-compose.ts # docker-compose.yml template
│       └── config.ts         # Default config file template
├── dist/                     # Compiled JavaScript (gitignored)
├── instances/                # Local instance artifacts (created at runtime)
└── website/                  # Existing Next.js app (unchanged)
```

### Files Included in npm Package

Only essential files are published:
- `dist/` - Compiled JavaScript
- `README.md` - Documentation
- `LICENSE` - License file

Excluded from package:
- `src/` - TypeScript source (not needed at runtime)
- `website/` - Next.js app (separate concern)
- `cli/` - Ansible scripts (legacy tooling)
- `specs/` - Documentation (keep in repo only)

## Command-Line Interface

### Primary Command

```
npx clawctl <ip> [options]
```

### Arguments

| Argument | Required | Description | Default |
|----------|----------|-------------|---------|
| `<ip>` | Yes | Target server IP address | - |

### Options

| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--key <path>` | `-k` | string | SSH private key path | **Required** |
| `--name <name>` | `-n` | string | Instance name | `instance-<IP-dashed>` |
| `--user <user>` | `-u` | string | SSH username (must be root) | `root` |
| `--port <port>` | `-p` | number | SSH port | `22` |
| `--branch <branch>` | `-b` | string | OpenClaw git branch | `main` |
| `--skip-onboard` | - | boolean | Skip onboarding wizard | `false` |
| `--global` | `-g` | boolean | Save artifact to ~/.clawctl/instances/ | `false` |
| `--force` | `-f` | boolean | Ignore partial deployment, start fresh | `false` |
| `--clean` | - | boolean | Remove everything and start fresh | `false` |
| `--verbose` | `-v` | boolean | Verbose output | `false` |
| `--version` | - | boolean | Show version | - |
| `--help` | `-h` | boolean | Show help | - |

**Notes:**
- The `--user` option exists for flexibility, but the SSH user **must have root privileges**
- Use `--force` to ignore partial deployment state and restart from phase 1
- Use `--clean` to completely remove previous deployment before starting
- Re-running without flags will automatically resume from last failed phase

### Usage Examples

**Basic deployment:**
```bash
npx clawctl 192.168.1.100 --key ~/.ssh/id_ed25519
```

**With custom name:**
```bash
npx clawctl 192.168.1.100 -k ./mykey -n production
```

**Test a specific OpenClaw branch:**
```bash
npx clawctl 192.168.1.100 -k ./mykey --branch feature/new-ui
```

**Skip onboarding (for automation):**
```bash
npx clawctl 192.168.1.100 -k ./mykey --skip-onboard
```

**Verbose mode (for debugging):**
```bash
npx clawctl 192.168.1.100 -k ./mykey -v
```

## Architecture

### Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Entry Point                         │
│                     (src/index.ts)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Commander.js                                         │   │
│  │  - Parse arguments                                    │   │
│  │  - Validate inputs                                    │   │
│  │  - Route to deploy command                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Deploy Command Handler                      │
│                  (src/commands/deploy.ts)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Orchestrates deployment phases:                      │   │
│  │  1. SSH connection                                    │   │
│  │  2. System setup (Docker, user)                       │   │
│  │  3. Image build                                       │   │
│  │  4. Container launch                                  │   │
│  │  5. Artifact creation                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┼────────────┬────────────────┐
         │            │            │                │
         ▼            ▼            ▼                ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ SSHClient    │ │ Docker   │ │ Compose  │ │ Interactive  │
│              │ │ Setup    │ │ Gen      │ │ Session      │
├──────────────┤ ├──────────┤ ├──────────┤ ├──────────────┤
│ - connect()  │ │ - install│ │ - generate│ │ - runOnboard│
│ - exec()     │ │ - verify │ │ - upload │ │ - handlePTY  │
│ - upload()   │ │          │ │          │ │              │
└──────────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### Module Responsibilities

#### src/index.ts - CLI Entry Point
- Parse command-line arguments using commander
- Validate IP address format
- Verify SSH key file exists
- Display help and version information
- Route to appropriate command handler

#### src/commands/deploy.ts - Deployment Orchestrator
- Coordinate all deployment phases
- Manage overall error handling
- Display progress indicators
- Create instance artifacts
- Log deployment summary

#### src/lib/ssh-client.ts - SSH Operations
- Establish SSH connection with retry logic
- Execute commands and stream output
- Upload files via SFTP
- Create interactive PTY sessions
- Handle connection lifecycle

#### src/lib/docker-setup.ts - Docker Installation
- Check if Docker is installed
- Add Docker GPG key and repository
- Install Docker CE packages
- Verify Docker Compose v2 availability
- Start and enable Docker service

#### src/lib/user-setup.ts - User Setup
- Detect SSH user and their UID/GID
- Add SSH user to docker group
- Handle root user specially (use UID 1000 in container)
- Create directory structure in user's home
- Generate .env file with user info

#### src/lib/image-builder.ts - Image Build
- Clone OpenClaw git repository
- Build Docker image with correct tag
- Verify image built successfully
- Check container runs as non-root
- Clean up build artifacts

#### src/lib/compose.ts - Docker Compose
- Generate docker-compose.yml from template (with ${VARIABLES} intact)
- Generate .env file with actual values
- Upload both files to server
- Docker Compose substitutes variables from .env at runtime
- Set correct file ownership

#### src/lib/interactive.ts - PTY Sessions
- Request PTY from SSH server
- Pipe local stdin to remote container
- Pipe container output to local stdout
- Handle terminal resize events
- Manage raw mode terminal state

#### src/lib/logger.ts - Output Formatting
- Colored console output
- Progress indicators
- Phase headers
- Error formatting
- Verbose mode filtering

#### src/lib/artifact.ts - Instance Metadata
- Create instances/ directory if needed
- Generate instance YAML file
- Store deployment metadata
- Read existing artifacts
- Validate artifact format

#### src/lib/config.ts - Configuration Management
- Load configuration from multiple sources (flags, env, files, defaults)
- Resolve configuration hierarchy (precedence rules)
- Parse YAML config files (~/.clawctl/config.yml, ./clawctl.yml)
- Read environment variables (CLAWCTL_* prefix)
- Merge and validate configuration
- Provide resolved config to commands

## Idempotency & Error Recovery

### Design Principle

**Every operation must be idempotent and resumable.** If deployment fails at any phase, re-running the same command should:
1. Detect work already completed
2. Skip completed phases
3. Resume from failure point
4. Complete successfully

### Resume Detection Strategy

**State tracking via deployment marker file:**

Create `/home/roboclaw/.clawctl-deploy-state.json` on the remote server:
```json
{
  "instanceName": "production",
  "deploymentId": "uuid-v4",
  "startedAt": "2026-02-04T15:30:00Z",
  "lastPhase": 7,
  "phases": {
    "1": "complete",
    "2": "complete",
    "3": "complete",
    "4": "complete",
    "5": "complete",
    "6": "complete",
    "7": "failed",
    "8": "pending",
    "9": "pending",
    "10": "pending"
  },
  "metadata": {
    "deployUser": "roboclaw",
    "deployUid": 1000,
    "deployGid": 1000,
    "deployHome": "/home/roboclaw",
    "image": "roboclaw/openclaw:local",
    "branch": "main"
  }
}
```

**Resume behavior:**
1. **Check for state file** on server at start of deployment
2. **If found:**
   - Compare instance name matches
   - Show resume prompt to user
   - Skip completed phases
   - Start from first non-complete phase
3. **If not found:**
   - Fresh deployment, start from phase 1
4. **Update state file** after each phase completes
5. **Delete state file** when deployment fully succeeds

### User Experience

**Scenario: Deployment fails at phase 7**

First attempt:
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519 --name production
```

Output:
```
[Phases 1-6 complete]

Phase 7: Building OpenClaw image...
  Cloning repository...
  Building image...
  ✗ Error: Docker build failed (network timeout)

Deployment failed at phase 7: Build OpenClaw Image

To retry:
  npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519 --name production

The deployment will resume from phase 7.
```

Second attempt (retry):
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519 --name production
```

Output:
```
Detected partial deployment on 192.168.1.100

  Instance: production
  Started: 2026-02-04 15:30:00
  Last phase: 7 (failed)

Resume from phase 7? [Y/n] y

Resuming deployment...
  ✓ Phase 1: Validated (skip)
  ✓ Phase 2: Connected (skip)
  ✓ Phase 3: Base packages installed (skip)
  ✓ Phase 4: Docker installed (skip)
  ✓ Phase 5: User configured (skip)
  ✓ Phase 6: Directories created (skip)

Phase 7: Building OpenClaw image...
  Repository already cloned
  Building image...
  ✓ Image built: roboclaw/openclaw:local

[Continues with phases 8-10]

✅ Deployment complete!
```

### Forced Fresh Deployment

If user wants to start over (ignore partial state):

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519 --name production --force
```

This will:
1. Detect existing state file
2. Warn user about overwriting
3. Delete state file
4. Start fresh from phase 1

### Phase-Level Idempotency

Each phase follows this pattern:

```typescript
async function executePhase(phase: Phase, state: DeploymentState) {
  // 1. Check if already complete
  if (await isPhaseComplete(phase)) {
    logger.info(`✓ Phase ${phase.number}: ${phase.name} (skip)`)
    return 'skipped'
  }

  // 2. Execute phase
  try {
    await phase.execute()

    // 3. Verify success
    await phase.verify()

    // 4. Mark complete
    await updateState(phase.number, 'complete')
    logger.info(`✓ Phase ${phase.number}: ${phase.name}`)
    return 'success'

  } catch (error) {
    // 5. Mark failed
    await updateState(phase.number, 'failed')
    throw error
  }
}
```

### Per-Phase Idempotency Checks

| Phase | Check Method | Safe to Retry? |
|-------|--------------|----------------|
| 1. Validation | Always runs (validates current state) | ✅ Always |
| 2. SSH Connection | Test connection | ✅ Always |
| 3. Base Packages | `dpkg -l \| grep curl` | ✅ Already installed |
| 4. Docker | `docker --version` | ✅ Already installed |
| 5. User Setup | `id roboclaw` | ✅ User exists |
| 6. Directories | `test -d /home/roboclaw/.openclaw` | ✅ Already created |
| 7. Image Build | `docker images \| grep roboclaw/openclaw:local` | ✅ Already built |
| 8. Upload Compose | Compare checksums | ✅ Already uploaded |
| 9. Onboarding | Check `~/.openclaw/config.json` exists | ⚠️ Skip if done |
| 10. Artifact | Local file exists | ✅ Overwrite |

### Phase-Specific Idempotency Logic

#### Phase 3: Install Base Packages
```bash
# Check if packages already installed
if dpkg -l | grep -q '^ii.*curl.*'; then
  echo "Packages already installed"
else
  apt-get update -qq
  apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
fi
```

#### Phase 4: Install Docker
```bash
# Check if Docker already installed
if command -v docker &> /dev/null; then
  DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+')
  echo "Docker already installed: $DOCKER_VERSION"

  # Verify Docker Compose v2
  if docker compose version &> /dev/null; then
    echo "Docker Compose v2 available"
  else
    echo "Error: Docker Compose v2 not available"
    exit 1
  fi
else
  # Install Docker...
fi
```

#### Phase 5: Setup Deployment User
```bash
# Check if roboclaw user exists
if id roboclaw &> /dev/null; then
  echo "User 'roboclaw' already exists"
  ROBOCLAW_UID=$(id -u roboclaw)
  ROBOCLAW_GID=$(id -g roboclaw)

  # Ensure in docker group
  if groups roboclaw | grep -q docker; then
    echo "Already in docker group"
  else
    usermod -aG docker roboclaw
  fi
else
  # Create user...
fi
```

#### Phase 6: Create Directories
```bash
# Check each directory
for dir in .openclaw .roboclaw docker openclaw-src; do
  if [ -d "$DEPLOY_HOME/$dir" ]; then
    echo "Directory $dir already exists"
  else
    mkdir -p "$DEPLOY_HOME/$dir"
    chown $DEPLOY_USER:$DEPLOY_USER "$DEPLOY_HOME/$dir"
  fi
done

# Fix ownership if needed (idempotent)
chown -R $DEPLOY_USER:$DEPLOY_USER \
  $DEPLOY_HOME/.openclaw \
  $DEPLOY_HOME/.roboclaw \
  $DEPLOY_HOME/docker \
  $DEPLOY_HOME/openclaw-src
```

#### Phase 7: Build OpenClaw Image
```bash
# Check if image already exists
if docker images | grep -q 'roboclaw/openclaw.*local'; then
  echo "Image already built: roboclaw/openclaw:local"

  # Verify image is usable
  if docker run --rm roboclaw/openclaw:local node --version &> /dev/null; then
    echo "Image verified"
    # Skip build
  else
    echo "Image exists but corrupted, rebuilding..."
    docker rmi roboclaw/openclaw:local
    # Continue to build
  fi
else
  # Clone and build...
fi

# Check if source directory exists
if [ -d "$DEPLOY_HOME/openclaw-src/.git" ]; then
  echo "Repository already cloned, updating..."
  cd "$DEPLOY_HOME/openclaw-src"
  sudo -u $DEPLOY_USER git fetch origin
  sudo -u $DEPLOY_USER git checkout main
  sudo -u $DEPLOY_USER git pull
else
  # Clone fresh...
fi
```

#### Phase 8: Upload Docker Compose
```bash
# Check if files exist and compare checksums
REMOTE_COMPOSE="$DEPLOY_HOME/docker/docker-compose.yml"
if [ -f "$REMOTE_COMPOSE" ]; then
  # Compare checksums (local vs remote)
  LOCAL_HASH=$(sha256sum /tmp/docker-compose.yml | cut -d' ' -f1)
  REMOTE_HASH=$(sha256sum $REMOTE_COMPOSE | cut -d' ' -f1)

  if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "docker-compose.yml already up to date"
  else
    echo "docker-compose.yml changed, uploading..."
    # Upload new version
  fi
else
  # Upload for first time
fi
```

#### Phase 9: Onboarding & Gateway Startup
```bash
# Check if onboarding already completed
if [ -f "$DEPLOY_HOME/.openclaw/config.json" ]; then
  echo "Onboarding already completed"
  # Skip onboarding, but still check gateway status
else
  # Run onboarding wizard
fi

# Check if gateway is already running
if docker compose ps openclaw-gateway | grep -q 'Up'; then
  echo "Gateway already running"

  # Verify health
  if docker compose exec openclaw-gateway node dist/index.js gateway health 2>/dev/null; then
    echo "Gateway healthy"
  else
    echo "Gateway running but unhealthy, restarting..."
    docker compose restart openclaw-gateway
  fi
else
  # Start gateway
fi
```

#### Phase 10: Create Artifact
```bash
# Always overwrite local artifact (latest state)
# This is the final phase, so we know deployment succeeded
```

### Cleanup on Failure

If deployment fails and user wants to start completely fresh:

```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519 --name production --clean
```

The `--clean` flag will:
1. Stop all containers
2. Remove all containers
3. Remove Docker images
4. Delete directories (/home/roboclaw)
5. Remove roboclaw user
6. Delete state file
7. Start fresh deployment

**Warning prompt:**
```
⚠️  Clean deployment requested

This will remove:
  - roboclaw user and all files
  - All OpenClaw Docker containers and images
  - Deployment state

Continue? [y/N]
```

### State File Management

**Location:** `/home/roboclaw/.clawctl-deploy-state.json`

**Lifecycle:**
- Created: Start of phase 1
- Updated: After each phase completes
- Deleted: Successful completion of phase 10
- Deleted: User runs `--force` or `--clean`

**Stale state detection:**
- If state file is >24 hours old, warn user
- Prompt: "Deployment started X hours ago. Resume or start fresh?"

### Exit Codes by Phase

| Exit Code | Meaning | Recovery Action |
|-----------|---------|-----------------|
| 0 | Success | None |
| 1 | Invalid arguments | Fix arguments |
| 2 | SSH connection failed | Check network, key, server |
| 3 | Package installation failed | Check apt repos, disk space |
| 4 | Docker installation failed | Check system requirements |
| 5 | User setup failed | Check permissions |
| 6 | Directory creation failed | Check disk space, permissions |
| 7 | Image build failed | Check network, Docker, source |
| 8 | Compose upload failed | Check SFTP, permissions |
| 9 | Gateway startup failed | Check logs, ports, onboarding |
| 10 | Artifact creation failed | Check local disk space |

## Deployment Flow

### Phase-by-Phase Breakdown

#### Phase 1: Argument Validation

**Tasks:**
1. Parse CLI arguments
2. Validate IP address format (regex: `^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$`)
3. Resolve SSH key path (relative → absolute)
4. Verify SSH key file exists
5. Verify SSH key permissions (must be 600 or 400)
6. Generate instance name if not provided
7. Warn if SSH user is not 'root'

**Error Conditions:**
- Invalid IP format → Exit with usage message
- SSH key not found → Exit with file path error
- SSH key not readable → Exit with permission error
- SSH key permissions too open (e.g., 644) → Exit with security warning

**Output:**
```
Preparing to deploy OpenClaw
  Target: 192.168.1.100
  Instance: production
  SSH User: root
  SSH Key: /home/user/.ssh/id_ed25519

⚠️  Note: This tool requires root SSH access to install Docker
```

#### Phase 2: SSH Connection

**Tasks:**
1. Create SSH client instance
2. Read private key file
3. Attempt connection (3 retries, 5s between)
4. Verify user is root: `id -u` should return 0
5. Display connection success

**Error Conditions:**
- Connection timeout → Retry, then fail with network diagnostic
- Authentication failed → Exit with key/permission message
- Host unreachable → Exit with network/firewall message
- Connected user is not root → Exit with privilege error

**Output:**
```
Connecting to server...
  ✓ Connected to 192.168.1.100 as root
  ✓ Root access verified
```

**Privilege Error:**
```
Error: Insufficient privileges

Details:
  - Connected as: deploy
  - Required: root

This tool requires root SSH access to:
  1. Install Docker and system packages
  2. Manage system users and groups
  3. Configure system services

Options:
  1. Connect as root: --user root
  2. Enable root SSH access on target server
  3. Use sudo access (not yet supported)
```

#### Phase 3: Install Base Packages

**Tasks:**
1. Update apt cache: `apt-get update -qq`
2. Install packages: `apt-get install -y curl wget git ca-certificates gnupg`

**Commands:**
```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
```

**Output:**
```
Installing base packages...
  $ apt-get update -qq
  $ apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
  ✓ Base packages installed
```

#### Phase 4: Install Docker

**Tasks:**
1. Check if Docker is installed: `docker --version`
2. If missing:
   - Add Docker GPG key
   - Add Docker repository
   - Install docker-ce, docker-ce-cli, containerd.io
   - Start Docker service
3. Verify Docker Compose v2: `docker compose version`

**Commands:**
```bash
# Check
docker --version || {
  # Install
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io
  systemctl start docker
  systemctl enable docker
}
```

**Output:**
```
Installing Docker...
  ✓ Docker already installed: 25.0.3
  ✓ Docker Compose v2.24.0
```

#### Phase 5: Setup Deployment User

**Tasks:**
1. Verify we're running as root (already checked in Phase 2)
2. Create dedicated 'roboclaw' system user if it doesn't exist
3. Set UID 1000 / GID 1000 (or next available)
4. Add roboclaw user to docker group
5. Log user info for docker-compose generation

**Commands:**
```bash
# Create roboclaw user if it doesn't exist
if ! id roboclaw >/dev/null 2>&1; then
  # Try to use UID 1000, or let system assign next available
  useradd -r -m -s /bin/bash -u 1000 roboclaw 2>/dev/null || \
    useradd -r -m -s /bin/bash roboclaw
fi

# Get actual UID/GID assigned
ROBOCLAW_UID=$(id -u roboclaw)
ROBOCLAW_GID=$(id -g roboclaw)
ROBOCLAW_HOME=$(eval echo ~roboclaw)

# Add to docker group
usermod -aG docker roboclaw

# Export for use in later phases
export DEPLOY_USER=roboclaw
export DEPLOY_UID=$ROBOCLAW_UID
export DEPLOY_GID=$ROBOCLAW_GID
export DEPLOY_HOME=$ROBOCLAW_HOME
```

**Output:**
```
Setting up deployment user...
  ✓ Created user 'roboclaw' (UID: 1000, GID: 1000)
  ✓ Added to docker group
  Home directory: /home/roboclaw
  Container will run as: 1000:1000
```

**Note:** Running containers as UID 1000 (non-root) provides security isolation. Files in mounted volumes will be owned by the 'roboclaw' user.

#### Phase 6: Create Directories

**Tasks:**
1. Create OpenClaw config directories in roboclaw user's home
2. Create RoboClaw data directories
3. Create Docker Compose directory
4. Create source build directory
5. Set correct ownership (roboclaw user)

**Commands:**
```bash
# Use roboclaw user's home directory
mkdir -p $DEPLOY_HOME/.openclaw
mkdir -p $DEPLOY_HOME/.roboclaw/{sessions,credentials,data,logs}
mkdir -p $DEPLOY_HOME/docker
mkdir -p $DEPLOY_HOME/openclaw-src

# Set ownership to roboclaw user
chown -R $DEPLOY_USER:$DEPLOY_USER \
  $DEPLOY_HOME/.openclaw \
  $DEPLOY_HOME/.roboclaw \
  $DEPLOY_HOME/docker \
  $DEPLOY_HOME/openclaw-src

# Secure credentials directory
chmod 700 $DEPLOY_HOME/.roboclaw/credentials
```

**Output:**
```
Creating directories...
  ✓ /home/roboclaw/.openclaw
  ✓ /home/roboclaw/.roboclaw
  ✓ /home/roboclaw/docker
  ✓ /home/roboclaw/openclaw-src
  Ownership: roboclaw:roboclaw
```

#### Phase 7: Build OpenClaw Image

**Tasks:**
1. Clone OpenClaw repository as roboclaw user
2. Build Docker image
3. Verify image built successfully
4. Check container runs as non-root

**Commands:**
```bash
# Clone as roboclaw user (run via sudo -u)
sudo -u $DEPLOY_USER bash <<'EOSCRIPT'
cd $HOME
if [ -d openclaw-src ]; then
  cd openclaw-src
  git fetch origin
  git checkout main
  git pull
else
  git clone https://github.com/openclaw/openclaw.git openclaw-src
  cd openclaw-src
  git checkout main
fi
EOSCRIPT

# Build image (as root, but files owned by roboclaw)
cd $DEPLOY_HOME/openclaw-src
docker build -t roboclaw/openclaw:local .

# Verify container runs as expected UID
docker run --rm --user $DEPLOY_UID:$DEPLOY_GID roboclaw/openclaw:local id -u
# Should output 1000 (non-root)
```

**Output:**
```
Building OpenClaw image...
  Cloning https://github.com/openclaw/openclaw.git
  Branch: main
  Building image... (this may take several minutes)
  ✓ Image built: roboclaw/openclaw:local
  ✓ Container verified: runs as UID 1000 (non-root)
```

#### Phase 8: Upload Docker Compose

**Tasks:**
1. Generate docker-compose.yml with `${VARIABLES}` intact
2. Generate .env file with actual values
3. Upload via SFTP to `/home/roboclaw/docker/`
4. Set ownership to `roboclaw:roboclaw`

**Variable Substitution Strategy:**

This phase uses **Docker Compose runtime variable substitution**:
- The docker-compose.yml contains `${VARIABLE}` placeholders
- The .env file contains actual values (e.g., `USER_UID=1000`)
- Docker Compose reads .env and substitutes variables at runtime
- TypeScript does NOT substitute these variables during generation

**Implementation Note:**
```typescript
// In src/templates/docker-compose.ts
// Use String.raw or escape $ to prevent TypeScript substitution
export function generateCompose(): string {
  return String.raw`version: '3.8'
services:
  openclaw-cli:
    user: "${USER_UID}:${USER_GID}"
    volumes:
      - ${USER_HOME}/.openclaw:/home/node/.openclaw
`
}
```

**Generated Files:**

**docker-compose.yml:** (variables NOT substituted, left as-is)
```yaml
version: '3.8'

services:
  openclaw-cli:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:local}
    container_name: openclaw-cli
    stdin_open: true
    tty: true
    user: "${USER_UID}:${USER_GID}"
    environment:
      HOME: /home/node
      TERM: xterm-256color
    volumes:
      - ${USER_HOME}/.openclaw:/home/node/.openclaw
      - ${USER_HOME}/.roboclaw:/home/node/.roboclaw
    profiles:
      - cli

  openclaw-gateway:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:local}
    container_name: openclaw-gateway
    restart: unless-stopped
    user: "${USER_UID}:${USER_GID}"
    environment:
      HOME: /home/node
      TERM: xterm-256color
    ports:
      - "127.0.0.1:18789:18789"
    volumes:
      - ${USER_HOME}/.openclaw:/home/node/.openclaw
      - ${USER_HOME}/.roboclaw:/home/node/.roboclaw
    command: ["node", "dist/index.js", "gateway", "start"]
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "gateway", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    init: true
```

**.env:** (actual values, substituted by Docker Compose at runtime)
```bash
# OpenClaw Docker image
OPENCLAW_IMAGE=roboclaw/openclaw:local

# Deployment user info (roboclaw system user)
USER_UID=1000
USER_GID=1000
USER_HOME=/home/roboclaw
DEPLOY_USER=roboclaw
```

**How Variable Substitution Works:**

1. **Generation (TypeScript):** Creates files with `${USER_UID}` syntax intact
2. **Upload (SFTP):** Both docker-compose.yml and .env uploaded to server
3. **Runtime (Docker Compose):** Reads .env, replaces `${USER_UID}` → `1000`

**Example:**
```bash
# On server: /home/roboclaw/docker/
$ cat docker-compose.yml
  user: "${USER_UID}:${USER_GID}"

$ cat .env
  USER_UID=1000
  USER_GID=1000

$ docker compose config  # Shows expanded config
  user: "1000:1000"       # Variables substituted!
```

**Output:**
```
Configuring Docker Compose...
  ✓ Generated docker-compose.yml with variable placeholders
  ✓ Generated .env with actual values (UID: 1000, GID: 1000)
  ✓ Uploaded to /home/roboclaw/docker/
  ✓ Ownership set to roboclaw:roboclaw
```

#### Phase 9: Interactive Onboarding & Gateway Startup

**Tasks:**
1. Run onboarding container with PTY
2. Pipe stdin/stdout for wizard interaction
3. Handle terminal resize
4. Wait for onboarding completion
5. Start gateway daemon
6. Verify gateway is running and healthy

**Commands:**
```bash
# Step 1: Run onboarding as roboclaw user
cd $DEPLOY_HOME/docker
sudo -u $DEPLOY_USER docker compose run --rm -it openclaw-cli onboard

# Step 2: Start gateway daemon (must run after onboarding completes)
cd $DEPLOY_HOME/docker
sudo -u $DEPLOY_USER docker compose up -d openclaw-gateway

# Step 3: Verify gateway started
docker compose ps openclaw-gateway

# Step 4: Wait for health check to pass (max 60s)
for i in {1..12}; do
  if docker compose exec openclaw-gateway node dist/index.js gateway health 2>/dev/null; then
    break
  fi
  sleep 5
done
```

**Output:**
```
Launching OpenClaw onboarding wizard...

[OpenClaw wizard output appears here, user interacts]

  ✓ Onboarding completed

Starting OpenClaw gateway...
  ✓ Gateway container started
  ✓ Health check passed
  Gateway listening on http://localhost:18789
```

**Skip Option:**
If `--skip-onboard` is specified:
```
Skipping onboarding wizard

⚠️  Gateway requires onboarding to be completed first

  To complete setup:
    1. SSH to server: ssh -i <key> root@<IP>
    2. Switch to roboclaw user: sudo -u roboclaw -i
    3. Run onboarding: cd ~/docker && docker compose run --rm -it openclaw-cli onboard
    4. Start gateway: docker compose up -d openclaw-gateway
```

**Error Handling:**
If gateway fails to start or health check fails:
```
Error: Gateway failed to start

Details:
  - Container status: docker compose ps openclaw-gateway
  - Container logs: docker compose logs openclaw-gateway

Possible causes:
  1. Port 18789 is already in use
  2. Onboarding was not completed successfully
  3. Image is corrupted or incompatible

To debug:
  ssh -i <key> root@<IP>
  sudo -u roboclaw -i
  cd ~/docker
  docker compose logs openclaw-gateway
  docker compose restart openclaw-gateway
```

#### Phase 10: Create Artifact

**Tasks:**
1. Create instances/ directory if needed
2. Generate YAML artifact file
3. Save to instances/<name>.yml

**Artifact Format:**
```yaml
name: production
ip: 192.168.1.100
deployedAt: 2026-02-04T15:30:00Z
deploymentMethod: clawctl
version: 1.0.0
ssh:
  keyFile: /home/user/.ssh/id_ed25519
  user: root
  port: 22
docker:
  image: roboclaw/openclaw:local
  composeFile: /home/roboclaw/docker/docker-compose.yml
  branch: main
deployment:
  user: roboclaw      # System user created for deployment
  uid: 1000
  gid: 1000
  home: /home/roboclaw
status:
  onboardingCompleted: true
```

**Output:**
```
Creating instance artifact...
  ✓ Saved to instances/production.yml

✅ Deployment complete!

Instance Details:
  Name: production
  IP: 192.168.1.100
  User: roboclaw (system user, UID 1000)
  Gateway: Running at http://localhost:18789 (localhost only)

Next steps:
  1. Create SSH tunnel to access gateway:
     ssh -L 18789:localhost:18789 -i ~/.ssh/id_ed25519 root@192.168.1.100 -N -f

  2. Access gateway in your browser:
     http://localhost:18789

  3. View gateway logs:
     npx clawctl logs production

  4. Check instance status:
     npx clawctl status production

  5. Manage gateway:
     npx clawctl restart production  # Restart gateway
     npx clawctl stop production     # Stop gateway
     npx clawctl start production    # Start gateway
```

## Docker Configuration

### Container Definitions

#### openclaw-cli (Interactive Service)

**Purpose:** Run interactive commands like `openclaw onboard`

**Configuration:**
- **Image:** `roboclaw/openclaw:local` (or from Docker Hub in future)
- **User:** `${USER_UID}:${USER_GID}` (roboclaw user's UID, non-root)
- **Profile:** `cli` (only runs when explicitly invoked)
- **TTY:** Enabled for interactive use
- **Volumes:**
  - `${USER_HOME}/.openclaw` → `/home/node/.openclaw` (roboclaw home)
  - `${USER_HOME}/.roboclaw` → `/home/node/.roboclaw` (roboclaw home)

**Invocation:**
```bash
docker compose run --rm -it openclaw-cli onboard
```

#### openclaw-gateway (Daemon Service)

**Purpose:** Long-running gateway API server

**Configuration:**
- **Image:** `roboclaw/openclaw:local`
- **User:** `${USER_UID}:${USER_GID}` (roboclaw user's UID, non-root)
- **Restart:** `unless-stopped`
- **Port:** `127.0.0.1:18789:18789` (localhost only)
- **Command:** `node dist/index.js gateway start`
- **Health Check:** Calls `gateway health` command every 30s
- **Init Process:** Enabled for proper signal handling

**Invocation:**
```bash
docker compose up -d openclaw-gateway
```

### Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `${USER_HOME}/.openclaw` | `/home/node/.openclaw` | OpenClaw configuration, sessions, workspace |
| `${USER_HOME}/.roboclaw` | `/home/node/.roboclaw` | RoboClaw credentials, data, logs |

**Note:** `${USER_HOME}` is substituted by Docker Compose from .env file (typically `/home/roboclaw`)

**Ownership:**
- Host: roboclaw system user (`roboclaw:roboclaw`, UID 1000)
- Container: Runs as roboclaw UID/GID (1000:1000)
- Files created in container are automatically owned by roboclaw user on host
- UID matching ensures seamless file ownership between host and container

### Security

**Non-Root Container:**
- Runs as roboclaw UID inside container (typically 1000)
- Host sees processes as roboclaw system user
- No root privileges inside container
- Defense in depth: Container escape is non-privileged
- Isolation: Dedicated system user separate from root SSH access

**Network Isolation:**
- Gateway binds to localhost only
- External access requires SSH tunnel
- No direct internet exposure

## SSH Operations

### Connection Management

**Library:** `ssh2` npm package

**Connection Options:**
```typescript
{
  host: string,
  port: number,
  username: string,
  privateKey: Buffer,
  readyTimeout: 30000,
  algorithms: {
    kex: ['curve25519-sha256@libssh.org', 'curve25519-sha256']
  }
}
```

**Retry Logic:**
- Attempts: 3
- Exponential backoff between attempts
- Configurable timeout per attempt

### Command Execution

**Standard Execution:**
```typescript
ssh.exec(command: string): Promise<{
  exitCode: number
  stdout: string
  stderr: string
}>
```

**Stream Output:**
```typescript
ssh.execStream(command: string, onOutput: (data: string) => void): Promise<number>
```

**Script Execution:**
```typescript
ssh.execScript(commands: string[]): Promise<void>
// Executes commands sequentially, fails on first non-zero exit
```

### File Upload (SFTP)

**Upload File:**
```typescript
ssh.uploadFile(localPath: string, remotePath: string): Promise<void>
```

**Upload Content:**
```typescript
ssh.uploadContent(content: string, remotePath: string): Promise<void>
```

### Interactive Session (PTY)

**PTY Request:**
```typescript
ssh.execInteractive(command: string): Promise<void>
// Pipes process.stdin/stdout to SSH channel
// Handles terminal resize events
```

**Implementation:**
1. Request PTY with terminal dimensions
2. Set local terminal to raw mode
3. Pipe stdin → SSH channel → container
4. Pipe container → SSH channel → stdout
5. Listen for SIGWINCH (resize events)
6. Restore terminal mode on exit

## Error Handling

### Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Argument Errors | Invalid IP, missing key | Exit with usage |
| File Errors | SSH key not found | Exit with path |
| SSH Errors | Connection failed | Retry, then diagnostic |
| System Errors | apt-get fails | Log error, suggest fix |
| Docker Errors | Image build fails | Log output, exit |
| Container Errors | Onboarding crashes | Log error, note incomplete |

### Error Message Format

```
Error: <Short description>

Details:
  - Key: value
  - Key: value

Possible causes:
  1. Cause with explanation
  2. Another cause

To debug:
  <Actionable command or step>
```

### Example Error Messages

**SSH Connection Failed:**
```
Error: SSH connection failed after 3 attempts

Details:
  - Host: 192.168.1.100
  - Port: 22
  - User: root

Possible causes:
  1. Server is not reachable (check network/firewall)
  2. SSH service is not running
  3. SSH key is not authorized for root user
  4. Root SSH login is disabled (check /etc/ssh/sshd_config)

To debug:
  ssh -i /path/to/key root@192.168.1.100

To enable root SSH access:
  1. Edit /etc/ssh/sshd_config
  2. Set: PermitRootLogin prohibit-password
  3. Restart: systemctl restart sshd
  4. Add your public key to /root/.ssh/authorized_keys
```

**Docker Installation Failed:**
```
Error: Docker installation failed

Details:
  - Command: apt-get install docker-ce
  - Exit code: 1

Possible causes:
  1. Package repository is unavailable
  2. Server has insufficient disk space
  3. Conflicting Docker installation exists

To debug:
  ssh -i /path/to/key root@192.168.1.100
  apt-get update
  apt-get install docker-ce
```

## Instance Artifacts

### File Location

Local artifacts stored at: `instances/<name>.yml`

### YAML Schema

```yaml
# Deployment metadata
name: string                  # Instance name
ip: string                    # Server IP address
deployedAt: string            # ISO 8601 timestamp
deploymentMethod: string      # Always "clawctl"
version: string               # CLI version used

# SSH configuration
ssh:
  keyFile: string             # Absolute path to private key
  user: string                # SSH username (usually "root")
  port: number                # SSH port (usually 22)

# Docker configuration
docker:
  image: string               # Image tag used
  composeFile: string         # Path on remote server
  branch: string              # OpenClaw git branch used

# Deployment status
status:
  onboardingCompleted: boolean  # Whether wizard was completed
```

### Usage

**Read Artifact:**
```typescript
const artifact = await readInstanceArtifact('production')
// Returns parsed YAML as object
```

**Create Artifact:**
```typescript
await createInstanceArtifact({
  name: 'production',
  ip: '192.168.1.100',
  ssh: { keyFile: '/path/to/key', user: 'root', port: 22 },
  docker: { image: 'roboclaw/openclaw:local', branch: 'main' }
})
```

**List Artifacts:**
```typescript
const instances = await listInstances()
// Returns array of instance names
```

## Dependencies

### Production Dependencies

```json
{
  "commander": "^12.0.0",    // CLI argument parsing
  "ssh2": "^1.16.0",         // SSH client
  "yaml": "^2.8.2"           // YAML parsing/generation (config + artifacts)
}
```

**Note:** `dotenv` is not needed as we'll read environment variables directly via `process.env`.

### Development Dependencies

```json
{
  "@types/node": "^22.10.5",      // Node.js types
  "@types/ssh2": "^1.15.1",       // SSH2 types
  "typescript": "^5.7.3"          // TypeScript compiler
}
```

### Why These Dependencies?

**commander:**
- Industry standard for Node.js CLIs
- Automatic help generation
- Type-safe argument parsing
- Subcommand support for future expansion

**ssh2:**
- Pure JavaScript SSH implementation
- No external dependencies (no OpenSSH required)
- Cross-platform (Windows, macOS, Linux)
- Supports PTY for interactive sessions
- Already used in website/lib/ssh-provisioner.ts

**yaml:**
- Simple, lightweight YAML parser
- Human-readable output
- Already used in website codebase
- Better for config files than JSON

## Implementation Phases

### Phase 1: Project Setup

**Tasks:**
- [ ] Create package.json at project root
- [ ] Configure tsconfig.json for ES modules
- [ ] Set up src/ directory structure
- [ ] Install dependencies (commander, ssh2, yaml)
- [ ] Configure .gitignore for dist/
- [ ] Configure .npmignore for publishing

**Deliverable:** Empty project compiles successfully

### Phase 2: Core Infrastructure

**Tasks:**
- [ ] Implement src/lib/types.ts with all interfaces
- [ ] Implement src/lib/logger.ts with colored output
- [ ] Implement src/lib/config.ts for configuration loading
- [ ] Port SSH client from website/lib/ssh-provisioner.ts
- [ ] Add SFTP upload capability
- [ ] Write unit tests for logger and config

**Deliverable:** SSH connection and configuration loading work end-to-end

### Phase 3: Deployment Modules

**Tasks:**
- [ ] Implement src/lib/docker-setup.ts
- [ ] Implement src/lib/user-setup.ts
- [ ] Implement src/lib/image-builder.ts
- [ ] Implement src/lib/compose.ts
- [ ] Test each module independently

**Deliverable:** Can deploy Docker and build image

### Phase 4: CLI Integration

**Tasks:**
- [ ] Implement src/index.ts with commander
- [ ] Implement src/commands/deploy.ts orchestration
- [ ] Implement src/lib/interactive.ts for PTY
- [ ] Implement src/lib/artifact.ts
- [ ] Wire all modules together

**Deliverable:** Full deployment flow works

### Phase 5: Testing & Polish

**Tasks:**
- [ ] Test on fresh Ubuntu 24.04 server
- [ ] Test error handling paths
- [ ] Improve error messages
- [ ] Add progress indicators
- [ ] Write README with examples
- [ ] Update specs to reflect implementation

**Deliverable:** Production-ready package

### Phase 6: Publication

**Tasks:**
- [ ] Create npm account (if needed)
- [ ] Verify package name availability
- [ ] Run `npm publish`
- [ ] Test `npx clawctl` from clean environment
- [ ] Update RoboClaw project documentation

**Deliverable:** Published to npm, users can run it

## Future Enhancements

### v1.1: Docker Hub Support

- Add `--image <tag>` option to pull from Docker Hub
- Deprecate on-server image build for production
- Keep build mode for development/testing

### v1.2: Additional Commands

```bash
npx clawctl connect <instance>     # SSH to instance
npx clawctl validate <instance>    # Health check
npx clawctl list                   # Show all instances
npx clawctl destroy <instance>     # Clean up
```

### v1.3: Multi-Server Support

```bash
npx clawctl deploy-multi servers.yml
# Deploy to multiple servers in parallel
```

### v1.4: CI/CD Mode

```bash
npx clawctl <IP> --key <path> --no-tty --no-interaction
# Non-interactive mode for automation
```

## Related Documents

- [clawctl-strategy.md](./clawctl-strategy.md) - Strategic vision and goals
- [deployment-workflow.md](./deployment-workflow.md) - Current Ansible approach (for comparison)
- [docker-openclaw.md](./docker-openclaw.md) - Docker containerization details

---

**Document Status:** Draft
**Maintained By:** RoboClaw Development Team
**Last Review:** 2026-02-04
**Next Steps:** Review and approve specification before implementation
