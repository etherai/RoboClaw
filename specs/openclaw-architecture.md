# OpenClaw Architecture Specification

## Overview

### What is OpenClaw?

**OpenClaw** is an AI assistant platform designed to provide intelligent assistance through various channels. It's a self-hosted solution that combines a command-line interface with a web-based gateway service, enabling users to interact with AI capabilities through their preferred interfaces while maintaining control over their infrastructure.

OpenClaw serves as the core AI assistant infrastructure that RoboClaw deploys to remote servers. While RoboClaw handles the deployment automation, OpenClaw provides the actual AI assistant functionality once deployed. Think of it as the application layer that runs on the infrastructure RoboClaw provisions.

**Key Characteristics:**
- **Self-hosted**: Runs on your own servers, not SaaS
- **Containerized**: Deployed via Docker for isolation and portability
- **Multi-interface**: Supports CLI and web gateway access
- **Device-paired**: Uses a pairing system for secure multi-device access
- **Open source**: Built and maintained by the OpenClaw community

### Key Capabilities

**1. Interactive AI Assistance**
- Command-line interface for direct interaction
- Real-time conversation with AI models
- Context-aware responses
- Multi-turn dialogues

**2. Web Gateway Dashboard**
- Browser-based interface at http://localhost:18789
- Device pairing system for secure access
- Real-time communication with backend
- Multiple device support

**3. Self-Service Onboarding**
- Interactive wizard for initial setup
- API key configuration
- Gateway authentication setup
- Persistent configuration storage

**4. Secure Architecture**
- Non-root container execution (UID 1000)
- Localhost-only gateway binding (SSH tunnel for remote access)
- Token-based authentication
- Isolated container namespace

### Use Cases

**Development & Testing**
- Test AI integrations locally before cloud deployment
- Experiment with different AI models and configurations
- Develop custom workflows and automations

**Personal AI Assistant**
- Self-hosted alternative to cloud AI services
- Full control over data and privacy
- Customizable to personal workflows
- Cost control via self-hosting

**Team Collaboration**
- Shared AI assistant for small teams
- Centralized knowledge base
- Consistent AI interactions across team members
- Team workspace management

**Edge Deployment**
- Run AI assistance on edge servers
- Low-latency responses for local users
- Reduced bandwidth to cloud services
- Hybrid cloud-edge architectures

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Remote Server (Ubuntu 24.04)              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Docker Host (Docker Compose)                                │ │
│  │                                                              │ │
│  │  ┌──────────────────────┐    ┌──────────────────────────┐  │ │
│  │  │ openclaw-cli         │    │ openclaw-gateway         │  │ │
│  │  │ (on-demand)          │    │ (long-running daemon)    │  │ │
│  │  │                      │    │                          │  │ │
│  │  │ • Interactive shell  │    │ • Web dashboard server   │  │ │
│  │  │ • Onboarding wizard  │    │ • Device pairing mgmt    │  │ │
│  │  │ • CLI commands       │    │ • Authentication         │  │ │
│  │  │ • Non-root (UID 1000)│    │ • Health checks          │  │ │
│  │  │                      │    │ • Port 18789 (localhost) │  │ │
│  │  │ User: node (1000)    │    │ User: node (1000)        │  │ │
│  │  └──────────────────────┘    └──────────────────────────┘  │ │
│  │            │                             │                  │ │
│  │            └─────────┬───────────────────┘                  │ │
│  │                      │                                      │ │
│  │            ┌─────────▼──────────┐                          │ │
│  │            │ Shared Volumes      │                          │ │
│  │            │                     │                          │ │
│  │            │ ~/.openclaw/        │ ← Config, sessions       │ │
│  │            │ ~/.openclaw/workspace │ ← User files           │ │
│  │            └─────────────────────┘                          │ │
│  │                                                              │ │
│  │  Base Image: roboclaw/openclaw:latest                       │ │
│  │  (Debian Bookworm + Node.js 22)                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Deployment User: roboclaw (UID 1000)                            │
└─────────────────────────────────────────────────────────────────┘
           ▲                                    ▲
           │                                    │
    SSH (root access)                    SSH Tunnel (18789)
           │                                    │
    ┌──────┴────────┐                   ┌──────┴────────┐
    │ clawctl       │                   │ Web Browser   │
    │ (deployment)  │                   │ (dashboard)   │
    └───────────────┘                   └───────────────┘
```

### Two-Service Model

OpenClaw deploys as **two separate Docker services** with distinct responsibilities:

| Aspect | openclaw-cli | openclaw-gateway |
|--------|-------------|------------------|
| **Lifecycle** | On-demand, ephemeral | Long-running, persistent |
| **Purpose** | Interactive commands | Web dashboard backend |
| **Port Binding** | None | 18789 (localhost only) |
| **Restart Policy** | None (--rm) | unless-stopped |
| **Invocation** | `docker compose run --rm -it openclaw-cli` | `docker compose up -d openclaw-gateway` |
| **Use Cases** | Onboarding, CLI commands | Device pairing, web access |
| **Health Check** | N/A | Built-in (gateway health) |

**Why Two Services?**

1. **Separation of Concerns**: Interactive CLI operations don't need to run 24/7
2. **Resource Efficiency**: CLI containers only exist when needed
3. **Isolation**: Gateway daemon runs independently of user sessions
4. **Flexibility**: Different restart policies and resource limits
5. **Security**: CLI can have different permissions than long-running daemon

### Data Flow

**Onboarding Flow:**
```
User → SSH → Docker Compose run openclaw-cli onboard
  ↓
Interactive wizard prompts for:
  - API keys (Anthropic, OpenAI, etc.)
  - Gateway authentication setup
  ↓
Creates ~/.openclaw/openclaw.json
  ↓
Gateway token extracted and injected into .env
  ↓
Gateway service started with authentication enabled
```

**Device Pairing Flow:**
```
Browser → SSH Tunnel → Gateway (port 18789)
  ↓
Gateway creates pairing request
  ↓
Pairing request appears in "devices list"
  ↓
Auto-approval (via clawctl) or manual approval
  ↓
Device paired, session established
  ↓
User interacts with AI via web dashboard
```

**CLI Command Flow:**
```
SSH → docker compose run --rm -it openclaw-cli <command>
  ↓
Container reads ~/.openclaw/openclaw.json
  ↓
Executes command (query, chat, etc.)
  ↓
Output streamed to terminal
  ↓
Container exits and is removed
```

### Deployment Context

**clawctl** (the deployment tool) automates the process of setting up OpenClaw:

1. **Phase 0-2**: Server preparation (Docker, users, directories)
2. **Phase 3**: Build or pull OpenClaw Docker image
3. **Phase 4**: Generate and upload docker-compose.yml
4. **Phase 5**: Start gateway daemon
5. **Phase 6**: Run onboarding wizard (interactive PTY session)
6. **Phase 7**: Extract gateway token, update .env
7. **Phase 8**: Restart gateway with authentication
8. **Phase 9-10**: Save artifact, optional auto-connect

After deployment, **OpenClaw** runs independently. Users interact via:
- SSH + docker compose commands
- Web browser via SSH tunnel
- Wrapper script: `openclaw <command>` (transparent Docker execution)

---

## OpenClaw CLI Service

### Purpose and Responsibilities

The **openclaw-cli** service is the interactive command-line interface for OpenClaw. It provides:

**1. Onboarding Wizard**
- First-run setup experience
- Interactive prompts for API keys
- Gateway authentication configuration
- Config file generation

**2. CLI Commands**
- Execute AI queries from command line
- Manage configuration
- Run administrative commands
- Direct AI interaction without web interface

**3. Development & Debugging**
- Test configurations
- Troubleshoot issues
- Inspect system state
- Run diagnostic commands

### Available Commands

The CLI service uses the OpenClaw Node.js application as its entrypoint:

```bash
# Entrypoint: ["node", "dist/index.js"]
# Usage: docker compose run --rm -it openclaw-cli <command>
```

**Core Commands:**

**Onboarding:**
```bash
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```
- Launches interactive wizard
- Prompts for API keys (Anthropic API, OpenAI, etc.)
- Configures gateway authentication token
- Creates `~/.openclaw/openclaw.json`
- `--no-install-daemon`: Skip systemd service installation (used in containerized deployments)

**Version Check:**
```bash
docker compose run --rm -it openclaw-cli --version
```
- Display OpenClaw version
- Useful for validating image

**Help:**
```bash
docker compose run --rm -it openclaw-cli --help
```
- Show available commands and options

**AI Interaction (examples):**
```bash
# These are inferred commands based on typical CLI AI assistants
docker compose run --rm -it openclaw-cli chat
docker compose run --rm -it openclaw-cli query "What is the weather?"
docker compose run --rm -it openclaw-cli config show
docker compose run --rm -it openclaw-cli config edit
```

### Onboarding Process Detailed Walkthrough

The onboarding wizard is the primary use case for the CLI service during deployment:

**Step 1: Launch Wizard**
```bash
# Executed by clawctl during Phase 6
cd ~/docker && docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```

**Step 2: Interactive Prompts**

The wizard presents a series of interactive prompts (actual prompts depend on OpenClaw implementation):

```
┌─────────────────────────────────────────────┐
│  OpenClaw Onboarding Wizard                 │
└─────────────────────────────────────────────┘

Welcome! Let's set up your OpenClaw instance.

→ API Configuration
  Please provide your API keys:

  Anthropic API Key: [user enters key]
  OpenAI API Key (optional): [user enters key or skips]

→ Gateway Setup
  Configuring gateway authentication...
  Generated token: abc123def456...

→ Workspace
  Workspace directory: ~/.openclaw/workspace

→ Configuration Summary
  • Config saved to: ~/.openclaw/openclaw.json
  • Gateway token: abc123...
  • Workspace: ~/.openclaw/workspace

✓ Onboarding complete!
```

**Step 3: Config File Creation**

The wizard creates `~/.openclaw/openclaw.json`:

```json
{
  "api": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "apiKey": "sk-..."
    }
  },
  "gateway": {
    "auth": {
      "token": "abc123def456789..."
    },
    "bind": "lan",
    "port": 18789
  },
  "workspace": {
    "path": "/home/node/.openclaw/workspace"
  }
}
```

**Step 4: Post-Onboarding**

After onboarding completes:
1. clawctl extracts the gateway token from config
2. Updates `.env` file with `OPENCLAW_GATEWAY_TOKEN=...`
3. Restarts gateway with authentication enabled
4. Gateway now requires token for API access

### Container Details

**Docker Compose Service Definition:**

```yaml
openclaw-cli:
  image: ${OPENCLAW_IMAGE:-openclaw:local}
  user: "${DEPLOY_UID}:${DEPLOY_GID}"
  environment:
    HOME: /home/node
    TERM: xterm-256color
    OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
    BROWSER: echo  # Disable browser opening in container
  volumes:
    - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
    - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
  stdin_open: true
  tty: true
  init: true
  entrypoint: ["node", "dist/index.js"]
```

**Key Features:**

| Feature | Value | Reason |
|---------|-------|--------|
| **Image** | `${OPENCLAW_IMAGE}` | From .env, default: `openclaw:local` |
| **User** | `${DEPLOY_UID}:${DEPLOY_GID}` | Typically 1000:1000 (roboclaw user) |
| **stdin_open** | `true` | Enable interactive input |
| **tty** | `true` | Allocate pseudo-TTY for colors, prompts |
| **init** | `true` | Proper signal handling (SIGTERM, SIGINT) |
| **Volumes** | Shared with gateway | Config and workspace persistence |
| **No restart policy** | - | Ephemeral, removed after use (--rm) |
| **No ports** | - | CLI doesn't need network exposure |

**Environment Variables:**

- `HOME=/home/node`: Required for config file paths
- `TERM=xterm-256color`: Color support in interactive sessions
- `OPENCLAW_GATEWAY_TOKEN`: Authentication for gateway API calls
- `BROWSER=echo`: Prevent browser auto-open in container environment

### Configuration It Creates/Uses

**Primary Config: `~/.openclaw/openclaw.json`**

Location in container: `/home/node/.openclaw/openclaw.json`
Location on host: `/home/roboclaw/.openclaw/openclaw.json`

**Created during onboarding:**
- API keys for AI services
- Gateway authentication token
- Workspace configuration
- User preferences

**Read by CLI commands:**
- Authentication for API calls
- Gateway connection settings
- Workspace paths

**Schema (inferred):**
```typescript
interface OpenClawConfig {
  api: {
    anthropic?: { apiKey: string }
    openai?: { apiKey: string }
    // Other AI providers...
  }
  gateway: {
    auth: { token: string }
    bind: string  // "lan", "loopback", etc.
    port: number  // 18789
  }
  workspace: {
    path: string
  }
  // Additional configuration...
}
```

**Workspace: `~/.openclaw/workspace/`**

User files, projects, and data:
- Created automatically during onboarding
- Mounted into both CLI and gateway containers
- Persisted on host filesystem
- Owned by roboclaw user (UID 1000)

---

## OpenClaw Gateway Service

### Purpose and Responsibilities

The **openclaw-gateway** service is a long-running daemon that provides:

**1. Web Dashboard Backend**
- HTTP server listening on port 18789
- WebSocket connections for real-time communication
- API endpoints for frontend interactions
- Session management

**2. Device Management System**
- Device pairing requests and approvals
- Multi-device support
- Device authentication and authorization
- Session tracking per device

**3. Authentication & Security**
- Token-based authentication (from onboarding)
- Request validation
- Secure session handling
- Rate limiting (presumed)

**4. AI Coordination**
- Route AI requests to appropriate backends
- Manage API key usage
- Handle streaming responses
- Context management across sessions

### Long-Running Daemon vs CLI Tool

**Gateway Characteristics:**

| Aspect | Gateway (Daemon) | CLI (Tool) |
|--------|------------------|------------|
| **Uptime** | 24/7, always-on | On-demand, ephemeral |
| **Process** | Single long-running process | New process per command |
| **State** | Maintains session state | Stateless |
| **Restart** | `unless-stopped` | N/A (--rm) |
| **Resources** | Consistent memory footprint | Spins up/down as needed |
| **Health** | Health checks enabled | N/A |
| **Ports** | 18789 exposed | None |

**Why a Daemon?**

1. **Web Interface**: Browser needs persistent server
2. **WebSocket Support**: Real-time bidirectional communication
3. **Session State**: Maintain conversation context
4. **Device Pairing**: Handle async pairing requests
5. **Performance**: No startup overhead per request

### Device Management System

OpenClaw uses a **device pairing system** similar to smart home devices:

**Pairing Lifecycle:**

```
1. Device Request
   ↓
   User opens http://localhost:18789/ (via SSH tunnel)
   Browser generates device pairing request
   Request stored in gateway with unique requestId

2. Pending State
   ↓
   Request appears in "devices list" output
   Status: Pending
   Contains: requestId, deviceId, IP, timestamp

3. Approval
   ↓
   Admin approves via "devices approve <requestId>"
   Or: Auto-approval (clawctl --auto-connect)

4. Paired State
   ↓
   Device added to paired devices list
   Session token issued to browser
   User can now interact with AI assistant

5. Active Session
   ↓
   Paired device maintains active session
   WebSocket connection for real-time updates
   Can send queries, receive responses
```

**Security Model:**

- **First Access**: Requires manual approval (or auto-approval during deployment)
- **Subsequent Access**: Paired devices authenticate with session token
- **Revocation**: Devices can be unpaired via gateway commands
- **Isolation**: Each device has separate session context

### API Reference (Commands Discovered in Codebase)

The gateway exposes a command-line API accessed via `docker compose exec`:

**Pattern:**
```bash
docker compose exec -T openclaw-gateway node dist/index.js <command> [args]
```

#### 1. List Devices

**Command:**
```bash
docker compose exec -T openclaw-gateway node dist/index.js devices list
```

**Output Format:**
```
┌─────────────────────────────────────────────────────────────────┐
│ OpenClaw Gateway - Device Management                            │
└─────────────────────────────────────────────────────────────────┘

Pending (2)
┌──────────────────────────────────┬──────────────┬──────┬──────────────┬──────┬───────┐
│ Request ID                       │ Device ID    │ Role │ IP Address   │ Age  │ Flags │
├──────────────────────────────────┼──────────────┼──────┼──────────────┼──────┼───────┤
│ a1b2c3d4-e5f6-7890-abcd-ef123456 │ device-001   │ user │ 192.168.1.50 │ 2m   │       │
│ x9y8z7w6-v5u4-3210-wxyz-876543ab │ device-002   │ user │ 10.0.0.100   │ 15s  │       │
└──────────────────────────────────┴──────────────┴──────┴──────────────┴──────┴───────┘

Paired (1)
┌──────────────────────────────────┬──────────────┬──────┬──────────────┬─────────┬───────┐
│ Device ID                        │ Name         │ Role │ IP Address   │ Paired  │ Flags │
├──────────────────────────────────┼──────────────┼──────┼──────────────┼─────────┼───────┤
│ device-000                       │ Main Browser │ user │ 192.168.1.10 │ 1h ago  │       │
└──────────────────────────────────┴──────────────┴──────┴──────────────┴─────────┴───────┘
```

**Parsing (from auto-connect.ts):**
- Output is table format with sections: "Pending (...)" and "Paired (...)"
- Each row contains: Request ID, Device ID, Role, IP, Age/Paired time, Flags
- Rows start with `│` character
- Request IDs are UUID format: `[0-9a-f-]{36}`

**Use Cases:**
- List pending pairing requests
- View currently paired devices
- Monitor device activity
- Audit device access

#### 2. Approve Device

**Command:**
```bash
docker compose exec -T openclaw-gateway node dist/index.js devices approve <requestId>
```

**Arguments:**
- `<requestId>`: UUID from "devices list" output

**Example:**
```bash
docker compose exec -T openclaw-gateway node dist/index.js devices approve a1b2c3d4-e5f6-7890-abcd-ef123456
```

**Exit Codes:**
- `0`: Success - device approved
- `non-zero`: Failure - invalid request ID, already approved, etc.

**Use Cases:**
- Manual device approval
- Auto-approval during deployment (clawctl)
- Batch approval of multiple devices

#### 3. Gateway Health Check

**Command:**
```bash
docker compose exec -T openclaw-gateway node dist/index.js gateway health
```

**Purpose:**
- Verify gateway is running and responsive
- Check authentication is configured
- Validate configuration file
- Used in health checks and deployment validation

**Exit Codes:**
- `0`: Healthy - gateway operational
- `non-zero`: Unhealthy - config missing, auth failed, etc.

**Output:**
Likely returns JSON or simple status text.

**Use Cases:**
- Docker health checks
- Deployment validation
- Monitoring scripts
- Load balancer health endpoints

#### 4. Gateway Start (Implicit)

**Command:**
```bash
docker compose up -d openclaw-gateway
```

**Container Command:**
```yaml
command: ["node", "dist/index.js", "gateway", "--bind", "${OPENCLAW_GATEWAY_BIND}", "--port", "18789"]
```

**Flags:**
- `--bind`: Network binding mode
  - `loopback`: 127.0.0.1 only (localhost)
  - `lan`: 0.0.0.0 (all interfaces)
- `--port`: Port number (default: 18789)

**Environment Variables:**
- `OPENCLAW_GATEWAY_BIND`: From .env, default: `lan`
- `OPENCLAW_GATEWAY_TOKEN`: Required for authentication
- `HOME`: `/home/node` for config file resolution

#### 5. Other Commands (Inferred)

Based on typical gateway patterns, likely commands include:

**Device Management:**
```bash
devices list                    # List all devices
devices approve <requestId>     # Approve pending device
devices revoke <deviceId>       # Unpair a device
devices info <deviceId>         # Show device details
```

**Gateway Control:**
```bash
gateway start                   # Start gateway (container command)
gateway health                  # Health check
gateway status                  # Show gateway status
gateway config                  # Display configuration
```

**Session Management:**
```bash
sessions list                   # List active sessions
sessions kill <sessionId>       # Terminate session
```

### Health Checks

**Docker Compose Health Check:**

```yaml
healthcheck:
  test: ["CMD", "node", "dist/index.js", "gateway", "health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

**Health Check Behavior:**

- **Test**: Runs `gateway health` command
- **Interval**: Every 30 seconds
- **Timeout**: Fail if command takes >10 seconds
- **Retries**: 3 consecutive failures before marking unhealthy
- **Start Period**: 40 second grace period during startup

**Health States:**

1. **starting**: Within start_period, checks don't count as failures
2. **healthy**: Health check passes, status returned as "healthy"
3. **unhealthy**: 3+ consecutive failures, container marked unhealthy

**Why Health Checks Matter:**

- **Monitoring**: Docker can report unhealthy containers
- **Orchestration**: Restart policies can use health status
- **Dependencies**: Other services can wait for healthy status
- **Alerting**: External monitoring can query Docker health

**Checking Health Manually:**

```bash
# Via Docker CLI
docker ps  # Shows "healthy" or "unhealthy" in STATUS column

# Via Docker Compose
docker compose ps  # Shows health status

# Direct health check
docker compose exec -T openclaw-gateway node dist/index.js gateway health
echo $?  # 0 = healthy, non-zero = unhealthy
```

### Authentication

**Token-Based Authentication:**

**Token Generation:**
1. User runs onboarding wizard
2. Wizard generates random token (likely UUID or random string)
3. Token saved to `~/.openclaw/openclaw.json` under `gateway.auth.token`
4. Token extracted by clawctl
5. Token injected into `.env` as `OPENCLAW_GATEWAY_TOKEN`
6. Gateway reads token from environment variable on startup

**Token Usage:**

**Phase 1: Pre-Onboarding (No Auth)**
```bash
# Gateway starts without auth token
docker compose up -d openclaw-gateway
# Gateway listens but may not require authentication yet
```

**Phase 2: Post-Onboarding (Auth Required)**
```bash
# After onboarding, token added to .env
# Gateway restarted with token
docker compose restart openclaw-gateway
# Now gateway requires token for API calls
```

**Authentication Flow:**

```
Browser Request
  ↓
  Sends HTTP request to localhost:18789
  ↓
  Includes authentication header (likely):
    Authorization: Bearer abc123def456...
  ↓
Gateway validates token
  ↓
  Compares with OPENCLAW_GATEWAY_TOKEN env var
  ↓
Valid → Allow request
Invalid → 401 Unauthorized
```

**Security Considerations:**

- **Token Storage**: Environment variable, also in config file
- **Token Scope**: Full gateway access
- **Token Rotation**: Not automatic, requires manual regeneration
- **Network Exposure**: Localhost-only binding limits attack surface
- **SSH Tunnel**: Remote access requires SSH tunnel, adds layer of auth

**Auto-Connect Token Inclusion:**

When clawctl auto-connects, it appends the token to the URL:

```javascript
const url = token
  ? `http://localhost:${port}/?token=${token}`
  : `http://localhost:${port}`
openBrowser(url)
```

This allows the browser to include the token in the initial request, likely stored in a cookie or local storage for subsequent requests.

---

## Configuration System

### Config File Structure (`openclaw.json`)

**Location:**
- **In container**: `/home/node/.openclaw/openclaw.json`
- **On host**: `/home/roboclaw/.openclaw/openclaw.json`
- **Ownership**: roboclaw:roboclaw (1000:1000)
- **Permissions**: 0644 (readable by user and group)

**Structure (inferred from codebase):**

```json
{
  "api": {
    "anthropic": {
      "apiKey": "sk-ant-api03-..."
    },
    "openai": {
      "apiKey": "sk-..."
    }
  },
  "gateway": {
    "auth": {
      "token": "abc123def456789..."
    },
    "bind": "lan",
    "port": 18789
  },
  "workspace": {
    "path": "/home/node/.openclaw/workspace"
  },
  "version": "1.0.0"
}
```

**Schema Breakdown:**

**`api` section:**
- Contains API keys for various AI service providers
- Each provider has its own subsection
- Keys encrypted or stored in plaintext (implementation dependent)
- Used by CLI and gateway for AI API calls

**`gateway` section:**
- `auth.token`: Gateway authentication token (generated during onboarding)
- `bind`: Network binding mode (`lan`, `loopback`)
- `port`: Gateway port number (18789)

**`workspace` section:**
- `path`: Directory for user files and projects
- Mounted as volume in both containers

**`version`:**
- Config format version for migrations

### What Data is Stored

**API Credentials:**
- Anthropic API keys (Claude models)
- OpenAI API keys (GPT models)
- Other AI provider credentials
- Service-specific configuration (endpoints, models, etc.)

**Gateway Configuration:**
- Authentication token (required for gateway access)
- Network binding settings
- Port configuration
- TLS/SSL settings (if implemented)

**User Preferences:**
- Default AI model
- Response formatting preferences
- Workspace directory
- Language/locale settings

**Session Data (possibly):**
- Recent conversation contexts
- User-specific settings
- Device pairings (may be separate file)

### How Credentials are Managed

**Security Measures:**

**1. File Permissions:**
```bash
# Config file
-rw-r--r-- 1 roboclaw roboclaw  openclaw.json

# Workspace (potential sensitive data)
drwxr-xr-x 2 roboclaw roboclaw  workspace/
```

**2. Container Isolation:**
- Config file only accessible to containers running as UID 1000
- No access from other containers or users
- Docker namespace isolation

**3. Network Security:**
- Gateway binds to localhost only (default: `lan` but port binding is `127.0.0.1:18789`)
- Remote access requires SSH tunnel
- Token-based authentication for gateway

**4. Environment Variables:**
- Gateway token also passed via environment variable
- Allows config-less gateway startup
- Environment vars not visible to other users

**Credential Lifecycle:**

**Creation:**
1. User runs `openclaw onboard`
2. Wizard prompts for API keys
3. Keys stored in plaintext (or encrypted, implementation-dependent)
4. Config file written to `~/.openclaw/openclaw.json`

**Usage:**
1. CLI reads config on each command
2. Gateway reads config on startup
3. API keys used for AI service requests
4. Gateway token used for authentication

**Rotation:**
- Manual: Edit `openclaw.json` directly
- Via CLI: `openclaw config edit` (if implemented)
- Gateway restart required after token change

**Revocation:**
- Delete or change API keys in config
- Restart gateway for changes to take effect
- Devices paired with old token become invalid

### Config Creation (During Onboarding)

**Onboarding Flow:**

```
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
  ↓
Welcome screen
  ↓
API Key Prompts:
  "Anthropic API Key: " → user enters → validates format
  "OpenAI API Key (optional): " → user enters or skips
  ↓
Gateway Setup:
  Generates random token (e.g., UUID)
  "Gateway token: abc123..." → displayed to user
  ↓
Workspace Configuration:
  Uses default: ~/.openclaw/workspace
  Creates directory if not exists
  ↓
Writes config to ~/.openclaw/openclaw.json
  ↓
Displays summary:
  ✓ Config saved to: ~/.openclaw/openclaw.json
  ✓ Gateway token: abc123...
  ✓ Workspace: ~/.openclaw/workspace
  ↓
Exits (exit code 0)
```

**Post-Onboarding (clawctl actions):**

1. **Extract Token:**
```bash
# clawctl reads the config file
ssh.exec('cat ~/.openclaw/openclaw.json')
config = JSON.parse(result.stdout)
token = config.gateway.auth.token
```

2. **Update .env:**
```bash
# Add token to Docker Compose .env file
echo "OPENCLAW_GATEWAY_TOKEN=${token}" >> ~/docker/.env
```

3. **Restart Gateway:**
```bash
# Gateway now starts with authentication
docker compose up -d --force-recreate openclaw-gateway
```

**Config File Example (after onboarding):**

```json
{
  "api": {
    "anthropic": {
      "apiKey": "sk-ant-api03-abcdefghijklmnopqrstuvwxyz..."
    }
  },
  "gateway": {
    "auth": {
      "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    "bind": "lan",
    "port": 18789
  },
  "workspace": {
    "path": "/home/node/.openclaw/workspace"
  },
  "version": "1.0.0"
}
```

**Directory Structure After Onboarding:**

```
/home/roboclaw/.openclaw/
├── openclaw.json          # Main config file
├── workspace/             # User workspace
│   └── (empty initially)
└── (other files created by OpenClaw)
```

---

## Device Pairing System

### How Pairing Works

The OpenClaw gateway uses a **request-approve** pairing model:

**High-Level Flow:**

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│ Browser  │         │ Gateway  │         │ Admin    │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ 1. Open dashboard  │                    │
     ├───────────────────>│                    │
     │                    │                    │
     │ 2. Request pairing │                    │
     ├───────────────────>│                    │
     │                    │                    │
     │                    │ 3. Store request   │
     │                    │    (pending)       │
     │                    │                    │
     │                    │ 4. List requests   │
     │                    │<───────────────────┤
     │                    │                    │
     │                    │ 5. Approve request │
     │                    │<───────────────────┤
     │                    │                    │
     │ 6. Pairing success │                    │
     │<───────────────────┤                    │
     │                    │                    │
     │ 7. Session token   │                    │
     │<───────────────────┤                    │
     │                    │                    │
     │ 8. AI interactions │                    │
     │<──────────────────>│                    │
     │                    │                    │
```

**Step-by-Step:**

**1. Browser Opens Dashboard**
- User opens `http://localhost:18789/` (via SSH tunnel)
- Gateway serves web interface
- Frontend JavaScript detects no active session

**2. Request Pairing**
- Frontend sends POST request to `/api/pairing/request` (or similar)
- Includes: browser fingerprint, IP address, timestamp
- Gateway generates unique `requestId` (UUID)
- Request stored in pending state

**3. Pending State**
- Request visible in `devices list` output
- Contains: requestId, deviceId, IP, age
- Status: "Pending"
- Awaiting approval

**4. Admin Lists Requests**
```bash
docker compose exec -T openclaw-gateway node dist/index.js devices list
```
- Shows pending requests table
- Admin can see requestId, deviceId, IP, timestamp

**5. Admin Approves**
```bash
docker compose exec -T openclaw-gateway node dist/index.js devices approve <requestId>
```
- Gateway validates request exists
- Moves request from pending to paired
- Generates session token for browser

**6. Browser Receives Approval**
- Frontend polls for approval status (or WebSocket notification)
- Receives session token
- Stores token in localStorage or cookie

**7. Active Session**
- Browser includes token in subsequent requests
- Token authenticates user
- AI interactions now allowed

**Auto-Approval (clawctl --auto-connect):**

clawctl can automatically approve the first new pairing request:

```typescript
// 1. Get existing pending requests before opening browser
const existingRequests = await getPendingRequests(ssh, userInfo)
const existingIds = new Set(existingRequests.map(r => r.requestId))

// 2. Open browser (creates new pairing request)
openBrowser(url)

// 3. Poll for NEW pairing request
const newRequest = await waitForNewPairingRequest(ssh, userInfo, existingIds, 60000)

// 4. Auto-approve it
if (newRequest) {
  await approveDevice(ssh, userInfo, newRequest.requestId)
}
```

### Pairing Request Lifecycle

**States:**

```
┌──────────┐
│  Created │  → New pairing request initiated by browser
└────┬─────┘
     │
     v
┌──────────┐
│ Pending  │  → Awaiting admin approval
└────┬─────┘
     │
     ├─→ Approved ─→ ┌────────┐
     │               │ Paired │  → Active device, can interact
     │               └────────┘
     │
     └─→ Rejected ─→ ┌──────────┐
                     │ Deleted  │  → Request denied or expired
                     └──────────┘
```

**Transition Triggers:**

| From | To | Trigger | Action |
|------|----|----|--------|
| - | Created | Browser opens dashboard | Generate requestId, deviceId |
| Created | Pending | Request stored | Add to pending list |
| Pending | Paired | Admin approves | Issue session token, add to paired list |
| Pending | Deleted | Admin rejects OR timeout | Remove from pending list |
| Paired | Deleted | Admin unpairs OR device inactive | Revoke session token, remove from paired list |

**Data Structure (inferred):**

```typescript
interface PairingRequest {
  requestId: string      // UUID (e.g., "a1b2c3d4-e5f6-7890-abcd-ef123456")
  deviceId: string       // Device identifier (e.g., "device-001")
  role: string           // "user", "admin", etc.
  ip: string             // Client IP address (e.g., "192.168.1.50")
  timestamp: Date        // Request creation time
  age: string            // Human-readable age (e.g., "2m", "15s")
  status: 'pending' | 'paired' | 'deleted'
}

interface PairedDevice {
  deviceId: string       // Same as request deviceId
  name?: string          // User-assigned name (e.g., "Main Browser")
  role: string           // "user", "admin"
  ip: string             // Last known IP
  pairedAt: Date         // When approved
  sessionToken: string   // Authentication token for this device
  lastActive?: Date      // Last activity timestamp
}
```

**Storage:**

Likely stored in gateway process memory or a local database:
- Pending requests: In-memory map or SQLite database
- Paired devices: Persisted to disk (config file or separate DB)
- Session tokens: In-memory with periodic persistence

**Expiration:**

- **Pending requests**: Likely expire after X minutes (e.g., 5-10 minutes)
- **Paired devices**: Persist until explicitly unpaired
- **Session tokens**: May have TTL (time-to-live) or refresh mechanism

### Auto-Approval (from auto-connect feature)

The clawctl `--auto-connect` feature demonstrates auto-approval:

**Implementation (from auto-connect.ts):**

```typescript
export async function autoConnect(ssh, sshConfig, userInfo, port, token) {
  // Step 1: Capture existing pending requests
  const existingRequests = await getPendingRequests(ssh, userInfo)
  const existingIds = new Set(existingRequests.map(r => r.requestId))

  // Step 2: Create SSH tunnel
  const tunnel = createSSHTunnel(sshConfig, port)

  // Step 3: Open browser (triggers new pairing request)
  const url = token ? `http://localhost:${port}/?token=${token}` : `http://localhost:${port}`
  openBrowser(url)

  // Step 4: Wait for NEW pairing request
  const newRequest = await waitForNewPairingRequest(ssh, userInfo, existingIds, 60000)

  if (!newRequest) {
    logger.warn('No new pairing request detected within 60 seconds')
    return
  }

  // Step 5: Auto-approve the new request
  logger.info('Auto-approving device...')
  const approved = await approveDevice(ssh, userInfo, newRequest.requestId)

  if (approved) {
    logger.success('Device approved!')
  }
}
```

**Polling Mechanism:**

```typescript
async function waitForNewPairingRequest(ssh, userInfo, existingIds, timeoutMs) {
  const startTime = Date.now()
  const pollInterval = 2000  // Poll every 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const requests = await getPendingRequests(ssh, userInfo)

    // Find first new request (not in existingIds)
    for (const req of requests) {
      if (!existingIds.has(req.requestId)) {
        return req  // Found new request!
      }
    }

    await sleep(pollInterval)
  }

  return null  // Timeout
}
```

**Auto-Approval Benefits:**

1. **Zero-Touch Setup**: User doesn't need to SSH and run approval commands
2. **Better UX**: Browser immediately paired after opening dashboard
3. **Safe**: Only approves NEW requests (not existing pending requests)
4. **Time-Limited**: 60-second timeout prevents indefinite waiting

**Manual Approval Flow (without --auto-connect):**

```bash
# 1. User opens browser
open http://localhost:18789/  # (via SSH tunnel)

# 2. Browser creates pairing request
# User sees "Waiting for approval" message

# 3. Admin SSHs to server
ssh -i key root@server-ip
su - roboclaw

# 4. Admin lists pending requests
cd ~/docker
docker compose exec -T openclaw-gateway node dist/index.js devices list

# Output shows:
# Pending (1)
# │ a1b2c3d4-... │ device-001 │ user │ 192.168.1.50 │ 30s │ │

# 5. Admin approves
docker compose exec -T openclaw-gateway node dist/index.js devices approve a1b2c3d4-...

# 6. Browser receives approval, session starts
```

### Device IDs and Tracking

**Device ID Generation:**

When a pairing request is created:

```typescript
// Browser generates or gateway assigns deviceId
const deviceId = `device-${randomString()}` // e.g., "device-001", "device-abc123"
```

**Device ID Persistence:**

- **Browser**: Stores deviceId in localStorage
- **Gateway**: Maps deviceId → sessionToken
- **Subsequent Requests**: Browser includes deviceId for authentication

**Tracking Purposes:**

**1. Multi-Device Support**
- Each browser/client gets unique deviceId
- User can have multiple paired devices
- Example: Desktop browser, laptop browser, mobile browser

**2. Device Management**
- Admin can see all paired devices
- Can unpair specific devices
- Can view device activity (last active, IP)

**3. Session Isolation**
- Each device has separate session
- Separate conversation contexts
- Independent authentication

**4. Security**
- Track suspicious IPs or device patterns
- Rate limiting per device
- Revoke specific device access

**Example: Multiple Devices**

```bash
# List all paired devices
docker compose exec -T openclaw-gateway node dist/index.js devices list

# Output:
Paired (3)
│ Device ID   │ Name          │ Role │ IP            │ Paired   │
├─────────────┼───────────────┼──────┼───────────────┼──────────┤
│ device-001  │ Desktop       │ user │ 192.168.1.10  │ 2h ago   │
│ device-002  │ Laptop        │ user │ 192.168.1.20  │ 1h ago   │
│ device-003  │ Mobile Safari │ user │ 10.0.0.50     │ 5m ago   │
```

**Device Metadata:**

```typescript
interface DeviceMetadata {
  deviceId: string
  name?: string          // User-assigned friendly name
  role: string           // "user", "admin"
  ip: string             // Last known IP
  userAgent?: string     // Browser user agent
  pairedAt: Date
  lastActive: Date
  sessionToken: string   // Current auth token for this device
}
```

**Device Operations:**

```bash
# View device details (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices info device-001

# Unpair a device (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices revoke device-001

# Rename a device (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices rename device-001 "Work Laptop"
```

---

## Docker Containerization

### Why Containers?

**Benefits:**

**1. Isolation**
- OpenClaw runs in its own namespace
- Can't access host files outside mounted volumes
- Prevents conflicts with other software
- Limits blast radius of security issues

**2. Portability**
- Same image runs on any Docker host
- Ubuntu, Debian, Fedora, etc.
- x86 or ARM architectures
- Consistent behavior across environments

**3. Reproducibility**
- Image built once, deployed many times
- No "works on my machine" issues
- Version pinning for stability
- Easy rollback to previous versions

**4. Security**
- Non-root execution (UID 1000)
- Limited capabilities (no CAP_SYS_ADMIN, etc.)
- Network isolation
- Resource limits (CPU, memory)

**5. Simplified Deployment**
- Single image contains all dependencies
- No manual Node.js/pnpm installation
- No conflict with system packages
- Clean uninstall (remove container)

**6. Resource Management**
- Set CPU and memory limits
- Monitor resource usage per container
- Prevents OpenClaw from consuming all resources

### Image: `roboclaw/openclaw`

**Build Process:**

```bash
# Clone OpenClaw source
git clone https://github.com/openclaw/openclaw.git openclaw-src
cd openclaw-src

# Build Docker image (uses official Dockerfile)
docker build -t roboclaw/openclaw:latest .

# Tag with version
docker tag roboclaw/openclaw:latest roboclaw/openclaw:v2026.2.4

# Test image
docker run --rm -e HOME=/home/node roboclaw/openclaw:latest --version

# Push to registry (for production mode)
docker push roboclaw/openclaw:latest
docker push roboclaw/openclaw:v2026.2.4
```

**Image Details:**

| Attribute | Value | Notes |
|-----------|-------|-------|
| **Repository** | `roboclaw/openclaw` | Custom-built, not third-party |
| **Base Image** | `node:22-bookworm` | Debian Bookworm + Node.js 22 |
| **OS** | Debian 12 (Bookworm) | Not Alpine (for compatibility) |
| **Size** | ~400-500 MB | Includes Node, build tools |
| **User** | `node` (UID 1000) | Non-root by default |
| **Entrypoint** | `["node", "dist/index.js"]` | CLI entry point |
| **Working Dir** | `/usr/src/app` | Application code location |

**Why Debian (not Alpine)?**

- **Compatibility**: Better npm package compatibility
- **Tooling**: Full GNU toolchain for native modules
- **Stability**: Debian is more battle-tested
- **Consistency**: Matches production environments

**Image Layers (approximate):**

```
Layer 1: Debian Bookworm base         (~100 MB)
Layer 2: Node.js 22 runtime            (~150 MB)
Layer 3: OpenClaw dependencies         (~100 MB)
Layer 4: OpenClaw application code     (~50 MB)
Layer 5: Configuration and setup       (~10 MB)
─────────────────────────────────────────────
Total:                                 ~410 MB
```

**Version Tagging:**

- `latest`: Most recent stable build
- `v2026.2.4`: Specific version (recommended for production)
- `v2026.2.4-beta`: Pre-release versions
- `nightly`: Daily automated builds (if implemented)

### Non-Root User (node:1000)

**User Configuration:**

```yaml
# In docker-compose.yml
user: "${DEPLOY_UID}:${DEPLOY_GID}"  # From .env: DEPLOY_UID=1000, DEPLOY_GID=1000
```

```dockerfile
# In Dockerfile (from base image)
USER node
```

**User Mapping:**

```
Container                Host
─────────                ────
node (UID 1000)    ←→    roboclaw (UID 1000)
node (GID 1000)    ←→    roboclaw (GID 1000)
```

**Why UID 1000?**

1. **Standard Non-Root UID**: Commonly used for first regular user
2. **Matches Host User**: Files created in volumes have correct ownership
3. **Security**: No root privileges inside container
4. **Compatibility**: Works with most Docker base images

**Permission Model:**

```
┌─────────────────────────────────────────────────────────┐
│ Container (UID 1000)                                     │
│                                                           │
│  Can:                                                    │
│  ✓ Read/write mounted volumes (owned by UID 1000)       │
│  ✓ Execute application code                             │
│  ✓ Make network connections                             │
│  ✓ Create files in mounted directories                  │
│                                                           │
│  Cannot:                                                 │
│  ✗ Modify container filesystem (read-only root)         │
│  ✗ Install system packages (no apt-get)                 │
│  ✗ Change system configuration                          │
│  ✗ Access other users' files on host                    │
│  ✗ Bind to privileged ports (<1024)                     │
│  ✗ Load kernel modules                                  │
└─────────────────────────────────────────────────────────┘
```

**File Ownership Example:**

```bash
# Inside container
$ id
uid=1000(node) gid=1000(node) groups=1000(node)

$ ls -la ~/.openclaw/
drwxr-xr-x 2 node node  openclaw.json
drwxr-xr-x 2 node node  workspace/

# On host (as root)
$ ls -la /home/roboclaw/.openclaw/
drwxr-xr-x 2 roboclaw roboclaw  openclaw.json
drwxr-xr-x 2 roboclaw roboclaw  workspace/
```

**Security Benefits:**

- **Privilege Escalation Defense**: Attacker can't gain root in container
- **Filesystem Isolation**: Can't modify host system files
- **Capability Restrictions**: No special Linux capabilities
- **User Namespace**: Process appears as UID 1000 on host, not root

### Volume Mounts

**Mount Configuration:**

```yaml
# docker-compose.yml
volumes:
  - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
  - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
```

```bash
# .env file
OPENCLAW_CONFIG_DIR=/home/roboclaw/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/roboclaw/.openclaw/workspace
```

**Mount Table:**

| Host Path | Container Path | Purpose | Permissions |
|-----------|----------------|---------|-------------|
| `/home/roboclaw/.openclaw` | `/home/node/.openclaw` | Config, sessions | 0755 (rwxr-xr-x) |
| `/home/roboclaw/.openclaw/workspace` | `/home/node/.openclaw/workspace` | User files | 0755 (rwxr-xr-x) |

**Why These Mounts?**

**1. Configuration Persistence**
- `openclaw.json` survives container restarts
- Gateway token persists across deployments
- API keys don't need re-entry

**2. Data Persistence**
- User workspace files persist
- Session history maintained
- Project files survive updates

**3. Shared State**
- CLI and gateway share config
- Both containers see same workspace
- Consistent configuration across services

**4. Easy Backup**
- Backup host directory = backup all OpenClaw data
- Simple tar/zip operations
- No need to extract from containers

**File Ownership:**

```bash
# Host
chown -R roboclaw:roboclaw /home/roboclaw/.openclaw

# Inside container, appears as:
chown -R node:node /home/node/.openclaw
```

**Volume Type: Bind Mounts**

OpenClaw uses **bind mounts** (not Docker volumes):

```yaml
# Bind mount syntax
volumes:
  - /host/path:/container/path  # Direct host directory mounting
```

**vs. Docker Named Volumes:**

```yaml
# Named volume syntax (NOT used by OpenClaw)
volumes:
  - openclaw-data:/home/node/.openclaw  # Docker-managed volume
```

**Why Bind Mounts?**

- **Direct Access**: Easy to edit config files on host
- **Backups**: Standard filesystem backup tools work
- **Debugging**: Can inspect files without docker exec
- **Simplicity**: No volume management commands needed

**Data Lifecycle:**

```
Container Created
  ↓
Volumes mounted from host
  ↓
Container reads config from mounted volume
  ↓
Container writes data to mounted volume
  ↓
Container stopped
  ↓
Data remains on host (persists)
  ↓
Container recreated
  ↓
Same volumes mounted again
  ↓
Container sees previous data
```

### Network Ports (18789 for gateway)

**Port Binding:**

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:${OPENCLAW_GATEWAY_PORT:-18789}:18789"
```

```bash
# .env file
OPENCLAW_GATEWAY_PORT=18789
```

**Expanded Binding:**
```
127.0.0.1:18789:18789
└─────┬────┘ │ └───┬──┘
      │      │     └──── Container port (inside container)
      │      └────────── Host port (on host machine)
      └───────────────── Bind address (localhost only)
```

**Network Configuration:**

| Component | Value | Meaning |
|-----------|-------|---------|
| **Bind Address** | `127.0.0.1` | Localhost only |
| **Host Port** | `18789` | Port on host machine |
| **Container Port** | `18789` | Port inside container |
| **Protocol** | TCP (implicit) | HTTP/WebSocket traffic |

**Why Port 18789?**

- **Non-Privileged**: >1024, can bind as non-root
- **Uncommon**: Unlikely to conflict with other services
- **Memorable**: Easy to remember
- **Consistent**: Same port in container and on host

**Localhost-Only Binding:**

```bash
# Bound to localhost only
127.0.0.1:18789  ← Only accessible from local machine

# NOT bound to all interfaces (more secure)
0.0.0.0:18789    ← Would be accessible from network
```

**Access Methods:**

**1. Local Access (on server):**
```bash
curl http://localhost:18789/
```

**2. Remote Access (via SSH tunnel):**
```bash
# From local machine
ssh -L 18789:localhost:18789 -i key root@server-ip

# Then in browser
open http://localhost:18789/
```

**3. Auto-Connect (clawctl):**
```typescript
// Create SSH tunnel in background
const tunnel = spawn('ssh', [
  '-L', '18789:localhost:18789',
  '-i', privateKeyPath,
  '-N',
  `root@${serverIP}`
])

// Open browser
openBrowser('http://localhost:18789/')
```

**Security Benefits of Localhost Binding:**

- **No Internet Exposure**: Gateway not accessible from public internet
- **SSH Required**: Must have SSH access to reach gateway
- **Defense in Depth**: Even if gateway has vulnerability, not reachable externally
- **Rate Limiting**: SSH provides authentication and rate limiting

**Firewall Interaction:**

```bash
# UFW firewall on host
sudo ufw status

# Output shows only SSH allowed:
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere

# Port 18789 NOT in firewall rules (bound to localhost only)
```

**Docker Network Mode:**

OpenClaw uses default bridge network:

```yaml
# Implicit (default)
network_mode: bridge
```

- Containers get their own network namespace
- Can communicate with each other via Docker network
- Port forwarding for external access

### Security Considerations

**Container Security Layers:**

**1. User Isolation (Non-Root)**

```yaml
user: "1000:1000"
```

**Benefits:**
- No root privileges inside container
- Can't modify container filesystem
- Can't install packages or change system config
- Limited capability set

**Attack Mitigation:**
- If attacker compromises container, they're UID 1000, not root
- Can't escalate to root without kernel exploit
- Filesystem writes limited to mounted volumes

**2. Network Isolation (Localhost Binding)**

```yaml
ports:
  - "127.0.0.1:18789:18789"
```

**Benefits:**
- Gateway not accessible from network
- Must have SSH access to reach gateway
- Reduces attack surface

**Attack Mitigation:**
- External attacker can't reach gateway directly
- Must compromise SSH first (strong authentication)
- Rate limiting via SSH connection limits

**3. Filesystem Isolation (Bind Mounts)**

```yaml
volumes:
  - /home/roboclaw/.openclaw:/home/node/.openclaw
  - /home/roboclaw/.openclaw/workspace:/home/node/.openclaw/workspace
```

**Benefits:**
- Container can only access explicitly mounted directories
- No access to /etc, /var, /root on host
- Can't read other users' files

**Attack Mitigation:**
- If container compromised, limited host access
- Sensitive system files not accessible
- Blast radius limited to mounted volumes

**4. Resource Limits (Recommended)**

```yaml
# Can be added to docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

**Benefits:**
- Prevents resource exhaustion attacks
- Limits impact of infinite loops or memory leaks
- Ensures host system remains responsive

**5. Read-Only Root Filesystem (Advanced)**

```yaml
# Advanced configuration (not currently implemented)
read_only: true
tmpfs:
  - /tmp
```

**Benefits:**
- Container filesystem immutable
- Prevents persistence of malicious code
- Forces all writes to volumes or tmpfs

**6. Capability Dropping (Advanced)**

```yaml
# Advanced configuration (can be added)
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE  # If needed for ports <1024
```

**Benefits:**
- Removes unnecessary Linux capabilities
- Further restricts what container can do
- Defense against capability-based exploits

**Threat Model:**

**Threats Mitigated:**
- ✓ External network attacks (localhost-only binding)
- ✓ Privilege escalation (non-root user)
- ✓ Host filesystem access (limited volumes)
- ✓ Resource exhaustion (can add limits)
- ✓ Container escape (user namespaces, seccomp)

**Threats Not Fully Mitigated:**
- ⚠️ Compromised SSH key (would grant full access)
- ⚠️ Kernel exploits (container escape possible)
- ⚠️ API key leakage (stored in plaintext config)
- ⚠️ Supply chain attacks (if image is compromised)

**Security Best Practices:**

1. **Keep Docker Updated**: Security patches for container runtime
2. **Rotate SSH Keys**: Regularly change SSH keys
3. **Monitor Logs**: Watch for suspicious activity
4. **Backup Config**: Regularly backup ~/.openclaw directory
5. **Review Image**: Audit Docker image for vulnerabilities
6. **Limit SSH Access**: Use SSH key passphrases, restrict IPs
7. **Update OpenClaw**: Apply security updates promptly

---

## Integration Points

### How clawctl Interacts with OpenClaw

**Deployment Phases (clawctl → OpenClaw):**

```
Phase 0-2: Server Preparation
  ├─ Install Docker
  ├─ Create roboclaw user (UID 1000)
  └─ Create directories (~/.openclaw, ~/docker)

Phase 3: Image Management
  ├─ Clone OpenClaw repo (or pull image)
  ├─ Build Docker image: roboclaw/openclaw:latest
  └─ Verify image: docker run --rm <image> --version

Phase 4: Docker Compose Setup
  ├─ Generate docker-compose.yml (with ${VARIABLES})
  ├─ Generate .env file (with actual values)
  └─ Upload both files to ~/docker/

Phase 5: Gateway Startup (No Auth)
  ├─ docker compose up -d openclaw-gateway
  ├─ Wait for gateway to start listening
  └─ Gateway running without authentication

Phase 6: Onboarding Wizard (Interactive PTY)
  ├─ docker compose run --rm -it openclaw-cli onboard --no-install-daemon
  ├─ User enters API keys interactively
  ├─ Wizard generates gateway token
  └─ Config saved to ~/.openclaw/openclaw.json

Phase 7: Token Extraction
  ├─ Read ~/.openclaw/openclaw.json from server
  ├─ Parse JSON, extract gateway.auth.token
  ├─ Update .env file: OPENCLAW_GATEWAY_TOKEN=...
  └─ Restart gateway: docker compose up -d --force-recreate

Phase 8: Instance Artifact
  ├─ Create ./instances/<name>.yml locally
  └─ Save metadata (IP, version, token, etc.)

Phase 9: Auto-Connect (Optional)
  ├─ Create SSH tunnel: ssh -L 18789:localhost:18789
  ├─ Open browser: http://localhost:18789/?token=...
  ├─ Wait for pairing request
  ├─ Auto-approve: devices approve <requestId>
  └─ Keep tunnel open until Ctrl+C
```

**clawctl → OpenClaw Communication:**

| clawctl Action | OpenClaw Interaction | Method |
|----------------|----------------------|--------|
| Build image | Uses OpenClaw Dockerfile | `docker build` |
| Upload compose files | Static templates | SSH file upload |
| Start gateway | Uses Docker Compose | `docker compose up -d` |
| Run onboarding | Interactive wizard | SSH PTY session |
| Extract token | Read config file | SSH exec `cat` |
| Update .env | Modify gateway token | SSH file upload |
| List devices | Query gateway API | `docker compose exec` |
| Approve device | Call gateway API | `docker compose exec` |
| Health check | Gateway health command | `docker compose exec` |

**No Direct Code Dependency:**

- clawctl doesn't import OpenClaw code
- OpenClaw doesn't import clawctl code
- Communication via Docker APIs and SSH
- Loose coupling, independent versioning

### SSH + Docker Compose exec Pattern

**Command Pattern:**

```bash
# General pattern
ssh root@<IP> "cd ~/docker && docker compose exec -T <service> <command>"

# Example: List devices
ssh root@192.168.1.100 "cd /home/roboclaw/docker && docker compose exec -T openclaw-gateway node dist/index.js devices list"
```

**Using clawctl's SSHClient:**

```typescript
// In clawctl code
const cmd = `cd ${userInfo.home}/docker && sudo -u ${userInfo.username} docker compose exec -T openclaw-gateway node dist/index.js devices list`
const result = await ssh.exec(cmd)

if (result.exitCode === 0) {
  // Parse result.stdout
  const devices = parseDeviceList(result.stdout)
}
```

**Why This Pattern?**

1. **No Local Docker Required**: clawctl doesn't need Docker installed
2. **Remote Execution**: All Docker commands run on remote server
3. **Standard SSH**: Uses well-known SSH protocol
4. **Easy Debugging**: Can run same commands manually via SSH

**Flags Explained:**

- `-T`: Disable pseudo-TTY allocation (non-interactive)
  - Required for scripting (clawctl automation)
  - Prevents terminal control characters in output
  - Stdout is clean, parseable text

- `-it`: Allocate pseudo-TTY and keep stdin open (interactive)
  - Required for onboarding wizard (user input)
  - Enables colors, prompts, line editing
  - Used in `docker compose run --rm -it openclaw-cli onboard`

**SSH + Sudo Pattern:**

```bash
# clawctl runs commands as roboclaw user (not root)
sudo -u roboclaw docker compose exec -T openclaw-gateway <command>
```

**Why sudo -u?**

- clawctl connects as root (required for Docker installation)
- But OpenClaw containers owned by roboclaw user
- Sudo ensures correct file ownership and permissions

### PTY Sessions for Interactive Commands

**What is a PTY?**

**PTY (Pseudo-Terminal)**: Emulates a terminal for interactive programs.

**Without PTY (non-interactive):**
```bash
# No colors, no prompts, line-buffered
docker compose exec -T openclaw-cli --version
# Output: openclaw 1.2.3
```

**With PTY (interactive):**
```bash
# Full terminal emulation
docker compose run --rm -it openclaw-cli onboard

# Output includes:
#   - Colors (ANSI escape codes)
#   - Interactive prompts with cursor
#   - Line editing (backspace, arrow keys)
#   - Real-time output (not line-buffered)
```

**PTY Use Cases in OpenClaw:**

**1. Onboarding Wizard (Primary Use Case)**

```typescript
// clawctl/src/lib/interactive.ts
export async function runOnboarding(ssh: SSHClient, userInfo: UserInfo) {
  const onboardCmd = `cd ${composeDir} && sudo -u ${username} docker compose run --rm -it openclaw-cli onboard --no-install-daemon`

  // Use execInteractive (creates PTY)
  await ssh.execInteractive(onboardCmd)
}
```

**Why PTY for Onboarding?**

- User enters API keys (password-like prompts)
- Interactive prompts: "Anthropic API Key: "
- Real-time validation and feedback
- Colors for success/error messages
- Ability to backspace and edit input

**2. SSH PTY Creation (ssh2 library):**

```typescript
// clawctl/src/lib/ssh-client.ts
export async function execInteractive(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    this.client.exec(command, { pty: true }, (err, stream) => {
      if (err) reject(err)

      // Forward stdin/stdout/stderr
      process.stdin.pipe(stream)
      stream.pipe(process.stdout)
      stream.stderr.pipe(process.stderr)

      // Handle exit
      stream.on('close', (code) => {
        process.stdin.unpipe(stream)
        if (code === 0) resolve()
        else reject(new Error(`Exit code ${code}`))
      })
    })
  })
}
```

**PTY Features Enabled:**

- **TERM environment variable**: `TERM=xterm-256color`
- **Window size**: Terminal dimensions (rows, cols)
- **Signal handling**: Ctrl+C, Ctrl+D work correctly
- **Line editing**: Readline library works
- **Colors**: ANSI escape codes rendered

**TTY Flags in Docker:**

```yaml
# docker-compose.yml
stdin_open: true  # Keep STDIN open (for input)
tty: true         # Allocate TTY (for colors/prompts)
```

```bash
# Command-line flags
docker compose run --rm -it openclaw-cli onboard
#                       ↑↑
#                       │└─ -t: Allocate TTY
#                       └── -i: Keep STDIN open
```

**PTY Session Flow:**

```
User's Terminal (clawctl)
  ↓
SSH Client (ssh2 library)
  ↓
SSH Server (on remote host)
  ↓
PTY Master (pseudo-terminal)
  ↓
PTY Slave (connected to Docker container)
  ↓
Container Process (openclaw onboard)
  ↓
Terminal Output (colors, prompts, etc.)
  ↑
User sees interactive wizard
```

**Non-PTY vs PTY Comparison:**

| Aspect | Non-PTY (-T) | PTY (-it) |
|--------|-------------|----------|
| **Use Case** | Automation, scripting | Human interaction |
| **Output** | Clean text | Colors, formatting |
| **Input** | Stdin redirect | Keyboard input |
| **Buffering** | Line-buffered | Character-buffered |
| **Colors** | None | ANSI colors |
| **Prompts** | Not interactive | Interactive |
| **Example** | devices list | onboard wizard |

### Streaming Output

**Use Cases:**

1. **Real-Time Logs**: See Docker output as it happens
2. **Long-Running Commands**: Build progress, download status
3. **Debugging**: Watch command execution live

**Implementation (from clawctl):**

```typescript
// clawctl/src/lib/ssh-client.ts
export async function execStream(command: string): Promise<number> {
  return new Promise((resolve, reject) => {
    this.client.exec(command, (err, stream) => {
      if (err) reject(err)

      // Stream stdout to console in real-time
      stream.on('data', (data: Buffer) => {
        process.stdout.write(data.toString())
      })

      // Stream stderr to console in real-time
      stream.stderr.on('data', (data: Buffer) => {
        process.stderr.write(data.toString())
      })

      // Wait for command to finish
      stream.on('close', (code: number) => {
        resolve(code)
      })
    })
  })
}
```

**Example: Streaming Gateway Startup**

```typescript
// clawctl/src/lib/interactive.ts
export async function startGateway(ssh: SSHClient, userInfo: UserInfo) {
  const startCmd = `cd ${composeDir} && sudo -u ${username} docker compose up -d --force-recreate openclaw-gateway`

  // Use execStream for real-time output
  const result = await ssh.execStream(startCmd)

  if (result !== 0) {
    throw new Error('Failed to start gateway')
  }
}
```

**User sees (in real-time):**

```
[+] Running 2/2
 ✔ Network docker_default           Created
 ✔ Container openclaw-gateway       Started
```

**Streaming vs Buffering:**

**Buffered Execution (`exec`):**
```typescript
const result = await ssh.exec(cmd)
// Wait for command to complete
// Then get all output at once
console.log(result.stdout)
```

**Streamed Execution (`execStream`):**
```typescript
const exitCode = await ssh.execStream(cmd)
// Output appears in real-time
// Line by line as it's generated
```

**When to Use Each:**

| Method | Use When | Example |
|--------|----------|---------|
| **exec** | Need to parse output | `devices list`, `gateway health` |
| **execStream** | Long-running, want progress | `docker compose up`, `docker build` |
| **execInteractive** | User input required | `onboard`, interactive shells |

---

## Common Operations

### Onboarding a New Instance

**Full Onboarding Flow (Step-by-Step):**

**Step 1: Deploy with clawctl**

```bash
# From local machine
npx clawctl 192.168.1.100 --key ~/.ssh/id_ed25519 --name production
```

**What happens:**
- Phases 0-5: Server preparation, Docker install, gateway startup
- Phase 6: Onboarding wizard automatically launched

**Step 2: Onboarding Wizard (Interactive)**

```
┌─────────────────────────────────────────────┐
│  OpenClaw Onboarding Wizard                 │
└─────────────────────────────────────────────┘

Welcome! Let's set up your OpenClaw instance.

→ API Configuration

  Anthropic API Key: sk-ant-api03-[user enters key]
  ✓ Valid key format

  OpenAI API Key (optional): [user presses Enter to skip]

→ Gateway Setup

  Generating authentication token...
  ✓ Token generated: abc123def456...

→ Workspace

  Workspace directory: ~/.openclaw/workspace
  ✓ Directory created

→ Configuration Summary

  • Config saved to: ~/.openclaw/openclaw.json
  • Gateway token: abc123def456...
  • Workspace: ~/.openclaw/workspace
  • API providers: Anthropic

✓ Onboarding complete!
```

**Step 3: Post-Onboarding (Automatic)**

clawctl automatically:
1. Extracts gateway token from config
2. Updates .env file with token
3. Restarts gateway with authentication
4. Saves instance artifact

**Step 4: Auto-Connect (If Not Skipped)**

```bash
# Automatic prompt
┌─ Auto-connect to Dashboard ─────────────────────────────────┐
│ Would you like to open the dashboard now?                   │
└─────────────────────────────────────────────────────────────┘
  [Y/n]: Y

Creating SSH tunnel on port 18789...
✓ Tunnel established (PID 12345)
Opening browser...
✓ Browser opened
Waiting for device pairing request...
  (press Ctrl+C to skip)
✓ New pairing request detected
Auto-approving device...
✓ Device approved!

Dashboard is ready!
  Tunnel will stay open. Press Ctrl+C to exit.
```

**Step 5: Use Dashboard**

Browser opens to `http://localhost:18789/`
- Device already paired (auto-approved)
- Can immediately start chatting with AI
- No manual approval needed

**Manual Onboarding (If Skipped During Deployment):**

```bash
# Connect to server
ssh -i ~/.ssh/key root@192.168.1.100

# Switch to roboclaw user
sudo su - roboclaw

# Run onboarding manually
cd ~/docker
docker compose run --rm -it openclaw-cli onboard --no-install-daemon

# Start gateway (if not already running)
docker compose up -d openclaw-gateway
```

### Starting/Stopping Services

**Start Gateway:**

```bash
# From server (as roboclaw user)
cd ~/docker
docker compose up -d openclaw-gateway

# Verify started
docker compose ps openclaw-gateway

# Output:
# NAME                 STATUS          PORTS
# openclaw-gateway     Up 10 seconds   127.0.0.1:18789->18789/tcp
```

**Stop Gateway:**

```bash
cd ~/docker
docker compose stop openclaw-gateway

# Or stop all services
docker compose down
```

**Restart Gateway:**

```bash
cd ~/docker
docker compose restart openclaw-gateway

# Or force recreate (use updated docker-compose.yml)
docker compose up -d --force-recreate openclaw-gateway
```

**View Logs:**

```bash
# Real-time logs
docker compose logs -f openclaw-gateway

# Last 50 lines
docker compose logs --tail 50 openclaw-gateway

# Since specific time
docker compose logs --since 30m openclaw-gateway
```

**CLI Service (On-Demand):**

```bash
# CLI doesn't "start" - it runs on-demand
docker compose run --rm -it openclaw-cli <command>

# Examples
docker compose run --rm -it openclaw-cli --version
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
docker compose run --rm -it openclaw-cli chat

# --rm: Remove container after exit
# -it: Interactive with TTY
```

**Service Status:**

```bash
# List all services
docker compose ps

# Output:
# NAME                 STATUS          PORTS
# openclaw-gateway     Up 5 minutes    127.0.0.1:18789->18789/tcp

# Detailed status (JSON)
docker compose ps --format json openclaw-gateway | jq
```

**Autostart on Boot:**

Gateway has `restart: unless-stopped`:

```yaml
restart: unless-stopped
```

- **On server reboot**: Gateway auto-starts
- **On failure**: Gateway auto-restarts
- **If manually stopped**: Stays stopped until manually started

**To disable autostart:**

```bash
# Stop and don't restart
docker compose stop openclaw-gateway
docker compose rm -f openclaw-gateway
```

**To re-enable autostart:**

```bash
docker compose up -d openclaw-gateway
```

### Checking Health Status

**Gateway Health Check:**

```bash
# Method 1: Via gateway health command
docker compose exec -T openclaw-gateway node dist/index.js gateway health
echo $?  # 0 = healthy, non-zero = unhealthy

# Method 2: Via Docker health status
docker compose ps openclaw-gateway
# Look for "healthy" in STATUS column

# Method 3: Docker inspect
docker inspect openclaw-gateway --format='{{.State.Health.Status}}'
# Output: healthy | unhealthy | starting
```

**Manual Health Checks:**

```bash
# Check if gateway is listening
curl http://localhost:18789/
# Should return HTML (dashboard page)

# Check if gateway is accessible
curl -I http://localhost:18789/
# Should return HTTP 200 or 301 (not 404 or 500)

# Check gateway logs for errors
docker compose logs --tail 50 openclaw-gateway | grep -i error
```

**Health Check Details:**

```bash
# Get detailed health check results
docker inspect openclaw-gateway --format='{{json .State.Health}}' | jq

# Output example:
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2026-02-05T10:30:00Z",
      "End": "2026-02-05T10:30:01Z",
      "ExitCode": 0,
      "Output": "Gateway is healthy\n"
    }
  ]
}
```

**Automated Health Monitoring (Optional):**

Create a monitoring script:

```bash
#!/bin/bash
# monitor-openclaw.sh

while true; do
  status=$(docker inspect openclaw-gateway --format='{{.State.Health.Status}}')

  if [ "$status" != "healthy" ]; then
    echo "[$(date)] WARNING: Gateway is $status"
    # Send alert (email, Slack, etc.)
  fi

  sleep 60  # Check every minute
done
```

### Running CLI Commands

**Basic Pattern:**

```bash
cd ~/docker
docker compose run --rm -it openclaw-cli <command> [args]
```

**Common Commands:**

```bash
# Show version
docker compose run --rm -it openclaw-cli --version

# Show help
docker compose run --rm -it openclaw-cli --help

# Onboarding
docker compose run --rm -it openclaw-cli onboard --no-install-daemon

# (Other commands depend on OpenClaw implementation)
# Examples based on typical AI CLI tools:

# Chat mode
docker compose run --rm -it openclaw-cli chat

# Single query
docker compose run --rm -it openclaw-cli query "What is the weather?"

# Config management
docker compose run --rm -it openclaw-cli config show
docker compose run --rm -it openclaw-cli config edit
```

**Wrapper Script (Convenience):**

clawctl creates a wrapper script for easier access:

```bash
# Location: /home/roboclaw/.local/bin/openclaw
# Added to PATH via ~/.bashrc

# Usage (as roboclaw user)
openclaw --version
openclaw onboard --no-install-daemon
openclaw chat

# Wrapper translates to:
# cd ~/docker && docker compose run --rm -it openclaw-cli <command>
```

**Wrapper Script Content:**

```bash
#!/bin/bash
set -euo pipefail

COMPOSE_DIR="/home/roboclaw/docker"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

# Error handling
error_exit() {
    echo "Error: $1" >&2
    exit 1
}

# Verify Docker and compose file
docker info >/dev/null 2>&1 || error_exit "Docker is not running"
[ -f "$COMPOSE_FILE" ] || error_exit "Compose file not found: $COMPOSE_FILE"

# Check image exists
if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "openclaw"; then
    error_exit "OpenClaw image not found. Run deployment first."
fi

# Execute command
cd "$COMPOSE_DIR"
exec docker compose run --rm -it openclaw-cli "$@"
```

**Remote Execution (from local machine):**

```bash
# Via clawctl's connect-instance.sh
./cli/connect-instance.sh production onboard

# Or direct SSH
ssh -i ~/.ssh/key root@192.168.1.100 "sudo -u roboclaw bash -c 'cd ~/docker && docker compose run --rm -it openclaw-cli --version'"
```

### Approving Pairing Requests

**Manual Approval (Step-by-Step):**

**Step 1: User Opens Dashboard**

```bash
# From local machine, create SSH tunnel
ssh -L 18789:localhost:18789 -i ~/.ssh/key root@192.168.1.100

# Open browser
open http://localhost:18789/
```

Browser creates pairing request, shows "Waiting for approval..."

**Step 2: Admin Lists Pending Requests**

```bash
# SSH to server (in another terminal)
ssh -i ~/.ssh/key root@192.168.1.100

# Switch to roboclaw user
sudo su - roboclaw

# List pending requests
cd ~/docker
docker compose exec -T openclaw-gateway node dist/index.js devices list
```

**Output:**

```
Pending (1)
┌──────────────────────────────────┬──────────────┬──────┬──────────────┬──────┬───────┐
│ Request ID                       │ Device ID    │ Role │ IP Address   │ Age  │ Flags │
├──────────────────────────────────┼──────────────┼──────┼──────────────┼──────┼───────┤
│ a1b2c3d4-e5f6-7890-abcd-ef123456 │ device-001   │ user │ 192.168.1.10 │ 15s  │       │
└──────────────────────────────────┴──────────────┴──────┴──────────────┴──────┴───────┘
```

**Step 3: Admin Approves Request**

```bash
# Copy the Request ID from above
docker compose exec -T openclaw-gateway node dist/index.js devices approve a1b2c3d4-e5f6-7890-abcd-ef123456

# Output (likely):
# ✓ Device approved successfully
```

**Step 4: Browser Receives Approval**

Browser automatically detects approval (polling or WebSocket):
- "Waiting for approval..." message disappears
- Dashboard interface loads
- User can start chatting with AI

**Auto-Approval (via clawctl):**

```bash
# During deployment (automatic)
npx clawctl 192.168.1.100 --key ~/.ssh/key

# After deployment, clawctl:
# 1. Opens browser
# 2. Waits for NEW pairing request
# 3. Auto-approves it
# 4. User immediately has access
```

**Batch Approval (Multiple Requests):**

```bash
# List all pending requests
docker compose exec -T openclaw-gateway node dist/index.js devices list > requests.txt

# Extract Request IDs (example using grep/awk)
grep -E '^│ [0-9a-f-]{36}' requests.txt | awk '{print $2}' > request_ids.txt

# Approve each
while read -r request_id; do
  docker compose exec -T openclaw-gateway node dist/index.js devices approve "$request_id"
  echo "Approved: $request_id"
done < request_ids.txt
```

**Reject/Delete Request (Hypothetical):**

```bash
# If OpenClaw supports rejection
docker compose exec -T openclaw-gateway node dist/index.js devices reject <requestId>

# Or just wait for timeout (requests expire after X minutes)
```

---

## Reference

### Gateway API Commands (Full List)

**Device Management:**

```bash
# List all devices (pending and paired)
docker compose exec -T openclaw-gateway node dist/index.js devices list

# Approve pending device pairing request
docker compose exec -T openclaw-gateway node dist/index.js devices approve <requestId>

# View device details (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices info <deviceId>

# Unpair a device (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices revoke <deviceId>

# Rename a device (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js devices rename <deviceId> <newName>
```

**Gateway Control:**

```bash
# Health check
docker compose exec -T openclaw-gateway node dist/index.js gateway health

# Gateway status (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js gateway status

# Show configuration (hypothetical)
docker compose exec -T openclaw-gateway node dist/index.js gateway config
```

**Session Management (Hypothetical):**

```bash
# List active sessions
docker compose exec -T openclaw-gateway node dist/index.js sessions list

# Terminate a session
docker compose exec -T openclaw-gateway node dist/index.js sessions kill <sessionId>
```

### CLI Commands (Full List)

**Core Commands:**

```bash
# Version information
docker compose run --rm -it openclaw-cli --version

# Help
docker compose run --rm -it openclaw-cli --help

# Onboarding wizard
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```

**Configuration Management (Hypothetical):**

```bash
# Show current configuration
docker compose run --rm -it openclaw-cli config show

# Edit configuration interactively
docker compose run --rm -it openclaw-cli config edit

# Set specific config value
docker compose run --rm -it openclaw-cli config set <key> <value>

# Get specific config value
docker compose run --rm -it openclaw-cli config get <key>
```

**AI Interaction (Hypothetical):**

```bash
# Interactive chat mode
docker compose run --rm -it openclaw-cli chat

# Single query
docker compose run --rm -it openclaw-cli query "What is the weather today?"

# List conversation history
docker compose run --rm -it openclaw-cli history

# Continue previous conversation
docker compose run --rm -it openclaw-cli resume <conversationId>
```

**Workspace Management (Hypothetical):**

```bash
# List workspace files
docker compose run --rm -it openclaw-cli workspace list

# Create new project
docker compose run --rm -it openclaw-cli workspace create <projectName>

# Delete project
docker compose run --rm -it openclaw-cli workspace delete <projectName>
```

### Exit Codes

**Standard Exit Codes:**

| Code | Meaning | Examples |
|------|---------|----------|
| **0** | Success | Command completed successfully |
| **1** | General error | Invalid arguments, config error |
| **2** | Misuse of command | Wrong number of arguments |
| **126** | Command cannot execute | Permission denied |
| **127** | Command not found | Invalid subcommand |
| **130** | Terminated by Ctrl+C | User interrupted |

**OpenClaw-Specific Exit Codes (Inferred):**

| Code | Meaning | Context |
|------|---------|---------|
| **0** | Success | All operations successful |
| **1** | Config error | Missing openclaw.json, invalid config |
| **2** | Auth error | Invalid gateway token, API key failed |
| **3** | Network error | Can't reach gateway, API timeout |
| **4** | Device error | Invalid requestId, device not found |

**Usage in Scripts:**

```bash
# Check if command succeeded
docker compose exec -T openclaw-gateway node dist/index.js gateway health
if [ $? -eq 0 ]; then
  echo "Gateway is healthy"
else
  echo "Gateway is unhealthy"
  exit 1
fi

# Approve device and check result
docker compose exec -T openclaw-gateway node dist/index.js devices approve <requestId>
if [ $? -eq 0 ]; then
  echo "Device approved"
else
  echo "Failed to approve device"
  exit 1
fi
```

### Configuration Schema

**openclaw.json Structure:**

```typescript
interface OpenClawConfig {
  // API provider configurations
  api: {
    anthropic?: {
      apiKey: string
      model?: string        // Default: "claude-3-5-sonnet-20241022"
      maxTokens?: number
    }
    openai?: {
      apiKey: string
      model?: string        // Default: "gpt-4"
      organization?: string
    }
    // Other providers...
  }

  // Gateway daemon configuration
  gateway: {
    auth: {
      token: string         // Authentication token (generated during onboarding)
    }
    bind: string            // "lan" | "loopback"
    port: number            // Default: 18789
    cors?: {
      enabled: boolean
      origins: string[]
    }
  }

  // Workspace settings
  workspace: {
    path: string            // Absolute path to workspace directory
    maxSize?: number        // Max workspace size in MB
  }

  // User preferences
  preferences?: {
    defaultModel?: string   // Default AI model
    theme?: string          // "light" | "dark"
    language?: string       // "en" | "es" | etc.
  }

  // Config file version (for migrations)
  version: string           // "1.0.0"
}
```

**Example openclaw.json:**

```json
{
  "api": {
    "anthropic": {
      "apiKey": "sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456789",
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096
    },
    "openai": {
      "apiKey": "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz",
      "model": "gpt-4-turbo"
    }
  },
  "gateway": {
    "auth": {
      "token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    },
    "bind": "lan",
    "port": 18789
  },
  "workspace": {
    "path": "/home/node/.openclaw/workspace",
    "maxSize": 1024
  },
  "preferences": {
    "defaultModel": "claude-3-5-sonnet-20241022",
    "theme": "dark",
    "language": "en"
  },
  "version": "1.0.0"
}
```

**Environment Variables (in .env):**

```bash
# Docker Compose environment variables

# Image configuration
OPENCLAW_IMAGE=roboclaw/openclaw:latest

# Volume mount paths
OPENCLAW_CONFIG_DIR=/home/roboclaw/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/roboclaw/.openclaw/workspace

# Gateway settings
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_TOKEN=a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Deployment user (matches container user)
DEPLOY_USER=roboclaw
DEPLOY_UID=1000
DEPLOY_GID=1000
DEPLOY_HOME=/home/roboclaw
```

### Related Files in Codebase

**clawctl Source Files:**

| File | Purpose | Key Functions |
|------|---------|---------------|
| `clawctl/src/lib/auto-connect.ts` | Auto-connect feature | `autoConnect()`, `getPendingRequests()`, `approveDevice()` |
| `clawctl/src/lib/interactive.ts` | Onboarding wizard | `runOnboarding()`, `startGateway()`, `extractGatewayToken()` |
| `clawctl/src/templates/docker-compose.ts` | Compose template | `generateDockerCompose()` |
| `clawctl/src/lib/compose.ts` | Compose file management | `uploadComposeFiles()`, `generateEnvFile()`, `updateEnvToken()` |
| `clawctl/src/commands/deploy.ts` | Deployment orchestration | `deployCommand()` - 10-phase deployment |
| `clawctl/src/lib/ssh-client.ts` | SSH operations | `exec()`, `execStream()`, `execInteractive()` |

**Specification Documents:**

| File | Purpose | Key Sections |
|------|---------|--------------|
| `specs/clawctl-spec.md` | clawctl technical specification | Package structure, CLI interface, deployment phases |
| `specs/clawctl-cli-spec.md` | CLI interface specification | Commands, flags, usage examples |
| `specs/docker-openclaw.md` | Docker containerization | Image details, volume mounts, security |
| `specs/clawctl-strategy.md` | Strategic direction | Roadmap, future enhancements |
| `specs/openclaw-architecture.md` | **This document** | OpenClaw architecture, API reference |

**Configuration Files:**

| File | Purpose | Location |
|------|---------|----------|
| `openclaw.json` | OpenClaw config | `/home/roboclaw/.openclaw/openclaw.json` (host) |
| `docker-compose.yml` | Docker Compose config | `/home/roboclaw/docker/docker-compose.yml` (host) |
| `.env` | Docker Compose environment | `/home/roboclaw/docker/.env` (host) |
| `<instance>.yml` | Instance artifact | `./instances/<instance>.yml` (local) |

**Docker Image Source:**

| Resource | Description | URL |
|----------|-------------|-----|
| OpenClaw Repository | Official source code | https://github.com/openclaw/openclaw |
| OpenClaw Dockerfile | Image build instructions | `openclaw/Dockerfile` (in repo) |
| OpenClaw Documentation | Official docs | (URL depends on OpenClaw project) |

---

## Appendix: OpenClaw Discovery Notes

**Data Sources Used:**

This specification was created by analyzing the RoboClaw codebase to understand how clawctl interacts with OpenClaw:

1. **clawctl/src/lib/auto-connect.ts**: Device pairing API usage
2. **clawctl/src/lib/interactive.ts**: Onboarding process, gateway startup
3. **clawctl/src/templates/docker-compose.ts**: Service definitions
4. **clawctl/src/lib/compose.ts**: Environment variables, config management
5. **specs/docker-openclaw.md**: Docker containerization details
6. **README.md**: User-facing deployment documentation

**Inferred vs Documented:**

- ✅ **Documented**: Docker Compose configuration, deployment process, clawctl commands
- ⚠️ **Inferred**: Specific gateway API responses, config file schema, some CLI commands
- ❓ **Unknown**: Full list of CLI commands, detailed gateway REST API, internal architecture

**OpenClaw as External Project:**

OpenClaw appears to be an independent project (potentially https://github.com/openclaw/openclaw or similar). This specification documents OpenClaw **from the perspective of clawctl integration**, not from OpenClaw's own documentation.

**Future Updates:**

As OpenClaw evolves, this specification should be updated to reflect:
- New gateway API commands
- Additional CLI features
- Configuration schema changes
- New deployment modes
- Updated Docker images

---

**Document Status:** Complete
**Version:** 1.0
**Last Updated:** 2026-02-05
**Author:** Generated from RoboClaw codebase analysis
**Maintained By:** RoboClaw Development Team
