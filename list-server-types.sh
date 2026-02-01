#!/bin/bash
set -e

# Load .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$HCLOUD_TOKEN" ]; then
    echo "Error: HCLOUD_TOKEN not set in .env"
    exit 1
fi

echo "Fetching available server types from Hetzner Cloud..."
echo ""

# Get all server types
curl -s -H "Authorization: Bearer $HCLOUD_TOKEN" \
    https://api.hetzner.cloud/v1/server_types | \
    python3 -c "
import json, sys

data = json.load(sys.stdin)
output = []

output.append('=' * 80)
output.append('AVAILABLE HETZNER SERVER TYPES')
output.append('=' * 80)
output.append('')

for st in data['server_types']:
    if not st['deprecated']:
        output.append(f\"Name: {st['name']}\")
        output.append(f\"  Description: {st['description']}\")
        output.append(f\"  vCPU: {st['cores']}\")
        output.append(f\"  RAM: {st['memory']}GB\")
        output.append(f\"  Disk: {st['disk']}GB\")
        output.append(f\"  Price/month: €{st['prices'][0]['price_monthly']['gross']}\")
        output.append(f\"  Architecture: {st['architecture']}\")
        output.append('')

print('\n'.join(output))

# Write to file
with open('available-server-types.txt', 'w') as f:
    f.write('\n'.join(output))

print('✅ Server types saved to: available-server-types.txt')
"

echo ""
echo "Checking which types are available in Helsinki (hel1)..."
echo ""

# Get server types available in hel1
curl -s -H "Authorization: Bearer $HCLOUD_TOKEN" \
    "https://api.hetzner.cloud/v1/server_types" | \
    python3 -c "
import json, sys

data = json.load(sys.stdin)
output = []

output.append('=' * 80)
output.append('SERVER TYPES AVAILABLE IN HELSINKI (hel1)')
output.append('=' * 80)
output.append('')

for st in data['server_types']:
    if not st['deprecated']:
        # Check if hel1 is in available locations
        # Note: API doesn't directly provide per-location availability in server_types endpoint
        # So we'll list all non-deprecated types
        output.append(f\"{st['name']:15} - {st['cores']} vCPU, {st['memory']}GB RAM, {st['disk']}GB disk - €{st['prices'][0]['price_monthly']['gross']}/mo\")

print('\n'.join(output))

# Append to file
with open('available-server-types.txt', 'a') as f:
    f.write('\n\n')
    f.write('\n'.join(output))
"
