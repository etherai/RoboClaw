#!/bin/bash
set -e

# Change to script directory (cli/) to ensure relative paths work
cd "$(dirname "$0")"

# Connect to RoboClaw instance and run OpenClaw commands
#
# Usage:
#   ./connect-instance.sh <instance-name>                    # Connect using instance artifact
#   ./connect-instance.sh <instance-name> setup              # Run openclaw setup
#   ./connect-instance.sh <instance-name> onboard            # Run openclaw onboard
#   ./connect-instance.sh --ip <ip> --key <path> [command]  # Connect using custom IP/key
#
# Examples:
#   ./connect-instance.sh ROBOCLAW-INT-TEST setup
#   ./connect-instance.sh ROBOCLAW-INT-TEST onboard
#   ./connect-instance.sh ROBOCLAW-INT-TEST                  # Interactive shell
#   ./connect-instance.sh --ip 77.42.73.229 --key ./ssh-keys/key setup

# Parse arguments
INSTANCE_NAME=""
IP=""
SSH_KEY=""
OPENCLAW_CMD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --ip)
            IP="$2"
            shift 2
            ;;
        --key)
            SSH_KEY="$2"
            shift 2
            ;;
        -h|--help)
            echo "Connect to RoboClaw instance and run OpenClaw commands"
            echo ""
            echo "Usage:"
            echo "  ./connect-instance.sh <instance-name> [command]"
            echo "  ./connect-instance.sh --ip <ip> --key <path> [command]"
            echo ""
            echo "Commands:"
            echo "  onboard    Run 'openclaw onboard' - full interactive setup wizard (recommended)"
            echo "  setup      Run 'openclaw setup' - minimal config initialization"
            echo "  (none)     Open interactive shell as roboclaw user"
            echo ""
            echo "Examples:"
            echo "  ./connect-instance.sh ROBOCLAW-INT-TEST onboard"
            echo "  ./connect-instance.sh ROBOCLAW-INT-TEST"
            echo "  ./connect-instance.sh --ip 77.42.73.229 --key ./ssh-keys/key onboard"
            exit 0
            ;;
        setup|onboard|configure|status|help)
            OPENCLAW_CMD="$1"
            shift
            ;;
        *)
            if [ -z "$INSTANCE_NAME" ]; then
                INSTANCE_NAME="$1"
            fi
            shift
            ;;
    esac
done

# Determine connection details
if [ -n "$INSTANCE_NAME" ]; then
    # Read from instance artifact
    ARTIFACT="../instances/${INSTANCE_NAME}.yml"
    if [ ! -f "$ARTIFACT" ]; then
        echo "Error: Instance artifact not found: $ARTIFACT"
        echo ""
        echo "Available instances:"
        ls -1 ../instances/*.yml 2>/dev/null | xargs -n1 basename | sed 's/.yml$//' | sed 's/^/  - /'
        exit 1
    fi

    IP=$(grep '^\s*ip:' "$ARTIFACT" | head -1 | awk '{print $2}')
    SSH_KEY=$(grep '^\s*key_file:' "$ARTIFACT" | head -1 | awk '{print $2}' | tr -d '"' | sed 's/^"\(.*\)"$/\1/')

    if [ -z "$IP" ]; then
        echo "Error: Could not extract IP from $ARTIFACT"
        exit 1
    fi

    if [ -z "$SSH_KEY" ]; then
        echo "Error: Could not extract key_file from $ARTIFACT"
        exit 1
    fi
fi

# Validate we have connection details
if [ -z "$IP" ]; then
    echo "Error: No IP address specified. Use <instance-name> or --ip <address>"
    exit 1
fi

if [ -z "$SSH_KEY" ]; then
    echo "Error: No SSH key specified. Use <instance-name> or --key <path>"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "Error: SSH key not found: $SSH_KEY"
    exit 1
fi

# Display connection info
echo "🔗 Connecting to RoboClaw instance"
echo "   IP: $IP"
echo "   SSH Key: $SSH_KEY"
if [ -n "$OPENCLAW_CMD" ]; then
    echo "   Command: openclaw $OPENCLAW_CMD"
fi
echo ""

# Build the remote command
if [ -n "$OPENCLAW_CMD" ]; then
    # Run specific openclaw command
    REMOTE_CMD="su - roboclaw -c 'openclaw $OPENCLAW_CMD'"
else
    # Interactive shell as roboclaw user
    REMOTE_CMD="su - roboclaw"
fi

# Connect via SSH
ssh -i "$SSH_KEY" \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -t \
    root@"$IP" \
    "$REMOTE_CMD"
