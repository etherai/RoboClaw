# OpenClaw Docker Containerization Specification

## Overview

This specification describes the transition from native OpenClaw installation (via pnpm) to a Docker container-based deployment. Running OpenClaw in a Docker container improves security by isolating it from the host system and provides better portability and reproducibility.

**Last Updated:** 2026-02-04
**Version:** 1.1 (Draft - Updated)
**Status:** Proposed

## Document Updates

**Version 1.1 Changes:**
- ✅ Changed from `alpine/openclaw` to custom-built `roboclaw/openclaw` image
- ✅ Changed from root user (0:0) to node user (1000:1000) for security
- ✅ Changed mount paths from `/root` to `/home/node`
- ✅ Added image build and testing scripts
- ✅ Added Docker Compose v2 compatibility checks
- ✅ Added comprehensive error handling to wrapper script
- ✅ Added vetting workflow for upstream changes
- ✅ Clarified base image is Debian Bookworm (not Alpine)
- ✅ Added health checks using OpenClaw commands (not curl)
- ✅ Added init process for proper signal handling

**Key Decision: Hybrid Deployment Approach**

This spec supports **two deployment modes**:

1. **Development Mode** (current): Build image on remote server
   - Fast iteration during development
   - No registry setup required
   - Test changes quickly

2. **Production Mode** (future): Pull from your registry
   - Vetted, tested images only
   - Version control and rollback
   - Consistent across all servers

This provides flexibility during development while maintaining a path to production-grade deployments with **version control** and **security vetting**.

## Quick Summary

**Current (Native Installation):**
```bash
# OpenClaw installed via pnpm globally
pnpm install -g openclaw@latest
openclaw --version
```

**Proposed (Docker Container):**
```bash
# Build and publish custom OpenClaw image
./cli/docker/build-openclaw-image.sh v2026.2.4
docker push roboclaw/openclaw:v2026.2.4
docker push roboclaw/openclaw:latest

# Deploy to servers (pulls from your registry)
./cli/run-deploy.sh <IP> -k <key> -n <instance>

# Run commands via wrapper script
openclaw --version  # Transparent Docker execution
```

## Motivation

### Current Limitations

1. **Security:** Native installation gives OpenClaw full access to the host system
2. **Dependency Conflicts:** Node.js/pnpm versions can conflict with other system software
3. **Reproducibility:** Different pnpm/Node.js versions across servers can cause inconsistencies
4. **Cleanup:** Uninstalling leaves behind pnpm packages and configurations

### Benefits of Containerization

1. **Isolation:** OpenClaw runs in its own environment with limited host access
2. **Consistency:** Same Docker image runs identically on all servers
3. **Security:** Container runs as non-root user (UID 1000) for defense in depth
4. **Portability:** Easy to move between servers or cloud providers
5. **Controlled Updates:** Build and vet changes before deployment
6. **Version Control:** Pin specific image versions for stability
7. **Supply Chain Security:** Control entire image build process

## Architecture

### Component Overview

```
Docker Host (Target Server)
├── Docker Engine (already installed)
├── roboclaw user (UID 1000)
│   ├── ~/.openclaw/          # OpenClaw config (mounted volume)
│   ├── ~/.roboclaw/          # RoboClaw data (mounted volume)
│   └── ~/docker/
│       ├── docker-compose.yml
│       └── .env              # Image configuration
├── Docker Images
│   └── roboclaw/openclaw:latest  # Custom built, from your registry
└── Docker Containers
    ├── openclaw-cli          # On-demand for commands
    └── openclaw-gateway      # Long-running service
```

### Container Architecture

```
┌──────────────────────────────────────────────┐
│ roboclaw/openclaw:latest Container           │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Debian Bookworm Base (node:22)          │ │
│  │  ├── Node.js 22 runtime                 │ │
│  │  ├── OpenClaw CLI & Gateway             │ │
│  │  └── User: node (UID 1000) NON-ROOT     │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  Mounted Volumes:                             │
│  ├── /home/node/.openclaw ← /home/roboclaw   │
│  └── /home/node/.roboclaw ← /home/roboclaw   │
│                                               │
│  Security: Non-root user, isolated namespace │
└──────────────────────────────────────────────┘
```

## Implementation Design

### 1. Docker Compose Configuration

**New File:** `cli/docker/docker-compose.openclaw.yml`

```yaml
version: '3.8'

services:
  # Interactive CLI for onboarding and setup
  openclaw-cli:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:latest}
    container_name: openclaw-cli
    stdin_open: true
    tty: true
    user: "1000:1000"  # Run as node user (non-root)
    environment:
      HOME: /home/node
      TERM: xterm-256color
    volumes:
      - /home/roboclaw/.openclaw:/home/node/.openclaw
      - /home/roboclaw/.roboclaw:/home/node/.roboclaw
    profiles:
      - cli  # Only run when explicitly invoked

  # Long-running gateway service
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:latest}
    container_name: openclaw-gateway
    restart: unless-stopped
    user: "1000:1000"  # Run as node user (non-root)
    environment:
      HOME: /home/node
      TERM: xterm-256color
    ports:
      - "127.0.0.1:18789:18789"  # Gateway API (localhost only)
    volumes:
      - /home/roboclaw/.openclaw:/home/node/.openclaw
      - /home/roboclaw/.roboclaw:/home/node/.roboclaw
    command: ["node", "dist/index.js", "gateway", "start"]
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "gateway", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    init: true  # Proper signal handling
```

**Design Decisions:**

- **Two Services:** Separate CLI (interactive) and gateway (daemon) containers
- **Profiles:** CLI service uses `cli` profile to prevent auto-start
- **Non-Root User:** User `1000:1000` (node user) for security - matches roboclaw UID on host
- **Volume Mounts:** Mount to `/home/node` (not `/root`) - files owned by roboclaw on host
- **Port Binding:** Localhost only for security (SSH tunnel for remote access)
- **Custom Image:** Pulls from your registry (`roboclaw/openclaw:latest`)
- **Docker Compose v2:** Compatible syntax, uses `docker compose` (not `docker-compose`)
- **Health Check:** Uses OpenClaw's built-in health command (no curl dependency)
- **Init Process:** Proper signal handling and zombie reaping

### 2. Deployment Modes

**Purpose:** Support both rapid development iteration and production-grade deployments.

This specification supports two deployment modes that can be toggled via Ansible variables:

#### Mode Comparison

| Aspect | Development Mode | Production Mode |
|--------|------------------|-----------------|
| **Image Source** | Built on remote server | Pulled from registry |
| **Deployment Time** | ~5-10 minutes (build time) | ~1-2 minutes (pull only) |
| **Use Case** | Testing, iteration, development | Production deployments |
| **Requirements** | Git, build tools on server | Docker registry access |
| **Consistency** | Each server builds independently | Identical image across servers |
| **Rollback** | Rebuild from different branch | Change image tag |
| **Disk Usage** | Source code + image (~1GB) | Image only (~500MB) |
| **When to Use** | Initial setup, testing changes | Stable production deployments |

#### Development Mode (Build on Remote)

**Purpose:** Rapid iteration and testing during development phase.

**How it works:**
1. Ansible clones OpenClaw repository to remote server
2. Builds Docker image on the server: `docker build -t roboclaw/openclaw:local`
3. Image available immediately for testing
4. No registry push/pull needed

**Ansible Configuration:**
```yaml
vars:
  openclaw_mode: development  # Enable development mode
  openclaw_repo_url: https://github.com/openclaw/openclaw.git
  openclaw_repo_branch: main  # Can test different branches
  openclaw_image: roboclaw/openclaw:local
```

**Advantages:**
- ✅ No registry setup required
- ✅ Fast iteration (change code → rebuild → test)
- ✅ Easy to test specific branches or commits
- ✅ Good for development and experimentation
- ✅ No authentication needed

**Disadvantages:**
- ⚠️ Build time adds 5-10 minutes per deployment
- ⚠️ Requires Git and build dependencies on server
- ⚠️ Each server may have slightly different build
- ⚠️ Uses more disk space (source + image)
- ⚠️ Build artifacts left on server

**When to use:**
- Initial development and testing
- Experimenting with configuration changes
- Testing upstream OpenClaw updates
- Before setting up production registry

#### Production Mode (Pull from Registry)

**Purpose:** Deploy vetted, tested images to production servers.

**How it works:**
1. Build and test image locally (or in CI/CD)
2. Push to your Docker registry
3. Ansible pulls pre-built image from registry
4. All servers run identical tested image

**Ansible Configuration:**
```yaml
vars:
  openclaw_mode: production  # Enable production mode
  openclaw_image: roboclaw/openclaw:v2026.2.4  # Specific version
  openclaw_registry_url: docker.io  # or ghcr.io, custom registry
```

**Advantages:**
- ✅ Fast deployment (1-2 minutes)
- ✅ Identical images across all servers
- ✅ Version control via image tags
- ✅ Easy rollback (change tag, redeploy)
- ✅ No build dependencies on servers
- ✅ Security vetting before deployment

**Disadvantages:**
- ⚠️ Requires registry setup and authentication
- ⚠️ Must build/push before deploying
- ⚠️ Additional step in workflow

**When to use:**
- Production deployments
- After initial development phase
- When deploying to multiple servers
- When you need version control and rollback

### 3. Image Build & Registry

**Purpose:** Build and publish vetted OpenClaw images (for production mode).

**Note:** This section applies to **production mode** only. Development mode builds directly on the remote server.

#### Why Custom Images?

Building your own images provides:
- **Version Control:** Deploy only after reviewing upstream changes
- **Security Vetting:** Audit code before it runs on your servers
- **Supply Chain Control:** No dependency on third-party image publishers
- **Customization:** Add organization-specific configurations or tools
- **Audit Trail:** Track exactly which version runs on each instance

#### Registry Options

You can publish to:
- **Docker Hub:** `docker.io/your-org/openclaw` (public or private)
- **GitHub Container Registry:** `ghcr.io/your-org/openclaw` (free private repos)
- **Private Registry:** `registry.example.com/openclaw` (full control)

**Set registry via environment variable:**
```bash
export OPENCLAW_REGISTRY="your-dockerhub-username"
# or
export OPENCLAW_REGISTRY="ghcr.io/your-github-org"
```

#### Build Script

**New File:** `cli/docker/build-openclaw-image.sh`

```bash
#!/bin/bash
set -euo pipefail

VERSION="${1:-latest}"
REGISTRY="${OPENCLAW_REGISTRY:-roboclaw}"
IMAGE_NAME="${REGISTRY}/openclaw"

echo "Building OpenClaw image: ${IMAGE_NAME}:${VERSION}"

# Clone or update OpenClaw source
if [ -d "openclaw-src" ]; then
    cd openclaw-src
    git fetch origin
    git checkout main
    git pull
    cd ..
else
    git clone https://github.com/openclaw/openclaw.git openclaw-src
fi

cd openclaw-src

# Build image from official Dockerfile
docker build \
    -t "${IMAGE_NAME}:${VERSION}" \
    -t "${IMAGE_NAME}:latest" \
    --build-arg OPENCLAW_DOCKER_APT_PACKAGES="" \
    .

cd ..

echo "✓ Built ${IMAGE_NAME}:${VERSION}"
echo ""
echo "Next steps:"
echo "  1. Test: ./cli/docker/test-openclaw-image.sh ${IMAGE_NAME}:${VERSION}"
echo "  2. Push: docker push ${IMAGE_NAME}:${VERSION}"
echo "  3. Push: docker push ${IMAGE_NAME}:latest"
```

#### Test Script

**New File:** `cli/docker/test-openclaw-image.sh`

```bash
#!/bin/bash
set -euo pipefail

IMAGE="${1:-roboclaw/openclaw:latest}"

echo "Testing OpenClaw image: ${IMAGE}"

# Test 1: Version check
echo "→ Test 1: Version check"
if docker run --rm -e HOME=/home/node "${IMAGE}" --version; then
    echo "✓ Version check passed"
else
    echo "✗ Version check failed"
    exit 1
fi

# Test 2: Gateway command exists
echo "→ Test 2: Gateway command exists"
if docker run --rm -e HOME=/home/node "${IMAGE}" gateway --help >/dev/null 2>&1; then
    echo "✓ Gateway command available"
else
    echo "✗ Gateway command failed"
    exit 1
fi

# Test 3: User permissions (should be non-root)
echo "→ Test 3: User is non-root"
USER_ID=$(docker run --rm "${IMAGE}" id -u)
if [ "$USER_ID" != "0" ]; then
    echo "✓ Running as non-root user (UID: $USER_ID)"
else
    echo "✗ WARNING: Running as root (UID: 0)"
fi

echo ""
echo "✓ All tests passed"
```

#### Vetting Workflow

Before publishing a new version:

1. **Review upstream changes:**
   ```bash
   cd openclaw-src
   git log --oneline --since="$(git describe --tags --abbrev=0)"
   git diff v2026.1.29..HEAD
   ```

2. **Build test image:**
   ```bash
   ./cli/docker/build-openclaw-image.sh test-$(date +%Y%m%d)
   ```

3. **Test image:**
   ```bash
   ./cli/docker/test-openclaw-image.sh roboclaw/openclaw:test-20260204
   ```

4. **Deploy to staging instance (if available):**
   ```bash
   OPENCLAW_IMAGE=roboclaw/openclaw:test-20260204 \
     ansible-playbook cli/reconfigure.yml -i staging,
   ```

5. **Promote to production:**
   ```bash
   docker tag roboclaw/openclaw:test-20260204 roboclaw/openclaw:v2026.2.4
   docker tag roboclaw/openclaw:test-20260204 roboclaw/openclaw:latest
   docker push roboclaw/openclaw:v2026.2.4
   docker push roboclaw/openclaw:latest
   ```

#### Image Configuration

**New File:** `cli/docker/.env.example`

```bash
# OpenClaw Docker Image Configuration
# Copy to .env and customize (not tracked in git)

OPENCLAW_IMAGE=roboclaw/openclaw:latest

# For testing specific versions:
# OPENCLAW_IMAGE=roboclaw/openclaw:v2026.2.4
```

### 4. Wrapper Script

**Purpose:** Allow users to run `openclaw` command transparently via Docker with error handling.

**Note:** This wrapper works the same in both development and production modes.

**Location:** `/home/roboclaw/.local/bin/openclaw`

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

# Check Docker is accessible
docker info >/dev/null 2>&1 || error_exit "Docker is not running or not accessible"

# Check compose file exists
[ -f "$COMPOSE_FILE" ] || error_exit "Docker Compose file not found: $COMPOSE_FILE"

# Check if image exists (any openclaw image)
if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "openclaw"; then
    error_exit "OpenClaw image not found. Run deployment playbook first."
fi

# Execute command in CLI container
cd "$COMPOSE_DIR"
exec docker compose run --rm -it openclaw-cli "$@"
```

**Features:**
- Error handling for common failures
- Docker availability check
- Compose file existence check
- Image existence verification
- Clear error messages

**Usage:**
```bash
# User runs normal command
openclaw --version

# Wrapper translates to:
cd /home/roboclaw/docker
docker compose run --rm -it openclaw-cli --version
```

### 5. Ansible Playbook Changes

#### Modify `cli/reconfigure.yml`

**Current Tasks (Lines 186-222):**
- Configure pnpm for roboclaw user
- Install OpenClaw globally via pnpm
- Configure .bashrc with pnpm paths
- Verify openclaw --version

**Add Playbook Variables:**
```yaml
vars:
  # Deployment mode
  openclaw_mode: development  # 'development' or 'production'

  # Development mode settings
  openclaw_repo_url: https://github.com/openclaw/openclaw.git
  openclaw_repo_branch: main

  # Production mode settings
  openclaw_image: "roboclaw/openclaw:latest"  # Override with -e openclaw_image=...
  openclaw_registry: "roboclaw"               # Your Docker Hub username or registry
```

**Replacement Tasks (Mode-Aware):**
```yaml
# ============================================
# Common Tasks (Both Modes)
# ============================================

# Verify Docker Compose v2 is available
- name: Verify Docker Compose v2
  ansible.builtin.shell:
    cmd: docker compose version
  register: compose_version
  changed_when: false
  failed_when: compose_version.rc != 0
  tags: [docker, always]

- name: Check Docker Compose version is v2
  ansible.builtin.assert:
    that:
      - "'version' in compose_version.stdout.lower()"
      - "'v2.' in compose_version.stdout or 'version 2.' in compose_version.stdout"
    fail_msg: "Docker Compose v2 is required (found: {{ compose_version.stdout }})"
    success_msg: "Docker Compose v2 detected"
  tags: [docker, always]

# Display deployment mode
- name: Display deployment mode
  ansible.builtin.debug:
    msg: "Deploying OpenClaw in {{ openclaw_mode | upper }} mode"
  tags: [roboclaw, always]

# Create Docker directory structure
- name: Create docker directory
  ansible.builtin.file:
    path: "{{ roboclaw_home }}/docker"
    state: directory
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0755'
  tags: [roboclaw, always]

# Create OpenClaw data directories with correct permissions
- name: Create OpenClaw data directories
  ansible.builtin.file:
    path: "{{ item }}"
    state: directory
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0755'
  loop:
    - "{{ roboclaw_home }}/.openclaw"
    - "{{ roboclaw_home }}/.openclaw/workspace"
    - "{{ roboclaw_home }}/.roboclaw"
  tags: [roboclaw, always]

# Verify roboclaw user has UID 1000 (matches container node user)
- name: Verify roboclaw user UID
  ansible.builtin.shell:
    cmd: id -u {{ roboclaw_user }}
  register: roboclaw_uid
  changed_when: false
  failed_when: roboclaw_uid.stdout != "1000"
  tags: [roboclaw, always]

# ============================================
# Development Mode Tasks
# ============================================

- name: Development mode image build
  when: openclaw_mode == 'development'
  tags: [roboclaw, openclaw-build]
  block:
    - name: Install build dependencies
      ansible.builtin.apt:
        name:
          - git
          - build-essential
        state: present
      become: true

    - name: Clone OpenClaw repository
      ansible.builtin.git:
        repo: "{{ openclaw_repo_url }}"
        dest: "{{ roboclaw_home }}/openclaw-src"
        version: "{{ openclaw_repo_branch }}"
        force: true
      become: true
      become_user: "{{ roboclaw_user }}"

    - name: Build OpenClaw Docker image on remote
      community.docker.docker_image:
        name: roboclaw/openclaw
        tag: local
        source: build
        build:
          path: "{{ roboclaw_home }}/openclaw-src"
          pull: true
        state: present
      become: true
      become_user: "{{ roboclaw_user }}"
      register: build_result

    - name: Display build result
      ansible.builtin.debug:
        msg: "Built OpenClaw image: {{ build_result.image.Id | default('unknown') }}"

    - name: Set development image name
      ansible.builtin.set_fact:
        openclaw_image_final: "roboclaw/openclaw:local"

# ============================================
# Production Mode Tasks
# ============================================

- name: Production mode image pull
  when: openclaw_mode == 'production'
  tags: [roboclaw, openclaw-image]
  block:
    - name: Pull OpenClaw Docker image from registry
      community.docker.docker_image:
        name: "{{ openclaw_image }}"
        source: pull
        state: present
      become: true
      become_user: "{{ roboclaw_user }}"

    - name: Verify image was pulled successfully
      ansible.builtin.shell:
        cmd: docker images {{ openclaw_image }} --format "{{.Repository}}:{{.Tag}}"
      become: true
      become_user: "{{ roboclaw_user }}"
      register: openclaw_image_check
      changed_when: false
      failed_when: openclaw_image_check.stdout == ""

    - name: Set production image name
      ansible.builtin.set_fact:
        openclaw_image_final: "{{ openclaw_image }}"

# ============================================
# Common Tasks (Continued)
# ============================================

# Create .env file for Docker Compose
- name: Create Docker Compose environment file
  ansible.builtin.copy:
    content: |
      OPENCLAW_IMAGE={{ openclaw_image_final }}
    dest: "{{ roboclaw_home }}/docker/.env"
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0644'
  tags: roboclaw

# Copy Docker Compose configuration
- name: Copy docker-compose.yml to server
  ansible.builtin.template:
    src: docker/docker-compose.openclaw.yml
    dest: "{{ roboclaw_home }}/docker/docker-compose.yml"
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0644'
  tags: roboclaw

# Create wrapper script with error handling
- name: Create openclaw wrapper script
  ansible.builtin.copy:
    content: |
      #!/bin/bash
      set -euo pipefail

      COMPOSE_DIR="{{ roboclaw_home }}/docker"
      COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

      error_exit() {
          echo "Error: $1" >&2
          exit 1
      }

      docker info >/dev/null 2>&1 || error_exit "Docker is not running"
      [ -f "$COMPOSE_FILE" ] || error_exit "Compose file not found"

      if ! docker images --format "{{.Repository}}:{{.Tag}}" | grep -q "openclaw"; then
          error_exit "OpenClaw image not found"
      fi

      cd "$COMPOSE_DIR"
      exec docker compose run --rm -it openclaw-cli "$@"
    dest: "{{ roboclaw_home }}/.local/bin/openclaw"
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0755'
  tags: roboclaw

# Update .bashrc with PATH only (no pnpm config)
- name: Configure .bashrc for roboclaw user
  ansible.builtin.blockinfile:
    path: "{{ roboclaw_home }}/.bashrc"
    marker: "# {mark} ANSIBLE MANAGED BLOCK - RoboClaw"
    block: |
      # OpenClaw Docker wrapper in PATH
      export PATH="{{ roboclaw_home }}/.local/bin:$PATH"
    create: true
    owner: "{{ roboclaw_user }}"
    group: "{{ roboclaw_user }}"
    mode: '0644'
  tags: [roboclaw, always]

# Verify container runs as non-root
- name: Verify OpenClaw runs as non-root
  ansible.builtin.shell:
    cmd: docker run --rm -e HOME=/home/node {{ openclaw_image_final }} id -u
  become: true
  become_user: "{{ roboclaw_user }}"
  register: container_uid
  changed_when: false
  tags: [roboclaw, always]

- name: Assert container is non-root
  ansible.builtin.assert:
    that:
      - container_uid.stdout != "0"
    fail_msg: "Container runs as root (UID 0) - security issue!"
    success_msg: "Container runs as UID {{ container_uid.stdout }} (non-root)"
  tags: [roboclaw, always]
```

**Key Changes:**
- Added `openclaw_mode` variable to control deployment mode
- Development mode: Clones repo and builds image on remote server
- Production mode: Pulls image from registry
- Both modes set `openclaw_image_final` variable for downstream tasks
- `.env` file uses appropriate image based on mode

#### Usage Examples

**Development Mode Deployment (Default):**
```bash
# Deploy with development mode (builds on remote)
./cli/run-deploy.sh <IP> -k <key> -n <instance>

# Or explicitly specify mode
ansible-playbook cli/reconfigure.yml \
  -i "<IP>," \
  --private-key=<key> \
  -e "openclaw_mode=development"
```

**Test Different Branch:**
```bash
ansible-playbook cli/reconfigure.yml \
  -i "<IP>," \
  --private-key=<key> \
  -e "openclaw_mode=development" \
  -e "openclaw_repo_branch=feature/new-feature"
```

**Production Mode Deployment (Future):**
```bash
# Deploy specific version from registry
ansible-playbook cli/reconfigure.yml \
  -i "<IP>," \
  --private-key=<key> \
  -e "openclaw_mode=production" \
  -e "openclaw_image=roboclaw/openclaw:v2026.2.4"
```

**Rebuild in Development Mode:**
```bash
# Force rebuild (useful after making changes)
ansible-playbook cli/reconfigure.yml \
  -i "<IP>," \
  --private-key=<key> \
  -e "openclaw_mode=development" \
  --tags openclaw-build
```

**Tasks to Remove:**
- Lines 186-195: pnpm configuration
- Lines 197-208: Native OpenClaw installation
- Lines 215-217: pnpm-related .bashrc exports

**Tasks to Keep:**
- Lines 169-184: Directory creation (enhanced with OpenClaw data dirs)
- Lines 210-222: .bashrc configuration (modified to remove pnpm)

#### Modify `cli/connect-instance.sh` (Renumber to match new structure)

**Current Implementation (Lines 119-126):**
```bash
if [ -n "$OPENCLAW_CMD" ]; then
    REMOTE_CMD="su - roboclaw -c 'openclaw $OPENCLAW_CMD'"
else
    REMOTE_CMD="su - roboclaw"
fi
```

**Proposed Implementation:**
```bash
if [ -n "$OPENCLAW_CMD" ]; then
    # Run via Docker Compose for full interactivity
    REMOTE_CMD="su - roboclaw -c 'cd ~/docker && docker compose run --rm -it openclaw-cli openclaw $OPENCLAW_CMD'"
else
    # Interactive shell as roboclaw user
    REMOTE_CMD="su - roboclaw"
fi
```

**Why this approach:**
- Uses `docker compose run` instead of wrapper script for better TTY handling
- Explicit `-it` flags ensure interactive onboarding wizard works correctly
- `--rm` flag auto-removes container after command completes

#### Replace `cli/openclaw-service.yml`

**Current Approach:** Manage systemd service (expects service created by `openclaw gateway install`)

**Proposed Approach:** Manage Docker Compose service directly

```yaml
---
# Manage the OpenClaw Docker container on a remote instance
# Usage: ansible-playbook openclaw-service.yml -i "IP," --private-key=KEY -e "openclaw_state=started"

- name: Manage OpenClaw Docker service
  hosts: all
  remote_user: root
  gather_facts: false

  vars:
    openclaw_state: started        # 'started' or 'stopped'
    openclaw_enabled: true         # auto-restart enabled
    roboclaw_user: roboclaw
    roboclaw_home: /home/roboclaw
    instance_name: ""

  tasks:
    - name: Check if docker-compose.yml exists
      ansible.builtin.stat:
        path: "{{ roboclaw_home }}/docker/docker-compose.yml"
      register: compose_file

    - name: Fail if Docker Compose file not found
      ansible.builtin.fail:
        msg: >
          Docker Compose file not found at {{ roboclaw_home }}/docker/docker-compose.yml.
          Please run the reconfigure playbook first.
      when: not compose_file.stat.exists

    - name: Start openclaw-gateway container
      ansible.builtin.shell:
        cmd: docker compose up -d openclaw-gateway
        chdir: "{{ roboclaw_home }}/docker"
      become: true
      become_user: "{{ roboclaw_user }}"
      when: openclaw_state == 'started'

    - name: Stop openclaw-gateway container
      ansible.builtin.shell:
        cmd: docker compose down
        chdir: "{{ roboclaw_home }}/docker"
      become: true
      become_user: "{{ roboclaw_user }}"
      when: openclaw_state == 'stopped'

    - name: Get container status
      ansible.builtin.shell:
        cmd: docker compose ps openclaw-gateway --format json
        chdir: "{{ roboclaw_home }}/docker"
      become: true
      become_user: "{{ roboclaw_user }}"
      register: container_status
      changed_when: false
      when: openclaw_state == 'started'

    # Fetch gateway token and update instance YAML (same as before)
    - name: Check if openclaw.json config exists
      ansible.builtin.stat:
        path: "{{ roboclaw_home }}/.openclaw/openclaw.json"
      register: openclaw_config_file
      when: openclaw_state == 'started'

    - name: Fetch openclaw.json from remote
      ansible.builtin.slurp:
        src: "{{ roboclaw_home }}/.openclaw/openclaw.json"
      register: openclaw_config_content
      when: openclaw_state == 'started' and openclaw_config_file.stat.exists

    - name: Extract gateway token from config
      ansible.builtin.set_fact:
        gateway_token: "{{ (openclaw_config_content.content | b64decode | from_json).gateway.auth.token | default('') }}"
      when: >
        openclaw_state == 'started' and
        openclaw_config_file.stat.exists and
        openclaw_config_content.content is defined

    - name: Build instance YAML path
      ansible.builtin.set_fact:
        instance_yaml_path: "../instances/{{ instance_name }}.yml"
      when: >
        openclaw_state == 'started' and
        gateway_token is defined and
        gateway_token != '' and
        instance_name != ''
      delegate_to: localhost
      become: false

    - name: Update instance YAML with gateway token
      ansible.builtin.lineinfile:
        path: "{{ instance_yaml_path }}"
        regexp: '^\s*gateway_token:'
        line: "      gateway_token: {{ gateway_token }}"
        insertafter: '^\s*software:'
        state: present
      when: >
        openclaw_state == 'started' and
        gateway_token is defined and
        gateway_token != '' and
        instance_yaml_path is defined
      delegate_to: localhost
      become: false
```

**Key Changes:**
- Replace systemd service checks with docker-compose.yml check
- Use `docker compose up -d` to start gateway
- Use `docker compose down` to stop
- Use `docker compose ps` to get status
- Keep gateway token extraction logic (unchanged)

### 6. Validation Updates

#### Update `cli/validate-instance.sh`

**Current Validation:**
```bash
# Test: Verify OpenClaw Installation
print_check "Verifying OpenClaw is installed globally via pnpm"
ACTUAL_VERSION=$(ssh_exec "openclaw --version" 2>/dev/null)
```

**Proposed Validation:**
```bash
# Test: Verify OpenClaw Docker Setup
print_header "OPENCLAW DOCKER SETUP"

print_check "Verifying OpenClaw Docker image exists"
if ssh_exec "docker images openclaw:local --format '{{.Repository}}:{{.Tag}}'" | grep -q "openclaw:local"; then
    print_success "OpenClaw Docker image found"
else
    print_fail "OpenClaw Docker image NOT found"
fi

print_check "Verifying docker-compose.yml exists"
if ssh_exec "test -f /home/roboclaw/docker/docker-compose.yml && echo yes"; then
    print_success "docker-compose.yml found"
else
    print_fail "docker-compose.yml NOT found"
fi

print_check "Verifying openclaw wrapper script"
if ssh_exec "test -x /home/roboclaw/.local/bin/openclaw && echo yes"; then
    print_success "openclaw wrapper script exists and is executable"
else
    print_fail "openclaw wrapper script NOT found or not executable"
fi

print_check "Verifying OpenClaw container can run"
ACTUAL_VERSION=$(ssh_exec "docker run --rm -e HOME=/home/node roboclaw/openclaw:latest --version" 2>/dev/null)
if [ -n "$ACTUAL_VERSION" ]; then
    print_success "OpenClaw Docker version: $ACTUAL_VERSION"
else
    print_fail "OpenClaw container failed to run"
fi

print_check "Verifying container runs as non-root"
CONTAINER_UID=$(ssh_exec "docker run --rm roboclaw/openclaw:latest id -u" 2>/dev/null)
if [ "$CONTAINER_UID" = "1000" ]; then
    print_success "Container runs as UID 1000 (non-root)"
elif [ "$CONTAINER_UID" = "0" ]; then
    print_fail "Container runs as root (UID 0) - security issue!"
else
    print_warn "Container runs as UID $CONTAINER_UID (unexpected)"
fi

print_check "Checking gateway container status"
GATEWAY_STATUS=$(ssh_exec "cd /home/roboclaw/docker && docker compose ps openclaw-gateway --format '{{.Status}}'" 2>/dev/null || echo "not running")
echo "  Gateway: $GATEWAY_STATUS"
```

#### Update `cli/validate-openclaw.yml`

**Current Tasks:**
```yaml
- name: Verify openclaw installation
  ansible.builtin.shell: |
    export PATH="{{ roboclaw_home }}/.local/bin:$PATH"
    openclaw --version
```

**Proposed Tasks:**
```yaml
- name: Check if OpenClaw Docker image exists
  ansible.builtin.shell: |
    docker images openclaw:local --format "{{.Repository}}:{{.Tag}}"
  become: true
  become_user: "{{ roboclaw_user }}"
  register: openclaw_image
  changed_when: false
  failed_when: false

- name: Display OpenClaw image status
  ansible.builtin.debug:
    msg: "{{ 'OpenClaw Docker image exists' if 'openclaw:local' in openclaw_image.stdout else 'OpenClaw Docker image NOT found' }}"

- name: Verify OpenClaw container runs
  ansible.builtin.shell: |
    docker run --rm openclaw:local --version
  become: true
  become_user: "{{ roboclaw_user }}"
  register: openclaw_version
  changed_when: false
  failed_when: false

- name: Display openclaw version
  ansible.builtin.debug:
    msg: "OpenClaw Docker: {{ openclaw_version.stdout }}"
  when: openclaw_version.rc == 0

- name: Check openclaw-gateway container status
  ansible.builtin.shell: |
    cd {{ roboclaw_home }}/docker && docker compose ps openclaw-gateway --format "{{.Status}}"
  become: true
  become_user: "{{ roboclaw_user }}"
  register: gateway_status
  changed_when: false
  failed_when: false

- name: Display gateway status
  ansible.builtin.debug:
    msg: "Gateway container status: {{ gateway_status.stdout | default('not running') }}"
```

## Data Persistence

### Volume Mappings

| Host Path | Container Path | Purpose | Permissions | Owner |
|-----------|----------------|---------|-------------|-------|
| `/home/roboclaw/.openclaw` | `/home/node/.openclaw` | OpenClaw config, sessions, workspace | 0755 | roboclaw:roboclaw (1000:1000) |
| `/home/roboclaw/.openclaw/workspace` | `/home/node/.openclaw/workspace` | User workspace files | 0755 | roboclaw:roboclaw (1000:1000) |
| `/home/roboclaw/.roboclaw` | `/home/node/.roboclaw` | RoboClaw credentials, data, logs | 0755 | roboclaw:roboclaw (1000:1000) |
| `/home/roboclaw/.roboclaw/credentials` | `/home/node/.roboclaw/credentials` | API keys, tokens | 0700 | roboclaw:roboclaw (1000:1000) |

**Key Points:**
- Container runs as `node` user (UID 1000) which matches `roboclaw` user on host
- Files created by container are automatically owned by `roboclaw` on host
- No root-owned files in mounted volumes (security benefit)

### Data Lifecycle

**Container Creation:**
1. Container starts with user `node` (UID 1000)
2. Volume mounts overlay host directories owned by `roboclaw` (UID 1000)
3. First run creates initial config files owned by correct user
4. File permissions match between container and host

**Container Updates:**
1. Build new image: `./cli/docker/build-openclaw-image.sh v2026.2.5`
2. Test new image: `./cli/docker/test-openclaw-image.sh roboclaw/openclaw:v2026.2.5`
3. Push to registry: `docker push roboclaw/openclaw:v2026.2.5`
4. Update servers: `ansible-playbook cli/reconfigure.yml -e openclaw_image=roboclaw/openclaw:v2026.2.5`
5. Restart containers: `docker compose restart`
6. Data persists across updates (volume mounts)

**Container Removal:**
1. Stop containers: `docker compose down`
2. Remove image: `docker rmi roboclaw/openclaw:latest`
3. Data remains on host in `/home/roboclaw/` directories
4. All files owned by `roboclaw` user (easy cleanup)

## Security Considerations

### Container Isolation

**Non-Root User:**
- Container runs as `node` user (UID 1000) inside container
- Host system also sees container processes as UID 1000 (`roboclaw` user)
- Container cannot access host files outside mounted volumes
- Container cannot modify kernel or host system
- **Defense in depth:** Even if container is compromised, attacker has no root privileges

**Privilege Model:**
```
┌─────────────────────────────────────────────┐
│ Host System                                  │
│  ├── root (UID 0) - Full system access     │
│  └── roboclaw (UID 1000) - Limited access  │
│      └── Docker container                   │
│          └── node user (UID 1000)           │
│              - Non-root inside container    │
│              - Maps to roboclaw on host     │
│              - Cannot escalate privileges   │
└─────────────────────────────────────────────┘
```

**Security Benefits of Non-Root:**
- Container escape vulnerabilities are less dangerous
- No ability to install system packages or modify container
- Filesystem writes limited to mounted volumes
- Process capabilities restricted
- Kernel operations denied

### Network Security

**Port Binding:**
- Gateway binds to `127.0.0.1:18789` (localhost only)
- External access requires SSH tunnel:
  ```bash
  ssh -L 18789:localhost:18789 -i key root@<IP>
  ```
- No direct internet exposure

**Firewall Rules:**
- Existing UFW rules remain (SSH only)
- Docker creates DOCKER-USER chain for custom rules
- Gateway not exposed via firewall

### Volume Security

**Mounted Volumes:**
- Read/write access to specific directories only
- No access to `/etc`, `/var/log`, `/root` on host
- Credentials directory has 0700 permissions on host

**Attack Surface:**
- Reduced: No native pnpm/Node.js installation on host
- Isolated: Compromise of OpenClaw limited to container
- Limited: Only mounted volumes accessible

### Image Supply Chain

**Custom Image Approach:**
- **Source:** Built from official OpenClaw GitHub repository
- **Build Process:** You control when and how images are built
- **Registry:** Published to your own Docker registry (Docker Hub, GHCR, or private)
- **Verification:** Review upstream changes before building
- **Audit Trail:** Track which version runs on each instance

**Image Security Workflow:**

1. **Upstream Monitoring:**
   - Watch OpenClaw GitHub repository for releases
   - Review changelogs and security advisories
   - Examine code changes in commits

2. **Build & Test:**
   - Clone official repository
   - Build image from Dockerfile
   - Run automated tests
   - Manual security review if needed

3. **Staging Deployment:**
   - Deploy to test/staging instance
   - Validate functionality
   - Monitor for issues

4. **Production Release:**
   - Tag with version number
   - Push to your registry
   - Deploy to production instances
   - Document deployment in changelog

**Benefits:**
- **No Third-Party Trust:** Don't rely on unknown image publishers
- **Version Control:** Deploy only vetted versions
- **Rollback Capability:** Keep previous versions available
- **Customization:** Add organization-specific configurations
- **Compliance:** Meet security audit requirements

## Performance Considerations

### Container Overhead

**Startup Time:**
- Native: ~100ms (direct process)
- Container: ~500ms (includes container creation)
- Gateway: Negligible (long-running daemon)

**Memory Usage:**
- Native: ~50-100MB (Node.js process)
- Container: ~100-150MB (+50MB container overhead)
- Trade-off: Acceptable for security benefits

**Disk Usage:**
- Native: ~200MB (pnpm global packages)
- Container: ~400-500MB (Docker image based on node:22-bookworm)
- Shared: Base Node.js image shared if using other Node containers
- Trade-off: Larger image size for better compatibility and security

### Optimization Strategies

**Image Caching:**
- Docker caches layers for faster rebuilds
- Same base image used for CLI and gateway
- Pull once, use for both services

**Volume Performance:**
- Bind mounts are near-native performance
- No performance penalty for volume access
- Local filesystem (no network overhead)

## Deployment Mode Migration

### Transitioning from Development to Production Mode

**When to transition:**
- Initial testing is complete
- Docker setup is validated and working
- Ready for multi-server deployments
- Need version control and rollback capability

**Transition Steps:**

**Step 1: Set Up Registry**
```bash
# Choose registry (Docker Hub shown here)
docker login

# Create repository (if using Docker Hub)
# Visit: https://hub.docker.com/repository/create
# Name: openclaw
# Visibility: Private (recommended)
```

**Step 2: Build and Push First Production Image**
```bash
# On your local machine or CI server
./cli/docker/build-openclaw-image.sh v1.0.0
./cli/docker/test-openclaw-image.sh roboclaw/openclaw:v1.0.0

# Push to registry
docker push roboclaw/openclaw:v1.0.0
docker push roboclaw/openclaw:latest
```

**Step 3: Update Instance Configuration**
```yaml
# In instances/<instance-name>.yml
openclaw:
  mode: production  # Changed from 'development'
  image: roboclaw/openclaw:v1.0.0
```

**Step 4: Redeploy with Production Mode**
```bash
./cli/run-deploy.sh <IP> -k <key> -n <instance> \
  -e openclaw_mode=production \
  -e openclaw_image=roboclaw/openclaw:v1.0.0
```

**Step 5: Clean Up Development Artifacts (Optional)**
```bash
# SSH to server and remove build artifacts
ssh -i <key> root@<IP>
su - roboclaw
rm -rf ~/openclaw-src  # Remove cloned repository
```

**Rollback to Development Mode:**
If needed, you can always switch back:
```bash
ansible-playbook cli/reconfigure.yml \
  -i "<IP>," \
  --private-key=<key> \
  -e "openclaw_mode=development"
```

## Migration Path

### Migration from Native to Docker

**Step 1: Backup Current Installation**
```bash
# SSH to server
ssh -i <key> root@<IP>
su - roboclaw

# Backup configurations
tar -czf ~/roboclaw-backup.tar.gz ~/.openclaw ~/.roboclaw
```

**Step 2: Update Deployment**
```bash
# From local machine
./cli/run-deploy.sh <IP> -k <key> -n <instance-name>
```

**Step 3: Restore Data (if needed)**
```bash
# Data is preserved in ~/.openclaw and ~/.roboclaw
# No restoration needed if deploying to same server
```

**Step 4: Verify Migration**
```bash
./cli/validate-instance.sh <instance-name>
```

### Rollback Plan

**If Docker deployment fails:**
1. SSH to server
2. Run native installation manually:
   ```bash
   su - roboclaw
   pnpm install -g openclaw@latest
   ```
3. Update playbooks to skip Docker tasks
4. Re-deploy with `--tags` to skip Docker

## Testing Strategy

### Unit Tests

**Test: Docker image exists**
```bash
docker images openclaw:local --format "{{.Repository}}:{{.Tag}}" | grep openclaw:local
```

**Test: Wrapper script works**
```bash
/home/roboclaw/.local/bin/openclaw --version
```

**Test: Docker Compose config valid**
```bash
cd /home/roboclaw/docker
docker compose config --quiet
```

### Integration Tests

**Test: Interactive onboarding**
```bash
./cli/connect-instance.sh <instance> onboard
# Verify wizard displays correctly
# Complete onboarding flow
```

**Test: Gateway service**
```bash
# Start service
ansible-playbook openclaw-service.yml -i "IP," --private-key=KEY -e "openclaw_state=started"

# Check status
ssh -i key root@IP "cd /home/roboclaw/docker && docker compose ps"

# Verify gateway responds
ssh -i key root@IP "curl -s http://localhost:18789/health"
```

**Test: Data persistence**
```bash
# Create test data
ssh -i key root@IP "docker compose run --rm openclaw-cli openclaw setup"

# Restart container
ssh -i key root@IP "cd /home/roboclaw/docker && docker compose restart openclaw-gateway"

# Verify data persists
ssh -i key root@IP "test -f /home/roboclaw/.openclaw/openclaw.json && echo OK"
```

### Validation Tests

**Run full validation suite:**
```bash
./cli/validate-instance.sh <instance-name>
```

**Expected output:**
```
✓ OpenClaw Docker image found
✓ docker-compose.yml found
✓ openclaw wrapper script exists and is executable
✓ OpenClaw Docker version: 1.2.3
  Gateway: Up (healthy)
```

## Dependencies

### System Requirements

**Target Server:**
- Ubuntu 24.04 LTS
- Docker CE 20.10+ (already installed by deployment)
- Docker Compose v2 (installed as Docker plugin)
- Root SSH access
- Minimum 2GB RAM, 1 vCPU, 10GB disk

**Docker Compose v2 Note:**
- This spec uses Docker Compose v2 syntax (`docker compose`, not `docker-compose`)
- v2 is a Docker plugin, not a separate binary
- Verify with: `docker compose version` (should show v2.x.x)
- Ubuntu 24.04 includes v2 by default

**Local Machine (unchanged):**
- Python 3.12+
- Ansible
- SSH client
- No Docker required

### Docker Image

**Custom Built Image:**
- **Name:** `roboclaw/openclaw` (or your registry/openclaw)
- **Source:** Built from official OpenClaw Dockerfile
- **Base:** Debian Bookworm (node:22-bookworm)
- **Size:** ~400-500MB (includes Node.js, build tools)
- **User:** Runs as `node` (UID 1000) - non-root

**Build Requirements (Local Machine):**
- Docker 20.10+ for building images
- Git for cloning OpenClaw repository
- 2GB disk space for build process
- Internet connection to clone repo and pull base image

**Registry Requirements:**
- Docker Hub account (free tier supports private repos)
- OR GitHub Container Registry (free with GitHub account)
- OR Self-hosted Docker registry

**Alternative Approaches:**
- **GitHub Actions:** Automate builds with CI/CD pipeline
- **Local Build:** Build on your workstation, push to registry
- **Air-Gapped:** Build locally, save as tar, transfer to servers

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `cli/reconfigure.yml` | Modified | Replace lines 186-222 (pnpm → Docker) |
| `cli/connect-instance.sh` | Modified | Update lines 119-126 (Docker Compose) |
| `cli/openclaw-service.yml` | Replaced | systemd → Docker Compose management |
| `cli/validate-instance.sh` | Modified | Docker-based validation checks |
| `cli/validate-openclaw.yml` | Modified | Docker-based validation tasks |
| `cli/hetzner-finland-fast.yml` | Modified | Same changes as reconfigure.yml |

## Files Created

| File | Purpose |
|------|---------|
| `cli/docker/docker-compose.openclaw.yml` | Docker Compose configuration for OpenClaw services |
| `cli/docker/build-openclaw-image.sh` | Script to build OpenClaw Docker image from source |
| `cli/docker/test-openclaw-image.sh` | Script to test OpenClaw Docker image before deployment |
| `cli/docker/.env.example` | Example environment file for Docker Compose configuration |
| `/home/roboclaw/docker/.env` | Runtime environment file (created by Ansible) |
| `/home/roboclaw/.local/bin/openclaw` | Wrapper script for transparent Docker execution (created by Ansible) |

## Implementation Checklist

### Phase 1: Development Mode Setup (Current)
- [ ] Create `cli/docker/` directory
- [ ] Create `cli/docker/docker-compose.openclaw.yml` with node user
- [ ] Create `cli/docker/.env.example`
- [ ] Add `openclaw_mode` variable to playbooks (default: development)
- [ ] Add development mode tasks (clone, build on remote)
- [ ] Test deployment in development mode
- [ ] Verify image builds successfully on remote
- [ ] Verify container runs as non-root (UID 1000)
- [ ] Test file ownership (should be roboclaw:roboclaw)

### Phase 2: Production Mode Setup (Future)
- [ ] Set up Docker registry (Docker Hub / GHCR / private)
- [ ] Create `cli/docker/build-openclaw-image.sh`
- [ ] Create `cli/docker/test-openclaw-image.sh`
- [ ] Build initial OpenClaw image locally
- [ ] Test image with test script
- [ ] Push image to registry
- [ ] Add production mode tasks to playbooks
- [ ] Document vetting workflow for team
- [ ] Test deployment in production mode

### Docker Compose & Configuration
- [ ] Create `cli/docker/docker-compose.openclaw.yml` with node user (1000:1000)
- [ ] Verify paths mount to `/home/node` (not `/root`)
- [ ] Add environment variables (HOME, TERM)
- [ ] Add health check using OpenClaw command
- [ ] Add init: true for signal handling
- [ ] Test Docker Compose file locally

### Ansible Playbook Updates
- [ ] Add `openclaw_image` variable to playbooks
- [ ] Add Docker Compose v2 version check task
- [ ] Add roboclaw UID verification (must be 1000)
- [ ] Modify `cli/reconfigure.yml` to pull from your registry
- [ ] Add task to create `.env` file
- [ ] Update wrapper script with error handling
- [ ] Add non-root container verification task
- [ ] Remove pnpm installation tasks
- [ ] Modify `cli/hetzner-finland-fast.yml` (same changes)
- [ ] Modify `cli/connect-instance.sh` (Docker Compose commands)
- [ ] Replace `cli/openclaw-service.yml` (systemd → Docker Compose)

### Validation & Testing
- [ ] Update `cli/validate-instance.sh` for Docker
- [ ] Add container UID check (should be 1000, not 0)
- [ ] Update `cli/validate-openclaw.yml` for Docker
- [ ] Test deployment on fresh server
- [ ] Verify file ownership (should be roboclaw:roboclaw)
- [ ] Test onboarding wizard interactivity
- [ ] Test gateway service start/stop
- [ ] Test data persistence across container restarts
- [ ] Test image updates and rollback

### Documentation
- [ ] Update `specs/deployment-workflow.md` to reflect Docker approach
- [ ] Document image build process in README
- [ ] Document registry setup
- [ ] Create runbook for image updates
- [ ] Update troubleshooting guide

## Future Enhancements

### Potential Improvements

1. **Docker Compose Optimization:**
   - Add health checks for gateway service
   - Configure logging drivers (json-file with rotation)
   - Add resource limits (memory, CPU)

2. **Image Management:**
   - Automatic image updates on deployment
   - Version pinning for stability
   - Local image registry for faster pulls

3. **Monitoring:**
   - Container health monitoring
   - Resource usage metrics
   - Auto-restart on failure (already included via `restart: unless-stopped`)

4. **Multi-Architecture:**
   - Support ARM64 and AMD64 images
   - Automatic architecture detection
   - Multi-arch image manifest

## Related Documentation

- [deployment-workflow.md](./deployment-workflow.md) - Main deployment workflow spec
- [../README.md](../README.md) - Project overview
- [../PROVISION.md](../PROVISION.md) - Detailed provisioning documentation

## Appendix

### Complete Docker Compose Example

**File: `cli/docker/docker-compose.openclaw.yml`**
```yaml
version: '3.8'

services:
  openclaw-cli:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:latest}
    container_name: openclaw-cli
    stdin_open: true
    tty: true
    user: "1000:1000"  # node user (non-root)
    environment:
      HOME: /home/node
      TERM: xterm-256color
    volumes:
      - /home/roboclaw/.openclaw:/home/node/.openclaw
      - /home/roboclaw/.roboclaw:/home/node/.roboclaw
    profiles:
      - cli

  openclaw-gateway:
    image: ${OPENCLAW_IMAGE:-roboclaw/openclaw:latest}
    container_name: openclaw-gateway
    restart: unless-stopped
    user: "1000:1000"  # node user (non-root)
    environment:
      HOME: /home/node
      TERM: xterm-256color
    ports:
      - "127.0.0.1:18789:18789"
    volumes:
      - /home/roboclaw/.openclaw:/home/node/.openclaw
      - /home/roboclaw/.roboclaw:/home/node/.roboclaw
    command: ["node", "dist/index.js", "gateway", "start"]
    healthcheck:
      test: ["CMD", "node", "dist/index.js", "gateway", "health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    init: true

# Environment file (.env) sets OPENCLAW_IMAGE variable
# Example .env content:
# OPENCLAW_IMAGE=roboclaw/openclaw:v2026.2.4
```

**Key Differences from Initial Draft:**
- ✅ Image from your registry (not alpine/openclaw)
- ✅ Non-root user (1000:1000, not 0:0)
- ✅ Mount to /home/node (not /root)
- ✅ Environment variables for HOME and TERM
- ✅ Health check uses OpenClaw command (not curl)
- ✅ Init process for proper signal handling
- ✅ Image version controlled via .env file

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Image pull fails | Network issue, wrong registry, auth required | Check registry URL, verify credentials, test `docker login` |
| Wrapper script not working | Missing execute permission | `chmod +x ~/.local/bin/openclaw` |
| Container won't start | Docker not running, missing image | Check Docker status, verify image exists with `docker images` |
| Onboarding not interactive | Missing -it flags | Use `docker compose run -it` in wrapper/scripts |
| Data not persisting | Incorrect volume mount paths | Verify mounts to `/home/node` (not `/root`) |
| Gateway port conflict | Port 18789 in use | Check for other services: `lsof -i :18789`, change port |
| Permission denied errors | Wrong UID in container or host | Verify container UID is 1000, roboclaw user is UID 1000 |
| Files owned by root on host | Container running as root | Check `user: "1000:1000"` in docker-compose.yml |
| Docker Compose v1 vs v2 | Wrong compose version | Use `docker compose` not `docker-compose` |
| Health check failing | Wrong health check command | Use `node dist/index.js gateway health` not curl |
| Image not found | Wrong image name, not pushed to registry | Verify image name matches registry, check `docker images` |
| Container runs as root | Missing user directive | Add `user: "1000:1000"` to service definition |

---

**Document Status:** Draft v1.1 (Updated)
**Maintained By:** RoboClaw Development Team
**Last Review:** 2026-02-04
**Next Review:** After implementation and testing

**Outstanding Questions:**
- When to transition from development to production mode?
- Which Docker registry for production? (Docker Hub, GHCR, or private)
- What's the username/organization for the registry? (currently using `roboclaw` as placeholder)
- Should we set up automated image builds via GitHub Actions for production?
- What's the staging environment strategy?

**Ready for Implementation - Phase 1 (Development Mode):**
- ✅ Architecture and design decisions finalized
- ✅ Docker Compose configuration complete
- ✅ Ansible playbook changes specified (development mode)
- ✅ Security model defined (non-root user)
- ✅ Validation strategy documented
- ✅ Hybrid deployment approach defined
- ⚠️ Need to implement Ansible tasks for development mode
- ⚠️ Need to test deployment on fresh server
- ⚠️ Need to verify build process on remote

**Future - Phase 2 (Production Mode):**
- ⚠️ Need to create build/test scripts (when transitioning to production)
- ⚠️ Need to set up registry and push first image
- ⚠️ Need to implement Ansible tasks for production mode
- ⚠️ Need to test transition from development to production
