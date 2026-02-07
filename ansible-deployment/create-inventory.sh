#!/bin/bash
set -e

# Create Ansible inventory file from IP address
#
# Usage:
#   ./create-inventory.sh <ip-address> [output-file]
#
# Examples:
#   ./create-inventory.sh 1.2.3.4
#   ./create-inventory.sh 1.2.3.4 production-inventory.ini

IP="$1"
OUTPUT_FILE="${2:-inventory.ini}"

if [ -z "$IP" ]; then
    echo "Error: IP address required"
    echo ""
    echo "Usage: ./create-inventory.sh <ip-address> [output-file]"
    echo ""
    echo "Examples:"
    echo "  ./create-inventory.sh 1.2.3.4"
    echo "  ./create-inventory.sh 1.2.3.4 production-inventory.ini"
    exit 1
fi

# Validate IP format (basic check)
if ! echo "$IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
    echo "Error: Invalid IP address format: $IP"
    exit 1
fi

# Create inventory file
cat > "$OUTPUT_FILE" << EOF
[servers]
$IP ansible_user=root
EOF

echo "✅ Created inventory file: $OUTPUT_FILE"
echo "   IP: $IP"
echo ""
echo "Deploy with:"
echo "  ./run-deploy.sh -k <ssh-key> -i $OUTPUT_FILE"
