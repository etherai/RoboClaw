# Prompt: Create Troubleshooting Guide

## Your Task

Create a comprehensive troubleshooting guide at `specs/troubleshooting-guide.md` that helps users and developers diagnose and fix common clawctl deployment failures.

## Context

You're working on the **RoboClaw** project's **clawctl** tool (Node.js/TypeScript CLI that deploys OpenClaw via SSH and Docker). The deployment process has 11 phases (0-10), and failures can occur at any phase for various reasons.

**Problem:** When deployments fail, users and developers need:
1. Quick identification of what went wrong
2. Clear explanation of why it failed
3. Step-by-step recovery instructions
4. Prevention strategies

Currently this knowledge exists only in code and developer experience.

## What You Need to Research

Explore the codebase to understand:

1. **Deployment Phases:**
   - Phase 0: Pre-flight checks
   - Phase 1: SSH connection
   - Phase 2: System requirements check
   - Phase 3: Docker installation
   - Phase 4: User setup
   - Phase 5: Directory setup
   - Phase 6: Git clone and image build
   - Phase 7: Docker Compose setup
   - Phase 8: Interactive onboarding
   - Phase 9: Gateway startup
   - Phase 10: Auto-connect (optional)

2. **Error Handling:**
   - Look at error messages in each module
   - Exit codes and what they mean
   - State tracking and recovery
   - Idempotency checks

3. **Common Failure Points:**
   - SSH connection issues
   - Permission problems
   - Network failures
   - Docker installation issues
   - Git clone failures
   - Container startup problems
   - Port conflicts
   - Onboarding failures
   - Auto-connect issues

4. **Debugging Tools:**
   - `--verbose` flag output
   - State file inspection
   - Remote system inspection
   - Docker logs
   - System logs

5. **Recovery Strategies:**
   - When to use `--force`
   - When to use `--clean`
   - Manual cleanup steps
   - State file manipulation

## Where to Look

**Start here:**
- `clawctl/src/commands/deploy.ts` - All 11 phases, error handling
- `clawctl/src/lib/ssh-client.ts` - SSH errors
- `clawctl/src/lib/docker-setup.ts` - Docker installation errors
- `clawctl/src/lib/user-setup.ts` - User creation errors
- `clawctl/src/lib/image-builder.ts` - Git and Docker build errors
- `clawctl/src/lib/interactive.ts` - Onboarding errors
- `clawctl/src/lib/auto-connect.ts` - Auto-connect errors

**Also check:**
- Error messages throughout codebase
- Logger patterns (error, warn, info)
- State management and resume logic
- Idempotency checks that might fail

## Document Structure

Create `specs/troubleshooting-guide.md` with these sections:

### 1. Overview
- Purpose of this guide
- How to use it (symptom → diagnosis → solution)
- When to seek additional help

### 2. Quick Diagnosis

Provide a decision tree or table:

| Symptom | Likely Cause | Jump To |
|---------|-------------|---------|
| "Connection refused" | SSH/firewall issue | Phase 1 Errors |
| "Permission denied" | SSH key or user issue | Phase 1 Errors |
| "Docker installation failed" | Network or apt issue | Phase 3 Errors |
| "User already exists" | Previous failed deployment | Phase 4 Errors |
| "Git clone failed" | Network or auth issue | Phase 6 Errors |
| "Container won't start" | Port conflict or config | Phase 9 Errors |
| "Browser didn't open" | Platform or SSH tunnel issue | Phase 10 Errors |

### 3. General Troubleshooting Steps

#### Step 1: Enable Verbose Mode
```bash
clawctl deploy <IP> --key <path> --verbose
```
What verbose mode shows and how to interpret output.

#### Step 2: Check Remote State
How to SSH in and check:
- State file: `/home/roboclaw/.clawctl-deploy-state.json`
- Docker status: `docker ps`, `docker images`
- User exists: `id roboclaw`
- File permissions
- Process status

#### Step 3: Check Local Environment
- SSH key permissions (600 for private key)
- SSH agent issues
- Network connectivity
- Sufficient permissions

#### Step 4: Identify Phase
Which phase failed and what that means.

### 4. Phase-by-Phase Troubleshooting

For each phase (0-10), provide:

#### Phase X: [Phase Name]

**What This Phase Does:**
Brief explanation of the phase's purpose.

**Common Errors:**

##### Error: "[Specific error message]"

**Symptoms:**
- Exact error message shown
- Phase where it fails
- Additional context

**Causes:**
1. Most common cause
2. Second most common cause
3. Other possible causes

**Diagnosis:**
Step-by-step diagnostic commands:
```bash
# Check if X exists
ssh root@<IP> "command to verify"

# Verify Y configuration
ssh root@<IP> "command to check"
```

**Solution:**
Step-by-step fix:
```bash
# Step 1: Do this
command here

# Step 2: Verify
verification command

# Step 3: Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
How to avoid this error in future deployments.

---

### Example Detailed Troubleshooting Entry

#### Phase 1: SSH Connection

**What This Phase Does:**
Establishes SSH connection to remote server and verifies root access.

**Common Errors:**

##### Error: "Connection refused"

**Symptoms:**
```
✗ Failed to connect to 192.168.1.100:22
Error: Connection refused
```

**Causes:**
1. SSH server not running on remote
2. Firewall blocking port 22
3. Wrong IP address
4. Server is down

**Diagnosis:**
```bash
# Test connection manually
ssh -i ~/.ssh/mykey root@192.168.1.100

# Check if server is reachable
ping 192.168.1.100

# Try telnet to SSH port
telnet 192.168.1.100 22
```

**Solution:**

For firewall issues:
```bash
# On remote server (via console or other access):
sudo ufw allow 22/tcp
sudo ufw reload
```

For SSH not running:
```bash
# On remote server:
sudo systemctl start ssh
sudo systemctl enable ssh
```

For wrong IP:
```bash
# Verify correct IP and retry
clawctl deploy <CORRECT_IP> --key ~/.ssh/mykey
```

**Prevention:**
- Verify server IP before deploying
- Ensure SSH is enabled during server provisioning
- Keep firewall rules documented

---

##### Error: "Permission denied (publickey)"

**Symptoms:**
```
✗ SSH authentication failed
Error: All configured authentication methods failed
```

**Causes:**
1. Wrong SSH key provided
2. Key not authorized on remote
3. Key file permissions incorrect
4. Key requires passphrase but not provided

**Diagnosis:**
```bash
# Check key file permissions (should be 600)
ls -l ~/.ssh/mykey

# Test SSH with verbose output
ssh -vvv -i ~/.ssh/mykey root@192.168.1.100

# Verify key is correct type
ssh-keygen -l -f ~/.ssh/mykey
```

**Solution:**

For permission issues:
```bash
# Fix key permissions
chmod 600 ~/.ssh/mykey

# Retry deployment
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

For wrong/unauthorized key:
```bash
# Verify which keys are authorized on remote
ssh-copy-id -i ~/.ssh/correct_key root@192.168.1.100

# Or manually add to authorized_keys via server console
```

**Prevention:**
- Keep track of which key is authorized on each server
- Use descriptive key names (e.g., `hetzner-prod.key`)
- Store key paths in instance config files

### 5. Common Error Categories

#### SSH and Authentication Errors
- Connection refused
- Permission denied
- Host key verification failed
- Connection timeout
- Network unreachable

#### Permission and Access Errors
- Permission denied (file operations)
- User already exists
- Cannot create directory
- Cannot write file

#### Docker Errors
- Docker installation failed
- Cannot connect to Docker daemon
- Image build failed
- Container won't start
- Port already in use

#### Network Errors
- Git clone failed
- DNS resolution failed
- Connection timeout
- Name or service not known

#### Configuration Errors
- Invalid branch name
- Invalid instance name
- Config file parse error
- Missing required parameter

#### Runtime Errors
- Container crashed
- Onboarding failed
- Gateway won't start
- Health check failed

### 6. Recovery Strategies

#### When to Use --force
Explanation and examples:
```bash
clawctl deploy <IP> --key <path> --force
```

#### When to Use --clean
Explanation, warnings, and examples:
```bash
clawctl deploy <IP> --key <path> --clean
```

#### Manual Cleanup
When automation fails, manual steps:
```bash
# SSH to server
ssh root@192.168.1.100

# Stop containers
cd /home/roboclaw/docker
sudo -u roboclaw docker compose down

# Remove containers
sudo -u roboclaw docker compose rm -f

# Remove images (optional)
docker rmi roboclaw/openclaw

# Remove user (nuclear option)
userdel -r roboclaw

# Remove state file
rm /home/roboclaw/.clawctl-deploy-state.json
```

#### State File Manipulation
Understanding and editing state file:
```json
{
  "lastCompletedPhase": 5,
  "timestamp": "2026-02-05T10:30:00Z",
  "instanceName": "instance-192-168-1-100",
  "branch": "main"
}
```

When and how to manually edit or delete it.

### 7. Platform-Specific Issues

#### WSL (Windows Subsystem for Linux)
- SSH agent issues
- Path handling (Windows vs Linux paths)
- Browser opening issues
- Known limitations

#### macOS
- SSH key permissions
- Keychain integration
- Browser opening (`open` command)

#### Linux
- Distribution-specific issues
- SSH agent variations
- Browser opening (`xdg-open` command)

### 8. Debugging Advanced Issues

#### Container Won't Start
```bash
# Check container logs
docker logs openclaw-gateway

# Check compose logs
docker compose logs

# Inspect container
docker inspect openclaw-gateway

# Check for port conflicts
netstat -tulpn | grep 18789
```

#### Onboarding Hangs
```bash
# Check if CLI container is running
docker ps | grep openclaw-cli

# Check logs
docker logs openclaw-cli

# Manual onboarding
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```

#### Gateway Not Responding
```bash
# Check if gateway is running
docker ps | grep openclaw-gateway

# Test gateway health
curl http://localhost:18789/health

# Check gateway logs
docker logs openclaw-gateway --tail 50

# Restart gateway
docker compose restart openclaw-gateway
```

### 9. Error Message Reference

Comprehensive list of error messages with explanations:

| Error Message | Meaning | Solution Link |
|---------------|---------|---------------|
| "Connection refused" | SSH port blocked or closed | [Phase 1: SSH Connection](#phase-1-ssh-connection) |
| "Permission denied (publickey)" | SSH key not authorized | [Phase 1: Authentication](#error-permission-denied-publickey) |
| [More entries...] | | |

### 10. Getting Help

#### Information to Provide
When asking for help, provide:
- Full error message
- Phase where failure occurred
- Output of `--verbose` mode
- State file contents
- Remote system info (Ubuntu version, Docker version)
- What you've tried already

#### Where to Get Help
- GitHub Issues: [link]
- Discord: [link]
- Documentation: [link to specs]

#### Self-Service Resources
- PRIMER.md for navigation
- clawctl-spec.md for implementation details
- testing-guide.md for testing workflows

### 11. Preventing Common Issues

#### Pre-Deployment Checklist
- [ ] Server meets requirements (Ubuntu 24.04+)
- [ ] SSH access verified manually
- [ ] SSH key has correct permissions (600)
- [ ] Sufficient disk space (5GB+)
- [ ] Internet connectivity on server
- [ ] Ports available (22, 18789)

#### Best Practices
- Test on non-production servers first
- Keep deployments simple (use defaults initially)
- Document custom configurations
- Maintain server snapshots for rollback
- Monitor deployment progress
- Keep clawctl updated

### 12. FAQ

**Q: Can I safely retry a failed deployment?**
A: Yes, clawctl is idempotent and will resume from the last successful phase.

**Q: Will --force delete my data?**
A: No, --force only resets the deployment state tracking. Use --clean to remove everything.

**Q: How do I update OpenClaw after deployment?**
A: (Document current update process or note it's coming in v1.1)

[More FAQs based on common questions...]

### 13. Quick Reference Commands

```bash
# Resume failed deployment
clawctl deploy <IP> --key <path>

# Start fresh (ignore state)
clawctl deploy <IP> --key <path> --force

# Complete reset
clawctl deploy <IP> --key <path> --clean

# Verbose output
clawctl deploy <IP> --key <path> --verbose

# Check remote state
ssh root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json"

# Check containers
ssh root@<IP> "docker ps"

# View gateway logs
ssh root@<IP> "docker logs openclaw-gateway"

# Manual cleanup
ssh root@<IP> "cd /home/roboclaw/docker && docker compose down"
```

## Style Guidelines

- **Audience:** Users and developers troubleshooting deployment issues
- **Tone:** Helpful, clear, systematic
- **Format:** Searchable (users should be able to Ctrl+F their error message)
- **Examples:** Real error messages and commands
- **Organization:** By symptom first, then by phase

## Validation

Before considering the guide complete, verify:

- [ ] All 11 phases have troubleshooting sections
- [ ] Common errors identified from codebase are covered
- [ ] Each error has diagnosis steps and solutions
- [ ] Quick reference table exists for fast lookup
- [ ] Recovery strategies are clear and safe
- [ ] Platform-specific issues covered
- [ ] Examples use real error messages from code

## Deliverable

Create `specs/troubleshooting-guide.md` that enables:

1. Quick error identification (< 2 minutes to find relevant section)
2. Self-service diagnosis and resolution
3. Safe recovery from failed deployments
4. Prevention of future issues
5. Knowledge of when to escalate to maintainers

The guide should be the first resource users and developers consult when deployments fail.

---

**Note:** Use actual error messages from the codebase. If you can't find specific error messages for a scenario, describe likely errors based on the code logic.
