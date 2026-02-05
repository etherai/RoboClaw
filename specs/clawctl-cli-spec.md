# clawctl CLI Interface Specification

## Overview

This document specifies the complete command-line interface for `clawctl`, the deployment and management tool for OpenClaw instances.

**Last Updated:** 2026-02-05
**Version:** 1.0.1 (Implemented)
**Status:** Active

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Command Structure](#command-structure)
- [Instance Artifacts](#instance-artifacts)
- [Deployment Commands](#deployment-commands)
- [Instance Management](#instance-management)
- [Gateway Operations](#gateway-operations)
- [OpenClaw Operations](#openclaw-operations)
- [Connection Management](#connection-management)
- [Global Options](#global-options)
- [Output Formats](#output-formats)
- [Error Handling](#error-handling)
- [Implementation Phases](#implementation-phases)

## Design Philosophy

### Core Principles

1. **Instance-Centric:** Commands operate on named instances, not IP addresses (after initial deployment)
2. **Artifact-Based:** Instance metadata stored locally in `instances/<name>.yml` drives all operations
3. **Progressive Disclosure:** Common operations are simple, advanced options available when needed
4. **Consistent Patterns:** Similar commands follow similar argument patterns
5. **SSH Abstraction:** Users don't need to remember SSH keys or IPs after deployment
6. **Graceful Degradation:** Commands work even if instance metadata is missing (fall back to manual input)

### Command Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| Deployment | Create new instances | `deploy` |
| Instance Management | Lifecycle operations | `list`, `status`, `destroy` |
| Gateway Operations | Manage gateway daemon | `start`, `stop`, `restart`, `logs` |
| OpenClaw Operations | Run OpenClaw commands | `onboard`, `exec`, `shell` |
| Connection Management | SSH and tunnels | `connect`, `tunnel` |

## Command Structure

### General Pattern

```
npx clawctl <command> [instance] [options]
```

### Command Types

**1. Instance Commands** (require instance name)
```bash
npx clawctl <command> <instance> [options]
```
Examples: `status`, `logs`, `restart`, `destroy`

**2. Global Commands** (no instance required)
```bash
npx clawctl <command> [options]
```
Examples: `list`, `version`, `help`

**3. Deployment Commands** (create new instances)
```bash
npx clawctl deploy <ip> [options]
```
Special case: takes IP address, creates instance artifact

### Instance Name Resolution

Commands accept instance names, which are resolved to connection details via `instances/<name>.yml`:

```bash
# After deploying as "production"
npx clawctl logs production
# Reads instances/production.yml → SSH to 192.168.1.100 → docker compose logs
```

## Instance Artifacts

### Purpose

Instance artifacts store all metadata needed to manage a deployed instance:
- SSH connection details
- Server IP and credentials
- Deployment configuration
- Gateway status

### Location

**Primary location:** `./instances/<instance-name>.yml` (current working directory)
**Fallback location:** `~/.clawctl/instances/<instance-name>.yml` (global instances)

**Resolution order:**
1. Check `./instances/<name>.yml` (local, project-specific)
2. If not found, check `~/.clawctl/instances/<name>.yml` (global)
3. If not found, error: "Instance '<name>' not found"

**Rationale:**
- Local instances allow per-project organization
- Global instances allow managing instances from anywhere
- Users can choose which works best for their workflow

**Creation:**
- `deploy` command creates artifact in `./instances/` by default
- Can specify `--global` flag to create in `~/.clawctl/instances/` instead

### Schema

```yaml
name: string                 # Instance identifier
ip: string                   # Server IP address
deployedAt: string           # ISO 8601 timestamp
deploymentMethod: string     # Always "clawctl"
version: string              # clawctl version used

ssh:
  keyFile: string            # Absolute path to SSH private key
  user: string               # SSH username (typically "root")
  port: number               # SSH port (typically 22)

docker:
  image: string              # Docker image tag used
  composeFile: string        # Path to docker-compose.yml on server
  branch: string             # OpenClaw git branch deployed

deployment:
  user: string               # System user running containers (roboclaw)
  uid: number                # Container UID
  gid: number                # Container GID
  home: string               # Deployment user's home directory

status:
  onboardingCompleted: boolean  # Whether onboarding wizard ran
  gatewayRunning: boolean       # Whether gateway is currently running (best effort)
```

### Usage by Commands

```typescript
// Commands read artifact to get connection details
const artifact = await readInstanceArtifact('production')
const ssh = await connectToInstance(artifact)
await ssh.exec(`cd ${artifact.deployment.home}/docker && docker compose logs`)
```

## Deployment Commands

### `deploy` - Deploy New Instance

**Purpose:** Deploy OpenClaw to a new server via SSH.

**Syntax:**
```bash
npx clawctl deploy <ip> [options]
```

**Arguments:**
- `<ip>` - Target server IP address (required)

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--key <path>` | `-k` | string | SSH private key path | **Required** |
| `--name <name>` | `-n` | string | Instance name | `instance-<IP-dashed>` |
| `--user <user>` | `-u` | string | SSH username (must be root) | `root` |
| `--port <port>` | `-p` | number | SSH port | `22` |
| `--branch <branch>` | `-b` | string | OpenClaw git branch | `main` |
| `--skip-onboard` | - | boolean | Skip onboarding wizard | `false` |
| `--no-auto-connect` | - | boolean | Skip auto-connect to dashboard | `false` |
| `--global` | `-g` | boolean | Save artifact to ~/.clawctl/instances/ | `false` |
| `--verbose` | `-v` | boolean | Verbose output | `false` |

**Examples:**

Basic deployment:
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/id_ed25519
```

With custom name:
```bash
npx clawctl deploy 192.168.1.100 -k ~/.ssh/id_ed25519 -n production
```

Deploy specific branch:
```bash
npx clawctl deploy 192.168.1.100 -k ~/.ssh/id_ed25519 --branch feature/new-ui
```

Skip auto-connect (for CI/CD):
```bash
npx clawctl deploy 192.168.1.100 -k ~/.ssh/id_ed25519 --no-auto-connect
```

**Output:**
```
Preparing to deploy OpenClaw
  Target: 192.168.1.100
  Instance: production
  SSH User: root

[Deployment phases 1-10...]

✅ Deployment complete!

Instance Details:
  Name: production
  IP: 192.168.1.100
  Gateway: Running at http://localhost:18789

┌─ Auto-connect to Dashboard ─────────────────────────────────┐
│ Would you like to open the dashboard now?                   │
└─────────────────────────────────────────────────────────────┘
  [Y/n]: Y

ℹ Checking existing pairing requests...
ℹ Creating SSH tunnel on port 18789...
✓ Tunnel established (PID 12345)
ℹ Opening browser...
✓ Browser opened
ℹ Waiting for device pairing request...
  (press Ctrl+C to skip)
✓ New pairing request detected
ℹ Auto-approving device...
✓ Device approved!

✅ Dashboard is ready!
  Tunnel will stay open. Press Ctrl+C to exit.
```

**Artifact Created:**
- `instances/production.yml`

**Exit Codes:**
- `0` - Success
- `1` - Invalid arguments
- `2` - SSH connection failed
- `3` - Package installation failed
- `4` - Docker installation failed
- `5` - User setup failed
- `6` - Directory creation failed
- `7` - Image build failed
- `8` - Compose upload failed
- `9` - Gateway startup failed
- `10` - Artifact creation failed

**Error Recovery:**
- Re-run same command to resume from failure point
- Use `--force` to ignore partial state and start fresh
- Use `--clean` to remove everything and start over
- All operations are idempotent and safe to retry

---

## Instance Management

### `list` - List All Instances

**Purpose:** Show all deployed instances.

**Syntax:**
```bash
npx clawctl list [options]
```

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--json` | - | boolean | Output as JSON | `false` |

**Examples:**

```bash
npx clawctl list
```

**Output (table format):**
```
Instances (3):

NAME          IP              DEPLOYED           STATUS
production    192.168.1.100   2026-02-04 15:30   Running
staging       192.168.1.101   2026-02-03 10:15   Stopped
development   10.0.1.50       2026-02-01 09:00   Running

Use 'npx clawctl status <name>' for details
```

**Output (JSON format):**
```bash
npx clawctl list --json
```
```json
{
  "instances": [
    {
      "name": "production",
      "ip": "192.168.1.100",
      "deployedAt": "2026-02-04T15:30:00Z",
      "status": "running"
    },
    {
      "name": "staging",
      "ip": "192.168.1.101",
      "deployedAt": "2026-02-03T10:15:00Z",
      "status": "stopped"
    }
  ]
}
```

**Status Detection:**
- If SSH accessible: Query gateway container status
- If SSH fails: Show "Unknown (SSH failed)"
- If artifact exists but server gone: Show "Unreachable"

**Exit Codes:**
- `0` - Success (even if 0 instances)

---

### `status` - Show Instance Details

**Purpose:** Display detailed status of an instance.

**Syntax:**
```bash
npx clawctl status <instance> [options]
```

**Arguments:**
- `<instance>` - Instance name (required)

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--json` | - | boolean | Output as JSON | `false` |

**Examples:**

```bash
npx clawctl status production
```

**Output:**
```
Instance: production
IP: 192.168.1.100
Deployed: 2026-02-04 15:30:00 UTC (2 hours ago)
Version: clawctl v1.0.0

SSH Connection:
  User: root
  Port: 22
  Key: ~/.ssh/id_ed25519
  Status: ✓ Connected

Deployment:
  User: roboclaw (UID: 1000)
  Home: /home/roboclaw
  Docker Image: roboclaw/openclaw:local
  Branch: main

Gateway Status:
  Container: openclaw-gateway
  Status: ✓ Running (healthy)
  Uptime: 2h 15m
  Port: 127.0.0.1:18789
  Health Check: Passing
  Last Restart: 2026-02-04 15:32:00

Onboarding:
  Status: ✓ Completed

Resources:
  CPU: 2.3%
  Memory: 145 MB / 2 GB
  Disk: /home/roboclaw: 1.2 GB used

Quick Actions:
  View logs: npx clawctl logs production
  Restart: npx clawctl restart production
  Connect: npx clawctl connect production
```

**Exit Codes:**
- `0` - Instance running and healthy
- `1` - Instance not found
- `2` - SSH connection failed
- `3` - Gateway not running
- `4` - Gateway unhealthy

---

### `destroy` - Remove Instance

**Purpose:** Completely remove an instance (containers, data, artifact).

**Syntax:**
```bash
npx clawctl destroy <instance> [options]
```

**Arguments:**
- `<instance>` - Instance name (required)

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--keep-data` | - | boolean | Keep ~/.openclaw and ~/.roboclaw | `false` |
| `--force` | `-f` | boolean | Skip confirmation prompt | `false` |
| `--local-only` | - | boolean | Only delete local artifact | `false` |

**Examples:**

Interactive destroy (prompts for confirmation):
```bash
npx clawctl destroy production
```

Force destroy without prompt:
```bash
npx clawctl destroy production --force
```

Keep data on server:
```bash
npx clawctl destroy production --keep-data
```

Only remove local artifact (server cleanup failed):
```bash
npx clawctl destroy production --local-only
```

**Output:**
```
⚠️  Destroy instance 'production'?

This will permanently:
  - Stop the gateway container
  - Remove all containers
  - Delete /home/roboclaw/.openclaw and /home/roboclaw/.roboclaw
  - Remove local artifact: instances/production.yml

Instance: production
IP: 192.168.1.100
Deployed: 2 days ago

Type 'production' to confirm: production

Destroying instance...
  ✓ Stopped gateway
  ✓ Removed containers
  ✓ Deleted data directories
  ✓ Removed local artifact

Instance 'production' destroyed.
```

**Exit Codes:**
- `0` - Success
- `1` - Instance not found
- `2` - User cancelled
- `3` - SSH connection failed (use --local-only)

---

## Gateway Operations

### `start` - Start Gateway

**Purpose:** Start the gateway daemon container.

**Syntax:**
```bash
npx clawctl start <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl start production
```

**Output:**
```
Starting gateway on production (192.168.1.100)...
  ✓ Gateway container started
  ✓ Health check passed
  Gateway listening on http://localhost:18789

Create tunnel: npx clawctl tunnel production
```

**Exit Codes:**
- `0` - Gateway started successfully
- `1` - Instance not found
- `2` - Gateway already running
- `3` - Failed to start

---

### `stop` - Stop Gateway

**Purpose:** Stop the gateway daemon container.

**Syntax:**
```bash
npx clawctl stop <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl stop production
```

**Output:**
```
Stopping gateway on production (192.168.1.100)...
  ✓ Gateway stopped

Restart: npx clawctl start production
```

**Exit Codes:**
- `0` - Gateway stopped successfully
- `1` - Instance not found
- `2` - Gateway already stopped

---

### `restart` - Restart Gateway

**Purpose:** Restart the gateway daemon container.

**Syntax:**
```bash
npx clawctl restart <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl restart production
```

**Output:**
```
Restarting gateway on production (192.168.1.100)...
  ✓ Gateway stopped
  ✓ Gateway started
  ✓ Health check passed

Gateway listening on http://localhost:18789
```

**Exit Codes:**
- `0` - Success
- `1` - Instance not found
- `3` - Failed to restart

---

### `logs` - View Gateway Logs

**Purpose:** Stream or view gateway container logs.

**Syntax:**
```bash
npx clawctl logs <instance> [options]
```

**Arguments:**
- `<instance>` - Instance name (required)

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--follow` | `-f` | boolean | Follow log output (stream) | `false` |
| `--tail <n>` | `-n` | number | Show last N lines | `100` |
| `--since <time>` | - | string | Show logs since timestamp | - |

**Examples:**

View last 100 lines:
```bash
npx clawctl logs production
```

Follow logs (live stream):
```bash
npx clawctl logs production --follow
```

Last 50 lines:
```bash
npx clawctl logs production --tail 50
```

Since 1 hour ago:
```bash
npx clawctl logs production --since 1h
```

**Output:**
```
Gateway logs for production (192.168.1.100):

2026-02-04 15:30:15 [INFO] Gateway started
2026-02-04 15:30:16 [INFO] Listening on 0.0.0.0:18789
2026-02-04 15:32:01 [INFO] Health check: OK
2026-02-04 15:35:42 [INFO] API request: GET /status
...

[following logs, press Ctrl+C to stop]
```

**Exit Codes:**
- `0` - Success
- `1` - Instance not found
- `2` - Gateway not running

---

## OpenClaw Operations

### `onboard` - Run Onboarding Wizard

**Purpose:** Run the interactive OpenClaw onboarding wizard.

**Syntax:**
```bash
npx clawctl onboard <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl onboard production
```

**Output:**
```
Launching onboarding wizard on production (192.168.1.100)...

[OpenClaw onboarding wizard runs interactively here]
[User responds to prompts]

  ✓ Onboarding completed
  ✓ Configuration saved

Gateway will restart to apply changes...
  ✓ Gateway restarted
```

**Notes:**
- Requires interactive terminal (PTY)
- Streams stdin/stdout between local and remote
- Handles terminal resize events
- Gateway automatically restarts after completion

**Exit Codes:**
- `0` - Onboarding completed
- `1` - Instance not found
- `2` - Already completed (use --force to re-run)
- `3` - Wizard failed or cancelled

---

### `exec` - Run OpenClaw Command

**Purpose:** Execute an arbitrary OpenClaw CLI command.

**Syntax:**
```bash
npx clawctl exec <instance> <command> [args...]
```

**Arguments:**
- `<instance>` - Instance name (required)
- `<command>` - OpenClaw command to run
- `[args...]` - Additional arguments

**Examples:**

Check OpenClaw version:
```bash
npx clawctl exec production version
```

Run a custom OpenClaw command:
```bash
npx clawctl exec production session list
```

**Output:**
```
Running 'version' on production (192.168.1.100)...

OpenClaw v2.1.0
Node.js v20.10.0
```

**Implementation:**
```bash
# Translates to:
ssh root@192.168.1.100 \
  "sudo -u roboclaw docker compose -f /home/roboclaw/docker/docker-compose.yml \
   run --rm openclaw-cli <command> <args...>"
```

**Exit Codes:**
- `0` - Command succeeded
- `1` - Instance not found
- `N` - Command's exit code

---

### `shell` - Interactive OpenClaw Shell

**Purpose:** Open an interactive shell in the OpenClaw container.

**Syntax:**
```bash
npx clawctl shell <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl shell production
```

**Output:**
```
Opening shell on production (192.168.1.100)...

node@openclaw:~$ ls
.openclaw  .roboclaw
node@openclaw:~$ openclaw version
OpenClaw v2.1.0
node@openclaw:~$ exit

Shell closed.
```

**Implementation:**
```bash
# Translates to:
ssh -t root@192.168.1.100 \
  "sudo -u roboclaw docker compose -f /home/roboclaw/docker/docker-compose.yml \
   run --rm -it openclaw-cli /bin/bash"
```

**Exit Codes:**
- `0` - Shell exited normally
- `1` - Instance not found

---

## Connection Management

### `connect` - SSH to Server

**Purpose:** Open SSH connection to the instance server.

**Syntax:**
```bash
npx clawctl connect <instance>
```

**Arguments:**
- `<instance>` - Instance name (required)

**Examples:**
```bash
npx clawctl connect production
```

**Output:**
```
Connecting to production (192.168.1.100)...

root@server:~#
```

**Implementation:**
```bash
# Translates to:
ssh -i ~/.ssh/id_ed25519 root@192.168.1.100
```

Reads SSH credentials from `instances/<instance>.yml`.

**Exit Codes:**
- `0` - SSH session exited normally
- `1` - Instance not found
- `2` - SSH connection failed

---

### `tunnel` - Create SSH Tunnel

**Purpose:** Create SSH tunnel to access gateway from local machine.

**Syntax:**
```bash
npx clawctl tunnel <instance> [options]
```

**Arguments:**
- `<instance>` - Instance name (required)

**Options:**
| Option | Alias | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--local-port <port>` | `-l` | number | Local port to bind | `18789` |
| `--background` | `-b` | boolean | Run in background | `false` |

**Examples:**

Foreground tunnel (blocks until Ctrl+C):
```bash
npx clawctl tunnel production
```

Background tunnel:
```bash
npx clawctl tunnel production --background
```

Custom local port:
```bash
npx clawctl tunnel production --local-port 8080
```

**Output (foreground):**
```
Creating tunnel to production (192.168.1.100)...

  Local:  http://localhost:18789
  Remote: http://127.0.0.1:18789

✓ Tunnel established

Gateway accessible at http://localhost:18789
Press Ctrl+C to close tunnel
```

**Output (background):**
```
Creating tunnel to production (192.168.1.100)...

✓ Tunnel started in background (PID: 12345)

Gateway accessible at http://localhost:18789

To stop: kill 12345
```

**Implementation:**
```bash
# Translates to:
ssh -L 18789:localhost:18789 \
    -i ~/.ssh/id_ed25519 \
    root@192.168.1.100 \
    -N -f  # -f for background
```

**Exit Codes:**
- `0` - Tunnel closed normally (foreground) or started (background)
- `1` - Instance not found
- `2` - Port already in use
- `3` - SSH connection failed

---

## Configuration

### Configuration Hierarchy

Configuration values are resolved in this order (highest to lowest priority):

1. **Command-line flags** (highest priority)
2. **Environment variables**
3. **Project config file** (`./clawctl.yml`)
4. **Global config file** (`~/.clawctl/config.yml`)
5. **Built-in defaults** (lowest priority)

Example: If `--key` flag is provided, it overrides `CLAWCTL_SSH_KEY` env var, which overrides `sshKey` in config file.

### Environment Variables

All configuration can be set via environment variables with `CLAWCTL_` prefix:

| Environment Variable | Maps To | Type | Example |
|---------------------|---------|------|---------|
| `CLAWCTL_SSH_KEY` | `--key` | string | `~/.ssh/id_ed25519` |
| `CLAWCTL_SSH_USER` | `--user` | string | `root` |
| `CLAWCTL_SSH_PORT` | `--port` | number | `22` |
| `CLAWCTL_DEFAULT_BRANCH` | `--branch` | string | `main` |
| `CLAWCTL_INSTANCES_DIR` | Instances directory | path | `./instances` |
| `CLAWCTL_SKIP_ONBOARD` | `--skip-onboard` | boolean | `true` or `false` |
| `CLAWCTL_VERBOSE` | `--verbose` | boolean | `true` or `false` |

**Usage:**

```bash
# Set in shell
export CLAWCTL_SSH_KEY=~/.ssh/production_key
export CLAWCTL_DEFAULT_BRANCH=develop
export CLAWCTL_INSTANCES_DIR=~/my-instances

# Use without flags
npx clawctl deploy 192.168.1.100

# Override with flags
npx clawctl deploy 192.168.1.100 --key ~/.ssh/other_key  # Uses other_key
```

**Boolean environment variables:**
- `true`, `1`, `yes` → true
- `false`, `0`, `no`, empty → false

### Configuration File

#### Global Configuration

**Location:** `~/.clawctl/config.yml`

**Format:**
```yaml
# Global clawctl configuration
# Applied to all projects unless overridden

defaults:
  # SSH connection defaults
  sshKey: ~/.ssh/id_ed25519
  sshUser: root
  sshPort: 22

  # Deployment defaults
  branch: main
  skipOnboard: false

  # Paths
  instancesDir: ~/.clawctl/instances  # Global instances directory

  # Behavior
  verbose: false
  autoResume: true  # Automatically resume failed deployments without prompting

# Instance-specific overrides (optional)
instances:
  production:
    sshKey: ~/.ssh/production_key
    branch: stable

  staging:
    sshKey: ~/.ssh/staging_key
    branch: develop
```

#### Project Configuration

**Location:** `./clawctl.yml` (in project directory)

**Format:**
```yaml
# Project-specific clawctl configuration
# Overrides global config

defaults:
  sshKey: ./keys/deploy_key
  branch: develop
  instancesDir: ./instances  # Project-local instances

instances:
  dev:
    sshKey: ./keys/dev_key
    branch: feature/new-ui
```

**Use case:** Store project-specific deployment settings in version control (except SSH keys!)

**.gitignore recommendation:**
```gitignore
# Ignore clawctl instances and sensitive config
instances/
clawctl.yml  # If it contains sensitive paths
```

Or use a committed template:
```yaml
# clawctl.yml.example (committed)
defaults:
  branch: develop
  instancesDir: ./instances
  # sshKey: <add your key path here>
```

### Instance-Specific Configuration

When deploying to a named instance, configuration can reference that instance:

```yaml
# ~/.clawctl/config.yml
instances:
  production:
    sshKey: ~/.ssh/prod_key
    branch: stable
    skipOnboard: true  # Already onboarded
```

```bash
# Deploy command uses instance config
npx clawctl deploy 192.168.1.100 --name production
# Automatically uses:
#   --key ~/.ssh/prod_key
#   --branch stable
#   --skip-onboard
```

### Configuration Examples

#### Example 1: Development Team

**Team shares:** `clawctl.yml` (committed)
```yaml
defaults:
  branch: develop
  instancesDir: ./instances

instances:
  local:
    branch: main
```

**Each developer adds:** `~/.clawctl/config.yml` (not committed)
```yaml
defaults:
  sshKey: ~/.ssh/id_ed25519
```

**Usage:**
```bash
# Uses: develop branch, team's config, personal SSH key
npx clawctl deploy 10.0.1.100 --name local
```

#### Example 2: Multi-Environment Ops

**Ops engineer:** `~/.clawctl/config.yml`
```yaml
defaults:
  sshUser: root
  sshPort: 22
  instancesDir: ~/deployments

instances:
  prod-us-east:
    sshKey: ~/.ssh/prod_us_east
    branch: stable

  prod-eu-west:
    sshKey: ~/.ssh/prod_eu_west
    branch: stable

  staging:
    sshKey: ~/.ssh/staging
    branch: develop
```

**Usage:**
```bash
# Each deployment uses correct key and branch automatically
npx clawctl deploy 203.0.113.10 --name prod-us-east
npx clawctl deploy 198.51.100.20 --name prod-eu-west
npx clawctl deploy 192.0.2.30 --name staging
```

#### Example 3: Environment Variables in CI/CD

**GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
env:
  CLAWCTL_SSH_KEY: ${{ secrets.DEPLOY_KEY }}
  CLAWCTL_SKIP_ONBOARD: true
  CLAWCTL_VERBOSE: true

steps:
  - name: Deploy to staging
    run: npx clawctl deploy ${{ secrets.STAGING_IP }} --name staging-${{ github.run_id }}
```

**GitLab CI:**
```yaml
# .gitlab-ci.yml
deploy:
  script:
    - export CLAWCTL_SSH_KEY="$DEPLOY_KEY_PATH"
    - export CLAWCTL_INSTANCES_DIR="./ci-instances"
    - npx clawctl deploy $STAGING_IP --name staging
```

### Configuration Validation

When clawctl starts, it validates configuration:

```
Loading configuration...
  ✓ Global config: ~/.clawctl/config.yml
  ✓ Project config: ./clawctl.yml
  ✓ Environment: CLAWCTL_SSH_KEY set

Resolved configuration for 'production':
  SSH Key: ~/.ssh/prod_key (from global config)
  SSH User: root (default)
  Branch: stable (from instance config)
  Instances Dir: ~/deployments (from global config)
```

**Validation errors:**
```
Error: Configuration invalid

  ~/.clawctl/config.yml:
    Line 5: 'sshPort' must be a number, got "twenty-two"

To fix:
  Edit ~/.clawctl/config.yml
  Or remove invalid config and use defaults
```

### Configuration Precedence Examples

**Scenario:** Multiple sources set `branch`

```yaml
# ~/.clawctl/config.yml
defaults:
  branch: main

instances:
  production:
    branch: stable
```

```bash
# .env or shell
export CLAWCTL_DEFAULT_BRANCH=develop
```

```bash
# Command
npx clawctl deploy 192.168.1.100 --name production --branch feature/test
```

**Resolution:**
1. ✅ `--branch feature/test` (command-line flag wins)
2. ~~`CLAWCTL_DEFAULT_BRANCH=develop`~~ (overridden)
3. ~~`instances.production.branch=stable`~~ (overridden)
4. ~~`defaults.branch=main`~~ (overridden)

**Without `--branch` flag:**
1. ~~`CLAWCTL_DEFAULT_BRANCH=develop`~~ (env var would win)
2. ~~`instances.production.branch=stable`~~ (overridden by env)

**Without env var or flag:**
1. ✅ `instances.production.branch=stable` (instance config wins)
2. ~~`defaults.branch=main`~~ (overridden)

### View Current Configuration

```bash
npx clawctl config show [instance]
```

**Output:**
```
Configuration for 'production':

  Source          Setting           Value
  ──────────────────────────────────────────────────────
  Flag            --key             (none)
  Environment     CLAWCTL_SSH_KEY   ~/.ssh/prod_key
  Instance Config branch            stable
  Global Config   sshUser           root
  Global Config   instancesDir      ~/deployments
  Default         sshPort           22

Resolved:
  sshKey:        ~/.ssh/prod_key
  sshUser:       root
  sshPort:       22
  branch:        stable
  instancesDir:  ~/deployments
```

### Edit Configuration

```bash
# Open global config in $EDITOR
npx clawctl config edit

# Open project config
npx clawctl config edit --local
```

### Initialize Configuration

```bash
# Create default global config
npx clawctl config init

# Create project config
npx clawctl config init --local
```

**Output:**
```
Creating ~/.clawctl/config.yml...

  ✓ Created default configuration

Edit configuration:
  npx clawctl config edit

Or manually edit:
  $EDITOR ~/.clawctl/config.yml
```

### Config File Schema

**Full schema with all options:**

```yaml
# clawctl configuration file
# Supports: ~/.clawctl/config.yml (global) or ./clawctl.yml (project)

defaults:
  # SSH connection
  sshKey: string              # Path to SSH private key
  sshUser: string             # SSH username (must be root)
  sshPort: number             # SSH port

  # Deployment
  branch: string              # OpenClaw git branch
  skipOnboard: boolean        # Skip onboarding wizard

  # Paths
  instancesDir: string        # Where to store instance artifacts

  # Behavior
  verbose: boolean            # Enable verbose logging
  autoResume: boolean         # Auto-resume without prompt
  autoClean: boolean          # Auto-clean failed deployments

# Instance-specific overrides
instances:
  [instance-name]:
    sshKey: string
    sshUser: string
    sshPort: number
    branch: string
    skipOnboard: boolean
    # Any default can be overridden per-instance
```

## Global Options

These options work with all commands:

| Option | Alias | Type | Description |
|--------|-------|------|-------------|
| `--version` | - | boolean | Show clawctl version |
| `--help` | `-h` | boolean | Show help for command |
| `--verbose` | `-v` | boolean | Verbose output |
| `--quiet` | `-q` | boolean | Minimal output (errors only) |

**Examples:**

```bash
npx clawctl --version
# clawctl v1.0.0

npx clawctl --help
# Shows general help

npx clawctl logs --help
# Shows help for logs command

npx clawctl logs production --verbose
# Verbose logging output
```

---

## Output Formats

### Human-Readable (Default)

Formatted for terminal viewing:
- Colors for status (green ✓, red ✗, yellow ⚠️)
- Tables for lists
- Progress indicators for long operations
- Helpful next-step suggestions

### JSON (--json flag)

Machine-readable JSON output:
- No colors or formatting
- Consistent schema
- Includes all available data
- Parseable by other tools

**Example:**
```bash
npx clawctl status production --json
```
```json
{
  "name": "production",
  "ip": "192.168.1.100",
  "deployedAt": "2026-02-04T15:30:00Z",
  "version": "1.0.0",
  "ssh": {
    "user": "root",
    "port": 22,
    "keyFile": "/home/user/.ssh/id_ed25519",
    "connected": true
  },
  "gateway": {
    "status": "running",
    "healthy": true,
    "uptime": 8100,
    "port": 18789
  },
  "deployment": {
    "user": "roboclaw",
    "uid": 1000,
    "home": "/home/roboclaw"
  }
}
```

---

## Error Handling

### Error Message Format

```
Error: <Short description>

Details:
  - Key: value
  - Key: value

Possible causes:
  1. Cause with explanation
  2. Another cause

To fix:
  <Actionable command or step>
```

### Common Errors

**Instance not found:**
```
Error: Instance 'production' not found

Details:
  - Artifact: instances/production.yml does not exist

Available instances:
  - staging
  - development

To list all: npx clawctl list
```

**SSH connection failed:**
```
Error: SSH connection failed

Details:
  - Instance: production
  - IP: 192.168.1.100
  - User: root

Possible causes:
  1. Server is unreachable (network/firewall)
  2. SSH key is not authorized
  3. SSH service is not running

To debug:
  ssh -i ~/.ssh/id_ed25519 root@192.168.1.100
```

**Gateway not running:**
```
Error: Gateway is not running

Details:
  - Instance: production
  - IP: 192.168.1.100

To start gateway:
  npx clawctl start production

To view logs:
  npx clawctl logs production
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (v1.0)

**Must-have for first release:**
- [x] `deploy` - Full deployment flow
- [x] Auto-connect to dashboard (v1.0.1)
  - [x] Interactive Y/n prompt
  - [x] SSH tunnel creation
  - [x] Browser opening (cross-platform)
  - [x] Pairing request detection
  - [x] Auto-approval of pairing
  - [x] `--no-auto-connect` flag
- [x] `list` - Show instances
- [x] `status` - Instance details
- [ ] Instance artifact CRUD operations
- [ ] SSH connection management
- [ ] Error handling framework

**Deliverable:** Can deploy and view instances, auto-connect to dashboard

### Phase 2: Gateway Management (v1.0)

**Must-have for first release:**
- [ ] `start` - Start gateway
- [ ] `stop` - Stop gateway
- [ ] `restart` - Restart gateway
- [ ] `logs` - View logs (with --follow)

**Deliverable:** Can manage gateway lifecycle

### Phase 3: OpenClaw Operations (v1.1)

**Nice-to-have, can ship later:**
- [ ] `onboard` - Run onboarding
- [ ] `exec` - Run commands
- [ ] `shell` - Interactive shell

**Deliverable:** Can run OpenClaw commands without SSH

### Phase 4: Connections (v1.1)

**Nice-to-have, can ship later:**
- [ ] `connect` - SSH to server
- [ ] `tunnel` - Create SSH tunnel

**Deliverable:** Easy access to server and gateway

### Phase 5: Cleanup (v1.0)

**Must-have for first release:**
- [ ] `destroy` - Remove instance

**Deliverable:** Complete lifecycle management

### Phase 6: Configuration Management (v1.0)

**Must-have for first release:**
- [ ] Load configuration from files and env vars
- [ ] Resolve configuration hierarchy (flags > env > config > defaults)
- [ ] `config show [instance]` - View current config
- [ ] `config edit [--local]` - Edit config file
- [ ] `config init [--local]` - Create default config

**Deliverable:** Complete configuration system

### Phase 7: Advanced (v1.2+)

**Future enhancements:**
- [ ] `deploy-multi` - Multi-server deployment
- [ ] `update` - Update OpenClaw version
- [ ] `backup` - Backup instance data
- [ ] `restore` - Restore from backup
- [ ] `migrate` - Move instance to new server
- [ ] `clone` - Duplicate instance

---

## Design Decisions

### ✅ Finalized Decisions

1. **Instance artifact location:** Option C - Local first with global fallback
   - Check `./instances/<name>.yml` first
   - Fall back to `~/.clawctl/instances/<name>.yml`
   - Allow users to organize artifacts per-project or globally

2. **SSH connection handling:** Option A - Connect/disconnect per command
   - Simple implementation for v1.0
   - No state management or connection pooling
   - Optimize later if performance becomes an issue

3. **Tunnel management:** Option A - Include `tunnel` command
   - Convenience wrapper around SSH tunnel creation
   - Reads credentials from artifact
   - Support foreground and background modes
   - No complex tunnel tracking for v1.0

4. **Wrapper script:** Not needed
   - `clawctl` commands handle all operations
   - Users never need to SSH manually for common tasks

### Open Questions

1. **Gateway health checks:**
   - How long should we wait for health check to pass?
   - Retry logic for transient failures?

2. **Concurrent operations:**
   - Should we prevent multiple commands running on same instance?
   - File locking on instance artifacts?

3. **Update mechanism:**
   - How do users update OpenClaw version on deployed instances?
   - Pull new image and restart? Or full redeploy?

---

**Document Status:** Active (v1.0.1 implemented)
**Maintained By:** RoboClaw Development Team
**Next Steps:** Implement remaining commands (list, status, logs, etc.) in v1.1
