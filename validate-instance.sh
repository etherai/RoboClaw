#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_check() {
    echo -e "${YELLOW}[CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((CHECKS_PASSED++)) || true
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((CHECKS_FAILED++)) || true
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Usage information
usage() {
    echo "Usage: $0 [instance-name]"
    echo ""
    echo "Validates a provisioned Hetzner instance against its artifact file."
    echo ""
    echo "Arguments:"
    echo "  instance-name    Name of the instance (default: finland-instance)"
    echo ""
    echo "Examples:"
    echo "  $0                           # Validate finland-instance"
    echo "  $0 finland-instance          # Validate specific instance"
    echo "  $0 my-server                 # Validate my-server instance"
    exit 1
}

# Parse arguments
INSTANCE_NAME="${1:-finland-instance}"

if [[ "$INSTANCE_NAME" == "-h" ]] || [[ "$INSTANCE_NAME" == "--help" ]]; then
    usage
fi

ARTIFACT_FILE="instances/${INSTANCE_NAME}.yml"
SSH_KEY="hetzner_key"

# Check if artifact file exists
if [[ ! -f "$ARTIFACT_FILE" ]]; then
    # Check if a deleted version exists
    DELETED_ARTIFACT="instances/${INSTANCE_NAME}_deleted.yml"
    if [[ -f "$DELETED_ARTIFACT" ]]; then
        DELETED_AT=$(grep "^    deleted_at:" "$DELETED_ARTIFACT" | sed 's/.*deleted_at: //' | tr -d ' ')
        echo -e "${RED}Error: Instance '$INSTANCE_NAME' was deleted${NC}"
        if [[ -n "$DELETED_AT" ]]; then
            echo -e "${RED}Deleted at: $DELETED_AT${NC}"
        fi
        echo ""
        echo "Artifact file: $DELETED_ARTIFACT"
        echo ""
        echo "This instance no longer exists in Hetzner Cloud."
        echo "To provision a new instance with this name, run:"
        echo "  ./run-hetzner.sh"
        exit 1
    fi

    echo -e "${RED}Error: Artifact file not found: $ARTIFACT_FILE${NC}"
    echo ""
    echo "Available instances:"
    if [[ -d "instances" ]] && [[ -n "$(ls -A instances/*.yml 2>/dev/null)" ]]; then
        for f in instances/*.yml; do
            basename "$f" .yml | sed 's/_deleted$//'
        done
    else
        echo "  (none)"
    fi
    exit 1
fi

# Check if SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
    echo -e "${RED}Error: SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

print_header "VALIDATING INSTANCE: $INSTANCE_NAME"

# Parse artifact file using grep/sed (simple YAML parsing)
print_info "Reading artifact file: $ARTIFACT_FILE"

IP_ADDRESS=$(grep "^    ip:" "$ARTIFACT_FILE" | sed 's/.*ip: //' | tr -d ' ')
SERVER_TYPE=$(grep "^    server_type:" "$ARTIFACT_FILE" | sed 's/.*server_type: //' | tr -d ' ')
LOCATION=$(grep "^    location:" "$ARTIFACT_FILE" | sed 's/.*location: //' | tr -d ' ')
IMAGE=$(grep "^    image:" "$ARTIFACT_FILE" | sed 's/.*image: //' | tr -d ' ')
INSTALL_MODE=$(grep "^    install_mode:" "$ARTIFACT_FILE" | sed 's/.*install_mode: //' | tr -d ' ')

# Expected versions (from artifact)
EXPECTED_OS=$(grep "^      os:" "$ARTIFACT_FILE" | sed 's/.*os: //' | sed 's/^ *//')
EXPECTED_KERNEL=$(grep "^      kernel:" "$ARTIFACT_FILE" | sed 's/.*kernel: //' | tr -d ' ')
EXPECTED_DOCKER=$(grep "^      docker:" "$ARTIFACT_FILE" | sed 's/.*docker: //' | sed 's/^ *//')
EXPECTED_NODEJS=$(grep "^      nodejs:" "$ARTIFACT_FILE" | sed 's/.*nodejs: //' | tr -d ' ')
EXPECTED_PNPM=$(grep "^      pnpm:" "$ARTIFACT_FILE" | sed 's/.*pnpm: //' | tr -d ' ')
EXPECTED_CLAWDBOT=$(grep "^      clawdbot:" "$ARTIFACT_FILE" | sed 's/.*clawdbot: //' | tr -d ' ')

print_info "Instance IP: $IP_ADDRESS"
print_info "Server Type: $SERVER_TYPE"
print_info "Location: $LOCATION"
print_info "Install Mode: $INSTALL_MODE"

# SSH helper function
ssh_exec() {
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -o ConnectTimeout=10 \
        -o LogLevel=QUIET \
        "root@$IP_ADDRESS" "$@"
}

# Test 1: SSH Connectivity
print_header "1. SSH CONNECTIVITY"
print_check "Testing SSH connection to $IP_ADDRESS"

if ssh_exec "echo 'Connection successful'" &>/dev/null; then
    print_success "SSH connection established"
else
    print_fail "Cannot connect via SSH"
    exit 1
fi

# Test 2: System Information
print_header "2. SYSTEM INFORMATION"

print_check "Verifying OS version"
ACTUAL_OS=$(ssh_exec "cat /etc/os-release | grep PRETTY_NAME | cut -d'\"' -f2")
# Extract major.minor version (e.g., "24.04" from "ubuntu-24.04")
IMAGE_VERSION=$(echo "$IMAGE" | grep -oE '[0-9]+\.[0-9]+' || echo "$IMAGE")
if [[ "$ACTUAL_OS" == *"$IMAGE_VERSION"* ]]; then
    print_success "OS version matches: $ACTUAL_OS"
else
    print_fail "OS mismatch. Expected version $IMAGE_VERSION, Got: $ACTUAL_OS"
fi

print_check "Verifying kernel version"
ACTUAL_KERNEL=$(ssh_exec "uname -r")
if [[ "$ACTUAL_KERNEL" == "$EXPECTED_KERNEL" ]]; then
    print_success "Kernel version matches: $ACTUAL_KERNEL"
else
    print_info "Kernel version: $ACTUAL_KERNEL (expected: $EXPECTED_KERNEL)"
fi

# Test 3: Software Versions
print_header "3. SOFTWARE VERSIONS"

print_check "Verifying Docker version"
ACTUAL_DOCKER=$(ssh_exec "docker --version")
if [[ "$ACTUAL_DOCKER" == *"$EXPECTED_DOCKER"* ]]; then
    print_success "Docker version matches: $ACTUAL_DOCKER"
else
    print_fail "Docker mismatch. Expected: $EXPECTED_DOCKER, Got: $ACTUAL_DOCKER"
fi

print_check "Verifying Node.js version"
ACTUAL_NODEJS=$(ssh_exec "node --version")
if [[ "$ACTUAL_NODEJS" == "$EXPECTED_NODEJS" ]]; then
    print_success "Node.js version matches: $ACTUAL_NODEJS"
else
    print_fail "Node.js mismatch. Expected: $EXPECTED_NODEJS, Got: $ACTUAL_NODEJS"
fi

print_check "Verifying pnpm version"
ACTUAL_PNPM=$(ssh_exec "pnpm --version")
if [[ "$ACTUAL_PNPM" == "$EXPECTED_PNPM" ]]; then
    print_success "pnpm version matches: $ACTUAL_PNPM"
else
    print_fail "pnpm mismatch. Expected: $EXPECTED_PNPM, Got: $ACTUAL_PNPM"
fi

# Test 4: Clawdbot User & Installation
print_header "4. CLAWDBOT USER & INSTALLATION"

print_check "Verifying clawdbot user exists"
if ssh_exec "id clawdbot" &>/dev/null; then
    USER_INFO=$(ssh_exec "id clawdbot")
    print_success "clawdbot user exists: $USER_INFO"
else
    print_fail "clawdbot user not found"
fi

print_check "Verifying clawdbot is in docker group"
if ssh_exec "groups clawdbot | grep -q docker"; then
    print_success "clawdbot user is in docker group"
else
    print_fail "clawdbot user is NOT in docker group"
fi

print_check "Verifying clawdbot home directory"
if ssh_exec "test -d /home/clawdbot"; then
    print_success "/home/clawdbot directory exists"
else
    print_fail "/home/clawdbot directory not found"
fi

print_check "Verifying clawdbot config directory structure"
MISSING_DIRS=()
for dir in .clawdbot .clawdbot/credentials .clawdbot/data .clawdbot/logs .clawdbot/sessions; do
    if ! ssh_exec "test -d /home/clawdbot/$dir" &>/dev/null; then
        MISSING_DIRS+=("$dir")
    fi
done

if [[ ${#MISSING_DIRS[@]} -eq 0 ]]; then
    print_success "All clawdbot config directories exist"
else
    print_fail "Missing directories: ${MISSING_DIRS[*]}"
fi

print_check "Verifying clawdbot installation"
if ssh_exec "su - clawdbot -c 'which clawdbot'" &>/dev/null; then
    CLAWDBOT_PATH=$(ssh_exec "su - clawdbot -c 'which clawdbot'")
    ACTUAL_CLAWDBOT=$(ssh_exec "su - clawdbot -c 'clawdbot --version'")

    if [[ "$ACTUAL_CLAWDBOT" == "$EXPECTED_CLAWDBOT" ]]; then
        print_success "clawdbot version matches: $ACTUAL_CLAWDBOT"
        print_info "Installed at: $CLAWDBOT_PATH"
    else
        print_fail "clawdbot version mismatch. Expected: $EXPECTED_CLAWDBOT, Got: $ACTUAL_CLAWDBOT"
    fi
else
    print_fail "clawdbot command not found for clawdbot user"
fi

print_check "Verifying clawdbot can access Docker"
if ssh_exec "su - clawdbot -c 'docker ps'" &>/dev/null; then
    print_success "clawdbot user can access Docker"
else
    print_fail "clawdbot user cannot access Docker"
fi

# Test 5: Firewall Configuration
print_header "5. FIREWALL CONFIGURATION"

print_check "Verifying UFW is installed and active"
if UFW_STATUS=$(ssh_exec "ufw status" 2>/dev/null); then
    if echo "$UFW_STATUS" | grep -q "Status: active"; then
        print_success "UFW firewall is active"
    else
        print_fail "UFW firewall is NOT active"
    fi
else
    print_fail "UFW not found or not accessible"
fi

print_check "Verifying SSH port (22) is allowed"
if ssh_exec "ufw status | grep -q '22/tcp.*ALLOW'"; then
    print_success "SSH port (22/tcp) is allowed through firewall"
else
    print_fail "SSH port (22/tcp) is NOT allowed through firewall"
fi

print_check "Verifying default deny policy"
if ssh_exec "ufw status verbose | grep -q 'Default: deny (incoming)'"; then
    print_success "Default deny policy for incoming traffic"
else
    print_fail "Default deny policy NOT configured"
fi

# Test 6: Docker Service
print_header "6. DOCKER SERVICE"

print_check "Verifying Docker daemon is running"
if ssh_exec "systemctl is-active docker" &>/dev/null; then
    print_success "Docker daemon is running"
else
    print_fail "Docker daemon is NOT running"
fi

print_check "Verifying Docker is enabled on boot"
if ssh_exec "systemctl is-enabled docker" &>/dev/null; then
    print_success "Docker is enabled on boot"
else
    print_fail "Docker is NOT enabled on boot"
fi

# Final Summary
print_header "VALIDATION SUMMARY"

echo ""
echo -e "Instance: ${BLUE}$INSTANCE_NAME${NC}"
echo -e "IP Address: ${BLUE}$IP_ADDRESS${NC}"
echo -e "Checks Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks Failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [[ $CHECKS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✓ All validation checks passed!${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. SSH into the server:"
    echo "     ssh -i $SSH_KEY root@$IP_ADDRESS"
    echo ""
    echo "  2. Switch to clawdbot user and onboard:"
    echo "     sudo su - clawdbot"
    echo "     clawdbot onboard --install-daemon"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Validation failed with $CHECKS_FAILED error(s)${NC}"
    echo ""
    echo "Please review the failed checks above and re-provision if necessary."
    exit 1
fi
