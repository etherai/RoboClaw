# clawctl Troubleshooting Guide

## Overview

This guide helps you diagnose and fix common clawctl deployment failures. The deployment process consists of 11 phases (0-10), and failures can occur at any phase due to SSH issues, network problems, permission errors, or Docker-related failures.

### How to Use This Guide

1. **Identify the symptom** - Look at the error message or phase where deployment failed
2. **Find the error** - Use the Quick Diagnosis table or search for your error message (Ctrl+F)
3. **Follow the solution** - Step-by-step recovery instructions
4. **Resume deployment** - clawctl is idempotent and will resume from the last successful phase

### When to Seek Help

If you've followed the troubleshooting steps and the issue persists, see the [Getting Help](#10-getting-help) section at the end of this guide.

---

## Quick Diagnosis

| Symptom | Likely Cause | Jump To |
|---------|--------------|---------|
| "Invalid IP address format" | IP format wrong | [Phase 0: Validation](#phase-0-validation--configuration) |
| "SSH key not found" | Key path incorrect | [Phase 0: Validation](#phase-0-validation--configuration) |
| "SSH key has insecure permissions" | Key permissions not 600 | [Phase 0: Validation](#phase-0-validation--configuration) |
| "SSH connection failed after 3 attempts" | SSH/firewall issue | [Phase 1: SSH Connection](#phase-1-ssh-connection) |
| "All configured authentication methods failed" | SSH key not authorized | [Phase 1: SSH Connection](#phase-1-ssh-connection) |
| "Insufficient privileges" | Not root user | [Phase 1: SSH Connection](#phase-1-ssh-connection) |
| "Failed to install base packages" | apt-get or network issue | [Phase 2: Install Base Packages](#phase-2-install-base-packages) |
| "Failed to install Docker" | Network or repository issue | [Phase 3: Install Docker](#phase-3-install-docker) |
| "Failed to create user" | System user limit or conflict | [Phase 4: Setup Deployment User](#phase-4-setup-deployment-user) |
| "Failed to create directories" | Permission or disk space issue | [Phase 5: Create Directories](#phase-5-create-directories) |
| "Git clone failed" | Network or GitHub issue | [Phase 6: Build OpenClaw Image](#phase-6-build-openclaw-image) |
| "Docker image build failed" | Build error or disk space | [Phase 6: Build OpenClaw Image](#phase-6-build-openclaw-image) |
| "Built image failed verification" | Image corrupted or incompatible | [Phase 6: Build OpenClaw Image](#phase-6-build-openclaw-image) |
| "Failed to set file ownership" | Permission issue | [Phase 7: Upload Docker Compose](#phase-7-upload-docker-compose) |
| "Onboarding failed - config file not found" | Onboarding didn't complete | [Phase 8: Onboarding & Gateway Startup](#phase-8-onboarding--gateway-startup) |
| "Failed to start gateway" | Docker Compose or port issue | [Phase 8: Onboarding & Gateway Startup](#phase-8-onboarding--gateway-startup) |
| "Gateway failed to start within 30 seconds" | Gateway startup timeout | [Phase 8: Onboarding & Gateway Startup](#phase-8-onboarding--gateway-startup) |
| "Failed to create SSH tunnel" | SSH or local port issue | [Phase 10: Auto-Connect](#phase-10-auto-connect-optional) |
| "Failed to open browser automatically" | Platform or command issue | [Phase 10: Auto-Connect](#phase-10-auto-connect-optional) |

---

## General Troubleshooting Steps

### Step 1: Enable Verbose Mode

Run deployment with `--verbose` flag to see detailed output:

```bash
clawctl deploy <IP> --key <path> --verbose
```

Verbose mode shows:
- All SSH commands being executed
- File paths being used
- Detailed error messages
- Progress indicators
- State changes

### Step 2: Check Remote State

SSH to the server and inspect deployment state:

```bash
# View deployment state
ssh root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json"

# Check Docker status
ssh root@<IP> "docker ps"
ssh root@<IP> "docker images"

# Check if roboclaw user exists
ssh root@<IP> "id roboclaw"

# Check directory permissions
ssh root@<IP> "ls -la /home/roboclaw"

# Check Docker logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs"
```

### Step 3: Check Local Environment

Verify your local setup:

```bash
# Check SSH key permissions (should be 600)
ls -l ~/.ssh/mykey

# Test SSH connection manually
ssh -i ~/.ssh/mykey root@<IP>

# Check connectivity
ping <IP>

# Verify clawctl version
npx clawctl --version
```

### Step 4: Identify Phase

Look at the error output to determine which phase failed. The phase number will be displayed in the format:

```
Phase X: Phase Name
```

Then jump to the corresponding section below for specific troubleshooting.

---

## Phase-by-Phase Troubleshooting

### Phase 0: Validation & Configuration

**What This Phase Does:**
- Validates IP address format
- Loads configuration from files, environment variables, and flags
- Validates SSH key file existence and permissions
- Reads SSH key into memory

**Common Errors:**

#### Error: "Invalid IP address format"

**Symptoms:**
```
✗ Invalid IP address format
Provided: 192.168.1
```

**Causes:**
1. IP address not in X.X.X.X format
2. Missing octets
3. Invalid characters

**Diagnosis:**
```bash
# Verify your IP address
ping <IP>
```

**Solution:**
```bash
# Use correct format
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey

# Not: clawctl deploy 192.168.1
```

**Prevention:**
- Always provide complete IP addresses (four octets)
- Double-check IP before deploying

---

#### Error: "SSH key not found"

**Symptoms:**
```
✗ SSH key validation failed
Key path: /home/user/.ssh/nonexistent
SSH key not found: /home/user/.ssh/nonexistent
```

**Causes:**
1. Wrong path provided
2. Key file doesn't exist
3. Typo in filename
4. Relative path used incorrectly

**Diagnosis:**
```bash
# Check if key exists
ls -l ~/.ssh/mykey

# List all keys
ls -la ~/.ssh/
```

**Solution:**
```bash
# Use correct path (absolute or ~)
clawctl deploy 192.168.1.100 --key ~/.ssh/correct-key

# Or use absolute path
clawctl deploy 192.168.1.100 --key /home/user/.ssh/correct-key
```

**Prevention:**
- Use tab completion to avoid typos
- Store key path in config file or environment variable
- Use descriptive key names

---

#### Error: "SSH key has insecure permissions"

**Symptoms:**
```
⚠️ SSH key has insecure permissions: 644
⚠️ Consider running: chmod 600 /home/user/.ssh/mykey
```

**Causes:**
1. Key file permissions too permissive
2. Key was copied without preserving permissions

**Diagnosis:**
```bash
# Check permissions
ls -l ~/.ssh/mykey
# Should show: -rw------- (600)
# Not: -rw-r--r-- (644)
```

**Solution:**
```bash
# Fix permissions
chmod 600 ~/.ssh/mykey

# Verify
ls -l ~/.ssh/mykey

# Retry deployment
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

**Prevention:**
- Always set SSH keys to 600 after creating or copying
- Add to your key creation workflow

---

### Phase 1: SSH Connection

**What This Phase Does:**
- Establishes SSH connection to remote server using private key
- Verifies connection with exponential backoff (3 retries)
- Verifies root access by checking UID

**Common Errors:**

#### Error: "SSH connection failed after 3 attempts: Connection refused"

**Symptoms:**
```
✗ SSH connection failed after 3 attempts: Connection refused
```

**Causes:**
1. SSH server not running on remote
2. Firewall blocking port 22
3. Wrong IP address
4. Server is down
5. SSH listening on non-standard port

**Diagnosis:**
```bash
# Test if server is reachable
ping 192.168.1.100

# Check if SSH port is open
nc -zv 192.168.1.100 22
# or
telnet 192.168.1.100 22

# Try manual SSH connection
ssh -i ~/.ssh/mykey root@192.168.1.100
```

**Solution:**

For firewall issues (on remote server):
```bash
# Via server console or other access method:
sudo ufw allow 22/tcp
sudo ufw reload
# or
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

For SSH not running (on remote server):
```bash
# Start SSH service
sudo systemctl start ssh
sudo systemctl enable ssh

# Verify it's running
sudo systemctl status ssh
```

For non-standard port:
```bash
# If SSH is on port 2222 instead of 22
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --port 2222
```

For wrong IP:
```bash
# Verify correct IP and retry
clawctl deploy <CORRECT_IP> --key ~/.ssh/mykey
```

**Prevention:**
- Verify server IP before deploying
- Ensure SSH is enabled during server provisioning
- Document non-standard SSH ports
- Keep firewall rules documented

---

#### Error: "All configured authentication methods failed"

**Symptoms:**
```
✗ SSH connection failed after 3 attempts: All configured authentication methods failed
```

**Causes:**
1. Wrong SSH key provided
2. Key not authorized on remote (not in `~/.ssh/authorized_keys`)
3. Key requires passphrase but not provided
4. Key type not supported by server
5. Wrong user for this key

**Diagnosis:**
```bash
# Check key file permissions
ls -l ~/.ssh/mykey
# Should be 600

# Test SSH with verbose output
ssh -vvv -i ~/.ssh/mykey root@192.168.1.100
# Look for "Offering public key" and "Server accepts key" messages

# Verify key fingerprint
ssh-keygen -l -f ~/.ssh/mykey

# Check if key type is supported
file ~/.ssh/mykey
```

**Solution:**

For wrong/unauthorized key:
```bash
# Add key to server (via console or password access)
cat ~/.ssh/mykey.pub  # Copy this output
# Then on server:
mkdir -p ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Or use ssh-copy-id
ssh-copy-id -i ~/.ssh/mykey root@192.168.1.100
```

For key permissions:
```bash
# Fix permissions
chmod 600 ~/.ssh/mykey
chmod 644 ~/.ssh/mykey.pub  # if public key exists

# Retry deployment
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

For passphrase-protected key:
```bash
# Add key to SSH agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/mykey
# Enter passphrase when prompted

# Then deploy (agent will provide key)
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

**Prevention:**
- Keep track of which key is authorized on each server
- Use descriptive key names (e.g., `hetzner-prod.key`)
- Store key paths in instance config files
- Test SSH access before deploying

---

#### Error: "Insufficient privileges"

**Symptoms:**
```
✗ Insufficient privileges
Connected as: user
Required: root

This tool requires root SSH access to:
  - Install Docker and system packages
  - Manage system users and groups
  - Configure system services
```

**Causes:**
1. Connected as non-root user
2. Using wrong username flag
3. Root SSH access disabled on server

**Diagnosis:**
```bash
# Check what user you're connecting as
ssh -i ~/.ssh/mykey user@192.168.1.100 "whoami"

# Try connecting as root
ssh -i ~/.ssh/mykey root@192.168.1.100 "whoami"
```

**Solution:**

For wrong username:
```bash
# Connect as root (default)
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey

# Or explicitly specify
clawctl deploy 192.168.1.100 --key ~/.ssh/mykey --user root
```

For root SSH disabled:
```bash
# Enable root SSH on server (via console or sudo access)
sudo sed -i 's/#PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Or add your key to root's authorized_keys
sudo mkdir -p /root/.ssh
sudo cat /home/youruser/.ssh/authorized_keys | sudo tee /root/.ssh/authorized_keys
sudo chmod 700 /root/.ssh
sudo chmod 600 /root/.ssh/authorized_keys
```

**Prevention:**
- Request root SSH access when provisioning servers
- Or ensure you can sudo to root
- Document SSH access method per environment

---

### Phase 2: Install Base Packages

**What This Phase Does:**
- Checks if curl, wget, git are installed
- Runs `apt-get update` and installs required packages
- Required for Docker installation and git cloning

**Common Errors:**

#### Error: "Failed to install base packages"

**Symptoms:**
```
Phase 2: Install Base Packages
ℹ Installing base packages...
✗ Failed to install base packages
```

**Causes:**
1. Network connectivity issues
2. Ubuntu package repositories unavailable
3. Disk space full
4. apt-get lock held by another process
5. DNS resolution failure

**Diagnosis:**
```bash
# Check network connectivity
ssh root@<IP> "ping -c 3 8.8.8.8"

# Check DNS resolution
ssh root@<IP> "nslookup archive.ubuntu.com"

# Check disk space
ssh root@<IP> "df -h"

# Check apt lock
ssh root@<IP> "ps aux | grep apt"

# Try manual install
ssh root@<IP> "apt-get update"
```

**Solution:**

For network issues:
```bash
# Check firewall allows outbound traffic
ssh root@<IP> "iptables -L OUTPUT"

# Test connectivity to Ubuntu repos
ssh root@<IP> "curl -I http://archive.ubuntu.com"
```

For disk space:
```bash
# Free up space
ssh root@<IP> "apt-get clean"
ssh root@<IP> "apt-get autoremove"

# Check available space
ssh root@<IP> "df -h /"
```

For apt lock:
```bash
# Wait for other apt processes to finish
ssh root@<IP> "ps aux | grep apt"

# Force remove lock (USE WITH CAUTION)
ssh root@<IP> "rm /var/lib/apt/lists/lock"
ssh root@<IP> "rm /var/cache/apt/archives/lock"
ssh root@<IP> "rm /var/lib/dpkg/lock*"
ssh root@<IP> "dpkg --configure -a"
```

For DNS issues:
```bash
# Test DNS
ssh root@<IP> "cat /etc/resolv.conf"

# Add Google DNS temporarily
ssh root@<IP> "echo 'nameserver 8.8.8.8' > /etc/resolv.conf"
```

Then resume deployment:
```bash
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Ensure outbound internet access on server
- Use servers with at least 5GB free disk space
- Avoid deploying during system updates
- Configure reliable DNS servers

---

### Phase 3: Install Docker

**What This Phase Does:**
- Checks if Docker CE and Docker Compose v2 are already installed
- Adds Docker GPG key and repository
- Installs docker-ce, docker-ce-cli, containerd.io, docker-buildx-plugin, docker-compose-plugin
- Starts and enables Docker service
- Verifies installation

**Common Errors:**

#### Error: "Failed to install Docker"

**Symptoms:**
```
Phase 3: Install Docker
ℹ Installing Docker CE...
✗ Failed to install Docker
```

**Causes:**
1. Network connectivity to Docker repositories
2. GPG key download failure
3. Incompatible Ubuntu version
4. apt-get failures
5. Insufficient disk space

**Diagnosis:**
```bash
# Check Ubuntu version (must be 20.04+)
ssh root@<IP> "lsb_release -a"

# Check connectivity to Docker repo
ssh root@<IP> "curl -fsSL https://download.docker.com/linux/ubuntu/gpg"

# Check disk space
ssh root@<IP> "df -h"

# Check if Docker repo was added
ssh root@<IP> "cat /etc/apt/sources.list.d/docker.list"

# Try manual Docker install
ssh root@<IP> "apt-get update && apt-get install -y docker-ce"
```

**Solution:**

For repository issues:
```bash
# Manually add Docker repository
ssh root@<IP>
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
exit

# Resume deployment
clawctl deploy <IP> --key <path>
```

For unsupported Ubuntu version:
```bash
# Check version
ssh root@<IP> "lsb_release -cs"

# If older than 20.04, upgrade or use supported server
# clawctl requires Ubuntu 20.04+
```

For disk space:
```bash
# Need at least 5GB for Docker installation
ssh root@<IP> "df -h /"
# Clean up if needed
```

**Prevention:**
- Use Ubuntu 24.04 LTS (recommended) or 22.04 LTS
- Ensure at least 10GB free disk space
- Test network connectivity before deploying
- Consider using servers with Docker pre-installed

---

#### Error: "Docker installation verification failed"

**Symptoms:**
```
✗ Docker installation verification failed
```

**Causes:**
1. Docker installed but not running
2. Docker service failed to start
3. Permission issues with Docker socket

**Diagnosis:**
```bash
# Check Docker service status
ssh root@<IP> "systemctl status docker"

# Check Docker socket
ssh root@<IP> "ls -l /var/run/docker.sock"

# Try running Docker
ssh root@<IP> "docker ps"
```

**Solution:**
```bash
# Start Docker service
ssh root@<IP> "systemctl start docker"
ssh root@<IP> "systemctl enable docker"

# Verify
ssh root@<IP> "docker --version"
ssh root@<IP> "docker compose version"
ssh root@<IP> "docker ps"

# Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Use systemd-based Linux distributions
- Ensure sufficient memory (at least 1GB RAM)

---

### Phase 4: Setup Deployment User

**What This Phase Does:**
- Checks if `roboclaw` user already exists
- Creates `roboclaw` system user with UID 1000 (or next available UID)
- Adds user to `docker` group for container management
- Sets up home directory at `/home/roboclaw`

**Common Errors:**

#### Error: "Failed to create user 'roboclaw'"

**Symptoms:**
```
Phase 4: Setup Deployment User
ℹ Creating user 'roboclaw'...
✗ Failed to create user 'roboclaw'
```

**Causes:**
1. User already exists (but not detected)
2. UID 1000 already taken
3. System user limit reached
4. Permission issues

**Diagnosis:**
```bash
# Check if user exists
ssh root@<IP> "id roboclaw"

# Check UID 1000
ssh root@<IP> "getent passwd 1000"

# Check system limits
ssh root@<IP> "cat /etc/login.defs | grep UID"
```

**Solution:**

For existing user:
```bash
# If user exists but phase failed, resume (idempotent)
clawctl deploy <IP> --key <path>

# Or force fresh start
clawctl deploy <IP> --key <path> --force
```

For UID conflict:
```bash
# The tool will automatically use next available UID
# Just resume deployment
clawctl deploy <IP> --key <path>

# Or manually remove conflicting user
ssh root@<IP> "userdel <conflicting-user>"
```

**Prevention:**
- Check for existing `roboclaw` user before deploying
- Use `--clean` flag to remove previous deployments

---

#### Error: "Failed to parse user info for 'roboclaw'"

**Symptoms:**
```
✗ Failed to parse user info for 'roboclaw'
```

**Causes:**
1. Unexpected output from `id` command
2. Non-standard user setup
3. Corrupted passwd file

**Diagnosis:**
```bash
# Check user info output
ssh root@<IP> "id roboclaw"
# Should output: uid=1000(roboclaw) gid=1000(roboclaw) groups=1000(roboclaw),999(docker)

ssh root@<IP> "eval echo ~roboclaw"
# Should output: /home/roboclaw

# Verify passwd entry
ssh root@<IP> "getent passwd roboclaw"
```

**Solution:**
```bash
# Recreate user
ssh root@<IP> "userdel -r roboclaw"
clawctl deploy <IP> --key <path> --force
```

**Prevention:**
- Use standard Ubuntu systems
- Avoid custom user management systems

---

### Phase 5: Create Directories

**What This Phase Does:**
- Creates OpenClaw config directories: `~/.openclaw/workspace`
- Creates RoboClaw directories: `~/.roboclaw/{sessions,credentials,data,logs}`
- Creates deployment directories: `~/docker`, `~/openclaw-src`
- Sets correct ownership (roboclaw:roboclaw)
- Secures credentials directory (chmod 700)

**Common Errors:**

#### Error: "Failed to create directories"

**Symptoms:**
```
Phase 5: Create Directories
ℹ Creating directories...
✗ Failed to create directories
```

**Causes:**
1. Disk space full
2. Permission issues
3. Home directory doesn't exist
4. Filesystem mounted read-only

**Diagnosis:**
```bash
# Check disk space
ssh root@<IP> "df -h /home"

# Check home directory
ssh root@<IP> "ls -la /home/roboclaw"

# Try creating manually
ssh root@<IP> "mkdir -p /home/roboclaw/test"

# Check filesystem mount
ssh root@<IP> "mount | grep /home"
```

**Solution:**

For disk space:
```bash
# Free up space
ssh root@<IP> "apt-get clean"
ssh root@<IP> "docker system prune -a"

# Check available space
ssh root@<IP> "df -h"
```

For permission issues:
```bash
# Fix home directory ownership
ssh root@<IP> "chown roboclaw:roboclaw /home/roboclaw"
ssh root@<IP> "chmod 755 /home/roboclaw"

# Resume deployment
clawctl deploy <IP> --key <path>
```

For read-only filesystem:
```bash
# Remount as read-write
ssh root@<IP> "mount -o remount,rw /home"

# Check for filesystem errors
ssh root@<IP> "dmesg | grep -i error"
```

**Prevention:**
- Ensure at least 5GB free disk space
- Use servers with standard filesystem setup
- Monitor disk usage

---

### Phase 6: Build OpenClaw Image

**What This Phase Does:**
- Checks if `roboclaw/openclaw:local` image already exists and is usable
- Clones OpenClaw repository from GitHub (https://github.com/openclaw/openclaw.git)
- Checks out specified branch (default: main)
- Builds Docker image using Dockerfile in repository
- Verifies image can run as non-root user (roboclaw UID)

**Common Errors:**

#### Error: "Git clone failed" / "fatal: could not read from remote repository"

**Symptoms:**
```
Phase 6: Build OpenClaw Image
ℹ Building OpenClaw image...
ℹ Cloning https://github.com/openclaw/openclaw.git (branch: main)
fatal: unable to access 'https://github.com/openclaw/openclaw.git/': Could not resolve host: github.com
✗ Docker image build failed
```

**Causes:**
1. No internet connectivity
2. DNS resolution failure
3. GitHub is down or blocked
4. Firewall blocking git/https
5. Wrong branch name

**Diagnosis:**
```bash
# Test network connectivity
ssh root@<IP> "ping -c 3 github.com"

# Test DNS
ssh root@<IP> "nslookup github.com"

# Test git clone manually
ssh root@<IP> "sudo -u roboclaw git clone https://github.com/openclaw/openclaw.git /tmp/test-clone"

# Check branch exists
ssh root@<IP> "git ls-remote --heads https://github.com/openclaw/openclaw.git"
```

**Solution:**

For network issues:
```bash
# Add Google DNS
ssh root@<IP> "echo 'nameserver 8.8.8.8' >> /etc/resolv.conf"

# Test connectivity
ssh root@<IP> "curl -I https://github.com"
```

For wrong branch:
```bash
# List available branches
ssh root@<IP> "git ls-remote --heads https://github.com/openclaw/openclaw.git"

# Deploy with correct branch
clawctl deploy <IP> --key <path> --branch main
```

For firewall:
```bash
# Allow outbound HTTPS
ssh root@<IP> "iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT"
```

Then resume:
```bash
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Verify internet connectivity before deploying
- Use default branch (main) unless you need a specific version
- Ensure firewall allows outbound HTTPS (port 443)

---

#### Error: "Docker image build failed"

**Symptoms:**
```
ℹ Building Docker image (this may take several minutes)...
[Docker build output...]
✗ Docker image build failed
```

**Causes:**
1. Dockerfile errors in OpenClaw repository
2. Network failures during package installation
3. Insufficient disk space
4. Out of memory during build
5. Base image unavailable

**Diagnosis:**
```bash
# Check disk space
ssh root@<IP> "df -h"

# Check memory
ssh root@<IP> "free -h"

# Check Docker daemon
ssh root@<IP> "docker info"

# Try manual build
ssh root@<IP> "cd /home/roboclaw/openclaw-src && docker build -t test-build ."

# Check Docker build logs
ssh root@<IP> "docker logs $(docker ps -aq --filter name=openclaw)"
```

**Solution:**

For disk space:
```bash
# Clean up Docker images
ssh root@<IP> "docker system prune -a"

# Check space again
ssh root@<IP> "df -h"

# Resume deployment
clawctl deploy <IP> --key <path>
```

For memory issues:
```bash
# Check available memory (need at least 1GB)
ssh root@<IP> "free -h"

# Upgrade server to larger instance
# Or add swap space temporarily
ssh root@<IP> "fallocate -l 2G /swapfile"
ssh root@<IP> "chmod 600 /swapfile"
ssh root@<IP> "mkswap /swapfile"
ssh root@<IP> "swapon /swapfile"
```

For network issues during build:
```bash
# Build may timeout on slow connections
# Try building with verbose to see where it fails
clawctl deploy <IP> --key <path> --verbose

# Or build manually with retries
ssh root@<IP>
cd /home/roboclaw/openclaw-src
docker build --network=host -t roboclaw/openclaw:local .
exit

# Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Use servers with at least 2GB RAM
- Ensure at least 10GB free disk space
- Use servers with fast internet connection
- Consider pre-building images and pushing to registry

---

#### Error: "Built image failed verification"

**Symptoms:**
```
✗ Built image failed verification
```

**Causes:**
1. Image doesn't support running as non-root
2. UID/GID mismatch
3. Corrupted image

**Diagnosis:**
```bash
# Check if image exists
ssh root@<IP> "docker images | grep openclaw"

# Test running as roboclaw user
ssh root@<IP> "docker run --rm --user 1000:1000 roboclaw/openclaw:local id -u"
# Should output: 1000

# Inspect image
ssh root@<IP> "docker inspect roboclaw/openclaw:local"
```

**Solution:**
```bash
# Remove corrupted image and rebuild
ssh root@<IP> "docker rmi roboclaw/openclaw:local"

# Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Use stable network connection during build
- Ensure sufficient disk space
- Use recommended server specs

---

### Phase 7: Upload Docker Compose

**What This Phase Does:**
- Generates `docker-compose.yml` with variable placeholders (e.g., `${USER_UID}`)
- Generates `.env` file with actual values (UID, GID, paths, image name)
- Uploads both files to `/home/roboclaw/docker/`
- Sets ownership to roboclaw:roboclaw

**Common Errors:**

#### Error: "Failed to set file ownership"

**Symptoms:**
```
Phase 7: Upload Docker Compose
ℹ Generating Docker Compose files...
✓ Uploaded docker-compose.yml
✓ Uploaded .env
✗ Failed to set file ownership
```

**Causes:**
1. Permission issues
2. User doesn't exist (shouldn't happen if Phase 4 succeeded)
3. Filesystem issues

**Diagnosis:**
```bash
# Check files exist
ssh root@<IP> "ls -la /home/roboclaw/docker/"

# Check ownership
ssh root@<IP> "ls -l /home/roboclaw/docker/docker-compose.yml"

# Try manual chown
ssh root@<IP> "chown roboclaw:roboclaw /home/roboclaw/docker/docker-compose.yml"
```

**Solution:**
```bash
# Fix ownership manually
ssh root@<IP> "chown -R roboclaw:roboclaw /home/roboclaw/docker"

# Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Ensure Phase 4 completes successfully
- Don't manually modify files during deployment

---

### Phase 8: Onboarding & Gateway Startup

**What This Phase Does:**
1. Runs interactive onboarding wizard (`docker compose run openclaw-cli onboard --no-install-daemon`)
2. User creates gateway authentication token
3. Extracts token from `~/.openclaw/openclaw.json`
4. Stops any existing gateway container
5. Updates `.env` with gateway token
6. Starts gateway with `docker compose up -d openclaw-gateway`
7. Waits up to 30 seconds for gateway to start listening

**Common Errors:**

#### Error: "Onboarding failed - config file not found"

**Symptoms:**
```
Phase 8: Onboarding & Gateway Startup
ℹ Launching onboarding wizard...
[Interactive onboarding session]
✗ Onboarding did not create config file
✗ Onboarding failed - config file not found
```

**Causes:**
1. User exited onboarding before completion (Ctrl+C, Ctrl+D)
2. Onboarding process crashed
3. Permission issues writing config file
4. User skipped token creation step

**Diagnosis:**
```bash
# Check if config file exists
ssh root@<IP> "test -f /home/roboclaw/.openclaw/openclaw.json && echo 'exists' || echo 'missing'"

# Check config directory permissions
ssh root@<IP> "ls -la /home/roboclaw/.openclaw/"

# Check onboarding logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs openclaw-cli"
```

**Solution:**

If onboarding was incomplete:
```bash
# Complete onboarding manually
ssh root@<IP>
sudo -u roboclaw -i
cd ~/docker
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
# Follow prompts to completion
exit
exit

# Resume deployment
clawctl deploy <IP> --key <path>
```

If you want to skip onboarding:
```bash
# Deploy with skip flag (gateway won't start automatically)
clawctl deploy <IP> --key <path> --skip-onboard

# Complete onboarding later manually
```

**Prevention:**
- Complete all onboarding prompts
- Don't exit with Ctrl+C during onboarding
- If unsure, use `--skip-onboard` and complete manually later

---

#### Error: "Failed to start gateway"

**Symptoms:**
```
ℹ Starting OpenClaw gateway...
✗ Failed to start gateway
```

**Causes:**
1. Port 18789 already in use
2. Docker Compose syntax error
3. Missing environment variables
4. Container image issues
5. Insufficient resources

**Diagnosis:**
```bash
# Check if port is in use
ssh root@<IP> "netstat -tulpn | grep 18789"
# or
ssh root@<IP> "lsof -i :18789"

# Try starting manually
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose up openclaw-gateway"

# Check logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs openclaw-gateway"

# Verify compose file
ssh root@<IP> "cd /home/roboclaw/docker && docker compose config"
```

**Solution:**

For port conflict:
```bash
# Find what's using the port
ssh root@<IP> "netstat -tulpn | grep 18789"

# Kill conflicting process
ssh root@<IP> "kill <PID>"

# Or change gateway port in .env
ssh root@<IP> "nano /home/roboclaw/docker/.env"
# Change: OPENCLAW_GATEWAY_PORT=18790

# Resume deployment
clawctl deploy <IP> --key <path>
```

For configuration issues:
```bash
# Check .env file
ssh root@<IP> "cat /home/roboclaw/docker/.env"

# Verify all variables are set
# Should include: OPENCLAW_IMAGE, OPENCLAW_GATEWAY_TOKEN, DEPLOY_UID, etc.

# If token is missing, extract manually
ssh root@<IP> "cat /home/roboclaw/.openclaw/openclaw.json | grep token"
# Add to .env: OPENCLAW_GATEWAY_TOKEN=<token>

# Restart gateway
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose up -d openclaw-gateway"
```

For container issues:
```bash
# Remove and recreate
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose down openclaw-gateway"
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose up -d openclaw-gateway"
```

**Prevention:**
- Ensure port 18789 is not in use
- Complete onboarding fully to generate token
- Use standard deployment flow

---

#### Error: "Gateway failed to start within 30 seconds"

**Symptoms:**
```
ℹ Waiting for gateway to start listening...
✗ Gateway startup timeout
✗ Gateway failed to start within 30 seconds
```

**Causes:**
1. Gateway crashed on startup
2. Missing dependencies
3. Configuration errors
4. Slow server (underpowered)
5. Network issues preventing container from starting

**Diagnosis:**
```bash
# Check if container is running
ssh root@<IP> "docker ps | grep openclaw-gateway"

# Check container status
ssh root@<IP> "docker ps -a | grep openclaw-gateway"

# Check logs for errors
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs --tail 50 openclaw-gateway"

# Check container health
ssh root@<IP> "docker inspect openclaw-gateway | grep -A 10 State"
```

**Solution:**

If container crashed:
```bash
# View crash logs
ssh root@<IP> "docker logs openclaw-gateway"

# Common issues:
# - Missing OPENCLAW_GATEWAY_TOKEN in .env
# - Invalid token format
# - Port binding failure

# Fix .env and restart
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose restart openclaw-gateway"
```

If container is starting slowly:
```bash
# Wait longer and check logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs -f openclaw-gateway"

# Once you see "listening on", deployment succeeded
# Just resume to complete remaining phases
clawctl deploy <IP> --key <path>
```

For permission issues:
```bash
# Check volume mounts have correct permissions
ssh root@<IP> "ls -la /home/roboclaw/.openclaw"
ssh root@<IP> "chown -R roboclaw:roboclaw /home/roboclaw/.openclaw"
```

**Prevention:**
- Use servers with at least 1GB RAM
- Ensure onboarding completes successfully
- Check logs during deployment with `--verbose`

---

### Phase 9: Create Instance Artifact

**What This Phase Does:**
- Creates `instances/<instance-name>.yml` file locally
- Stores instance metadata: IP, SSH config, deployment user info, image name, timestamps

**Common Errors:**

#### Error: "Failed to create instance artifact"

**Symptoms:**
```
Phase 9: Create Instance Artifact
✗ Failed to create instance artifact
```

**Causes:**
1. Local `instances/` directory doesn't exist or not writable
2. Permission issues
3. Disk full locally

**Diagnosis:**
```bash
# Check if instances directory exists
ls -la ./instances/

# Try creating file manually
touch ./instances/test.yml

# Check disk space
df -h .
```

**Solution:**
```bash
# Create instances directory
mkdir -p ./instances

# Fix permissions
chmod 755 ./instances

# Resume deployment
clawctl deploy <IP> --key <path>
```

**Prevention:**
- Run clawctl from writable directory
- Ensure local disk space available

---

### Phase 10: Auto-Connect (Optional)

**What This Phase Does:**
- Prompts user Y/n to auto-connect
- Creates SSH tunnel forwarding port 18789: `ssh -L 18789:localhost:18789 -N root@<IP>`
- Opens browser to `http://localhost:18789/?token=<token>`
- Polls for new device pairing requests
- Automatically approves first new pairing request
- Keeps tunnel open until Ctrl+C

**Common Errors:**

#### Error: "Failed to create SSH tunnel"

**Symptoms:**
```
ℹ Creating SSH tunnel on port 18789...
✗ Failed to create SSH tunnel
```

**Causes:**
1. Port 18789 already in use locally
2. SSH connection issues
3. SSH key passphrase required
4. Missing SSH binary

**Diagnosis:**
```bash
# Check if port is in use locally
netstat -an | grep 18789
# or
lsof -i :18789

# Try manual tunnel
ssh -L 18789:localhost:18789 -i ~/.ssh/mykey root@<IP> -N

# Check SSH is available
which ssh
```

**Solution:**

For port in use:
```bash
# Find and kill process using port
lsof -ti:18789 | xargs kill -9

# Or use different port
# (Note: clawctl doesn't support custom local port yet, coming in v1.1)
```

For SSH issues:
```bash
# Add key to agent if passphrase-protected
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/mykey

# Retry deployment (will reach Phase 10 and prompt again)
```

**Prevention:**
- Ensure port 18789 is available locally
- Use SSH agent for passphrase-protected keys
- Use `--no-auto-connect` to skip this phase if not needed

---

#### Error: "Failed to open browser automatically"

**Symptoms:**
```
ℹ Opening browser...
⚠️ Failed to open browser automatically: ...
ℹ Please open manually: http://localhost:18789/?token=...
```

**Causes:**
1. Platform-specific browser command not found (xdg-open, open, start)
2. Running in headless environment (server without GUI)
3. WSL without Windows integration
4. Permission issues

**Diagnosis:**
```bash
# Check platform
uname -s

# Check if browser command exists
which xdg-open    # Linux
which open        # macOS

# Test browser command
xdg-open http://localhost:18789  # Linux
open http://localhost:18789      # macOS
```

**Solution:**

This is a warning, not a fatal error. Just open the URL manually:

```bash
# Copy the URL from terminal output
# Open in your browser manually
```

For WSL:
```bash
# Open from WSL using Windows command
cmd.exe /c start http://localhost:18789/?token=<token>

# Or configure WSL to use Windows browser
```

**Prevention:**
- This is expected in headless environments
- Just open URL manually when prompted
- Use `--no-auto-connect` for automated deployments

---

#### Error: "No new pairing request detected within 60 seconds"

**Symptoms:**
```
ℹ Waiting for device pairing request...
  (press Ctrl+C to skip)
⚠️ No new pairing request detected within 60 seconds
```

**Causes:**
1. Browser didn't load dashboard
2. User didn't click "Pair Device"
3. Gateway not responding
4. Token invalid
5. Timeout too short (page takes time to load)

**Diagnosis:**
```bash
# Check if tunnel is working
curl http://localhost:18789/health

# Check gateway logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs --tail 20 openclaw-gateway"

# Check pending pairing requests manually
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose exec openclaw-gateway node dist/index.js devices list"
```

**Solution:**

This is informational, not a failure. The deployment succeeded. Just approve pairing manually:

```bash
# List pending requests
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose exec openclaw-gateway node dist/index.js devices list"

# Approve a request
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose exec openclaw-gateway node dist/index.js devices approve <request-id>"
```

Or refresh browser and try pairing again.

**Prevention:**
- Click "Pair Device" promptly when dashboard loads
- Refresh page if it doesn't load
- Use manual pairing if auto-connect times out

---

## Common Error Categories

### SSH and Authentication Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Connection refused | Port blocked or SSH not running | [Phase 1](#phase-1-ssh-connection) |
| Connection timeout | Network unreachable | [Phase 1](#phase-1-ssh-connection) |
| All authentication methods failed | Wrong key or not authorized | [Phase 1](#phase-1-ssh-connection) |
| Host key verification failed | Changed host key | See below |
| Network unreachable | Network/firewall issue | [Phase 1](#phase-1-ssh-connection) |

#### Error: "Host key verification failed"

**Solution:**
```bash
# Remove old host key
ssh-keygen -R <IP>

# Or disable strict checking (less secure)
ssh -o StrictHostKeyChecking=no -i ~/.ssh/mykey root@<IP>

# Resume deployment
clawctl deploy <IP> --key <path>
```

---

### Permission and Access Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Permission denied (file operations) | Insufficient permissions | [Phase 5](#phase-5-create-directories) |
| User already exists | Previous deployment | [Phase 4](#phase-4-setup-deployment-user) |
| Cannot create directory | Permission or disk issue | [Phase 5](#phase-5-create-directories) |
| Cannot write file | Permission issue | [Phase 7](#phase-7-upload-docker-compose) |

---

### Docker Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Docker installation failed | Network or apt issue | [Phase 3](#phase-3-install-docker) |
| Cannot connect to Docker daemon | Docker not running | [Phase 3](#phase-3-install-docker) |
| Image build failed | Build error or resources | [Phase 6](#phase-6-build-openclaw-image) |
| Container won't start | Config or resource issue | [Phase 8](#phase-8-onboarding--gateway-startup) |
| Port already in use | Port conflict | [Phase 8](#phase-8-onboarding--gateway-startup) |

---

### Network Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Git clone failed | Network or GitHub issue | [Phase 6](#phase-6-build-openclaw-image) |
| DNS resolution failed | DNS configuration | [Phase 2](#phase-2-install-base-packages) |
| Connection timeout | Network slow/blocked | [Phase 1](#phase-1-ssh-connection) |
| Name or service not known | DNS failure | [Phase 2](#phase-2-install-base-packages) |

---

### Configuration Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Invalid IP address format | IP syntax error | [Phase 0](#phase-0-validation--configuration) |
| SSH key not found | Wrong path | [Phase 0](#phase-0-validation--configuration) |
| Config file parse error | YAML syntax error | See below |

#### Error: Config file parse error

**Solution:**
```bash
# Check config file syntax
cat ~/.clawctl/config.yml
# or
cat ./clawctl.yml

# Validate YAML
python3 -c "import yaml; yaml.safe_load(open('.clawctl.yml'))"

# Fix syntax errors and retry
```

---

### Runtime Errors

| Error Pattern | Cause | Solution Link |
|--------------|-------|---------------|
| Container crashed | Config or code error | [Phase 8](#phase-8-onboarding--gateway-startup) |
| Onboarding failed | Incomplete wizard | [Phase 8](#phase-8-onboarding--gateway-startup) |
| Gateway won't start | Config or port issue | [Phase 8](#phase-8-onboarding--gateway-startup) |
| Health check failed | Gateway not responding | [Phase 8](#phase-8-onboarding--gateway-startup) |

---

## Recovery Strategies

### When to Use --force

The `--force` flag **ignores deployment state** and starts fresh **without** cleaning up existing resources.

**Use `--force` when:**
- State file is corrupted or outdated
- You want to redeploy without removing existing containers/images
- Resume logic is broken

**Command:**
```bash
clawctl deploy <IP> --key <path> --force
```

**What it does:**
- Deletes deployment state file
- Re-runs all phases from scratch
- Does NOT remove: containers, images, roboclaw user, files

**When NOT to use:**
- If you want to clean up everything (use `--clean` instead)
- If resume is working (just re-run without flags)

---

### When to Use --clean

The `--clean` flag **removes everything** before deploying.

**Use `--clean` when:**
- Previous deployment is corrupted
- You want a completely fresh start
- Testing deployment from scratch
- roboclaw user or containers are in bad state

**Command:**
```bash
clawctl deploy <IP> --key <path> --clean
```

**WARNING:** This is destructive! It removes:
- ✗ All Docker containers (stopped and running)
- ✗ All `roboclaw/openclaw` Docker images
- ✗ `roboclaw` user and entire home directory (`/home/roboclaw`)
- ✗ All configuration, data, logs
- ✗ Deployment state file

**What it preserves:**
- ✓ Docker installation
- ✓ Base packages
- ✓ Other users and containers

**Recovery after --clean:**
- You'll need to complete onboarding again
- All previous data and configuration is lost

---

### Manual Cleanup

When automation fails, perform manual cleanup steps:

```bash
# SSH to server
ssh root@<IP>

# Stop all containers
cd /home/roboclaw/docker
sudo -u roboclaw docker compose down

# Remove containers
sudo -u roboclaw docker compose rm -f

# Remove images (optional - large download)
docker rmi roboclaw/openclaw:local

# Remove build source (optional)
rm -rf /home/roboclaw/openclaw-src

# Remove user (nuclear option - deletes all data)
userdel -r roboclaw

# Remove state file
rm -f /home/roboclaw/.clawctl-deploy-state.json

# Exit
exit
```

**After manual cleanup:**
```bash
# Deploy fresh
clawctl deploy <IP> --key <path> --force
```

---

### State File Manipulation

The state file tracks deployment progress: `/home/roboclaw/.clawctl-deploy-state.json`

**View state:**
```bash
ssh root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json"
```

**Example state file:**
```json
{
  "instanceName": "instance-192-168-1-100",
  "deploymentId": "a1b2c3d4-...",
  "startedAt": "2026-02-05T10:30:00.000Z",
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

**When to edit state:**
- **Generally don't** - use `--force` instead
- Only if you know what you're doing
- To skip a phase that's incorrectly marked pending

**Manually mark phase complete:**
```bash
ssh root@<IP>
# Edit state file
nano /home/roboclaw/.clawctl-deploy-state.json
# Change phase status from "pending" to "complete"
# Save and exit

# Resume deployment
exit
clawctl deploy <IP> --key <path>
```

**Delete state file:**
```bash
ssh root@<IP> "rm /home/roboclaw/.clawctl-deploy-state.json"
clawctl deploy <IP> --key <path> --force
```

---

## Platform-Specific Issues

### WSL (Windows Subsystem for Linux)

**Common Issues:**

1. **SSH agent not working:**
```bash
# Start SSH agent in WSL
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/mykey
```

2. **Path issues (Windows vs Linux paths):**
```bash
# Use Linux paths in WSL
clawctl deploy <IP> --key ~/.ssh/mykey  # Good
clawctl deploy <IP> --key C:\\Users\\...  # Bad
```

3. **Browser opening fails:**
```bash
# Use Windows command to open browser
cmd.exe /c start http://localhost:18789

# Or configure auto-connect to skip
clawctl deploy <IP> --key <path> --no-auto-connect
```

4. **Port forwarding issues:**
```bash
# WSL2 may need firewall rules for port forwarding
# Add Windows firewall rule for port 18789
```

**Workarounds:**
- Use `--no-auto-connect` for automated deployments
- Open browser manually from Windows
- Consider using native Windows SSH client

---

### macOS

**Common Issues:**

1. **SSH key in keychain:**
```bash
# Add key to macOS keychain
ssh-add -K ~/.ssh/mykey

# Or use ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/mykey
```

2. **Gatekeeper blocking:**
```bash
# If browser command is blocked
# System Preferences > Security & Privacy > Allow
```

3. **Permissions on SSH keys:**
```bash
# Fix permissions
chmod 600 ~/.ssh/mykey
```

**Working Config:**
- Use built-in SSH client
- Use `open` command for browser (automatic)
- Store keys in `~/.ssh/`

---

### Linux

**Common Issues:**

1. **Missing `xdg-open`:**
```bash
# Install xdg-utils
sudo apt-get install xdg-utils

# Or use manual browser opening
```

2. **SSH agent variations:**
```bash
# GNOME Keyring
eval "$(gnome-keyring-daemon --start)"

# Or standard ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/mykey
```

3. **Firewall blocking local ports:**
```bash
# Allow port 18789 locally
sudo ufw allow 18789/tcp
```

**Recommended:**
- Use standard SSH agent
- Install xdg-utils for browser support
- Use systemd-based distributions

---

## Debugging Advanced Issues

### Container Won't Start

**Symptoms:**
- `docker ps` shows container exited immediately
- Gateway not responding

**Debugging steps:**
```bash
# Check container logs
ssh root@<IP>
cd /home/roboclaw/docker
docker compose logs openclaw-gateway --tail 50

# Check container status
docker ps -a | grep openclaw

# Inspect container
docker inspect openclaw-gateway

# Check exit code
docker inspect openclaw-gateway | grep -A 5 State

# Try running manually
docker compose up openclaw-gateway
# (watch output for errors)

# Check for port conflicts
netstat -tulpn | grep 18789
# or
ss -tulpn | grep 18789
```

**Common causes:**
- Missing OPENCLAW_GATEWAY_TOKEN in .env
- Port 18789 already in use
- Invalid configuration
- Missing volume mounts
- Insufficient permissions on mounted directories

**Solution:**
```bash
# Fix .env file
nano .env
# Ensure OPENCLAW_GATEWAY_TOKEN is set

# Fix permissions
chown -R roboclaw:roboclaw /home/roboclaw/.openclaw

# Recreate container
docker compose down openclaw-gateway
docker compose up -d openclaw-gateway

# Check logs
docker compose logs -f openclaw-gateway
```

---

### Onboarding Hangs

**Symptoms:**
- Onboarding wizard doesn't respond
- Terminal frozen during Phase 8

**Debugging steps:**
```bash
# In another terminal, SSH to server
ssh root@<IP>

# Check if CLI container is running
docker ps | grep openclaw-cli

# Check logs
cd /home/roboclaw/docker
docker compose logs openclaw-cli --tail 50

# Check if process is running
docker exec openclaw-cli ps aux

# Check terminal settings
stty -a
```

**Common causes:**
- PTY (pseudo-terminal) issues
- Network interruption during SSH
- Container crashed
- Input not being forwarded

**Solution:**

If frozen:
```bash
# Press Ctrl+C to exit
# Then complete onboarding manually:

ssh root@<IP>
sudo -u roboclaw -i
cd ~/docker
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
# Complete onboarding
exit
exit

# Resume deployment
clawctl deploy <IP> --key <path>
```

If container crashed:
```bash
# Check logs for errors
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs openclaw-cli"

# Try running manually
ssh root@<IP>
cd /home/roboclaw/docker
sudo -u roboclaw docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```

---

### Gateway Not Responding

**Symptoms:**
- Gateway container running but not accessible
- Health check fails
- Browser shows connection refused

**Debugging steps:**
```bash
ssh root@<IP>
cd /home/roboclaw/docker

# Check if gateway is running
docker ps | grep openclaw-gateway

# Test gateway health
curl http://localhost:18789/health

# Check logs
docker compose logs openclaw-gateway --tail 50

# Check if port is listening
netstat -tulpn | grep 18789

# Check gateway process inside container
docker exec openclaw-gateway ps aux

# Test from container
docker exec openclaw-gateway curl http://localhost:18789/health

# Check environment variables
docker exec openclaw-gateway env | grep OPENCLAW
```

**Common causes:**
- Gateway crashed after starting
- Invalid OPENCLAW_GATEWAY_TOKEN
- Port binding failed
- Network configuration issue

**Solution:**

For invalid token:
```bash
# Extract correct token
cat /home/roboclaw/.openclaw/openclaw.json | grep token

# Update .env
nano /home/roboclaw/docker/.env
# Set: OPENCLAW_GATEWAY_TOKEN=<correct-token>

# Restart gateway
docker compose down openclaw-gateway
docker compose up -d openclaw-gateway
```

For port issues:
```bash
# Check what's using port
netstat -tulpn | grep 18789

# Change port in .env
nano .env
# Set: OPENCLAW_GATEWAY_PORT=18790

# Restart
docker compose down
docker compose up -d
```

For crashed gateway:
```bash
# Check logs for crash reason
docker compose logs openclaw-gateway --tail 100

# Common fixes:
# - Ensure config file exists: /home/roboclaw/.openclaw/openclaw.json
# - Ensure token in .env matches config
# - Check permissions on mounted volumes
# - Ensure sufficient memory (at least 512MB)

# Restart with clean state
docker compose down openclaw-gateway
docker compose up -d openclaw-gateway
docker compose logs -f openclaw-gateway
```

---

## Error Message Reference

Comprehensive list of error messages with quick links:

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| "Invalid IP address format" | IP format wrong | [Phase 0](#phase-0-validation--configuration) |
| "SSH key not found" | Key doesn't exist | [Phase 0](#phase-0-validation--configuration) |
| "SSH key has insecure permissions" | Wrong permissions | [Phase 0](#phase-0-validation--configuration) |
| "SSH connection failed after 3 attempts" | Connection issue | [Phase 1](#phase-1-ssh-connection) |
| "All configured authentication methods failed" | Auth failed | [Phase 1](#phase-1-ssh-connection) |
| "Insufficient privileges" | Not root | [Phase 1](#phase-1-ssh-connection) |
| "Failed to install base packages" | apt-get failed | [Phase 2](#phase-2-install-base-packages) |
| "Failed to install Docker" | Docker install failed | [Phase 3](#phase-3-install-docker) |
| "Docker installation verification failed" | Docker not working | [Phase 3](#phase-3-install-docker) |
| "Failed to create user" | User creation failed | [Phase 4](#phase-4-setup-deployment-user) |
| "Failed to create directories" | Directory creation failed | [Phase 5](#phase-5-create-directories) |
| "Git clone failed" | Git operation failed | [Phase 6](#phase-6-build-openclaw-image) |
| "Docker image build failed" | Build failed | [Phase 6](#phase-6-build-openclaw-image) |
| "Built image failed verification" | Image verification failed | [Phase 6](#phase-6-build-openclaw-image) |
| "Failed to set file ownership" | chown failed | [Phase 7](#phase-7-upload-docker-compose) |
| "Onboarding failed - config file not found" | Onboarding incomplete | [Phase 8](#phase-8-onboarding--gateway-startup) |
| "Failed to start gateway" | Gateway start failed | [Phase 8](#phase-8-onboarding--gateway-startup) |
| "Gateway failed to start within 30 seconds" | Timeout | [Phase 8](#phase-8-onboarding--gateway-startup) |
| "Failed to create SSH tunnel" | Tunnel creation failed | [Phase 10](#phase-10-auto-connect-optional) |
| "Failed to open browser automatically" | Browser command failed | [Phase 10](#phase-10-auto-connect-optional) |
| "No new pairing request detected" | Pairing timeout | [Phase 10](#phase-10-auto-connect-optional) |

---

## Getting Help

### Information to Provide

When reporting issues or asking for help, include:

1. **Full error message**
   ```bash
   # Copy entire terminal output, especially:
   ✗ Error message here
   ```

2. **Phase where failure occurred**
   ```
   Phase X: Phase Name
   ```

3. **Verbose output**
   ```bash
   clawctl deploy <IP> --key <path> --verbose 2>&1 | tee deployment.log
   # Attach deployment.log
   ```

4. **State file contents**
   ```bash
   ssh root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json"
   ```

5. **Remote system info**
   ```bash
   ssh root@<IP> "lsb_release -a && docker --version && docker compose version"
   ```

6. **What you've tried**
   - Commands you ran
   - Troubleshooting steps followed
   - Results of diagnosis commands

### Where to Get Help

- **GitHub Issues:** https://github.com/anthropics/roboclaw/issues
  - Check existing issues first
  - Create new issue with template
  - Tag with `clawctl` label

- **Documentation:**
  - `PRIMER.md` - Navigation guide
  - `specs/clawctl-spec.md` - Implementation details
  - `specs/clawctl-cli-spec.md` - CLI reference

### Self-Service Resources

Before asking for help:
1. Read this troubleshooting guide thoroughly
2. Search for your error message (Ctrl+F)
3. Try verbose mode: `--verbose`
4. Check deployment state on server
5. Review recent changes to your setup

---

## Preventing Common Issues

### Pre-Deployment Checklist

Before running `clawctl deploy`, verify:

- [ ] Server meets requirements
  - Ubuntu 24.04 LTS or 22.04 LTS
  - At least 2GB RAM
  - At least 10GB free disk space
  - Root SSH access available

- [ ] SSH access verified manually
  ```bash
  ssh -i ~/.ssh/mykey root@<IP>
  ```

- [ ] SSH key has correct permissions
  ```bash
  ls -l ~/.ssh/mykey  # Should be -rw------- (600)
  ```

- [ ] Server has internet connectivity
  ```bash
  ssh root@<IP> "ping -c 3 github.com"
  ```

- [ ] Ports available
  - Port 22 (SSH) open
  - Port 18789 (gateway) not in use

- [ ] No previous failed deployments
  ```bash
  ssh root@<IP> "docker ps -a"  # Check for existing containers
  ```

### Best Practices

**For testing:**
- Test on non-production servers first
- Use VPS snapshots for quick rollback
- Deploy with `--verbose` to see what's happening
- Keep deployment simple (use defaults initially)

**For production:**
- Document your configuration
  - SSH key path
  - Server IPs
  - Instance names
  - Branch deployed
- Maintain server snapshots before deploying
- Monitor disk space and resources
- Keep clawctl updated: `npx clawctl@latest`

**For configuration:**
- Use config files for repeated deployments
- Store instance metadata in version control
- Document custom flags and settings
- Use descriptive instance names

**For security:**
- Use SSH keys, not passwords
- Keep SSH keys secure (600 permissions)
- Don't commit private keys to git
- Use firewall to restrict SSH access

### Maintenance Tips

**Monitor deployments:**
```bash
# Check container status
ssh root@<IP> "docker ps"

# Check disk space
ssh root@<IP> "df -h"

# Check gateway logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs --tail 50 openclaw-gateway"
```

**Regular cleanup:**
```bash
# Remove unused Docker images
ssh root@<IP> "docker system prune -a"

# Check log sizes
ssh root@<IP> "du -sh /home/roboclaw/.roboclaw/logs"
```

**Keep updated:**
```bash
# Update clawctl
npx clawctl@latest --version

# Update OpenClaw (coming in v1.1)
# clawctl update <instance-name>
```

---

## FAQ

### Q: Can I safely retry a failed deployment?

**A:** Yes, clawctl is idempotent. Just re-run the same command:
```bash
clawctl deploy <IP> --key <path>
```
It will resume from the last successful phase.

---

### Q: Will --force delete my data?

**A:** No. `--force` only resets the deployment state tracking file. It does NOT delete:
- Containers
- Images
- roboclaw user
- Configuration files
- Data

Use `--clean` if you want to remove everything.

---

### Q: What's the difference between --force and --clean?

**A:**
- `--force`: Resets state, re-runs all phases, keeps existing resources
- `--clean`: Deletes everything (containers, images, user, data), then deploys fresh

Use `--force` for retry, use `--clean` for fresh start.

---

### Q: How do I update OpenClaw after deployment?

**A:** Update commands are coming in v1.1. For now:
```bash
ssh root@<IP>
cd /home/roboclaw/openclaw-src
sudo -u roboclaw git pull
docker build -t roboclaw/openclaw:local .
cd /home/roboclaw/docker
sudo -u roboclaw docker compose down
sudo -u roboclaw docker compose up -d
```

---

### Q: Can I deploy multiple instances to the same server?

**A:** Not currently. The roboclaw user and ports are fixed. Multi-instance support is planned for v1.1+.

---

### Q: How do I stop/start the gateway after deployment?

**A:**
```bash
# Stop
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose stop openclaw-gateway"

# Start
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose start openclaw-gateway"

# Restart
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose restart openclaw-gateway"
```

Instance management commands coming in v1.1:
```bash
clawctl stop <instance-name>
clawctl start <instance-name>
clawctl restart <instance-name>
```

---

### Q: Where are the logs stored?

**A:** On the remote server:
```bash
# Gateway logs (Docker)
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs openclaw-gateway"

# Application logs
ssh root@<IP> "ls /home/roboclaw/.roboclaw/logs/"

# Session logs
ssh root@<IP> "ls /home/roboclaw/.roboclaw/sessions/"
```

---

### Q: How do I connect to the gateway after deployment?

**A:** Create SSH tunnel and open browser:
```bash
# Create tunnel
ssh -L 18789:localhost:18789 -i ~/.ssh/mykey root@<IP> -N -f

# Open browser
open http://localhost:18789  # macOS
xdg-open http://localhost:18789  # Linux

# With token (from deployment output)
open http://localhost:18789/?token=<your-token>
```

Or use auto-connect feature (default in v1.0.1+).

---

### Q: Can I skip onboarding?

**A:** Yes:
```bash
clawctl deploy <IP> --key <path> --skip-onboard
```

Then complete onboarding manually:
```bash
ssh root@<IP>
sudo -u roboclaw -i
cd ~/docker
docker compose run --rm -it openclaw-cli onboard --no-install-daemon
```

---

### Q: How do I completely remove a deployment?

**A:**
```bash
# Use --clean flag
clawctl deploy <IP> --key <path> --clean

# Or manual cleanup (more thorough)
ssh root@<IP>
cd /home/roboclaw/docker
docker compose down
docker rmi roboclaw/openclaw:local
userdel -r roboclaw
rm -rf /root/openclaw-build
exit
```

---

## Quick Reference Commands

```bash
# ============================================
# Deployment
# ============================================

# Basic deployment
clawctl deploy <IP> --key <path>

# With verbose output
clawctl deploy <IP> --key <path> --verbose

# Resume failed deployment (automatic)
clawctl deploy <IP> --key <path>

# Force fresh deployment (ignore state)
clawctl deploy <IP> --key <path> --force

# Complete cleanup and redeploy
clawctl deploy <IP> --key <path> --clean

# Skip onboarding wizard
clawctl deploy <IP> --key <path> --skip-onboard

# Skip auto-connect feature
clawctl deploy <IP> --key <path> --no-auto-connect

# Deploy specific branch
clawctl deploy <IP> --key <path> --branch develop

# ============================================
# Checking Status
# ============================================

# Check remote deployment state
ssh root@<IP> "cat /home/roboclaw/.clawctl-deploy-state.json"

# Check containers
ssh root@<IP> "docker ps"
ssh root@<IP> "docker ps -a"  # Including stopped

# Check images
ssh root@<IP> "docker images"

# Check user
ssh root@<IP> "id roboclaw"

# Check directories
ssh root@<IP> "ls -la /home/roboclaw"

# ============================================
# Gateway Management
# ============================================

# View gateway logs
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs openclaw-gateway"

# Follow logs (real-time)
ssh root@<IP> "cd /home/roboclaw/docker && docker compose logs -f openclaw-gateway"

# Restart gateway
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose restart openclaw-gateway"

# Stop gateway
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose stop openclaw-gateway"

# Start gateway
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose start openclaw-gateway"

# Check gateway health
ssh root@<IP> "curl http://localhost:18789/health"

# ============================================
# Connecting to Gateway
# ============================================

# Create SSH tunnel
ssh -L 18789:localhost:18789 -i ~/.ssh/mykey root@<IP> -N -f

# Kill SSH tunnel
pkill -f "ssh.*18789:localhost:18789"

# Access gateway (after tunnel)
# Browser: http://localhost:18789

# ============================================
# Device Pairing
# ============================================

# List devices and pending requests
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose exec openclaw-gateway node dist/index.js devices list"

# Approve device pairing
ssh root@<IP> "cd /home/roboclaw/docker && sudo -u roboclaw docker compose exec openclaw-gateway node dist/index.js devices approve <request-id>"

# ============================================
# Debugging
# ============================================

# Check disk space
ssh root@<IP> "df -h"

# Check memory
ssh root@<IP> "free -h"

# Check Docker daemon
ssh root@<IP> "docker info"

# Check Docker service
ssh root@<IP> "systemctl status docker"

# Check network connectivity
ssh root@<IP> "ping -c 3 github.com"

# Check DNS
ssh root@<IP> "nslookup github.com"

# Check port usage
ssh root@<IP> "netstat -tulpn | grep 18789"

# Check Docker Compose config
ssh root@<IP> "cd /home/roboclaw/docker && docker compose config"

# ============================================
# Manual Cleanup
# ============================================

# Stop all containers
ssh root@<IP> "cd /home/roboclaw/docker && docker compose down"

# Remove containers
ssh root@<IP> "cd /home/roboclaw/docker && docker compose rm -f"

# Remove OpenClaw image
ssh root@<IP> "docker rmi roboclaw/openclaw:local"

# Remove build source
ssh root@<IP> "rm -rf /home/roboclaw/openclaw-src"

# Remove user (CAUTION: deletes all data)
ssh root@<IP> "userdel -r roboclaw"

# Remove state file
ssh root@<IP> "rm -f /home/roboclaw/.clawctl-deploy-state.json"

# Docker cleanup (free space)
ssh root@<IP> "docker system prune -a"

# ============================================
# Configuration
# ============================================

# View .env file
ssh root@<IP> "cat /home/roboclaw/docker/.env"

# View docker-compose.yml
ssh root@<IP> "cat /home/roboclaw/docker/docker-compose.yml"

# View OpenClaw config
ssh root@<IP> "cat /home/roboclaw/.openclaw/openclaw.json"

# ============================================
# Version Info
# ============================================

# Check clawctl version
npx clawctl --version

# Check Docker version
ssh root@<IP> "docker --version"
ssh root@<IP> "docker compose version"

# Check Ubuntu version
ssh root@<IP> "lsb_release -a"
```

---

## Appendix: Exit Codes

clawctl uses the following exit codes:

| Code | Meaning | Phase |
|------|---------|-------|
| 0 | Success | - |
| 1 | General failure | Multiple |
| 2 | Insufficient privileges | Phase 1 |

**Note:** Specific phase numbers are not used as exit codes. Check error messages and verbose output to identify which phase failed.

---

**End of Troubleshooting Guide**

For additional help, see:
- `PRIMER.md` - Project navigation
- `specs/clawctl-spec.md` - Technical implementation details
- `specs/clawctl-cli-spec.md` - CLI reference
- GitHub Issues: https://github.com/anthropics/roboclaw/issues
