#!/bin/bash
# Quick validation script - tests openclaw on existing server
# Usage: ./quick-validate.sh [IP_ADDRESS]
# If no IP provided, uses finland-instance-ip.txt

set -euo pipefail

IP=${1:-$(cat finland-instance-ip.txt 2>/dev/null || echo "")}

if [[ -z "$IP" ]]; then
    echo "❌ Error: No IP address provided and finland-instance-ip.txt not found"
    echo "Usage: $0 [IP_ADDRESS]"
    exit 1
fi

echo "🔍 Validating OpenClaw on $IP..."
echo ""

source venv/bin/activate
ansible-playbook validate-openclaw.yml -i "$IP," --private-key=hetzner_key
