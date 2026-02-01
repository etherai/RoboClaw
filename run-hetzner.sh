#!/bin/bash
set -e

# Activate virtualenv
if [ -d "venv" ]; then
    source venv/bin/activate
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

if [ -z "$SSH_PUBLIC_KEY" ]; then
    echo "SSH_PUBLIC_KEY not set, checking for local key..."

    # Use project-local SSH key
    SSH_KEY_PATH="./hetzner_key"

    if [ ! -f "$SSH_KEY_PATH" ]; then
        echo "Creating new SSH key for Hetzner instance..."
        ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "hetzner-finland-instance"
        echo "✅ SSH key created: $SSH_KEY_PATH"
    else
        echo "Found existing SSH key: $SSH_KEY_PATH"
    fi

    export SSH_PUBLIC_KEY="$(cat ${SSH_KEY_PATH}.pub)"

    # Add to .gitignore to prevent committing private key
    if ! grep -q "^hetzner_key$" .gitignore 2>/dev/null; then
        echo "hetzner_key" >> .gitignore
        echo "hetzner_key.pub" >> .gitignore
    fi
fi

# Check if first argument is a command
case "${1:-provision}" in
    list)
        echo "Listing all servers..."
        ansible-playbook hetzner-teardown.yml --tags list
        ;;
    delete|teardown|destroy)
        shift
        echo "Running teardown playbook..."
        ansible-playbook hetzner-teardown.yml --tags delete "$@"
        ;;
    full)
        shift
        echo "Running FULL install with all extras (~10-15 minutes)..."
        ansible-playbook hetzner-finland.yml "$@"
        ;;
    provision|fast|*)
        shift
        echo "⚡ Running FAST install - essentials only (~2-3 minutes)..."
        echo "For full install with oh-my-zsh and extras: ./run-hetzner.sh full"
        ansible-playbook hetzner-finland-fast.yml "$@"
        ;;
esac
