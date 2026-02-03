#!/bin/bash
set -e

# Deploy OpenClaw to existing servers using SSH key and Ansible inventory
#
# Usage:
#   ./run-deploy.sh --ssh-key <path> --inventory <path>
#   ./run-deploy.sh -k <path> -i <path>
#
# Environment variables (alternative to flags):
#   SSH_PRIVATE_KEY_PATH  Path to SSH private key
#   INVENTORY_PATH        Path to Ansible inventory file
#
# Examples:
#   ./run-deploy.sh -k ~/.ssh/id_ed25519 -i hosts.ini
#   SSH_PRIVATE_KEY_PATH=./key INVENTORY_PATH=./hosts ./run-deploy.sh

# Function to check prerequisites
check_prerequisites() {
    local errors=0

    echo "Checking prerequisites..."

    # Check if venv exists
    if [ ! -d "venv" ]; then
        echo "❌ Virtual environment not found"
        echo "   → Run: python3 -m venv venv"
        echo "   → Ensure you have Python 3.12+ installed"
        echo "   → With pyenv: pyenv install 3.12.0 && ~/.pyenv/versions/3.12.0/bin/python3 -m venv venv"
        errors=1
    else
        echo "✓ Virtual environment found"

        # Activate venv to check contents
        source venv/bin/activate

        # Check Python version
        PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
        PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
        PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

        if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
            echo "❌ Python 3.12+ required, found: $PYTHON_VERSION"
            echo "   → Recreate venv with Python 3.12+"
            echo "   → Run: rm -rf venv && ~/.pyenv/versions/3.12.0/bin/python3 -m venv venv"
            errors=1
        else
            echo "✓ Python $PYTHON_VERSION"
        fi

        # Check if ansible is installed
        if ! command -v ansible-playbook &> /dev/null; then
            echo "❌ Ansible not installed in virtual environment"
            echo "   → Run: source venv/bin/activate && pip install -r requirements.txt"
            errors=1
        else
            ANSIBLE_VERSION=$(ansible --version | head -1 | awk '{print $3}' | tr -d ']')
            echo "✓ Ansible $ANSIBLE_VERSION"
        fi

        # Check if python-dateutil is installed
        if ! python -c "import dateutil" 2>/dev/null; then
            echo "❌ python-dateutil not installed"
            echo "   → Run: source venv/bin/activate && pip install -r requirements.txt"
            errors=1
        else
            echo "✓ python-dateutil installed"
        fi
    fi

    echo ""

    if [ $errors -ne 0 ]; then
        echo "Prerequisites not met."
        echo ""
        echo "Run automatic setup:"
        echo "  ./setup.sh"
        echo ""
        echo "Or manual setup:"
        echo "  1. ~/.pyenv/versions/3.12.0/bin/python3 -m venv venv"
        echo "  2. source venv/bin/activate"
        echo "  3. pip install -r requirements.txt"
        echo "  4. ansible-galaxy collection install hetzner.hcloud"
        exit 1
    fi

    echo "✓ All prerequisites met"
    echo ""
}

# Run prerequisite checks
check_prerequisites

# Activate virtualenv (already activated in check, but re-activate to be safe)
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Parse arguments
SSH_KEY="${SSH_PRIVATE_KEY_PATH:-}"
INVENTORY="${INVENTORY_PATH:-}"
AUTO_SETUP="onboard"  # Default: auto-onboard after deployment
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        -i|--inventory)
            INVENTORY="$2"
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
            echo "  ./run-deploy.sh --ssh-key <path> --inventory <path> [options]"
            echo "  ./run-deploy.sh -k <path> -i <path> [options]"
            echo ""
            echo "Options:"
            echo "  -k, --ssh-key <path>       Path to SSH private key"
            echo "  -i, --inventory <path>     Path to Ansible inventory file"
            echo "  --skip-onboard             Skip automatic onboarding (default: auto-onboard)"
            echo "  --no-onboard               Alias for --skip-onboard"
            echo "  -h, --help                 Show this help message"
            echo ""
            echo "Environment variables (alternative to flags):"
            echo "  SSH_PRIVATE_KEY_PATH       Path to SSH private key"
            echo "  INVENTORY_PATH             Path to Ansible inventory file"
            echo "  INSTANCE_NAME_OVERRIDE     Override instance name in artifact"
            echo ""
            echo "Examples:"
            echo "  ./run-deploy.sh -k ~/.ssh/id_ed25519 -i hosts.ini"
            echo "  ./run-deploy.sh -k ~/.ssh/id_ed25519 -i hosts.ini --skip-onboard"
            echo "  ./run-deploy.sh -k key -i inventory.ini --tags docker,nodejs"
            echo "  INSTANCE_NAME_OVERRIDE=my-server ./run-deploy.sh -k key -i hosts.ini"
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
    echo "Error: SSH key not provided. Use --ssh-key or set SSH_PRIVATE_KEY_PATH"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "Error: SSH key file not found: $SSH_KEY"
    exit 1
fi

if [ -z "$INVENTORY" ]; then
    echo "Error: Inventory not provided. Use --inventory or set INVENTORY_PATH"
    exit 1
fi

if [ ! -f "$INVENTORY" ]; then
    echo "Error: Inventory file not found: $INVENTORY"
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
    mkdir -p ./instances

    # Parse inventory file to extract hosts
    # This handles simple INI format: "host ansible_host=ip" or just "ip"
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
            INSTANCE_NAME=$(echo "$HOST" | tr '.' '-' | tr '_' '-')
        else
            # Host is the IP
            IP="$HOST"
            INSTANCE_NAME="instance-${IP//./-}"
        fi

        # Allow overriding instance name via environment variable
        if [ -n "$INSTANCE_NAME_OVERRIDE" ]; then
            INSTANCE_NAME="$INSTANCE_NAME_OVERRIDE"
        fi

        ARTIFACT_FILE="./instances/${INSTANCE_NAME}.yml"
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

        # Get absolute path of SSH key
        ABS_SSH_KEY=$(realpath "$SSH_KEY")

        # Create artifact file
        cat > "$ARTIFACT_FILE" << EOF
# Instance deployed via run-deploy.sh on ${TIMESTAMP}
instances:
  - name: ${INSTANCE_NAME}
    ip: ${IP}
    deployed_at: ${TIMESTAMP}
    deployment_method: run-deploy.sh
    inventory_file: ${INVENTORY}
    ssh:
      key_file: "${ABS_SSH_KEY}"
      public_key_file: "${ABS_SSH_KEY}.pub"
EOF

        echo "   ✓ Created artifact: ${ARTIFACT_FILE}"
        echo "   → Instance name: ${INSTANCE_NAME}"
        echo "   → IP: ${IP}"

    done < <(grep -v "^$" "$INVENTORY" 2>/dev/null || true)

    echo ""
    echo "✅ Deployment complete!"

    # Launch interactive onboarding if requested
    if [ -n "$AUTO_SETUP" ]; then
        echo ""
        echo "🚀 Launching OpenClaw interactive wizard..."
        echo ""
        sleep 1
        ./connect-instance.sh "${INSTANCE_NAME}" "$AUTO_SETUP"
    else
        echo ""
        echo "To complete setup, run:"
        echo "   ./connect-instance.sh ${INSTANCE_NAME} onboard"
    fi

else
    echo ""
    echo "❌ Deployment failed with exit code: $ANSIBLE_EXIT_CODE"
    exit $ANSIBLE_EXIT_CODE
fi
