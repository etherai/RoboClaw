import { Client, type ClientChannel } from 'ssh2'
import type { LogLevel } from './types'

export type LogCallback = (level: LogLevel, message: string) => void

export class SSHProvisioner {
  private client: Client | null = null
  private connected = false

  /**
   * Connects to the remote server via SSH
   */
  async connect(
    host: string,
    privateKey: string,
    onLog: LogCallback,
    retries = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.attemptConnection(host, privateKey, onLog)
        this.connected = true
        onLog('success', `Connected to ${host}`)
        return
      } catch (error) {
        onLog(
          'warning',
          `Connection attempt ${attempt}/${retries} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    }
    throw new Error(`Failed to connect after ${retries} attempts`)
  }

  private attemptConnection(
    host: string,
    privateKey: string,
    onLog: LogCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Client()

      this.client
        .on('ready', () => {
          resolve()
        })
        .on('error', (err) => {
          reject(err)
        })
        .connect({
          host,
          port: 22,
          username: 'root',
          privateKey,
          readyTimeout: 30000,
          algorithms: {
            kex: ['curve25519-sha256@libssh.org', 'curve25519-sha256'],
          },
        })
    })
  }

  /**
   * Executes a single command and streams output
   */
  async exec(command: string, onLog: LogCallback): Promise<number> {
    if (!this.client || !this.connected) {
      throw new Error('Not connected to SSH server')
    }

    return new Promise((resolve, reject) => {
      this.client!.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          reject(err)
          return
        }

        let exitCode = 0

        stream
          .on('close', (code: number) => {
            exitCode = code
            resolve(exitCode)
          })
          .on('data', (data: Buffer) => {
            const lines = data.toString().trim().split('\n')
            lines.forEach((line) => {
              if (line) onLog('info', line)
            })
          })
          .stderr.on('data', (data: Buffer) => {
            const lines = data.toString().trim().split('\n')
            lines.forEach((line) => {
              if (line) onLog('warning', line)
            })
          })
      })
    })
  }

  /**
   * Executes multiple commands sequentially
   */
  async execScript(commands: string[], onLog: LogCallback): Promise<void> {
    for (const command of commands) {
      onLog('command', `$ ${command}`)
      const exitCode = await this.exec(command, onLog)
      if (exitCode !== 0) {
        throw new Error(`Command failed with exit code ${exitCode}: ${command}`)
      }
    }
  }

  /**
   * Disconnects from the server
   */
  disconnect(): void {
    if (this.client) {
      this.client.end()
      this.client = null
      this.connected = false
    }
  }
}

/**
 * Phase 1: Install base packages
 * Replicates hetzner-finland-fast.yml lines 111-125
 */
export const INSTALL_PACKAGES_COMMANDS = [
  'export DEBIAN_FRONTEND=noninteractive',
  'apt-get update -qq',
  'apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release',
]

/**
 * Phase 2: Create roboclaw user
 * Replicates hetzner-finland-fast.yml lines 128-145
 */
export const CREATE_USER_COMMANDS = [
  'useradd -m -s /bin/bash -c "RoboClaw system user" roboclaw || true',
  'echo "roboclaw ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/roboclaw',
  'chmod 0440 /etc/sudoers.d/roboclaw',
  'visudo -cf /etc/sudoers.d/roboclaw',
  'loginctl enable-linger roboclaw || true',
]

/**
 * Phase 3: Install Docker CE
 * Replicates hetzner-finland-fast.yml lines 148-181
 */
export const INSTALL_DOCKER_COMMANDS = [
  'install -m 0755 -d /etc/apt/keyrings',
  'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg',
  'chmod a+r /etc/apt/keyrings/docker.gpg',
  'ARCH=$(dpkg --print-architecture) && CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME") && echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list',
  'apt-get update -qq',
  'apt-get install -y -qq docker-ce docker-ce-cli containerd.io',
  'usermod -aG docker roboclaw',
  'systemctl start docker',
  'systemctl enable docker',
]

/**
 * Phase 4: Configure UFW firewall
 * Replicates hetzner-finland-fast.yml lines 183-205
 */
export const CONFIGURE_FIREWALL_COMMANDS = [
  'apt-get install -y -qq ufw',
  'ufw default deny incoming',
  'ufw default allow outgoing',
  'ufw allow 22/tcp',
  'ufw --force enable',
]

/**
 * Phase 5: Install Node.js 22
 * Replicates hetzner-finland-fast.yml lines 207-229
 */
export const INSTALL_NODEJS_COMMANDS = [
  'curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --batch --yes --dearmor -o /usr/share/keyrings/nodesource.gpg',
  'echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list',
  'apt-get update -qq',
  'apt-get install -y -qq nodejs',
  'npm install -g pnpm',
]

/**
 * Phase 6: Install RoboClaw
 * Replicates hetzner-finland-fast.yml lines 232-281
 */
export const INSTALL_ROBOCLAW_COMMANDS = [
  'mkdir -p /home/roboclaw/.roboclaw/sessions',
  'mkdir -p /home/roboclaw/.roboclaw/credentials',
  'mkdir -p /home/roboclaw/.roboclaw/data',
  'mkdir -p /home/roboclaw/.roboclaw/logs',
  'mkdir -p /home/roboclaw/.local/share/pnpm',
  'mkdir -p /home/roboclaw/.local/bin',
  'chown -R roboclaw:roboclaw /home/roboclaw/.roboclaw',
  'chown -R roboclaw:roboclaw /home/roboclaw/.local',
  'chmod 0700 /home/roboclaw/.roboclaw/credentials',
  'su - roboclaw -c "pnpm config set global-dir /home/roboclaw/.local/share/pnpm"',
  'su - roboclaw -c "pnpm config set global-bin-dir /home/roboclaw/.local/bin"',
  'su - roboclaw -c "PNPM_HOME=/home/roboclaw/.local/share/pnpm PATH=/home/roboclaw/.local/bin:\\$PATH pnpm install -g roboclaw@latest"',
  `cat >> /home/roboclaw/.bashrc << 'BASHRC_EOF'

# BEGIN ANSIBLE MANAGED BLOCK - RoboClaw
# pnpm configuration
export PNPM_HOME="/home/roboclaw/.local/share/pnpm"
export PATH="/home/roboclaw/.local/bin:\\$PNPM_HOME:\\$PATH"
# END ANSIBLE MANAGED BLOCK - RoboClaw
BASHRC_EOF`,
  'chown roboclaw:roboclaw /home/roboclaw/.bashrc',
]

/**
 * Phase 7: Verify installation
 * Replicates hetzner-finland-fast.yml lines 283-286
 */
export const VERIFY_COMMANDS = [
  'su - roboclaw -c "roboclaw --version"',
  'docker --version',
  'node --version',
  'pnpm --version',
  'ufw status',
]

/**
 * Complete provisioning workflow
 */
export async function provisionServer(
  host: string,
  privateKey: string,
  onLog: LogCallback
): Promise<void> {
  const provisioner = new SSHProvisioner()

  try {
    // Wait for SSH to be ready
    onLog('info', 'Waiting for SSH to become available...')
    await waitForSSH(host, 120000)
    onLog('success', 'SSH is ready')

    // Connect
    onLog('info', 'Connecting to server...')
    await provisioner.connect(host, privateKey, onLog)

    // Phase 1: Install packages
    onLog('info', 'Installing base packages...')
    await provisioner.execScript(INSTALL_PACKAGES_COMMANDS, onLog)
    onLog('success', 'Base packages installed')

    // Phase 2: Create user
    onLog('info', 'Creating roboclaw user...')
    await provisioner.execScript(CREATE_USER_COMMANDS, onLog)
    onLog('success', 'RoboClaw user created')

    // Phase 3: Install Docker
    onLog('info', 'Installing Docker CE...')
    await provisioner.execScript(INSTALL_DOCKER_COMMANDS, onLog)
    onLog('success', 'Docker installed')

    // Phase 4: Configure firewall
    onLog('info', 'Configuring UFW firewall...')
    await provisioner.execScript(CONFIGURE_FIREWALL_COMMANDS, onLog)
    onLog('success', 'Firewall configured')

    // Phase 5: Install Node.js
    onLog('info', 'Installing Node.js 22 and pnpm...')
    await provisioner.execScript(INSTALL_NODEJS_COMMANDS, onLog)
    onLog('success', 'Node.js and pnpm installed')

    // Phase 6: Install RoboClaw
    onLog('info', 'Installing RoboClaw...')
    await provisioner.execScript(INSTALL_ROBOCLAW_COMMANDS, onLog)
    onLog('success', 'RoboClaw installed')

    // Phase 7: Verify
    onLog('info', 'Verifying installation...')
    await provisioner.execScript(VERIFY_COMMANDS, onLog)
    onLog('success', 'Installation verified')
  } finally {
    provisioner.disconnect()
  }
}

/**
 * Waits for SSH port to become available
 */
async function waitForSSH(
  host: string,
  timeoutMs = 120000
): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 3000

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Try to connect to port 22
      const connected = await checkSSHPort(host, 22, 5000)
      if (connected) {
        return
      }
    } catch {
      // Ignore errors and retry
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(`SSH did not become available within ${timeoutMs / 1000}s`)
}

/**
 * Checks if SSH port is open
 */
function checkSSHPort(
  host: string,
  port: number,
  timeout: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net')
    const socket = new net.Socket()

    socket.setTimeout(timeout)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(port, host)
  })
}
