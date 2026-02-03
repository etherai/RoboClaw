#!/bin/bash
set -e

# Store original directory for resolving user-provided paths
ORIGINAL_DIR="$(pwd)"

# Change to script directory (cli/) to ensure relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Deploy OpenClaw to existing servers using SSH key and Ansible inventory
#
# Usage:
#   ./cli/run-deploy.sh <IP> --ssh-key <path> [options]
#   ./cli/run-deploy.sh <IP> -k <path> [options]
#   ./cli/run-deploy.sh -k <path> -i <path> [options]  (backward compatibility)
#
# Environment variables (alternative to flags):
#   SSH_PRIVATE_KEY_PATH  Path to SSH private key
#   INVENTORY_PATH        Path to Ansible inventory file
#
# Examples:
#   ./run-deploy.sh 192.168.1.100 -k ~/.ssh/id_ed25519
#   ./run-deploy.sh 192.168.1.100 -k key -n production
#   ./run-deploy.sh -k key -i hosts.ini  (backward compatible)

# Function to check Python version
check_python_version() {
    local python_cmd="$1"

    if ! command -v "$python_cmd" &> /dev/null; then
        return 1
    fi

    # Try to get version, suppress errors
    local version
    if ! version=$($python_cmd --version 2>&1); then
        return 1
    fi

    version=$(echo "$version" | awk '{print $2}')
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)

    # Check if we got valid version numbers
    if ! [[ "$major" =~ ^[0-9]+$ ]] || ! [[ "$minor" =~ ^[0-9]+$ ]]; then
        return 1
    fi

    if [ "$major" -lt 3 ] || ([ "$major" -eq 3 ] && [ "$minor" -lt 12 ]); then
        return 1
    fi

    return 0
}

# Function to find Python 3.12+
find_python() {
    # Try common Python commands
    for cmd in python3.12 python3 python; do
        if check_python_version "$cmd" 2>/dev/null; then
            echo "$cmd"
            return 0
        fi
    done

    # Check pyenv if available
    if command -v pyenv &> /dev/null; then
        if [ -f ~/.pyenv/versions/3.12.0/bin/python3 ]; then
            local pyenv_python=~/.pyenv/versions/3.12.0/bin/python3
            if check_python_version "$pyenv_python" 2>/dev/null; then
                echo "$pyenv_python"
                return 0
            fi
        fi
    fi

    return 1
}

# Function to auto-setup environment
auto_setup() {
    echo "Setting up environment..."
    echo ""

    # Find Python 3.12+
    echo "Checking for Python 3.12+..."
    local python_cmd=""
    if ! python_cmd=$(find_python); then
        echo "❌ Error: Python 3.12+ not found"
        echo ""
        echo "Install Python 3.12+ using one of these methods:"
        echo ""
        echo "Using pyenv (recommended):"
        echo "  pyenv install 3.12.0"
        echo ""
        echo "Using apt (Ubuntu/Debian):"
        echo "  sudo apt update"
        echo "  sudo apt install python3.12 python3.12-venv"
        echo ""
        echo "Using brew (macOS):"
        echo "  brew install python@3.12"
        echo ""
        exit 1
    fi

    PYTHON_CMD="$python_cmd"
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
    echo "✓ Found Python $PYTHON_VERSION"
    echo ""

    # Create venv if it doesn't exist
    if [ ! -d "../venv" ]; then
        echo "Creating virtual environment..."
        $PYTHON_CMD -m venv ../venv
        echo "✓ Virtual environment created"
        echo ""
    fi

    # Activate venv
    source ../venv/bin/activate

    # Check if dependencies are installed
    local need_install=0
    if ! command -v ansible-playbook &> /dev/null; then
        need_install=1
    elif ! python -c "import dateutil" 2>/dev/null; then
        need_install=1
    fi

    # Install dependencies if needed
    if [ $need_install -eq 1 ]; then
        echo "Installing dependencies..."
        pip install --upgrade pip -q
        pip install -r ../requirements.txt
        echo "✓ Dependencies installed"
        echo ""
    fi

    # Check if Ansible collection is installed
    if ! ansible-galaxy collection list | grep -q "hetzner.hcloud"; then
        echo "Installing Ansible collections..."
        ansible-galaxy collection install hetzner.hcloud
        echo "✓ Ansible collections installed"
        echo ""
    fi

    echo "✓ Environment ready"
    echo ""
}

# Run auto-setup
auto_setup

# Activate virtualenv
source ../venv/bin/activate

# Parse arguments
SSH_KEY="${SSH_PRIVATE_KEY_PATH:-}"
INVENTORY="${INVENTORY_PATH:-}"
IP_ADDRESS=""
INSTANCE_NAME="${INSTANCE_NAME_OVERRIDE:-}"
AUTO_SETUP="onboard"  # Default: auto-onboard after deployment
EXTRA_ARGS=()
TEMP_INVENTORY=""

# Check if first arg is an IP address (positional)
if [[ $# -gt 0 ]] && [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    IP_ADDRESS="$1"
    shift
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --ip)
            IP_ADDRESS="$2"
            shift 2
            ;;
        -k|--ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        -i|--inventory)
            INVENTORY="$2"
            shift 2
            ;;
        -n|--name)
            INSTANCE_NAME="$2"
            shift 2
            ;;
        --skip-onboard|--no-onboard)
            AUTO_SETUP=""
            shift
            ;;
        -h|--help)
            echo "Deploy OpenClaw to existing servers using SSH key and Ansible inventory"
            echo ""
            echo "Usage:"
            echo "  ./cli/run-deploy.sh <IP> -k <ssh-key> [options]          # Direct IP (recommended)"
            echo "  ./cli/run-deploy.sh <IP> -k <ssh-key> -n <name>          # With instance name"
            echo "  ./cli/run-deploy.sh -k <ssh-key> -i <inventory>          # Inventory file (advanced)"
            echo ""
            echo "Options:"
            echo "  -k, --ssh-key <path>       Path to SSH private key (required)"
            echo "  -n, --name <name>          Instance name (default: instance-<IP>)"
            echo "  -i, --inventory <path>     Ansible inventory file (alternative to IP)"
            echo "  --ip <address>             IP address (alternative to positional)"
            echo "  --skip-onboard             Skip automatic onboarding"
            echo "  --no-onboard               Alias for --skip-onboard"
            echo "  -h, --help                 Show this help message"
            echo ""
            echo "Environment variables (alternative to flags):"
            echo "  SSH_PRIVATE_KEY_PATH       Path to SSH private key"
            echo "  INVENTORY_PATH             Path to Ansible inventory file"
            echo "  INSTANCE_NAME_OVERRIDE     Override instance name in artifact"
            echo ""
            echo "Examples:"
            echo "  ./cli/run-deploy.sh 192.168.1.100 -k ~/.ssh/id_ed25519"
            echo "  ./cli/run-deploy.sh 192.168.1.100 -k ~/.ssh/key -n production"
            echo "  ./cli/run-deploy.sh 192.168.1.100 -k key -n prod --skip-onboard"
            echo "  ./cli/run-deploy.sh -k key -i hosts.ini  # Backward compatible"
            echo ""
            echo "Note: By default, 'openclaw onboard' launches automatically after deployment."
            echo "      Use --skip-onboard if you want to onboard later manually."
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# Validate inputs
if [ -z "$SSH_KEY" ]; then
    echo "Error: SSH key not provided. Use -k/--ssh-key or set SSH_PRIVATE_KEY_PATH"
    exit 1
fi

# Resolve SSH key path relative to original directory
if [[ ! "$SSH_KEY" = /* ]]; then
    # Relative path - resolve it from the original directory
    SSH_KEY="$ORIGINAL_DIR/$SSH_KEY"
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "Error: SSH key file not found: $SSH_KEY"
    exit 1
fi

# Auto-generate inventory if IP provided, otherwise use inventory file
if [ -n "$IP_ADDRESS" ]; then
    # Validate IP format
    if ! echo "$IP_ADDRESS" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
        echo "Error: Invalid IP address format: $IP_ADDRESS"
        exit 1
    fi

    # Generate instance name if not provided
    if [ -z "$INSTANCE_NAME" ]; then
        INSTANCE_NAME="instance-${IP_ADDRESS//./-}"
    fi

    # Create temporary inventory file in instances directory
    mkdir -p ./instances
    TEMP_INVENTORY="../instances/.temp-inventory-${INSTANCE_NAME}.ini"
    cat > "$TEMP_INVENTORY" << EOF
[servers]
$IP_ADDRESS ansible_user=root
EOF

    INVENTORY="$TEMP_INVENTORY"
    echo "Generated temporary inventory for: $IP_ADDRESS"
    echo ""
elif [ -n "$INVENTORY" ]; then
    # Resolve inventory path relative to original directory
    if [[ ! "$INVENTORY" = /* ]]; then
        # Relative path - resolve it from the original directory
        INVENTORY="$ORIGINAL_DIR/$INVENTORY"
    fi

    # Using inventory file - validate it exists
    if [ ! -f "$INVENTORY" ]; then
        echo "Error: Inventory file not found: $INVENTORY"
        exit 1
    fi
else
    echo "Error: Either IP address or inventory file required"
    echo ""
    echo "Usage:"
    echo "  ./cli/run-deploy.sh <IP> -k <ssh-key>           # Using IP"
    echo "  ./cli/run-deploy.sh -k <ssh-key> -i <inventory> # Using inventory"
    echo ""
    echo "Run with --help for more options"
    exit 1
fi

# Run Ansible
echo "Deploying OpenClaw to servers in: $INVENTORY"
echo "Using SSH key: $SSH_KEY"
echo ""

ansible-playbook reconfigure.yml \
    -i "$INVENTORY" \
    --private-key="$SSH_KEY" \
    -e "ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'" \
    "${EXTRA_ARGS[@]}"

ANSIBLE_EXIT_CODE=$?

if [ $ANSIBLE_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "📝 Creating instance artifacts..."

    # Create instances directory if it doesn't exist
    mkdir -p ../instances

    # Parse inventory file to extract hosts
    # This handles simple INI format: "host ansible_host=ip" or just "ip"
    FINAL_INSTANCE_NAME=""
    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue
        # Skip section headers like [servers]
        [[ "$line" =~ ^\[.*\]$ ]] && continue

        # Extract hostname/IP
        HOST=$(echo "$line" | awk '{print $1}')

        # Check if there's an ansible_host variable
        if echo "$line" | grep -q "ansible_host="; then
            IP=$(echo "$line" | grep -oP 'ansible_host=\K[^ ]+')
            ARTIFACT_INSTANCE_NAME=$(echo "$HOST" | tr '.' '-' | tr '_' '-')
        else
            # Host is the IP
            IP="$HOST"
            ARTIFACT_INSTANCE_NAME="instance-${IP//./-}"
        fi

        # Use provided instance name, or INSTANCE_NAME_OVERRIDE, or derived name
        if [ -n "$INSTANCE_NAME" ]; then
            ARTIFACT_INSTANCE_NAME="$INSTANCE_NAME"
        elif [ -n "$INSTANCE_NAME_OVERRIDE" ]; then
            ARTIFACT_INSTANCE_NAME="$INSTANCE_NAME_OVERRIDE"
        fi

        ARTIFACT_FILE="../instances/${ARTIFACT_INSTANCE_NAME}.yml"
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

        # Get absolute path of SSH key
        ABS_SSH_KEY=$(realpath "$SSH_KEY")

        # Create artifact file
        cat > "$ARTIFACT_FILE" << EOF
# Instance deployed via run-deploy.sh on ${TIMESTAMP}
instances:
  - name: ${ARTIFACT_INSTANCE_NAME}
    ip: ${IP}
    deployed_at: ${TIMESTAMP}
    deployment_method: run-deploy.sh
    inventory_file: ${INVENTORY}
    ssh:
      key_file: "${ABS_SSH_KEY}"
      public_key_file: "${ABS_SSH_KEY}.pub"
EOF

        echo "   ✓ Created artifact: ${ARTIFACT_FILE}"
        echo "   → Instance name: ${ARTIFACT_INSTANCE_NAME}"
        echo "   → IP: ${IP}"

        FINAL_INSTANCE_NAME="$ARTIFACT_INSTANCE_NAME"

    done < <(grep -v "^$" "$INVENTORY" 2>/dev/null || true)

    # Clean up temporary inventory if created
    if [ -n "$TEMP_INVENTORY" ] && [ -f "$TEMP_INVENTORY" ]; then
        rm -f "$TEMP_INVENTORY"
    fi

    echo ""
    echo "✅ Deployment complete!"

    # Launch interactive onboarding if requested
    if [ -n "$AUTO_SETUP" ]; then
        echo ""
        echo "🚀 Launching OpenClaw interactive wizard..."
        echo ""
        sleep 1
        ./connect-instance.sh "${FINAL_INSTANCE_NAME}" "$AUTO_SETUP"
    else
        echo ""
        echo "To complete setup, run:"
        echo "   ./cli/connect-instance.sh ${FINAL_INSTANCE_NAME} onboard"
    fi

else
    # Clean up temporary inventory if created (even on failure)
    if [ -n "$TEMP_INVENTORY" ] && [ -f "$TEMP_INVENTORY" ]; then
        rm -f "$TEMP_INVENTORY"
    fi

    echo ""
    echo "❌ Deployment failed with exit code: $ANSIBLE_EXIT_CODE"
    exit $ANSIBLE_EXIT_CODE
fi
