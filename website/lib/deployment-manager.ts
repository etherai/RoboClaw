import { generateOpenSSHKeypair } from './keygen'
import * as hetzner from './hetzner'
import { provisionServer } from './ssh-provisioner'
import type {
  DeployConfig,
  DeployPhase,
  LogEntry,
  PhaseUpdate,
  ProgressUpdate,
  DeployResult,
  DeployError,
  DeploymentState,
  LogLevel,
} from './types'

type EventEmitter = (
  event: 'log' | 'phase' | 'progress' | 'success' | 'error',
  data: unknown
) => void

export class DeploymentManager {
  private state: DeploymentState
  private startTime: number = 0

  constructor(config: DeployConfig) {
    this.state = {
      config: {
        serverName:
          config.serverName || `roboclaw-${Date.now().toString(36)}`,
        serverType: config.serverType || 'cax11',
        location: config.location || 'hel1',
        image: config.image || 'ubuntu-24.04',
        token: config.token,
      },
    }
  }

  /**
   * Main execution method that orchestrates the entire deployment
   */
  async execute(emit: EventEmitter): Promise<void> {
    this.startTime = Date.now()

    try {
      // Phase 1: Generate SSH keypair
      await this.runPhase(
        'keygen',
        1,
        12,
        'Generating SSH keypair',
        emit,
        async (log) => {
          log('info', 'Generating Ed25519 SSH keypair...')
          this.state.sshKeypair = generateOpenSSHKeypair()
          log('success', 'SSH keypair generated')
        }
      )
      emit('progress', { percent: 5 })

      // Phase 2: Upload SSH key to Hetzner
      await this.runPhase(
        'ssh_key',
        2,
        12,
        'Uploading SSH key to Hetzner',
        emit,
        async (log) => {
          log('info', 'Creating SSH key in Hetzner Cloud...')
          const sshKey = await hetzner.createSSHKey(
            this.state.config.token,
            `${this.state.config.serverName}-key`,
            this.state.sshKeypair!.publicKey
          )
          this.state.sshKeyId = sshKey.id
          log('success', `SSH key created (ID: ${sshKey.id})`)
        }
      )
      emit('progress', { percent: 10 })

      // Phase 3: Create server
      await this.runPhase(
        'provisioning',
        3,
        12,
        'Creating VPS instance',
        emit,
        async (log) => {
          log('info', `Creating ${this.state.config.serverType} server in ${this.state.config.location}...`)
          const server = await hetzner.createServer(this.state.config.token, {
            name: this.state.config.serverName!,
            serverType: this.state.config.serverType!,
            image: this.state.config.image!,
            location: this.state.config.location!,
            sshKeyIds: [this.state.sshKeyId!],
          })
          this.state.serverId = server.id
          this.state.serverIp = server.public_net.ipv4.ip
          log('success', `Server created (ID: ${server.id}, IP: ${this.state.serverIp})`)

          // Wait for server to be running
          log('info', 'Waiting for server to start...')
          await hetzner.waitForServerRunning(
            this.state.config.token,
            this.state.serverId,
            (msg) => log('info', msg)
          )
          log('success', 'Server is running')
        }
      )
      emit('progress', { percent: 25 })

      // Phase 4-11: Provision server via SSH
      await this.runPhase(
        'ssh_wait',
        4,
        12,
        'Waiting for SSH',
        emit,
        async (log) => {
          log('info', 'Waiting for SSH to become available...')
          await this.waitForSSH(this.state.serverIp!, 120000, log)
          log('success', 'SSH is ready')
        }
      )
      emit('progress', { percent: 30 })

      // Run all provisioning phases
      await this.runPhase(
        'install_packages',
        5,
        12,
        'Installing base packages',
        emit,
        async (log) => {
          await provisionServer(
            this.state.serverIp!,
            this.state.sshKeypair!.privateKey,
            (level, message) => log(level, message)
          )
        }
      )
      emit('progress', { percent: 100 })

      // Phase 12: Success
      const result: DeployResult = {
        ip: this.state.serverIp!,
        serverName: this.state.config.serverName!,
        sshPrivateKey: this.state.sshKeypair!.privateKey,
        sshUser: 'root',
        nextSteps: [
          `ssh -i roboclaw_key root@${this.state.serverIp}`,
          'sudo su - roboclaw',
          'openclaw onboard --install-daemon',
        ],
      }

      const duration = ((Date.now() - this.startTime) / 1000).toFixed(0)
      this.emitLog(emit, 'success', `Deployment completed in ${duration}s`)
      emit('success', result)
    } catch (error) {
      await this.handleError(error, emit)
    }
  }

  /**
   * Runs a single deployment phase
   */
  private async runPhase(
    phase: DeployPhase,
    step: number,
    totalSteps: number,
    label: string,
    emit: EventEmitter,
    fn: (log: (level: LogLevel, message: string) => void) => Promise<void>
  ): Promise<void> {
    const phaseUpdate: PhaseUpdate = { phase, step, totalSteps, label }
    emit('phase', phaseUpdate)

    const log = (level: LogLevel, message: string) => {
      this.emitLog(emit, level, message, phase)
    }

    await fn(log)
  }

  /**
   * Emits a log event
   */
  private emitLog(
    emit: EventEmitter,
    level: LogLevel,
    message: string,
    phase?: DeployPhase
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      phase,
    }
    emit('log', logEntry)
  }

  /**
   * Handles errors during deployment
   */
  private async handleError(error: unknown, emit: EventEmitter): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    this.emitLog(emit, 'error', errorMessage)

    const deployError: DeployError = {
      message: errorMessage,
      serverId: this.state.serverId,
      recoverable: true,
    }

    emit('error', deployError)

    // Attempt cleanup
    if (this.state.serverId || this.state.sshKeyId) {
      this.emitLog(emit, 'warning', 'Cleaning up resources...')
      try {
        if (this.state.serverId) {
          await hetzner.deleteServer(
            this.state.config.token,
            this.state.serverId
          )
          this.emitLog(emit, 'info', 'Server deleted')
        }
        if (this.state.sshKeyId) {
          await hetzner.deleteSSHKey(
            this.state.config.token,
            this.state.sshKeyId
          )
          this.emitLog(emit, 'info', 'SSH key deleted')
        }
      } catch (cleanupError) {
        this.emitLog(
          emit,
          'warning',
          `Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`
        )
      }
    }
  }

  /**
   * Waits for SSH to become available
   */
  private async waitForSSH(
    host: string,
    timeoutMs: number,
    log: (level: LogLevel, message: string) => void
  ): Promise<void> {
    const startTime = Date.now()
    const pollInterval = 3000

    while (Date.now() - startTime < timeoutMs) {
      try {
        const available = await this.checkSSHPort(host, 22, 5000)
        if (available) {
          return
        }
        log('info', 'SSH not ready yet, retrying...')
      } catch {
        // Ignore errors
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new Error(`SSH did not become available within ${timeoutMs / 1000}s`)
  }

  /**
   * Checks if SSH port is open
   */
  private checkSSHPort(
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
}
