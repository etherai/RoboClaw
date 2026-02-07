# clawctl Testing and Development Guide

**Last Updated:** 2026-02-05
**Version:** 1.0.1
**Status:** Active

## Table of Contents

1. [Overview](#overview)
2. [Development Environment Setup](#development-environment-setup)
3. [Testing Workflow](#testing-workflow)
4. [Debugging Techniques](#debugging-techniques)
5. [Testing Specific Features](#testing-specific-features)
6. [Automated Testing Strategy](#automated-testing-strategy)
7. [Destructive Operations](#destructive-operations)
8. [Performance Testing](#performance-testing)
9. [Platform-Specific Testing](#platform-specific-testing)
10. [Testing Checklist](#testing-checklist)
11. [Common Test Scenarios](#common-test-scenarios)
12. [Troubleshooting Test Failures](#troubleshooting-test-failures)
13. [Best Practices](#best-practices)
14. [Reference](#reference)

---

## Overview

### Purpose

This guide helps developers safely test changes to `clawctl` without breaking production systems. Since clawctl deploys to remote servers via SSH and Docker, testing requires special care to avoid data loss or system corruption.

### Testing Philosophy

**Key Principles:**
1. **Test on disposable infrastructure** - Never test on production servers
2. **Fail fast** - Catch errors early before they cause damage
3. **Iterate quickly** - Use snapshots and automation to speed up testing
4. **Verify thoroughly** - Check both happy paths and error cases
5. **Document findings** - Update this guide when you discover new issues

### When to Test

Always test before:
- **Implementing features** - Validate your approach works end-to-end
- **Merging PRs** - Ensure changes don't break existing functionality
- **Releasing** - Run full regression suite before publishing to npm

---

## Development Environment Setup

### Local Setup

#### Prerequisites

- **Node.js 18+** - Check with `node --version`
- **SSH client** - Should be pre-installed on Linux/macOS/WSL
- **Git** - For cloning the repository
- **Text editor** - VS Code, Vim, etc.

#### Clone and Build

1. **Clone the repository:**
   ```bash
   git clone https://github.com/openclaw/roboclaw.git
   cd roboclaw/clawctl
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the CLI:**
   ```bash
   npm run build
   ```

   Expected output:
   ```
   src/index.ts → dist/index.js
   src/commands/deploy.ts → dist/commands/deploy.js
   ...
   ```

4. **Verify the build:**
   ```bash
   node dist/index.js --version
   ```

   Should output: `1.0.1` (or current version)

#### Development Mode

For active development, use watch mode:

```bash
npm run watch
```

This rebuilds automatically when you save files. Keep it running in a separate terminal.

#### Running Locally vs npx

**During development, run locally:**
```bash
node dist/index.js deploy <IP> --key <path>
```

**For testing published package:**
```bash
npx clawctl@latest deploy <IP> --key <path>
```

---

### Test Server Setup

#### Recommended Providers

Choose a cheap VPS provider for testing:

| Provider | Cost | Specs | Signup |
|----------|------|-------|--------|
| **DigitalOcean** | $6/month | 1GB RAM, 1 CPU | [DigitalOcean](https://digitalocean.com) |
| **Hetzner** | €4.50/month | 2GB RAM, 1 CPU | [Hetzner Cloud](https://hetzner.cloud) |
| **Linode** | $5/month | 1GB RAM, 1 CPU | [Linode](https://linode.com) |
| **Vultr** | $6/month | 1GB RAM, 1 CPU | [Vultr](https://vultr.com) |

#### Server Specifications

**Minimum requirements:**
- **OS:** Ubuntu 24.04 LTS (recommended) or Ubuntu 20.04+
- **RAM:** 1GB minimum (2GB recommended)
- **Disk:** 25GB minimum
- **Root SSH access** with public key authentication

#### Initial Server Setup

1. **Create a new VPS** with Ubuntu 24.04

2. **Add your SSH public key** during creation (most providers have this option)

3. **Test SSH access:**
   ```bash
   ssh -i ~/.ssh/test_key root@192.168.1.100
   ```

   If successful, you should see a root prompt.

4. **Verify Ubuntu version:**
   ```bash
   ssh -i ~/.ssh/test_key root@192.168.1.100 "cat /etc/os-release"
   ```

   Should show Ubuntu 24.04 or similar.

#### Using Snapshots for Fast Reset

**Why snapshots?** Testing often requires a clean slate. Snapshots let you restore your server to a known good state in seconds.

**Workflow:**

1. **Create a baseline snapshot** (clean Ubuntu install):
   - In your provider's dashboard, create a snapshot named `ubuntu-24.04-clean`

2. **Test your changes** on the server

3. **If something breaks**, restore from snapshot:
   - Most providers: Delete VPS → Recreate from snapshot
   - DigitalOcean: Power off → Restore snapshot → Power on

4. **Create new snapshots** at key milestones:
   - `ubuntu-with-docker` - After Docker installation
   - `ubuntu-with-openclaw` - After successful deployment

**Cost:** Most providers charge $0.05/GB/month for snapshots (~$1-2/month)

#### SSH Key Setup

**Generate a test-specific key** (recommended):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/clawctl_test_key -C "clawctl-testing"
```

Add to your server during VPS creation, or manually:

```bash
ssh-copy-id -i ~/.ssh/clawctl_test_key.pub root@192.168.1.100
```

**Security note:** Keep test keys separate from production keys.

---

## Testing Workflow

### Full Deployment Test

This is the most common test - deploy from scratch and verify everything works.

#### Step-by-Step Process

**1. Build the latest code:**
```bash
cd roboclaw/clawctl
npm run build
```

**2. Start deployment with verbose mode:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --name test-instance \
  --verbose
```

**3. Watch the phases execute:**

You should see:
```
Preparing to deploy OpenClaw
─────────────────────────────
  Target: 192.168.1.100
  Instance: test-instance
  SSH User: root
  SSH Key: /home/user/.ssh/clawctl_test_key
  Branch: main


Phase 1: SSH Connection
✓ Connected to 192.168.1.100 as root
✓ Root access verified

Phase 2: Install Base Packages
✓ Installed base packages (ca-certificates, curl, gnupg)

Phase 3: Install Docker
✓ Docker installed successfully
✓ Version: Docker version 27.4.1

Phase 4: Setup Deployment User
✓ Created deployment user: roboclaw (UID 1000, GID 1000)

Phase 5: Create Directories
✓ Created directory: /home/roboclaw/docker
✓ Created directory: /home/roboclaw/openclaw-build

Phase 6: Build OpenClaw Image
  Cloning OpenClaw repository (branch: main)...
  Building Docker image...
  [Docker build output...]
✓ Built image: roboclaw/openclaw:local

Phase 7: Upload Docker Compose
✓ Uploaded docker-compose.yml
✓ Uploaded .env file

Phase 8: Onboarding & Gateway Startup
  Running interactive onboarding wizard...
  [Interactive prompts appear here]
✓ Onboarding complete
✓ Gateway token extracted
✓ Gateway started

Phase 9: Create Instance Artifact
✓ Created artifact: instances/test-instance.yml

Phase 10: Finalize Deployment
✓ Deployment state cleaned up

✅ Deployment complete!

Instance Details:
  Name: test-instance
  IP: 192.168.1.100
  Gateway: Running at http://localhost:18789 (localhost only)

[Auto-connect prompts may appear here]
```

**4. Verify deployment success:**

```bash
# SSH to server and check containers
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps"
```

Expected output:
```
CONTAINER ID   IMAGE                        STATUS
abc123def456   roboclaw/openclaw:local      Up 30 seconds
```

**5. Check the instance artifact:**

```bash
cat instances/test-instance.yml
```

Should contain:
```yaml
instanceName: test-instance
ip: 192.168.1.100
deployedAt: 2026-02-05T10:30:00.000Z
user:
  username: roboclaw
  uid: 1000
  gid: 1000
  home: /home/roboclaw
image: roboclaw/openclaw:local
branch: main
```

#### Expected Timing

| Phase | Description | Typical Duration |
|-------|-------------|-----------------|
| 0 | Validation | < 1 second |
| 1 | SSH Connection | 2-5 seconds |
| 2 | Install Base Packages | 10-30 seconds |
| 3 | Install Docker | 30-60 seconds |
| 4 | Setup Deployment User | 2-5 seconds |
| 5 | Create Directories | 1-2 seconds |
| 6 | Build OpenClaw Image | 2-5 minutes |
| 7 | Upload Docker Compose | 1-2 seconds |
| 8 | Onboarding & Startup | 30-120 seconds |
| 9 | Create Artifact | < 1 second |
| 10 | Finalize | 1-2 seconds |

**Total:** 5-10 minutes for a fresh deployment

---

### Testing Individual Phases

Sometimes you need to test a specific phase in isolation without running the entire deployment.

#### Using State File to Simulate Partial Completion

The state file is at `/home/roboclaw/.clawctl-deploy-state.json` on the remote server.

**Example state file format:**
```json
{
  "instanceName": "test-instance",
  "deploymentId": "550e8400-e29b-41d4-a716-446655440000",
  "startedAt": "2026-02-05T10:00:00.000Z",
  "lastPhase": 5,
  "phases": {
    "1": "complete",
    "2": "complete",
    "3": "complete",
    "4": "complete",
    "5": "complete",
    "6": "pending",
    "7": "pending",
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

#### Testing Phase 6 (Build Image) in Isolation

**Scenario:** You modified the image builder and want to test just that phase.

**Setup:**
1. Manually complete phases 1-5 (or use a snapshot)
2. Create a state file marking phases 1-5 as complete:

```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "cat > /home/roboclaw/.clawctl-deploy-state.json" <<'EOF'
{
  "instanceName": "test-instance",
  "deploymentId": "test-build",
  "startedAt": "2026-02-05T10:00:00.000Z",
  "lastPhase": 5,
  "phases": {
    "1": "complete",
    "2": "complete",
    "3": "complete",
    "4": "complete",
    "5": "complete",
    "6": "pending",
    "7": "pending",
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
EOF
```

**Execute:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --verbose
```

**Expected output:**
```
Resuming from last checkpoint...

Phase 2: Install Base Packages
  (skip - already complete)

Phase 3: Install Docker
  (skip - already complete)

Phase 4: Setup Deployment User
  (skip - already complete)

Phase 5: Create Directories
  (skip - already complete)

Phase 6: Build OpenClaw Image
  [Your modified build logic runs here]
✓ Built image: roboclaw/openclaw:local

[Continues with phases 7-10...]
```

#### Manual Phase Verification

After each phase, you can manually verify the changes on the server:

**Phase 2 - Base packages installed:**
```bash
ssh root@IP "dpkg -l | grep -E 'ca-certificates|curl|gnupg'"
```

**Phase 3 - Docker installed:**
```bash
ssh root@IP "docker --version"
```

**Phase 4 - Deployment user created:**
```bash
ssh root@IP "id roboclaw"
```

**Phase 5 - Directories created:**
```bash
ssh root@IP "ls -la /home/roboclaw"
```

**Phase 6 - Image built:**
```bash
ssh root@IP "docker images | grep roboclaw/openclaw"
```

**Phase 7 - Compose files uploaded:**
```bash
ssh root@IP "ls -la /home/roboclaw/docker/"
ssh root@IP "cat /home/roboclaw/docker/docker-compose.yml"
```

**Phase 8 - Gateway running:**
```bash
ssh root@IP "docker ps | grep openclaw-gateway"
```

---

### Testing Resume/Idempotency

One of clawctl's key features is the ability to resume after failure. This section covers testing that capability.

#### Resume After Failure Test

**Scenario:** Verify that clawctl can resume a deployment after being killed mid-process.

**Setup:**

1. **Build the latest code:**
   ```bash
   npm run build
   ```

2. **Start a deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --verbose
   ```

3. **Let it run until Phase 5 completes** (watch the output)

4. **Kill the process:** Press `Ctrl+C`

**Verification:**

1. **SSH to the server and check state:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat /home/roboclaw/.clawctl-deploy-state.json"
   ```

   Expected output:
   ```json
   {
     "lastPhase": 5,
     "phases": {
       "1": "complete",
       "2": "complete",
       "3": "complete",
       "4": "complete",
       "5": "complete",
       "6": "pending",
       ...
     }
   }
   ```

2. **Resume the deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --verbose
   ```

3. **Verify it continues from Phase 6** (not Phase 1)

**Expected Behavior:**
- Should detect the partial deployment
- Should display: "Resuming from last checkpoint..."
- Should show: "Phase 2: Install Base Packages (skip - already complete)"
- Should start executing at Phase 6
- Should complete successfully

**Common Issues:**
- **State file not found:** Phase 4 didn't complete, state file wasn't created yet
- **Resumes from wrong phase:** State file corruption, use `--force` to restart
- **All phases re-run:** State file was deleted, or `--force` flag was used

#### Idempotency Test (Run Twice)

**Scenario:** Verify that running clawctl twice on the same server doesn't break things.

**Setup:**

1. **Run a complete deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name test-instance
   ```

   Wait for it to complete successfully.

2. **Run the exact same command again:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name test-instance
   ```

**Expected Behavior:**

The deployment should detect that the server is already deployed and handle it gracefully. However, note that **the current implementation doesn't have full idempotency detection for completed deployments** - the state file is deleted after success.

**Current behavior:**
- Will re-run the full deployment
- Should succeed without errors
- May recreate containers

**Future improvement:** Detect existing deployment and skip unnecessary work.

**Workaround for now:** Use `--force` explicitly when you want to re-deploy, or use `--clean` to remove everything first.

---

### Testing Error Recovery

Test how clawctl handles various failure scenarios.

#### Simulate Network Failure

**Scenario:** Test behavior when network connection drops mid-deployment.

**Setup:**

1. Start a deployment
2. During Phase 6 (long-running Docker build), disconnect the network:
   - On your local machine: Disable WiFi
   - On the server: Use `iptables` to block SSH (advanced)

**Expected Behavior:**
- Should timeout with a clear error message
- Should preserve state file on remote server
- Should allow resume when network is restored

**Manual simulation (safer):**
```bash
# On the remote server, temporarily block the SSH port
ssh root@IP "iptables -A INPUT -p tcp --dport 22 -j DROP"

# Wait a few seconds, then restore access via provider console
iptables -D INPUT -p tcp --dport 22 -j DROP
```

#### Simulate Permission Issues

**Scenario:** Test behavior when SSH key has wrong permissions.

**Setup:**

1. **Make SSH key world-readable (insecure):**
   ```bash
   chmod 644 ~/.ssh/clawctl_test_key
   ```

2. **Try to deploy:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key
   ```

**Expected Behavior:**
- Should show a warning about insecure permissions
- Should still attempt connection (SSH client may refuse)
- Should provide clear error message

**Restore permissions:**
```bash
chmod 600 ~/.ssh/clawctl_test_key
```

#### Simulate Docker Build Failure

**Scenario:** Test behavior when Docker build fails.

**Setup:**

1. **Modify the OpenClaw repository** to introduce a build error:
   - Deploy with a branch that has a broken Dockerfile
   - Or manually break the Dockerfile on the server after phase 5

2. **Run deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --branch broken-branch \
     --verbose
   ```

**Expected Behavior:**
- Should fail during Phase 6
- Should show Docker build error output
- Should preserve state (lastPhase: 5)
- Should allow resume after fixing the issue

#### Simulate Disk Space Issues

**Scenario:** Test behavior when server runs out of disk space.

**Setup:**

1. **Fill up disk space** (on a test server only!):
   ```bash
   ssh root@IP "dd if=/dev/zero of=/tmp/bigfile bs=1M count=10000"
   ```

2. **Try to deploy:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key
   ```

**Expected Behavior:**
- Should fail with "No space left on device" error
- Should provide clear error message
- Should suggest checking disk space

**Cleanup:**
```bash
ssh root@IP "rm /tmp/bigfile"
```

---

## Debugging Techniques

### Using Verbose Mode

The `--verbose` flag shows detailed information about every operation.

#### Basic Verbose Output

**Enable verbose mode:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --verbose
```

**Additional information shown:**
- SSH commands being executed
- File upload operations
- State file updates
- Docker command output
- Timing information

**Example verbose output:**
```
Phase 3: Install Docker
  [verbose] $ curl -fsSL https://get.docker.com -o get-docker.sh
  [verbose] $ sh get-docker.sh
  [Docker installation script output...]
  [verbose] Updated phase 3 status: complete
✓ Docker installed successfully
```

#### Adding Verbose Logging to Code

When developing new features, add verbose logging:

```typescript
import * as logger from './logger.js'

// Log commands
logger.verbose('Executing command: docker ps')

// Log file operations
logger.verbose(`Uploading file to ${remotePath}`)

// Log state changes
logger.verbose(`Phase ${phaseNumber} marked as complete`)

// Log intermediate values
logger.verbose(`Found ${count} containers running`)
```

**Guidelines:**
- Use verbose for implementation details
- Use info for user-facing progress
- Use success for completed steps
- Use warn for non-critical issues
- Use error for failures

---

### Inspecting Remote State

The state file is your window into what clawctl has done on the server.

#### Check State File

**Read the state file:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/.clawctl-deploy-state.json"
```

**Pretty-print with jq:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/.clawctl-deploy-state.json" | jq .
```

**Check if state file exists:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "test -f /home/roboclaw/.clawctl-deploy-state.json && echo EXISTS || echo MISSING"
```

#### Verify Docker Containers

**List all containers:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps -a"
```

**Check specific container:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker ps -a | grep openclaw-gateway"
```

**Inspect container details:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker inspect openclaw-gateway"
```

#### Check Container Logs

**View gateway logs:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cd /home/roboclaw/docker && sudo -u roboclaw docker compose logs openclaw-gateway"
```

**Follow logs in real-time:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cd /home/roboclaw/docker && sudo -u roboclaw docker compose logs -f openclaw-gateway"
```

**Last 50 lines:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cd /home/roboclaw/docker && sudo -u roboclaw docker compose logs --tail=50 openclaw-gateway"
```

---

### Manual Verification Steps

Use these commands to manually verify each deployment phase.

#### Phase-by-Phase Verification Checklist

**Phase 1: SSH Connection**
```bash
# Should succeed with no errors
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "echo OK"
```

**Phase 2: Base Packages Installed**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "dpkg -l | grep -E 'ca-certificates|curl|gnupg' | wc -l"
# Should output: 3 (or more)
```

**Phase 3: Docker Installed**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker --version"
# Should output: Docker version 27.x.x
```

**Phase 4: Deployment User Created**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "id roboclaw"
# Should output: uid=1000(roboclaw) gid=1000(roboclaw)

ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "groups roboclaw"
# Should include: docker
```

**Phase 5: Directories Created**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "ls -la /home/roboclaw/ | grep -E 'docker|openclaw-build'"
# Should show both directories with roboclaw ownership
```

**Phase 6: Image Built**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker images | grep 'roboclaw/openclaw'"
# Should show: roboclaw/openclaw:local

ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker image inspect roboclaw/openclaw:local"
# Should return JSON metadata
```

**Phase 7: Compose Files Uploaded**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "ls -la /home/roboclaw/docker/"
# Should show: docker-compose.yml, .env

ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/docker/.env"
# Should contain: USER_UID=1000, USER_GID=1000, GATEWAY_TOKEN=...
```

**Phase 8: Gateway Running**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker ps | grep openclaw-gateway"
# Should show container with "Up X seconds" status

ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "curl -s http://localhost:18789/health || echo 'Health check failed'"
# Should return health status (or at least not error)
```

**Phase 9: Instance Artifact Created**
```bash
ls instances/
# Should show: test-instance.yml

cat instances/test-instance.yml
# Should contain: instanceName, ip, deployedAt, user, image
```

**Phase 10: State File Cleaned Up**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "test -f /home/roboclaw/.clawctl-deploy-state.json && echo EXISTS || echo DELETED"
# Should output: DELETED
```

---

### Common Debug Scenarios

#### SSH Connection Fails

**Symptoms:**
```
✗ SSH connection failed after 3 attempts: Connection refused
```

**Debug steps:**

1. **Verify server is running:**
   ```bash
   ping 192.168.1.100
   ```

2. **Check SSH port is open:**
   ```bash
   nc -zv 192.168.1.100 22
   ```

3. **Test SSH manually:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key -v root@192.168.1.100
   ```
   (The `-v` flag shows detailed debug info)

4. **Check key permissions:**
   ```bash
   ls -la ~/.ssh/clawctl_test_key
   ```
   Should be: `-rw-------` (600)

5. **Verify key is authorized:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat ~/.ssh/authorized_keys"
   ```

**Common causes:**
- Wrong IP address
- Server firewall blocking SSH
- SSH key not authorized on server
- Key permissions too permissive
- Server not running

#### Docker Installation Hangs

**Symptoms:**
- Phase 3 takes more than 5 minutes
- No output for a long time
- `--verbose` shows script stuck

**Debug steps:**

1. **SSH to server manually and check:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100
   ps aux | grep docker
   ```

2. **Check if apt is locked:**
   ```bash
   ps aux | grep apt
   ```

3. **Check for pending reboots:**
   ```bash
   cat /var/run/reboot-required 2>/dev/null || echo "No reboot needed"
   ```

4. **Kill the deployment, manually install Docker, resume:**
   ```bash
   # On server
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker roboclaw

   # Resume deployment with --force
   node dist/index.js deploy IP --key KEY --force
   ```

#### Git Clone Fails

**Symptoms:**
```
Phase 6: Build OpenClaw Image
✗ Git clone failed: fatal: could not read from remote repository
```

**Debug steps:**

1. **Check internet connectivity from server:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "ping -c 3 github.com"
   ```

2. **Try manual clone:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "git clone https://github.com/OpenClaw/OpenClaw.git /tmp/test-clone"
   ```

3. **Check DNS resolution:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "nslookup github.com"
   ```

**Common causes:**
- Server has no internet access
- GitHub is down (check status.github.com)
- Firewall blocking HTTPS
- Wrong branch name specified

#### Container Won't Start

**Symptoms:**
```
Phase 8: Onboarding & Gateway Startup
✗ Gateway failed to start
```

**Debug steps:**

1. **Check container status:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "docker ps -a | grep openclaw"
   ```

2. **View container logs:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "docker logs openclaw-gateway"
   ```

3. **Inspect container:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "docker inspect openclaw-gateway"
   ```

4. **Check port conflicts:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "netstat -tlnp | grep 18789"
   ```

5. **Try starting manually:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cd /home/roboclaw/docker && docker compose up openclaw-gateway"
   ```

**Common causes:**
- Port already in use
- Missing environment variables
- Image build was corrupted
- Insufficient memory

#### Onboarding Hangs

**Symptoms:**
- Phase 8 shows onboarding prompt but nothing happens
- Terminal becomes unresponsive
- Can't type anything

**Debug steps:**

1. **Kill with Ctrl+C**

2. **Check if onboarding container is running:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "docker ps | grep onboard"
   ```

3. **Check onboarding logs:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cd /home/roboclaw/docker && docker compose logs openclaw-onboard"
   ```

4. **Try skipping onboarding:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --skip-onboard
   ```

**Common causes:**
- PTY session not properly initialized
- Network latency causing delays
- Container crashed but wasn't detected
- Terminal compatibility issues (try different terminal)

---

## Testing Specific Features

### Testing Auto-Connect

The auto-connect feature (added in v1.0.1) automates SSH tunnel creation and browser opening.

#### Full Auto-Connect Test

**Scenario:** Test the complete auto-connect workflow.

**Setup:**

1. **Deploy a fresh instance:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name auto-test \
     --verbose
   ```

2. **After deployment completes, you'll see:**
   ```
   ┌─ Auto-connect to Dashboard ─────────────────────────────────┐
   │ Would you like to open the dashboard now?                   │
   └─────────────────────────────────────────────────────────────┘
     [Y/n]:
   ```

3. **Press Enter (default: Yes)**

**Expected behavior:**

1. **Tunnel creation:**
   ```
   ℹ Checking existing pairing requests...
   ℹ Creating SSH tunnel on port 18789...
   ✓ Tunnel established (PID 12345)
   ```

2. **Browser opens** automatically to `http://localhost:18789/?token=xxx`

3. **Pairing detection:**
   ```
   ℹ Waiting for device pairing request...
     (press Ctrl+C to skip)
   ✓ New pairing request detected
   ```

4. **Auto-approval:**
   ```
   ℹ Auto-approving device...
   ✓ Device approved!

   ✓ Dashboard is ready!
     Tunnel will stay open. Press Ctrl+C to exit.
   ```

5. **Dashboard should be accessible** at `http://localhost:18789`

**Verification:**

1. **Check tunnel is running:**
   ```bash
   ps aux | grep "ssh.*18789"
   ```

2. **Test port forwarding:**
   ```bash
   curl http://localhost:18789
   ```
   Should return gateway response.

3. **Check browser opened:** Browser window should be visible

4. **Try accessing dashboard:** Navigate to `http://localhost:18789`

5. **Ctrl+C to exit:**
   ```
   ^C
   ℹ Closing SSH tunnel...
   ```

6. **Verify tunnel closed:**
   ```bash
   ps aux | grep "ssh.*18789"
   ```
   Should return nothing.

#### Test SSH Tunnel Creation

**Test the tunnel in isolation:**

```bash
# Manually test SSH tunnel
ssh -L 18789:localhost:18789 \
    -i ~/.ssh/clawctl_test_key \
    -N -f \
    root@192.168.1.100

# Check if tunnel works
curl http://localhost:18789

# Kill tunnel
pkill -f "ssh.*18789"
```

#### Test Browser Opening

**Platform-specific tests:**

**On Linux:**
```bash
# Should use xdg-open
xdg-open http://localhost:18789
```

**On macOS:**
```bash
# Should use open
open http://localhost:18789
```

**On WSL:**
```bash
# Should fall back to xdg-open (which opens Windows browser)
xdg-open http://localhost:18789
```

**On Windows (if testing natively):**
```cmd
REM Should use cmd /c start
cmd /c start http://localhost:18789
```

#### Test Pairing Detection

**Test pairing request detection logic:**

1. **Deploy with auto-connect enabled**

2. **When prompt appears, press Y**

3. **In browser, open the dashboard** at `http://localhost:18789`

4. **Pairing request should be detected automatically**

5. **Device should be auto-approved**

**Manual verification:**

```bash
# Check pending pairing requests
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cd /home/roboclaw/docker && docker compose exec openclaw-gateway node dist/index.js devices list"
```

#### Testing --no-auto-connect Flag

**Scenario:** Skip auto-connect entirely.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --no-auto-connect
```

**Expected behavior:**
- Should complete deployment normally
- Should NOT prompt for auto-connect
- Should show "Next steps" message instead
- Should exit cleanly

---

### Testing Flags

Test each command-line flag to ensure it works as expected.

#### Testing --force (Ignore State)

**Scenario:** Force a fresh deployment, ignoring partial state.

**Setup:**

1. **Start a deployment and kill it mid-way:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key
   # Kill after phase 5 with Ctrl+C
   ```

2. **Verify state exists:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat /home/roboclaw/.clawctl-deploy-state.json | jq .lastPhase"
   # Should output: 5
   ```

3. **Re-deploy with --force:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --force
   ```

**Expected behavior:**
- Should show: "Forcing fresh deployment (--force flag)"
- Should delete state file
- Should start from Phase 0
- Should NOT skip any phases

#### Testing --clean (Remove Everything)

**⚠️ DESTRUCTIVE - Only test on disposable servers!**

**Scenario:** Remove all traces of previous deployment.

**Setup:**

1. **Deploy normally:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key
   ```

2. **Wait for completion**

3. **Verify deployment exists:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "docker ps && id roboclaw"
   ```

4. **Re-deploy with --clean:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --clean
   ```

**Expected behavior:**

1. **Warning message:**
   ```
   ⚠️  Clean deployment requested

   This will remove:
     - All Docker containers and images
     - roboclaw user and all files
     - Deployment state
   ```

2. **Cleanup actions:**
   ```
   ℹ Cleaning previous deployment...
   ✓ Cleanup complete
   ```

3. **Fresh deployment starts from Phase 1**

**Verification:**

```bash
# Before --clean
ssh root@IP "docker ps"        # Shows containers
ssh root@IP "id roboclaw"      # User exists

# After --clean
ssh root@IP "docker ps"        # Empty
ssh root@IP "id roboclaw"      # User doesn't exist
```

#### Testing --skip-onboard

**Scenario:** Deploy without running interactive onboarding.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --skip-onboard
```

**Expected behavior:**
- Should complete deployment
- Should NOT show interactive onboarding prompts
- Should still create gateway container
- Gateway may not have token configured (needs manual onboarding)

**Verification:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker ps | grep openclaw-gateway"
# Should show gateway running

ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/docker/.env | grep GATEWAY_TOKEN"
# May be empty or have placeholder
```

#### Testing --verbose

**Scenario:** Show detailed output for debugging.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --verbose
```

**Expected additions to output:**
```
  [verbose] SSH connection attempt 1/3...
  [verbose] $ apt-get update
  [verbose] Uploaded content -> /home/roboclaw/.clawctl-deploy-state.json
  [verbose] Updated phase 2 status: complete
```

**Verification:**
- Should see `[verbose]` lines throughout
- Should show exact commands being executed
- Should show file operations
- Should show state updates

#### Testing Custom Name

**Scenario:** Deploy with custom instance name.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --name production-east
```

**Expected behavior:**
- Should use "production-east" as instance name
- Should create `instances/production-east.yml`

**Verification:**
```bash
cat instances/production-east.yml | grep instanceName
# Should output: instanceName: production-east
```

#### Testing Custom Branch

**Scenario:** Deploy a specific OpenClaw branch.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --branch feature/new-ui
```

**Expected behavior:**
- Should clone from `feature/new-ui` branch
- Should show in output: `Branch: feature/new-ui`
- Should build image from that branch

**Verification:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cd /home/roboclaw/openclaw-build && git branch"
# Should show: * feature/new-ui
```

#### Testing Custom Port

**Scenario:** Connect to SSH on non-standard port.

**Command:**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --port 2222
```

**Expected behavior:**
- Should connect to port 2222 instead of 22
- Should work if SSH is running on that port

**Verification:**
```bash
# Test manual connection
ssh -i ~/.ssh/clawctl_test_key -p 2222 root@192.168.1.100 "echo OK"
```

---

### Testing Configuration

Test the configuration precedence system.

#### Environment Variables

**Scenario:** Load configuration from environment variables.

**Setup:**

1. **Set environment variables:**
   ```bash
   export CLAWCTL_SSH_KEY=~/.ssh/clawctl_test_key
   export CLAWCTL_SSH_USER=root
   export CLAWCTL_DEFAULT_BRANCH=develop
   export CLAWCTL_VERBOSE=true
   ```

2. **Deploy without flags:**
   ```bash
   node dist/index.js deploy 192.168.1.100
   ```

**Expected behavior:**
- Should use SSH key from `CLAWCTL_SSH_KEY`
- Should use branch "develop"
- Should enable verbose mode
- Should display these values in the output

**Cleanup:**
```bash
unset CLAWCTL_SSH_KEY CLAWCTL_SSH_USER CLAWCTL_DEFAULT_BRANCH CLAWCTL_VERBOSE
```

#### Config Files

**Scenario:** Load configuration from `~/.clawctl/config.yml`.

**Setup:**

1. **Create config file:**
   ```bash
   mkdir -p ~/.clawctl
   cat > ~/.clawctl/config.yml <<'EOF'
   defaults:
     sshKey: ~/.ssh/clawctl_test_key
     sshUser: root
     branch: staging
     verbose: true

   instances:
     production:
       sshKey: ~/.ssh/prod_key
       branch: main
   EOF
   ```

2. **Deploy without flags:**
   ```bash
   node dist/index.js deploy 192.168.1.100
   ```

**Expected behavior:**
- Should use defaults from config file
- Should show: `Branch: staging`
- Should enable verbose mode

3. **Deploy with instance name:**
   ```bash
   node dist/index.js deploy 192.168.1.100 --name production
   ```

**Expected behavior:**
- Should use instance-specific config
- Should show: `Branch: main`

**Cleanup:**
```bash
rm ~/.clawctl/config.yml
```

#### Flag Precedence

**Scenario:** Verify flags override config files and environment variables.

**Setup:**

1. **Set environment variable:**
   ```bash
   export CLAWCTL_DEFAULT_BRANCH=develop
   ```

2. **Create config file:**
   ```bash
   mkdir -p ~/.clawctl
   cat > ~/.clawctl/config.yml <<'EOF'
   defaults:
     branch: staging
   EOF
   ```

3. **Deploy with flag:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --branch main
   ```

**Expected behavior:**
- Should use `main` branch (from flag)
- Should NOT use `staging` (from config)
- Should NOT use `develop` (from env)

**Precedence order (highest to lowest):**
1. CLI flags
2. Environment variables
3. Instance-specific config
4. Default config
5. Built-in defaults

---

## Automated Testing Strategy

### Unit Testing (Future)

Currently, clawctl has **no unit tests**. This section outlines a strategy for adding them.

#### What to Unit Test

**Good candidates for unit testing:**

1. **Configuration parsing** (`src/lib/config.ts`)
   - Test config merging precedence
   - Test environment variable parsing
   - Test path expansion
   - Test IP validation
   - Test SSH key validation

2. **Template generation** (`src/templates/docker-compose.ts`)
   - Test variable substitution
   - Test output format
   - Test edge cases (special characters)

3. **State management** (`src/lib/state.ts`)
   - Test state creation
   - Test phase updates
   - Test progress calculation
   - Test state age calculation

4. **Utility functions** (`src/lib/logger.ts`)
   - Test color formatting
   - Test message formatting
   - Test verbose mode

**Example unit test structure (using Jest):**

```typescript
// src/lib/config.test.ts
import { validateIP, expandPath } from './config.js'

describe('validateIP', () => {
  test('accepts valid IP addresses', () => {
    expect(validateIP('192.168.1.100')).toBe(true)
    expect(validateIP('10.0.0.1')).toBe(true)
  })

  test('rejects invalid IP addresses', () => {
    expect(validateIP('256.1.1.1')).toBe(false)
    expect(validateIP('192.168.1')).toBe(false)
    expect(validateIP('not-an-ip')).toBe(false)
  })
})

describe('expandPath', () => {
  test('expands tilde paths', () => {
    const home = process.env.HOME
    expect(expandPath('~/test')).toBe(`${home}/test`)
  })

  test('resolves relative paths', () => {
    expect(expandPath('./test')).toContain('test')
  })
})
```

#### Mocking SSH Operations

**Challenge:** Most operations require SSH connection to a real server.

**Solution:** Mock the SSH client for unit tests.

**Example mock:**

```typescript
// src/lib/ssh-client.mock.ts
export class MockSSHClient implements SSHClient {
  async exec(command: string): Promise<ExecResult> {
    // Return fake results based on command
    if (command === 'id -u') {
      return { exitCode: 0, stdout: '0', stderr: '' }
    }
    if (command === 'docker --version') {
      return { exitCode: 0, stdout: 'Docker version 27.4.1', stderr: '' }
    }
    return { exitCode: 0, stdout: '', stderr: '' }
  }

  async uploadContent(content: string, path: string): Promise<void> {
    // Simulate successful upload
  }

  // ... other methods
}
```

**Usage in tests:**

```typescript
// src/commands/deploy.test.ts
import { MockSSHClient } from '../lib/ssh-client.mock.js'
import * as dockerSetup from '../lib/docker-setup.js'

describe('dockerSetup', () => {
  test('installs Docker successfully', async () => {
    const ssh = new MockSSHClient()
    await dockerSetup.installDocker(ssh)
    // Verify Docker was installed
  })
})
```

---

### Integration Testing (Future)

Integration tests would test the full deployment flow against a real (or simulated) server.

#### Docker-in-Docker Test Environment

**Concept:** Use Docker to create an SSH-accessible container that simulates an Ubuntu server.

**Example setup:**

```dockerfile
# test/Dockerfile
FROM ubuntu:24.04

# Install SSH server
RUN apt-get update && apt-get install -y openssh-server sudo

# Create root .ssh directory
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

# Add test SSH key
COPY test_key.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Start SSH daemon
RUN mkdir -p /run/sshd
CMD ["/usr/sbin/sshd", "-D"]
```

**Run test server:**

```bash
# Build test container
docker build -t clawctl-test-server test/

# Run test server with Docker socket mounted
docker run -d \
  --name test-server \
  -p 2222:22 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --privileged \
  clawctl-test-server

# Run integration tests
npm run test:integration
```

**Integration test example:**

```typescript
// test/integration/deploy.test.ts
describe('Full deployment', () => {
  test('deploys to test server successfully', async () => {
    const result = await runCLI([
      'deploy', 'localhost',
      '--port', '2222',
      '--key', './test/test_key',
      '--skip-onboard'
    ])

    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('✅ Deployment complete')

    // Verify containers are running
    const containers = await exec('ssh -p 2222 -i test/test_key root@localhost "docker ps"')
    expect(containers).toContain('openclaw-gateway')
  })
})
```

#### CI/CD Integration

**GitHub Actions workflow example:**

```yaml
# .github/workflows/test.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Start test server
        run: |
          docker build -t clawctl-test-server test/
          docker run -d --name test-server -p 2222:22 \
            -v /var/run/docker.sock:/var/run/docker.sock \
            --privileged clawctl-test-server
          sleep 5

      - name: Run integration tests
        run: npm run test:integration

      - name: Stop test server
        run: docker stop test-server
```

---

### Current Manual Testing Checklist

Until automated tests exist, use this checklist before releases.

#### Pre-Release Testing Checklist

**Required tests:**

- [ ] **Fresh deployment** on Ubuntu 24.04
- [ ] **Fresh deployment** on Ubuntu 22.04
- [ ] **Fresh deployment** on Ubuntu 20.04
- [ ] **Resume after failure** (kill mid-deployment, resume)
- [ ] **Idempotency** (run twice on same server)
- [ ] **Auto-connect feature** (test Y and n responses)
- [ ] **--force flag** (ignore state, restart)
- [ ] **--clean flag** (remove everything)
- [ ] **--skip-onboard flag** (skip onboarding)
- [ ] **--verbose flag** (detailed output)
- [ ] **Custom branch** (test with non-main branch)
- [ ] **Custom name** (test with custom instance name)
- [ ] **Error messages** (test with wrong IP, wrong key, etc.)

**Platform tests:**

- [ ] Test on **Linux** (native)
- [ ] Test on **macOS**
- [ ] Test on **WSL** (Windows Subsystem for Linux)

**Network tests:**

- [ ] Test with **slow connection** (high latency)
- [ ] Test with **SSH on custom port** (--port 2222)

**Edge cases:**

- [ ] Server with **low disk space**
- [ ] Server with **low memory** (1GB)
- [ ] Server with **existing Docker installation**
- [ ] Server with **existing roboclaw user**

#### Regression Testing Scenarios

Test these scenarios whenever making major changes:

1. **Basic happy path:** Fresh deployment, default settings
2. **Custom configuration:** All flags used together
3. **Error recovery:** Network failure, permission errors, build failures
4. **State management:** Pause and resume at each phase
5. **Cleanup:** --clean removes all traces

---

## Destructive Operations

### Using --clean Safely

#### What --clean Does

The `--clean` flag removes:
1. **All Docker containers** (running and stopped)
2. **OpenClaw Docker images**
3. **roboclaw user** and all their files (`/home/roboclaw`)
4. **Build directories** (`/root/openclaw-build`, `/root/docker`)
5. **Deployment state files**

#### When to Use It

Use `--clean` when:
- You want to completely reset the server
- Previous deployment is corrupted beyond repair
- You're testing the cleanup logic itself
- You want to ensure a 100% fresh start

**Never use `--clean` on:**
- Production servers
- Servers with valuable data
- Shared test servers (without team approval)

#### Warnings and Confirmations

**Current behavior:** `--clean` executes immediately without confirmation.

**⚠️ Future improvement:** Should add confirmation prompt:
```
⚠️  This will permanently delete:
  - All OpenClaw containers and images
  - User 'roboclaw' and /home/roboclaw
  - All deployment state

Type 'yes' to confirm:
```

#### Safe Usage Example

```bash
# On a disposable test server only!
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --clean \
  --verbose
```

**Verify cleanup:**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "
  docker ps -a
  id roboclaw
  ls /home/
"
```

Expected results:
- No containers
- User "roboclaw" not found
- `/home/roboclaw` doesn't exist

---

### Using --force Safely

#### What --force Does

The `--force` flag:
1. **Deletes the deployment state file**
2. **Starts deployment from Phase 0**
3. **Does NOT remove existing infrastructure** (Docker, containers, users)

#### State Implications

**Without --force:**
- Resumes from last completed phase
- Skips already-completed work
- Preserves state for recovery

**With --force:**
- Ignores state entirely
- Re-runs all phases
- May conflict with existing resources

#### When It's Needed

Use `--force` when:
- State file is corrupted
- You want to re-run all phases
- Resume logic is broken (bug)
- Manual changes were made to server

#### Potential Issues

**Conflict scenarios:**

1. **roboclaw user already exists:**
   - Phase 4 may fail or warn
   - Current implementation: idempotent, skips if exists

2. **Docker already installed:**
   - Phase 3 should be idempotent
   - Current implementation: re-runs apt commands safely

3. **Containers already running:**
   - Phase 8 may fail if ports are in use
   - Workaround: Stop containers first with `--clean`

#### Safe Usage Example

```bash
# Use --force to restart a stuck deployment
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --force \
  --verbose
```

**When to combine --clean and --force:**
```bash
# Complete reset: remove everything and restart
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --clean \
  --force
```

---

### Recovering from Mistakes

#### Manual Cleanup After Failed Deployment

If deployment fails and leaves the server in a bad state:

**Step 1: Stop all containers**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker stop \$(docker ps -aq) 2>/dev/null || true"
```

**Step 2: Remove all containers**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker rm \$(docker ps -aq) 2>/dev/null || true"
```

**Step 3: Remove OpenClaw images**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "docker rmi \$(docker images -q 'roboclaw/openclaw*') 2>/dev/null || true"
```

**Step 4: Remove roboclaw user**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "userdel -r roboclaw 2>/dev/null || true"
```

**Step 5: Remove build directories**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "rm -rf /root/openclaw-build /root/docker 2>/dev/null || true"
```

**Step 6: Delete state files**
```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "rm -f /root/.clawctl-deploy-state.json /home/roboclaw/.clawctl-deploy-state.json 2>/dev/null || true"
```

**All-in-one cleanup script:**
```bash
#!/bin/bash
# cleanup.sh - Clean up failed clawctl deployment

IP="$1"
KEY="$2"

if [ -z "$IP" ] || [ -z "$KEY" ]; then
  echo "Usage: $0 <IP> <SSH_KEY>"
  exit 1
fi

echo "Cleaning up clawctl deployment on $IP..."

ssh -i "$KEY" root@"$IP" << 'ENDSSH'
  # Stop and remove containers
  docker stop $(docker ps -aq) 2>/dev/null || true
  docker rm $(docker ps -aq) 2>/dev/null || true

  # Remove images
  docker rmi $(docker images -q 'roboclaw/openclaw*') 2>/dev/null || true

  # Remove user
  userdel -r roboclaw 2>/dev/null || true

  # Remove directories
  rm -rf /root/openclaw-build /root/docker 2>/dev/null || true

  # Remove state
  rm -f /root/.clawctl-deploy-state.json /home/roboclaw/.clawctl-deploy-state.json 2>/dev/null || true

  echo "Cleanup complete!"
ENDSSH
```

Usage:
```bash
chmod +x cleanup.sh
./cleanup.sh 192.168.1.100 ~/.ssh/clawctl_test_key
```

#### Resetting to Clean State

**Option 1: Use --clean flag**
```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --clean
```

**Option 2: Restore from snapshot**
- Fastest method if you have a clean snapshot
- See [Test Server Setup](#test-server-setup) for snapshot workflow

**Option 3: Manual cleanup + deploy**
```bash
# Clean up manually
./cleanup.sh 192.168.1.100 ~/.ssh/clawctl_test_key

# Deploy fresh
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key
```

---

## Performance Testing

### Deployment Time

#### Expected Time Per Phase

| Phase | Operation | Fast Network | Slow Network |
|-------|-----------|--------------|--------------|
| 0 | Validation | < 1s | < 1s |
| 1 | SSH Connection | 2-5s | 5-10s |
| 2 | Install Base Packages | 10-30s | 30-60s |
| 3 | Install Docker | 30-60s | 60-120s |
| 4 | Setup User | 2-5s | 2-5s |
| 5 | Create Directories | 1-2s | 1-2s |
| 6 | Build Image | 2-4 min | 4-8 min |
| 7 | Upload Compose | 1-2s | 2-5s |
| 8 | Onboarding | 30-60s | 60-120s |
| 9 | Create Artifact | < 1s | < 1s |
| 10 | Finalize | 1-2s | 1-2s |

**Total (Fast Network):** 5-8 minutes
**Total (Slow Network):** 10-15 minutes

#### Factors Affecting Speed

1. **Network bandwidth:**
   - Git clone (OpenClaw repo ~500MB)
   - Docker installation (packages ~100MB)
   - Docker image layers (base images ~200MB)

2. **Server CPU:**
   - Docker image build (compile code)
   - More CPU cores = faster build

3. **Server disk I/O:**
   - Image layer extraction
   - File system operations
   - SSD vs HDD makes a big difference

4. **Geographic location:**
   - Latency to server
   - Latency to package mirrors (apt, Docker Hub)

#### How to Measure and Profile

**Basic timing:**

```bash
time node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --skip-onboard
```

**Per-phase timing:**

Add timing to verbose output (code modification needed):

```typescript
// In deploy.ts, before each phase:
const startTime = Date.now()

// After each phase:
const duration = Date.now() - startTime
logger.verbose(`Phase ${n} completed in ${duration}ms`)
```

**Network profiling:**

Monitor network usage during deployment:

```bash
# On Linux
iftop -i eth0

# On macOS
nettop
```

**Server-side profiling:**

Monitor server resources:

```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "
  # CPU usage
  mpstat 1 &

  # Disk I/O
  iostat 1 &

  # Network
  iftop
"
```

---

### Network Usage

#### What Gets Downloaded

| Component | Size | Phase | Source |
|-----------|------|-------|--------|
| Base packages (apt) | ~50MB | 2 | Ubuntu mirrors |
| Docker (apt) | ~100MB | 3 | Docker apt repo |
| Git clone OpenClaw | ~500MB | 6 | GitHub |
| Docker base images | ~200MB | 6 | Docker Hub |
| Docker build layers | ~100MB | 6 | Docker Hub |

**Total:** ~950MB to 1GB

#### Bandwidth Considerations

**Minimum recommended:** 10 Mbps download

**Deployment time estimates:**

| Bandwidth | Total Download Time |
|-----------|---------------------|
| 10 Mbps | ~13 minutes |
| 50 Mbps | ~3 minutes |
| 100 Mbps | ~1.5 minutes |
| 1 Gbps | ~10 seconds |

**Note:** Actual deployment time is higher due to:
- Build time (CPU-bound, not network-bound)
- Multiple round-trips for SSH commands
- Sequential operations

#### Reducing Network Usage

**Ideas for future optimization:**

1. **Cache Docker base images** on server between deployments
2. **Use shallow Git clone** (`--depth 1`) to reduce clone size
3. **Pre-build images** and pull from registry instead of building on server
4. **Compress artifacts** before upload

---

## Platform-Specific Testing

### Testing on WSL

Windows Subsystem for Linux (WSL) has some quirks.

#### SSH Agent Considerations

**Issue:** SSH agent forwarding may not work properly in WSL1.

**Solution for WSL2:**
```bash
# Start SSH agent
eval $(ssh-agent -s)

# Add key
ssh-add ~/.ssh/clawctl_test_key

# Verify
ssh-add -l
```

**Alternative:** Always specify key path explicitly with `--key` flag.

#### Path Handling

**Issue:** Windows paths vs Linux paths.

**WSL path mapping:**
```bash
# Windows path: C:\Users\user\.ssh\key
# WSL path: /mnt/c/Users/user/.ssh/key

# Prefer storing keys in WSL home directory:
~/.ssh/clawctl_test_key  # /home/user/.ssh/clawctl_test_key
```

**Recommendation:** Keep all SSH keys in WSL filesystem for better performance and permissions.

#### Known Issues

1. **Line endings:** Use LF, not CRLF
   ```bash
   git config --global core.autocrlf input
   ```

2. **File permissions:** WSL may not respect chmod on `/mnt/c/`
   - Solution: Store keys in `~/.ssh/` (WSL filesystem)

3. **Network:** WSL2 uses NAT, may have different IP than Windows host

**Testing checklist for WSL:**

- [ ] Build works (`npm run build`)
- [ ] SSH connection works
- [ ] SSH key permissions are correct (`ls -la ~/.ssh/`)
- [ ] Auto-connect browser opening works (should open Windows browser)
- [ ] Path handling works (no `/mnt/c/` errors)

---

### Testing on macOS

#### SSH Key Permissions

macOS is strict about SSH key permissions.

**Correct permissions:**
```bash
chmod 600 ~/.ssh/clawctl_test_key
chmod 700 ~/.ssh/
```

**Check permissions:**
```bash
ls -la ~/.ssh/
# Should show: -rw------- for keys
```

**Common error:**
```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Permissions 0644 for '/Users/user/.ssh/key' are too open.
```

**Fix:**
```bash
chmod 600 /Users/user/.ssh/key
```

#### Browser Opening

**Auto-connect uses `open` command on macOS:**

```bash
open http://localhost:18789
```

**Test manually:**
```bash
open http://localhost:18789
# Should open default browser
```

**If not working:**
- Check that `open` command exists: `which open`
- Check that default browser is set: System Preferences → General → Default web browser

#### macOS-Specific Issues

1. **Firewall:** macOS firewall may block SSH tunnel
   - Solution: Allow incoming connections for SSH
   - System Preferences → Security & Privacy → Firewall

2. **SSH config:** May interfere with clawctl
   - Check `~/.ssh/config` for conflicting settings

3. **Case sensitivity:** macOS filesystem is case-insensitive by default
   - Rarely an issue, but be aware

**Testing checklist for macOS:**

- [ ] Build works
- [ ] SSH connection works
- [ ] SSH key permissions checked
- [ ] Auto-connect opens Safari/Chrome
- [ ] Firewall allows SSH tunnel
- [ ] No conflicts in `~/.ssh/config`

---

### Testing on Linux

#### Browser Opening

**Auto-connect uses `xdg-open` command on Linux:**

```bash
xdg-open http://localhost:18789
```

**Test manually:**
```bash
xdg-open http://localhost:18789
# Should open default browser
```

**If not working:**

1. **Check if xdg-utils is installed:**
   ```bash
   which xdg-open
   ```

   If not:
   ```bash
   sudo apt install xdg-utils  # Ubuntu/Debian
   sudo yum install xdg-utils  # CentOS/RHEL
   ```

2. **Check default browser:**
   ```bash
   xdg-settings get default-web-browser
   ```

3. **Set default browser:**
   ```bash
   xdg-settings set default-web-browser firefox.desktop
   ```

#### Desktop Environment Differences

Different Linux desktop environments handle `xdg-open` differently:

| Desktop | Browser Command | Notes |
|---------|-----------------|-------|
| GNOME | `gnome-open` | xdg-open calls this |
| KDE | `kde-open` | xdg-open calls this |
| XFCE | `exo-open` | xdg-open calls this |
| Headless | `w3m`, `lynx` | Text browsers only |

**Headless server workaround:**

If testing on a headless Linux server (no GUI):

```bash
# SSH with X11 forwarding
ssh -X user@localhost

# Or use curl to test gateway
curl http://localhost:18789
```

#### Linux-Specific Issues

1. **Headless environment:** No browser to open
   - Auto-connect will fail to open browser
   - Solution: Use `--no-auto-connect` and create tunnel manually

2. **Port conflicts:** Port 18789 may be in use
   - Check: `netstat -tlnp | grep 18789`
   - Solution: Use different port (future: add `--port` flag to deploy)

3. **SELinux:** May block SSH operations
   - Check: `sestatus`
   - Solution: Disable SELinux temporarily for testing

**Testing checklist for Linux:**

- [ ] Build works
- [ ] SSH connection works
- [ ] `xdg-open` installed and works
- [ ] Default browser set
- [ ] Auto-connect opens browser (if GUI available)
- [ ] Tunnel works on headless (manual SSH tunnel)

---

## Testing Checklist

### Testing a New Feature

Before merging a PR that adds a new feature:

- [ ] **Build succeeds** without errors
- [ ] **Feature works** on fresh deployment
- [ ] **Feature works** with existing deployment (if applicable)
- [ ] **--verbose shows** relevant debug info
- [ ] **Error messages** are clear and actionable
- [ ] **Documentation updated** (README.md, specs)
- [ ] **Memory updated** with any gotchas or patterns

**Platform testing:**
- [ ] Tested on **Linux** (native or VM)
- [ ] Tested on **macOS** OR verified no platform-specific code
- [ ] Tested on **WSL** OR verified no platform-specific code

**Flag testing:**
- [ ] Feature works with **--force**
- [ ] Feature works with **--clean**
- [ ] Feature works with **--verbose**
- [ ] Feature works with **--skip-onboard** (if applicable)

---

### Testing a Bug Fix

Before merging a PR that fixes a bug:

- [ ] **Bug reproduced** on current version
- [ ] **Fix verified** - bug no longer occurs
- [ ] **Regression test** - fix doesn't break other features
- [ ] **Error handling** improved or added
- [ ] **Root cause** understood and documented

**Verification:**
- [ ] Manual test of bug scenario
- [ ] Test with **--verbose** to see fix in action
- [ ] Test on same platform where bug was found

---

### Pre-Release Testing

Before publishing a new version to npm:

**Build verification:**
- [ ] `npm run clean` succeeds
- [ ] `npm run build` succeeds
- [ ] `node dist/index.js --version` shows correct version
- [ ] `node dist/index.js --help` shows correct help text

**Core functionality:**
- [ ] Fresh deployment succeeds on Ubuntu 24.04
- [ ] Fresh deployment succeeds on Ubuntu 22.04
- [ ] Resume after failure works
- [ ] --clean flag works
- [ ] --force flag works
- [ ] --skip-onboard flag works
- [ ] --verbose flag works
- [ ] Auto-connect feature works

**Edge cases:**
- [ ] Deploy with custom name
- [ ] Deploy with custom branch
- [ ] Deploy with custom SSH port
- [ ] Deploy to server with low resources (1GB RAM)
- [ ] Error messages are helpful

**Platform testing:**
- [ ] Test on Linux
- [ ] Test on macOS
- [ ] Test on WSL

**Package verification:**
- [ ] Test with `npx clawctl@latest`
- [ ] Test global install: `npm install -g clawctl`
- [ ] Verify package size is reasonable: `npm pack --dry-run`

**Documentation:**
- [ ] README.md is up to date
- [ ] CHANGELOG.md updated (if it exists)
- [ ] Version number incremented in package.json
- [ ] No outdated references to old versions

---

### Regression Testing

Run these scenarios to catch regressions:

**Scenario 1: Happy path**
- Fresh Ubuntu 24.04 server
- Default flags
- Should complete in < 10 minutes
- All containers running
- Gateway accessible

**Scenario 2: Custom everything**
- Custom name: `--name custom-test`
- Custom branch: `--branch develop`
- Custom port: `--port 2222`
- Skip onboarding: `--skip-onboard`
- Should work without errors

**Scenario 3: Error recovery**
- Start deployment
- Kill at Phase 5
- Resume
- Should continue from Phase 6
- Should complete successfully

**Scenario 4: Clean deployment**
- Deploy once
- Run `--clean`
- Deploy again
- Should work identically to first deployment

**Scenario 5: Idempotency**
- Deploy once
- Deploy again with `--force`
- Should handle existing resources gracefully

---

## Common Test Scenarios

Detailed step-by-step instructions for common testing scenarios.

### 1. Fresh Deployment Test

**Goal:** Verify a complete fresh deployment works.

**Prerequisites:**
- Fresh Ubuntu 24.04 VPS
- SSH access with root key
- Internet connection

**Steps:**

1. **Build the latest code:**
   ```bash
   cd roboclaw/clawctl
   npm run build
   ```

2. **Run deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name fresh-test \
     --verbose
   ```

3. **Monitor output for all phases:**
   - Phase 0: Validation
   - Phase 1: SSH Connection
   - Phase 2: Install Base Packages
   - Phase 3: Install Docker
   - Phase 4: Setup Deployment User
   - Phase 5: Create Directories
   - Phase 6: Build OpenClaw Image
   - Phase 7: Upload Docker Compose
   - Phase 8: Onboarding & Gateway Startup
   - Phase 9: Create Instance Artifact
   - Phase 10: Finalize Deployment

4. **Verify success message:**
   ```
   ✅ Deployment complete!
   ```

5. **Check containers:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps"
   ```

   Expected: openclaw-gateway running

6. **Check instance artifact:**
   ```bash
   cat instances/fresh-test.yml
   ```

   Should contain valid YAML with deployment details.

7. **Test auto-connect (if prompted):**
   - Press Y
   - Browser should open
   - Dashboard should be accessible
   - Press Ctrl+C to exit

**Expected Duration:** 5-10 minutes

**Success Criteria:**
- All phases complete without errors
- Gateway container is running
- Instance artifact created
- Auto-connect works (if enabled)

---

### 2. Resume After Failure Test

**Goal:** Verify resume capability after unexpected interruption.

**Prerequisites:**
- Fresh Ubuntu 24.04 VPS
- SSH access

**Steps:**

1. **Start deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name resume-test \
     --verbose
   ```

2. **Wait for Phase 5 to complete** (watch output)

3. **Kill the process:**
   Press `Ctrl+C`

4. **Verify state was saved:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat /home/roboclaw/.clawctl-deploy-state.json | jq ."
   ```

   Should show:
   ```json
   {
     "lastPhase": 5,
     "phases": {
       "1": "complete",
       "2": "complete",
       "3": "complete",
       "4": "complete",
       "5": "complete",
       "6": "pending",
       ...
     }
   }
   ```

5. **Resume deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name resume-test \
     --verbose
   ```

6. **Verify resume behavior:**
   - Should show: "Detected partial deployment on server"
   - Should show: "Resuming from last checkpoint..."
   - Phases 1-5 should show: "(skip - already complete)"
   - Should start executing at Phase 6

7. **Wait for completion**

8. **Verify success**

**Expected Duration:**
- First attempt: ~3 minutes (until killed)
- Resume: ~5-7 minutes (remaining phases)

**Success Criteria:**
- State file preserved after kill
- Resume continues from correct phase
- Phases 1-5 are skipped
- Deployment completes successfully

---

### 3. Idempotency Test (Run Twice)

**Goal:** Verify running deployment twice doesn't break things.

**Prerequisites:**
- Fresh Ubuntu 24.04 VPS

**Steps:**

1. **First deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name idempotent-test
   ```

2. **Wait for completion**

3. **Verify success:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps"
   ```

4. **Second deployment (with --force):**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name idempotent-test \
     --force
   ```

5. **Monitor for errors:**
   - Phase 3 (Docker install) should handle existing installation
   - Phase 4 (User setup) should handle existing user
   - Phase 6 (Build image) should rebuild or use existing
   - Phase 8 (Gateway) should restart container

6. **Verify still works:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps"
   ```

**Expected Duration:**
- First run: 5-10 minutes
- Second run: 5-10 minutes (similar, not faster due to --force)

**Success Criteria:**
- Both runs complete successfully
- No errors about "already exists"
- Gateway still running after second deployment

**Note:** Current implementation may not be fully idempotent without `--force`. This is a known limitation.

---

### 4. Clean Deployment Test

**Goal:** Verify --clean removes all traces and allows fresh start.

**⚠️ Only run on disposable test servers!**

**Prerequisites:**
- Existing deployment on test server

**Steps:**

1. **Verify existing deployment:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "
     docker ps
     id roboclaw
     ls /home/roboclaw
   "
   ```

   Should show containers, user, and files.

2. **Run clean deployment:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name clean-test \
     --clean \
     --verbose
   ```

3. **Verify cleanup warnings:**
   Should show:
   ```
   ⚠️  Clean deployment requested

   This will remove:
     - All Docker containers and images
     - roboclaw user and all files
     - Deployment state
   ```

4. **Watch cleanup:**
   Should show:
   ```
   ℹ Cleaning previous deployment...
   ✓ Cleanup complete
   ```

5. **Verify cleanup succeeded:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "
     docker ps -a
     docker images
     id roboclaw 2>&1
     ls /home/ | grep roboclaw
   "
   ```

   Expected results:
   - No containers
   - No OpenClaw images
   - "id: 'roboclaw': no such user"
   - No /home/roboclaw

6. **Watch fresh deployment complete**

7. **Verify new deployment works:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps"
   ```

**Expected Duration:**
- Cleanup: < 1 minute
- Fresh deployment: 5-10 minutes

**Success Criteria:**
- All previous containers removed
- roboclaw user removed
- Fresh deployment succeeds
- New containers running

---

### 5. Skip Onboarding Test

**Goal:** Verify deployment works without interactive onboarding.

**Use case:** Automated deployments, CI/CD pipelines.

**Prerequisites:**
- Fresh Ubuntu 24.04 VPS

**Steps:**

1. **Deploy with --skip-onboard:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name skip-onboard-test \
     --skip-onboard \
     --verbose
   ```

2. **Verify no interactive prompts appear**

3. **Monitor Phase 8:**
   Should show:
   ```
   Phase 8: Onboarding & Gateway Startup
   ℹ Skipping interactive onboarding
   ✓ Gateway started
   ```

   Should NOT show interactive wizard.

4. **Verify deployment completes**

5. **Check gateway status:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 "docker ps | grep gateway"
   ```

6. **Check for token in .env:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat /home/roboclaw/docker/.env | grep GATEWAY_TOKEN"
   ```

   May be empty or have placeholder value.

**Expected Duration:** 5-8 minutes (faster without onboarding)

**Success Criteria:**
- No interactive prompts
- Deployment completes
- Gateway container running
- Can manually run onboarding later if needed

**Note:** Without onboarding, the gateway may not be fully configured. Manual onboarding may be required for full functionality.

---

### 6. Custom Configuration Test

**Goal:** Test all customization options together.

**Prerequisites:**
- Fresh Ubuntu 24.04 VPS on non-standard SSH port

**Steps:**

1. **Deploy with all custom options:**
   ```bash
   node dist/index.js deploy 192.168.1.100 \
     --key ~/.ssh/clawctl_test_key \
     --name production-east \
     --user root \
     --port 2222 \
     --branch develop \
     --skip-onboard \
     --no-auto-connect \
     --verbose
   ```

2. **Verify custom values in output:**
   ```
   Target: 192.168.1.100
   Instance: production-east
   SSH User: root
   SSH Key: /home/user/.ssh/clawctl_test_key
   SSH Port: 2222
   Branch: develop
   ```

3. **Monitor deployment**

4. **Verify correct branch was used:**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key -p 2222 root@192.168.1.100 \
     "cd /home/roboclaw/openclaw-build && git branch"
   ```

   Should show: `* develop`

5. **Verify instance artifact:**
   ```bash
   cat instances/production-east.yml | grep -E 'name|branch'
   ```

   Should show:
   ```yaml
   instanceName: production-east
   branch: develop
   ```

6. **Verify no auto-connect prompt**

**Expected Duration:** 5-8 minutes

**Success Criteria:**
- All custom options respected
- Correct branch deployed
- Instance name is "production-east"
- No auto-connect prompt appeared

---

### 7. Error Handling Test

**Goal:** Verify error messages are helpful and recovery is possible.

#### Test 7a: Invalid IP Address

```bash
node dist/index.js deploy 999.999.999.999 \
  --key ~/.ssh/clawctl_test_key
```

**Expected output:**
```
✗ Invalid IP address format

Details:
  - Provided: 999.999.999.999

Example: 192.168.1.100
```

**Success criteria:** Clear error, no stack trace, exit code 1

#### Test 7b: Missing SSH Key

```bash
node dist/index.js deploy 192.168.1.100 \
  --key /nonexistent/key
```

**Expected output:**
```
✗ SSH key validation failed

Details:
  - Key path: /nonexistent/key

SSH key not found: /nonexistent/key

Check that the file exists and is readable
```

**Success criteria:** Clear error, helpful message, exit code 1

#### Test 7c: Wrong SSH Key

```bash
node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/wrong_key
```

**Expected output:**
```
✗ Deployment failed: SSH connection failed after 3 attempts: ...
```

**Success criteria:** Connection attempts shown, clear error, resume possible

#### Test 7d: Network Failure During Deployment

1. Start deployment
2. During Phase 6, disconnect WiFi
3. Wait for timeout
4. Reconnect WiFi
5. Resume deployment

**Expected behavior:**
- Timeout with clear error
- State preserved
- Resume works after reconnection

---

## Troubleshooting Test Failures

### Test Server Won't Accept SSH

**Symptom:** Connection refused or timeout

**Checklist:**

1. **Is the server running?**
   ```bash
   ping 192.168.1.100
   ```

2. **Is SSH port open?**
   ```bash
   nmap -p 22 192.168.1.100
   # or
   nc -zv 192.168.1.100 22
   ```

3. **Is firewall blocking?**
   - Check provider firewall rules
   - Check server firewall: `ufw status`

4. **Is SSH service running?**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "systemctl status ssh"
   ```

5. **Are keys authorized?**
   ```bash
   ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
     "cat ~/.ssh/authorized_keys"
   ```

**Solutions:**

- Add firewall rule for SSH (port 22)
- Restart SSH service: `systemctl restart ssh`
- Re-add SSH key: `ssh-copy-id`
- Check `/var/log/auth.log` on server for clues

---

### Build Fails Locally

**Symptom:** `npm run build` fails with TypeScript errors

**Checklist:**

1. **Is Node.js version correct?**
   ```bash
   node --version  # Should be 18+
   ```

2. **Are dependencies installed?**
   ```bash
   npm install
   ```

3. **Are there type errors?**
   ```bash
   npm run build 2>&1 | grep error
   ```

4. **Is tsconfig.json valid?**
   ```bash
   cat tsconfig.json
   ```

**Common issues:**

- **Missing .js extensions in imports:**
  ```typescript
  // Wrong
  import { foo } from './bar'

  // Correct
  import { foo } from './bar.js'
  ```

- **Type errors:**
  ```bash
  # Fix by adding types or using `any`
  npm install --save-dev @types/node @types/ssh2
  ```

- **ES Modules syntax:**
  ```bash
  # Ensure package.json has:
  "type": "module"
  ```

---

### Deployment Hangs at Specific Phase

**Symptom:** Deployment stops progressing, no output

**Identify which phase:**

```bash
# Check state file
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/.clawctl-deploy-state.json | jq .lastPhase"
```

**Phase-specific troubleshooting:**

**Phase 3 (Docker install):**
- Check for apt locks: `ps aux | grep apt`
- Check logs: `tail -f /var/log/dpkg.log`
- Kill and retry: Ctrl+C, resume

**Phase 6 (Image build):**
- Very long phase (2-5 minutes), be patient
- Check Docker build progress:
  ```bash
  ssh root@IP "docker ps | grep build"
  ```
- Check disk space: `df -h`

**Phase 8 (Onboarding):**
- PTY session may hang
- Check container logs:
  ```bash
  ssh root@IP "docker logs openclaw-onboard"
  ```
- Try `--skip-onboard` instead

**General solutions:**

- Wait longer (some phases take minutes)
- Use `--verbose` to see what's happening
- Kill and resume
- Check server resources: `top`, `df -h`

---

### State File Corruption

**Symptom:** Resume doesn't work, strange phase behavior

**Diagnosis:**

```bash
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "cat /home/roboclaw/.clawctl-deploy-state.json | jq ."
```

**Common issues:**

1. **Invalid JSON:**
   ```
   parse error: Invalid numeric literal at line 1, column 10
   ```

2. **Missing fields:**
   ```json
   {
     "lastPhase": 5
     // Missing "phases" object
   }
   ```

3. **Wrong phase numbers:**
   ```json
   {
     "lastPhase": 15  // Should be 0-10
   }
   ```

**Solution:**

```bash
# Delete corrupted state and restart with --force
ssh -i ~/.ssh/clawctl_test_key root@192.168.1.100 \
  "rm /home/roboclaw/.clawctl-deploy-state.json"

node dist/index.js deploy 192.168.1.100 \
  --key ~/.ssh/clawctl_test_key \
  --force
```

---

### Docker Issues on Remote Server

**Symptom:** Docker commands fail or containers won't start

**Common issues:**

1. **Docker not installed:**
   ```bash
   ssh root@IP "docker --version"
   # command not found
   ```

   Solution: Re-run deployment, Phase 3 will install Docker

2. **Docker daemon not running:**
   ```bash
   ssh root@IP "systemctl status docker"
   # inactive (dead)
   ```

   Solution:
   ```bash
   ssh root@IP "systemctl start docker"
   ```

3. **Permission denied:**
   ```bash
   ssh root@IP "sudo -u roboclaw docker ps"
   # permission denied
   ```

   Solution: Re-add to docker group
   ```bash
   ssh root@IP "usermod -aG docker roboclaw"
   ```

4. **Out of disk space:**
   ```bash
   ssh root@IP "df -h"
   # /dev/vda1  100%  Used
   ```

   Solution: Clean up Docker
   ```bash
   ssh root@IP "docker system prune -af"
   ```

5. **Port conflicts:**
   ```bash
   ssh root@IP "netstat -tlnp | grep 18789"
   # Another process using port
   ```

   Solution: Stop the conflicting process or use different port

---

## Best Practices

### For Developers

1. **Always test on non-production servers**
   - Use cheap VPS providers
   - Use snapshots for quick reset
   - Never test on servers with important data

2. **Use snapshots for quick reset**
   - Create baseline snapshot after OS install
   - Create milestone snapshots (after Docker install, etc.)
   - Restore instead of manual cleanup

3. **Test both happy path and error cases**
   - Don't just test the success scenario
   - Intentionally break things and verify error handling
   - Test edge cases (low memory, slow network, etc.)

4. **Verify error messages are helpful**
   - Error messages should explain what went wrong
   - Error messages should suggest how to fix it
   - Error messages should not expose sensitive data

5. **Document new test scenarios**
   - If you find a new bug, add a test scenario for it
   - If you add a feature, add testing instructions
   - Update this guide when you learn something new

6. **Update this guide when adding features**
   - New flags need testing documentation
   - New phases need verification steps
   - New error cases need troubleshooting sections

### For Testing

1. **Start with --verbose always**
   - Verbose mode helps catch issues early
   - More information is better when testing
   - Production users can omit --verbose

2. **Keep test credentials separate**
   - Don't use production SSH keys for testing
   - Use dedicated test keys: `~/.ssh/clawctl_test_key`
   - Never commit keys to Git

3. **Clean up after tests**
   - Remove test instances
   - Delete test artifacts
   - Stop SSH tunnels

4. **Take notes during testing**
   - Record timing information
   - Note any warnings or odd behavior
   - Capture error messages for documentation

5. **Test on multiple platforms**
   - At minimum: Linux and macOS OR WSL
   - Ideally: All three (Linux, macOS, WSL)
   - Platform-specific bugs are common

### For CI/CD (Future)

1. **Automate regression tests**
   - Happy path should be automated
   - Run on every PR
   - Fail fast on errors

2. **Use matrix testing**
   - Test multiple Ubuntu versions
   - Test multiple Node.js versions
   - Test multiple platforms

3. **Monitor test duration**
   - Track how long tests take
   - Alert on slowdowns
   - Optimize slow tests

4. **Save test artifacts**
   - Logs from failed tests
   - State files
   - Container logs

---

## Reference

### Build Commands Quick Reference

```bash
# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Watch mode (rebuild on save)
npm run watch

# Clean build artifacts
npm run clean

# Clean + build
npm run clean && npm run build

# Run without building (for testing)
node dist/index.js <command>
```

---

### Deploy Commands Quick Reference

```bash
# Basic deployment
node dist/index.js deploy <IP> --key <path>

# With all common options
node dist/index.js deploy <IP> \
  --key <path> \
  --name <name> \
  --branch <branch> \
  --verbose

# Skip onboarding (for automation)
node dist/index.js deploy <IP> --key <path> --skip-onboard

# Force fresh deployment (ignore state)
node dist/index.js deploy <IP> --key <path> --force

# Clean everything first
node dist/index.js deploy <IP> --key <path> --clean

# Skip auto-connect
node dist/index.js deploy <IP> --key <path> --no-auto-connect

# Custom SSH port
node dist/index.js deploy <IP> --key <path> --port 2222

# Test published package
npx clawctl deploy <IP> --key <path>
```

---

### Debug Commands Quick Reference

```bash
# Check deployment state
ssh -i <key> root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json | jq ."

# Check containers
ssh -i <key> root@<IP> "docker ps -a"

# Check container logs
ssh -i <key> root@<IP> "docker logs openclaw-gateway"

# Check gateway status
ssh -i <key> root@<IP> "docker ps | grep gateway"

# Check roboclaw user
ssh -i <key> root@<IP> "id roboclaw"

# Check Docker installation
ssh -i <key> root@<IP> "docker --version"

# Check disk space
ssh -i <key> root@<IP> "df -h"

# Check running processes
ssh -i <key> root@<IP> "ps aux | grep docker"

# Check network ports
ssh -i <key> root@<IP> "netstat -tlnp"

# Check compose files
ssh -i <key> root@<IP> "ls -la /home/roboclaw/docker/"
ssh -i <key> root@<IP> "cat /home/roboclaw/docker/.env"

# Tail deployment logs (if logging to file)
ssh -i <key> root@<IP> "tail -f /var/log/clawctl.log"

# Manual cleanup
ssh -i <key> root@<IP> "
  docker stop \$(docker ps -aq) || true
  docker rm \$(docker ps -aq) || true
  docker rmi \$(docker images -q 'roboclaw/*') || true
  userdel -r roboclaw || true
  rm -rf /root/openclaw-build /root/docker || true
  rm -f /home/roboclaw/.clawctl-deploy-state.json || true
"
```

---

### Test Server Providers and Setup Links

#### DigitalOcean

- **Signup:** https://digitalocean.com
- **Pricing:** $6/month for 1GB RAM
- **Create Droplet:** Choose Ubuntu 24.04, add SSH key
- **Snapshots:** Available, $0.05/GB/month
- **Docs:** https://docs.digitalocean.com/products/droplets/

#### Hetzner Cloud

- **Signup:** https://hetzner.cloud
- **Pricing:** €4.50/month for 2GB RAM (best value)
- **Create Server:** Choose Ubuntu 24.04, add SSH key
- **Snapshots:** Available, €0.01/GB/month
- **Docs:** https://docs.hetzner.com/cloud/

#### Linode (Akamai)

- **Signup:** https://linode.com
- **Pricing:** $5/month for 1GB RAM
- **Create Linode:** Choose Ubuntu 24.04, add SSH key
- **Backups:** Available, $2/month
- **Docs:** https://www.linode.com/docs/

#### Vultr

- **Signup:** https://vultr.com
- **Pricing:** $6/month for 1GB RAM
- **Deploy Instance:** Choose Ubuntu 24.04, add SSH key
- **Snapshots:** Available, free
- **Docs:** https://www.vultr.com/docs/

#### Local Testing with Vagrant (Advanced)

```ruby
# Vagrantfile
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"  # Ubuntu 22.04
  config.vm.network "private_network", ip: "192.168.56.10"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
    vb.cpus = 2
  end
end
```

```bash
# Start VM
vagrant up

# Get SSH config
vagrant ssh-config

# Use with clawctl
node dist/index.js deploy 192.168.56.10 \
  --key ~/.vagrant.d/insecure_private_key \
  --port 2222
```

---

## Conclusion

This guide covered:
- Setting up a safe test environment
- Testing deployment features end-to-end
- Debugging common issues
- Platform-specific considerations
- Best practices for testing

**Key takeaways:**
1. Always test on disposable infrastructure
2. Use snapshots for quick reset
3. Test both success and failure scenarios
4. Document new test cases as you find them
5. Keep this guide updated

**Next steps:**
- Implement automated testing (unit + integration)
- Add more error recovery tests
- Document more edge cases
- Build CI/CD pipeline

---

**Happy testing!** 🧪🚀

If you find issues with this guide or discover new testing scenarios, please update this document or report them to the team.
