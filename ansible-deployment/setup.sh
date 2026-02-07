#!/bin/bash
set -e

# Change to project root directory to ensure paths work correctly
cd "$(dirname "$0")/.."

# Automatic setup script for RoboClaw deployment
# Checks for Python 3.12+, creates venv, installs dependencies

echo "🔧 RoboClaw Deployment Setup"
echo ""

# Function to check Python version
check_python_version() {
    local python_cmd="$1"

    if ! command -v "$python_cmd" &> /dev/null; then
        return 1
    fi

    local version=$($python_cmd --version 2>&1 | awk '{print $2}')
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)

    if [ "$major" -lt 3 ] || ([ "$major" -eq 3 ] && [ "$minor" -lt 12 ]); then
        return 1
    fi

    echo "$python_cmd"
    return 0
}

# Try to find Python 3.12+
echo "Checking for Python 3.12+..."
PYTHON_CMD=""

# Try common Python commands
for cmd in python3.12 python3 python; do
    if PYTHON_CMD=$(check_python_version "$cmd" 2>/dev/null); then
        PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
        echo "✓ Found Python $PYTHON_VERSION at: $(which $PYTHON_CMD)"
        break
    fi
done

# Check pyenv if available
if [ -z "$PYTHON_CMD" ] && command -v pyenv &> /dev/null; then
    echo "Checking pyenv installations..."
    if [ -f ~/.pyenv/versions/3.12.0/bin/python3 ]; then
        PYTHON_CMD=~/.pyenv/versions/3.12.0/bin/python3
        PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | awk '{print $2}')
        echo "✓ Found Python $PYTHON_VERSION via pyenv"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
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

echo ""

# Create venv if it doesn't exist
if [ -d "venv" ]; then
    echo "✓ Virtual environment already exists"
else
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
    echo "✓ Virtual environment created"
fi

echo ""

# Activate venv
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip -q

echo ""

# Install requirements
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo ""

# Install Ansible collections
echo "Installing Ansible collections..."
ansible-galaxy collection install hetzner.hcloud

echo ""
echo "✅ Setup complete!"
echo ""
echo "Your environment is ready. You can now:"
echo "  ./run-deploy.sh -k <key> -i <inventory>"
echo "  ./run-hetzner.sh"
echo ""
echo "Note: The virtual environment is activated in this shell."
echo "      To activate it in new shells, run: source venv/bin/activate"
