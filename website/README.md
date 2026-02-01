# Open Claw Deploy - Web Application

A sleek, modern web application for deploying Clawdbot on Hetzner Cloud VPS instances with real-time deployment logs.

## Features

- **1-Click Deployment**: Paste your Hetzner API token and launch
- **Real-Time Logs**: Watch the deployment progress with streaming terminal output
- **Automated Provisioning**: Installs Docker, Node.js, UFW firewall, and Clawdbot
- **Secure**: Token used transiently, SSH keys generated per deployment
- **Beautiful UI**: Dark-themed landing page with animated terminal mockup

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Utility-first styling
- **ssh2** - SSH client for remote provisioning
- **Server-Sent Events** - Real-time log streaming

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Hetzner Cloud account with API token (Read & Write permissions)

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
website/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── deploy/page.tsx             # Deployment interface with terminal UI
│   ├── api/deploy/route.ts         # SSE API: spawns run-hetzner.sh
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   ├── ui/                         # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   └── Terminal.tsx            # ANSI output renderer
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   └── ansible-executor.ts         # Child process wrapper for run-hetzner.sh
├── hooks/
│   └── useDeploymentStream.ts      # SSE client hook
└── public/                         # Static assets

../                                 # Parent directory (CLI tool)
├── run-hetzner.sh                  # Bash wrapper (executed by web app)
├── hetzner-finland-fast.yml        # Ansible playbook (actual deployment logic)
├── hetzner-teardown.yml            # Server deletion playbook
├── venv/                           # Python virtualenv with Ansible
├── hetzner_key                     # Generated SSH key (returned to user)
├── finland-instance-ip.txt         # Server IP (read by web app)
└── instances/                      # YAML artifacts of provisioned servers
```

## How It Works

### Relationship to CLI Tool

This web application provides a **browser-based UI wrapper** that executes the existing Ansible automation:
- **Backend**: Next.js API route spawns `../run-hetzner.sh` as a child process
- **Infrastructure**: Same Ansible playbook (`../hetzner-finland-fast.yml`) used by CLI
- **Guarantee**: Web UI and CLI always provision identical VPS instances (same code path)

Architecture benefits:
- **DRY Principle**: Single source of truth for deployment logic (Ansible)
- **Consistency**: No risk of web UI drift from CLI behavior
- **Maintainability**: Update Ansible playbook once, both interfaces benefit

### 1. User Flow

1. User lands on the homepage
2. Clicks "Launch Instance"
3. Enters Hetzner API token (sent to Next.js API)
4. API route executes `../run-hetzner.sh` with token as environment variable
5. User watches real-time Ansible output streaming in browser (via SSE)
6. On completion, downloads SSH private key from `../hetzner_key`
7. SSHs into the VPS and onboards Clawdbot (`clawdbot onboard --install-daemon`)

### 2. Deployment Flow

The web app **executes the existing Ansible playbook** (`../hetzner-finland-fast.yml`) via `../run-hetzner.sh`:

```bash
# What the Next.js API does under the hood:
cd /path/to/freepinch
HCLOUD_TOKEN=user_provided_token ./run-hetzner.sh
```

The Ansible playbook runs through these phases (see `hetzner-finland-fast.yml:1-383` for source):

#### Play 1: Provision Infrastructure (localhost)
Tasks run on the Next.js server machine:

1. **Validate HCLOUD_TOKEN** - Fail if not set (hetzner-finland-fast.yml:16-19)
2. **Validate SSH_PUBLIC_KEY** - Auto-generate if missing (hetzner-finland-fast.yml:21-24, run-hetzner.sh:24-45)
3. **Create SSH Key in Hetzner** - Upload public key (hetzner-finland-fast.yml:26-32)
4. **Create VPS Instance** - cax11 ARM, Helsinki, Ubuntu 24.04 (hetzner-finland-fast.yml:34-44)
5. **Save Server IP** - Write to `finland-instance-ip.txt` (hetzner-finland-fast.yml:56-60)
6. **Add to Inventory** - Register server for next play (hetzner-finland-fast.yml:62-68)
7. **Wait for SSH** - Poll port 22, max 5min (hetzner-finland-fast.yml:70-76)

#### Play 2: Fast Install Clawdbot (remote VPS)
Tasks run on the provisioned VPS via SSH:

8. **Update APT Cache** - No dist-upgrade for speed (hetzner-finland-fast.yml:111-114)
9. **Install Base Packages** - curl, wget, git, ca-certificates, gnupg, lsb-release (hetzner-finland-fast.yml:116-125)
10. **Create clawdbot User** - With home directory (hetzner-finland-fast.yml:128-135)
11. **Configure Sudo** - NOPASSWD for clawdbot (hetzner-finland-fast.yml:136-141)
12. **Enable Lingering** - User services without login (hetzner-finland-fast.yml:143-145)
13. **Install Docker CE** - Add repo + install packages (hetzner-finland-fast.yml:148-169)
14. **Add User to docker Group** - Non-root Docker access (hetzner-finland-fast.yml:171-175)
15. **Start Docker Service** - Enable on boot (hetzner-finland-fast.yml:177-181)
16. **Install UFW** - Uncomplicated Firewall (hetzner-finland-fast.yml:184-187)
17. **Configure UFW Policies** - Deny incoming, allow outgoing (hetzner-finland-fast.yml:189-195)
18. **Allow SSH Port 22** - Prevent lockout (hetzner-finland-fast.yml:197-201)
19. **Enable UFW** - Activate firewall (hetzner-finland-fast.yml:203-205)
20. **Install Node.js 22** - From NodeSource repo (hetzner-finland-fast.yml:208-224)
21. **Install pnpm** - Global via npm (hetzner-finland-fast.yml:226-229)
22. **Create Clawdbot Directories** - ~/.clawdbot/{sessions,credentials,data,logs} (hetzner-finland-fast.yml:232-246)
23. **Configure pnpm** - Set global-dir and bin paths (hetzner-finland-fast.yml:248-256)
24. **Install Clawdbot** - Global pnpm install (hetzner-finland-fast.yml:258-268)
25. **Configure .bashrc** - Add PNPM_HOME and PATH (hetzner-finland-fast.yml:270-281)
26. **Verify Installation** - Check clawdbot version (hetzner-finland-fast.yml:283-286)
27. **Save Instance Artifact** - Create YAML record in instances/ (hetzner-finland-fast.yml:319-377)
28. **Display Completion** - Show SSH instructions (hetzner-finland-fast.yml:288-315)

**Total time**: ~2-3 minutes (vs ~10-15 minutes for full install with extras)

### 3. Architecture

The web app is a **thin UI wrapper** around the existing Ansible automation:

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (User)                                              │
│  - React UI with Tailwind CSS                              │
│  - EventSource connects to /api/deploy                     │
│  - Real-time terminal output display                       │
└────────────────────┬────────────────────────────────────────┘
                     │ POST {token, serverName}
                     │ SSE stream (Ansible stdout)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js API (/api/deploy)                                   │
│  - Receive Hetzner token from user                         │
│  - Set HCLOUD_TOKEN environment variable                   │
│  - Spawn child_process: ../run-hetzner.sh                  │
│  - Stream stdout/stderr to browser via SSE                 │
│  - Read ../hetzner_key (private) and return to user        │
│  - Read ../finland-instance-ip.txt for SSH instructions    │
└────────────────────┬────────────────────────────────────────┘
                     │ spawn child process
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ run-hetzner.sh (Bash)                                       │
│  - Activate virtualenv (venv/)                             │
│  - Load .env or use passed HCLOUD_TOKEN                    │
│  - Auto-generate SSH key if needed (./hetzner_key)         │
│  - Execute: ansible-playbook hetzner-finland-fast.yml      │
└────────────────────┬────────────────────────────────────────┘
                     │ executes playbook
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Ansible Playbook (hetzner-finland-fast.yml)                │
│  Play 1: Provision VPS (localhost)                         │
│   - Create SSH key in Hetzner                              │
│   - Create server instance                                 │
│   - Wait for SSH                                           │
│  Play 2: Install Clawdbot (remote VPS)                     │
│   - Install Docker, Node.js, UFW, pnpm                     │
│   - Create clawdbot user                                   │
│   - Install Clawdbot globally                              │
│   - Save instance artifact                                 │
└─────────────────────────────────────────────────────────────┘
```

#### Components

- **Frontend** (`app/deploy/page.tsx`):
  - Form to collect Hetzner API token
  - `useDeploymentStream` hook for SSE connection
  - Terminal-style output with ANSI color support

- **Backend** (`app/api/deploy/route.ts`):
  - Validates token format (64-char hex)
  - Spawns `child_process.spawn('../run-hetzner.sh')`
  - Streams Ansible output via Server-Sent Events
  - Returns SSH key and server IP on completion

- **Infrastructure** (existing):
  - `run-hetzner.sh` - CLI wrapper script
  - `hetzner-finland-fast.yml` - Ansible playbook
  - Python virtualenv with Ansible + hcloud collection

#### SSE Event Types

```typescript
event: log        // Ansible stdout/stderr line
event: phase      // Play/task transition (parsed from Ansible output)
event: progress   // Percentage complete (estimated)
event: success    // Deployment complete with IP + SSH key
event: error      // Deployment failed with error message
```

## API Reference

### POST /api/deploy

Executes `../run-hetzner.sh` with user-provided token and streams Ansible output via SSE.

**Request Body:**

```json
{
  "token": "64-char-hex-hetzner-token",
  "serverName": "optional-server-name"  // Overrides default "finland-instance"
}
```

**Implementation:**

```typescript
// Simplified pseudo-code
export async function POST(request: Request) {
  const { token, serverName } = await request.json()

  // Set environment variables
  process.env.HCLOUD_TOKEN = token
  if (serverName) process.env.SERVER_NAME = serverName

  // Spawn Ansible script
  const ansible = spawn('../run-hetzner.sh', {
    cwd: path.join(process.cwd(), '..'),
    env: { ...process.env, HCLOUD_TOKEN: token }
  })

  // Stream stdout/stderr as SSE
  const stream = new ReadableStream({
    start(controller) {
      ansible.stdout.on('data', (chunk) => {
        controller.enqueue(`event: log\ndata: ${chunk}\n\n`)
      })

      ansible.on('close', (code) => {
        if (code === 0) {
          const ip = fs.readFileSync('../finland-instance-ip.txt', 'utf8')
          const key = fs.readFileSync('../hetzner_key', 'utf8')
          controller.enqueue(`event: success\ndata: ${JSON.stringify({ip, key})}\n\n`)
        } else {
          controller.enqueue(`event: error\ndata: Ansible failed\n\n`)
        }
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}
```

**Response:** `text/event-stream`

**SSE Events:**

```
event: log
data: TASK [Create Hetzner Cloud server in Helsinki] ********************************

event: log
data: changed: [localhost]

event: log
data: TASK [Display server information] *********************************************

event: log
data: ok: [localhost] => {
data:     "msg": "✅ Server created successfully!\n\n          Name: finland-instance\n          IPv4: 65.21.149.78"
data: }

event: success
data: {"ip":"65.21.149.78","serverName":"finland-instance","sshPrivateKey":"-----BEGIN OPENSSH PRIVATE KEY-----\n...","sshUser":"root","nextSteps":["ssh -i hetzner_key root@65.21.149.78","sudo su - clawdbot","clawdbot onboard --install-daemon"]}

event: error
data: {"message":"Ansible playbook failed with exit code 2","stderr":"ERROR! HCLOUD_TOKEN not set"}
```

**Notes:**
- Server type, location, and image are configured in `../hetzner-finland-fast.yml` (not via API)
- To customize, user must edit the Ansible playbook vars or use `-e` extra vars
- Private SSH key is read from `../hetzner_key` after successful deployment

## Configuration

### Environment Variables

No environment variables required for the web app. The Hetzner API token is provided by the user at deployment time and passed to `run-hetzner.sh` as an environment variable.

### Server Configuration

Server settings are defined in the **Ansible playbook**, not in the Next.js app:

**File:** `../hetzner-finland-fast.yml`

```yaml
vars:
  server_name: "finland-instance"        # Override via API serverName param
  server_type: "cax11"                   # ARM64, 2 vCPU, 4GB RAM, €3.29/mo
  location: "hel1"                       # Helsinki, Finland
  image: "ubuntu-24.04"                  # Ubuntu 24.04 LTS
  nodejs_version: "22.x"                 # Node.js version for Clawdbot
  clawdbot_user: "clawdbot"              # System user for Clawdbot
```

**To customize server type/location:**

1. Edit `../hetzner-finland-fast.yml` vars
2. Or pass Ansible extra vars via API (requires modifying spawn args)
3. Or use `./run-hetzner.sh -e server_type=cx22 -e location=nbg1` (CLI only)

**Available server types:** Run `../list-server-types.sh` to see options and pricing

## Deployment

### Prerequisites

Since the web app **executes Ansible scripts**, the deployment environment must have:

1. **Python 3.12+** with virtualenv
2. **Ansible** (installed in `../venv/`)
3. **Parent directory structure**:
   ```
   /your/path/
   ├── freepinch/              # Root project
   │   ├── run-hetzner.sh
   │   ├── hetzner-finland-fast.yml
   │   ├── venv/               # Python virtualenv
   │   └── website/            # This Next.js app
   ```

### Local Development

```bash
# 1. Set up Ansible environment (from parent directory)
cd ..
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
ansible-galaxy collection install -r hetzner-requirements.yml

# 2. Run Next.js dev server
cd website
npm install
npm run dev
```

### Vercel ❌ NOT RECOMMENDED

Vercel **cannot run Ansible** because:
- No Python runtime available in serverless functions
- No access to parent directory (`../run-hetzner.sh`)
- Function timeout too short (10-60s vs 2-3 min deployment)

You would need to reimplement the deployment logic in TypeScript (see git history for ssh2-based implementation).

### VPS (Self-Hosting) ✅ RECOMMENDED

```bash
# On your VPS
git clone <your-repo> /opt/freepinch
cd /opt/freepinch

# Set up Ansible
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
ansible-galaxy collection install -r hetzner-requirements.yml

# Build and start Next.js app
cd website
npm install
npm run build
npm start
```

Use PM2 for production:

```bash
npm install -g pm2
pm2 start npm --name "openclaw-deploy" -- start
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM ubuntu:24.04

# Install Node.js, Python, and Ansible
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copy entire project (parent + website)
COPY . .

# Set up Python virtualenv and Ansible
RUN python3 -m venv venv \
    && . venv/bin/activate \
    && pip install -r requirements.txt \
    && ansible-galaxy collection install -r hetzner-requirements.yml

# Install Node.js dependencies and build
WORKDIR /app/website
RUN npm ci --production && npm run build

EXPOSE 3000

# Start Next.js server (virtualenv will be activated by run-hetzner.sh)
CMD ["npm", "start"]
```

```bash
docker build -t openclaw-deploy .
docker run -p 3000:3000 openclaw-deploy
```

## Security Considerations

- **API Token**:
  - Sent in POST body, passed as env var to `run-hetzner.sh`
  - Never written to disk (not in .env file)
  - Exists only in process memory during deployment
  - Not persisted in logs or database

- **SSH Keys**:
  - Generated by Ansible in `../hetzner_key` (per deployment)
  - Private key sent to user once via SSE success event
  - User responsible for downloading and securing key
  - Keys **not deleted** after deployment (for potential reuse)
  - WARNING: Multiple deployments overwrite `../hetzner_key`

- **File System Access**:
  - Next.js API has read/write access to parent directory
  - Can read sensitive files (`../hetzner_key`, `../.env`)
  - **Security Risk**: Public deployment exposes your local machine's SSH keys
  - **Mitigation**: Only deploy on trusted servers, use firewall/auth

- **No Database**: Stateless design, no credentials stored

- **Firewall**: UFW configured on VPS (deny all incoming except SSH)

- **Recommendation**: Add authentication (NextAuth.js) before public deployment

## Troubleshooting

### Build Errors

**Error: `Module parse failed: Unexpected character '�'`**

This means ssh2 native bindings are being included in the client bundle. Ensure `next.config.ts` has:

```typescript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    }
  }
  return config
}
```

### Runtime Errors

**Error: `SSH connection failed`**

- Wait 30-60s after VPS creation for SSH to become available
- Check Hetzner console to verify server is running
- Verify firewall allows SSH on port 22

**Error: `Deployment failed during package installation`**

- Server may be low on resources
- Check Hetzner status page for outages
- Retry deployment

### Deployment Timeout

If deployment times out before completing:

- **Vercel**: Upgrade to Pro for 60s timeout or self-host
- **Self-hosted**: No timeout limits

## Development

### Adding New Features

1. **New provisioning step**: Edit `../hetzner-finland-fast.yml` (Ansible playbook)
2. **New UI component**: Add to `components/ui/`
3. **Modify streaming output**: Update `lib/ansible-executor.ts` parsing logic
4. **Change server config**: Edit Ansible vars in `../hetzner-finland-fast.yml`

### Testing Locally

**Option 1: Test web app (requires Hetzner token)**

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Test API endpoint (spawns Ansible)
curl -N -X POST http://localhost:3000/api/deploy \
  -H "Content-Type: application/json" \
  -d '{"token":"your-64-char-hetzner-token"}' \
  --no-buffer

# Watch SSE stream with real Ansible output
```

**Option 2: Test Ansible directly (faster iteration)**

```bash
# Test Ansible playbook without web UI
cd ..
echo 'HCLOUD_TOKEN=your-token' > .env
./run-hetzner.sh

# Verify changes work, then test via web UI
```

### Development Workflow

1. Make changes to Ansible playbook (`../hetzner-finland-fast.yml`)
2. Test via CLI: `cd .. && ./run-hetzner.sh delete && ./run-hetzner.sh`
3. Once working, test via web UI: `curl -X POST http://localhost:3000/api/deploy`
4. Verify SSE streaming and output parsing work correctly

### Debugging

```bash
# Enable Ansible verbose mode
cd ..
ansible-playbook hetzner-finland-fast.yml -vvv

# Check Next.js API logs
npm run dev  # Watch console for child_process errors

# Test SSE stream
curl -N http://localhost:3000/api/deploy --no-buffer | grep "event:"
```

## License

MIT

## Contributing

Pull requests welcome! Please ensure:

- TypeScript types are correct
- Code follows existing style
- Build passes: `npm run build`
- Deployment tested end-to-end

## Related

- [Hetzner Cloud API Docs](https://docs.hetzner.cloud/)
- [Clawdbot Repository](https://github.com/openclaw/clawdbot)
- [ssh2 Documentation](https://github.com/mscdex/ssh2)
