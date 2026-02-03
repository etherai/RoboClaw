#!/bin/bash
set -e

# Change to script directory (cli/) to ensure relative paths work
cd "$(dirname "$0")"

# Function to check prerequisites
check_prerequisites() {
    local errors=0

    echo "Checking prerequisites..."

    # Check if venv exists
    if [ ! -d "../venv" ]; then
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

        # Check if Hetzner Cloud collection is installed
        if ! ansible-galaxy collection list | grep -q "hetzner.hcloud"; then
            echo "❌ Hetzner Cloud Ansible collection not installed"
            echo "   → Run: source venv/bin/activate && ansible-galaxy collection install hetzner.hcloud"
            errors=1
        else
            HCLOUD_VERSION=$(ansible-galaxy collection list | grep hetzner.hcloud | awk '{print $2}')
            echo "✓ Hetzner Cloud collection $HCLOUD_VERSION"
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
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading credentials from .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Check required variables
if [ -z "$HCLOUD_TOKEN" ]; then
    echo "Error: HCLOUD_TOKEN not set in .env"
    exit 1
fi

# Skip SSH key generation for service and reconfigure commands (they read from artifacts)
if [ "${1:-provision}" != "service" ] && [ "${1:-provision}" != "reconfigure" ]; then
    if [ -z "$SSH_PUBLIC_KEY" ]; then
        echo "SSH_PUBLIC_KEY not set, generating SSH key..."

        # Use server-specific SSH key if SERVER_NAME is provided, otherwise use default
        if [ -n "$SERVER_NAME" ]; then
            SSH_KEY_PATH="./ssh-keys/${SERVER_NAME}_key"
            mkdir -p ./ssh-keys
        else
            SSH_KEY_PATH="./hetzner_key"
        fi

        # Always generate a new key for each deployment to avoid uniqueness errors
        if [ -f "$SSH_KEY_PATH" ]; then
            echo "Removing existing SSH key: $SSH_KEY_PATH"
            rm -f "$SSH_KEY_PATH" "$SSH_KEY_PATH.pub"
        fi

        echo "Creating new SSH key: $SSH_KEY_PATH"
        ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "hetzner-${SERVER_NAME:-instance}"
        echo "✅ SSH key created: $SSH_KEY_PATH"

        export SSH_PUBLIC_KEY="$(cat ${SSH_KEY_PATH}.pub)"
        export SSH_PRIVATE_KEY_PATH="$SSH_KEY_PATH"

        # Add to .gitignore to prevent committing private keys
        if ! grep -q "^hetzner_key$" .gitignore 2>/dev/null; then
            echo "hetzner_key" >> .gitignore
            echo "hetzner_key.pub" >> .gitignore
            echo "ssh-keys/" >> .gitignore
        fi
    fi
fi

# Check if first argument is a command
case "${1:-provision}" in
    list)
        echo "Listing all servers..."
        ansible-playbook hetzner-teardown.yml --tags list
        ;;
    delete|teardown|destroy)
        [ $# -gt 0 ] && shift
        echo "Running teardown playbook..."
        ansible-playbook hetzner-teardown.yml --tags delete "$@"
        ;;
    reconfigure)
        shift
        INSTANCE_NAME="${1:?Usage: run-hetzner.sh reconfigure <instance-name> [ansible args]}"
        shift

        # Read IP and SSH key from instance artifact
        ARTIFACT="../instances/${INSTANCE_NAME}.yml"
        if [ ! -f "$ARTIFACT" ]; then
            echo "Error: Instance artifact not found: $ARTIFACT"
            exit 1
        fi

        IP=$(grep '^\s*ip:' "$ARTIFACT" | head -1 | awk '{print $2}')
        KEY_FILE=$(grep '^\s*key_file:' "$ARTIFACT" | head -1 | awk '{print $2}' | tr -d '"' | sed 's/^"\(.*\)"$/\1/')

        if [ -z "$IP" ]; then
            echo "Error: Could not extract IP from $ARTIFACT"
            exit 1
        fi

        if [ -z "$KEY_FILE" ]; then
            echo "Error: Could not extract key_file from $ARTIFACT"
            exit 1
        fi

        echo "🔄 Reconfiguring instance: $INSTANCE_NAME"
        echo "   IP: $IP"
        echo "   SSH Key: $KEY_FILE"
        echo ""

        ansible-playbook reconfigure.yml \
            -i "${IP}," \
            --private-key="${KEY_FILE}" \
            -e "ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'" \
            "$@"
        ;;
    service)
        shift
        INSTANCE_NAME="${1:?Usage: run-hetzner.sh service <instance-name> <started|stopped> [--enable|--disable]}"
        shift
        OPENCLAW_STATE="${1:?Usage: run-hetzner.sh service <instance-name> <started|stopped>}"
        shift

        # Default: enable if starting, disable if stopping
        OPENCLAW_ENABLED="true"
        if [ "$OPENCLAW_STATE" = "stopped" ]; then
            OPENCLAW_ENABLED="false"
        fi

        # Override with explicit flag
        while [ $# -gt 0 ]; do
            case "$1" in
                --enable) OPENCLAW_ENABLED="true"; shift ;;
                --disable) OPENCLAW_ENABLED="false"; shift ;;
                *) shift ;;
            esac
        done

        # Read IP and SSH key from instance artifact
        ARTIFACT="../instances/${INSTANCE_NAME}.yml"
        if [ ! -f "$ARTIFACT" ]; then
            echo "Error: Instance artifact not found: $ARTIFACT"
            exit 1
        fi

        IP=$(grep '^\s*ip:' "$ARTIFACT" | head -1 | awk '{print $2}')
        KEY_FILE=$(grep '^\s*key_file:' "$ARTIFACT" | head -1 | awk '{print $2}' | tr -d '"' | sed 's/^"\(.*\)"$/\1/')

        if [ -z "$IP" ]; then
            echo "Error: Could not extract IP from $ARTIFACT"
            exit 1
        fi

        if [ -z "$KEY_FILE" ]; then
            echo "Error: Could not extract key_file from $ARTIFACT"
            exit 1
        fi

        # Verify SSH key exists
        if [ ! -f "$KEY_FILE" ]; then
            echo "Error: SSH key not found: $KEY_FILE"
            exit 1
        fi

        echo "🔧 Managing openclaw service: $INSTANCE_NAME"
        echo "   Action: $OPENCLAW_STATE"
        echo "   Enabled: $OPENCLAW_ENABLED"
        echo "   IP: $IP"
        echo ""

        ansible-playbook openclaw-service.yml \
            -i "${IP}," \
            --private-key="${KEY_FILE}" \
            -e "ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'" \
            -e "openclaw_state=${OPENCLAW_STATE}" \
            -e "openclaw_enabled=${OPENCLAW_ENABLED}" \
            -e "instance_name=${INSTANCE_NAME}"
        ;;
    provision|*)
        [ $# -gt 0 ] && shift
        echo "⚡ Provisioning and installing RoboClaw (~2-3 minutes)..."
        ansible-playbook hetzner-finland-fast.yml "$@"
        ;;
esac
