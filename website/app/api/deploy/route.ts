import { spawn } from 'child_process'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createWriteStream } from 'fs'
import type { DeployConfig } from '@/lib/types'

// Force Node.js runtime (required for child_process)
export const runtime = 'nodejs'
// 10 minute timeout for long-running deployments
export const maxDuration = 600

// Project root is one level up from website directory
const PROJECT_ROOT = join(process.cwd(), '..')
const LOGS_DIR = join(PROJECT_ROOT, 'deployment-logs')

// Sanitize sensitive data from log messages
function sanitizeLog(message: string, token: string): string {
  if (!message) return message

  // Replace full token with redacted version
  const redactedToken = token.substring(0, 8) + '...' + token.substring(token.length - 4)
  let sanitized = message.replace(new RegExp(token, 'g'), redactedToken)

  // Also redact any other potential tokens (64 char alphanumeric strings)
  sanitized = sanitized.replace(/\b[a-zA-Z0-9]{64}\b/g, (match) => {
    return match.substring(0, 8) + '...' + match.substring(match.length - 4)
  })

  return sanitized
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeployConfig

    // Validate token exists
    if (!body.token || typeof body.token !== 'string' || body.token.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing Hetzner API token' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Helper to emit SSE events
        const emit = (event: string, data: unknown) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          emit('heartbeat', {})
        }, 15000)

        try {
          await executeAnsibleDeployment(body, emit)
        } catch (error) {
          emit('error', {
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            recoverable: false,
          })
        } finally {
          clearInterval(heartbeatInterval)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

type EventEmitter = (
  event: 'log' | 'phase' | 'progress' | 'success' | 'error',
  data: unknown
) => void

async function executeAnsibleDeployment(
  config: DeployConfig,
  emit: EventEmitter
): Promise<void> {
  const startTime = Date.now()
  const serverName = config.serverName || `openclaw-${Date.now().toString(36)}`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFileName = `${timestamp}_${serverName}.log`
  const logFilePath = join(LOGS_DIR, logFileName)

  // Ensure logs directory exists
  try {
    await mkdir(LOGS_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create logs directory:', error)
  }

  // Create write stream for log file
  const logStream = createWriteStream(logFilePath, { flags: 'a' })
  const writeToLog = (message: string) => {
    const sanitized = sanitizeLog(message, config.token)
    logStream.write(`${sanitized}\n`)
  }

  writeToLog(`=== Deployment started at ${new Date().toISOString()} ===`)
  writeToLog(`Server name: ${serverName}`)
  writeToLog(`Server type: ${config.serverType || 'cax11'}`)
  writeToLog(`Location: ${config.location || 'hel1'}`)
  writeToLog(`Image: ${config.image || 'ubuntu-24.04'}`)
  writeToLog(`Log file: ${logFilePath}`)
  writeToLog('')

  emit('log', {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Starting Ansible deployment...',
    phase: 'keygen',
  })

  emit('phase', {
    phase: 'keygen',
    step: 1,
    totalSteps: 12,
    label: 'Initializing deployment',
  })

  return new Promise((resolve, reject) => {
    // Execute run-hetzner.sh with environment variables
    // Note: shell is false by default (removed shell: true to fix security warning)
    const child = spawn('./run-hetzner.sh', ['provision'], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        HCLOUD_TOKEN: config.token,
        // Pass additional config as environment variables
        SERVER_NAME: serverName,
        SERVER_TYPE: config.serverType || 'cax11',
        LOCATION: config.location || 'hel1',
        IMAGE: config.image || 'ubuntu-24.04',
      },
    })

    let currentPhase = 'keygen'
    let step = 1
    let serverIp: string | null = null

    // Parse Ansible output to determine phase
    const parsePhaseFromOutput = (line: string): { phase: string; step: number; label: string } | null => {
      // Match Ansible task names to determine phase
      if (line.includes('Generate SSH keypair') || line.includes('ssh-keygen')) {
        return { phase: 'keygen', step: 1, label: 'Generate SSH keypair' }
      }
      if (line.includes('Upload SSH key') || line.includes('Create or update SSH key')) {
        return { phase: 'ssh_key', step: 2, label: 'Upload SSH key' }
      }
      if (line.includes('Create Hetzner Cloud server') || line.includes('Create server')) {
        return { phase: 'provisioning', step: 3, label: 'Create VPS instance' }
      }
      if (line.includes('Wait for SSH')) {
        return { phase: 'ssh_wait', step: 4, label: 'Wait for SSH' }
      }
      if (line.includes('Update apt cache') || line.includes('Install minimal essential packages')) {
        return { phase: 'install_packages', step: 5, label: 'Install base packages' }
      }
      if (line.includes('Create openclaw user')) {
        return { phase: 'create_user', step: 6, label: 'Create openclaw user' }
      }
      if (line.includes('Install Docker')) {
        return { phase: 'install_docker', step: 7, label: 'Install Docker' }
      }
      if (line.includes('Configure UFW') || line.includes('Install UFW')) {
        return { phase: 'configure_firewall', step: 8, label: 'Configure firewall' }
      }
      if (line.includes('Install Node.js') || line.includes('Add NodeSource')) {
        return { phase: 'install_nodejs', step: 9, label: 'Install Node.js' }
      }
      if (line.includes('Install OpenClaw') || line.includes('Install pnpm')) {
        return { phase: 'install_openclaw', step: 10, label: 'Install OpenClaw' }
      }
      if (line.includes('Verify openclaw installation')) {
        return { phase: 'verify', step: 11, label: 'Verify installation' }
      }
      if (line.includes('FAST INSTALL COMPLETE')) {
        return { phase: 'success', step: 12, label: 'Complete' }
      }
      return null
    }

    // Extract IP address from output
    const extractIp = (line: string): string | null => {
      const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
      return ipMatch ? ipMatch[1] : null
    }

    child.stdout.on('data', (data) => {
      const output = data.toString()
      const lines = output.split('\n')

      lines.forEach((line: string) => {
        if (!line.trim()) return

        // Write to log file (sanitized)
        writeToLog(`[STDOUT] ${line}`)

        // Try to extract IP address
        const ip = extractIp(line)
        if (ip && !serverIp && !line.includes('127.0.0.1')) {
          serverIp = ip
        }

        // Update phase if we detect a new one
        const phaseInfo = parsePhaseFromOutput(line)
        if (phaseInfo && phaseInfo.step > step) {
          currentPhase = phaseInfo.phase
          step = phaseInfo.step
          writeToLog(`[PHASE] ${phaseInfo.label} (${phaseInfo.step}/12)`)
          emit('phase', {
            phase: phaseInfo.phase,
            step: phaseInfo.step,
            totalSteps: 12,
            label: phaseInfo.label,
          })
          emit('progress', { percent: Math.floor((step / 12) * 100) })
        }

        // Emit log
        emit('log', {
          timestamp: new Date().toISOString(),
          level: line.includes('fatal') || line.includes('FAILED') ? 'error'
                : line.includes('changed') || line.includes('ok:') || line.includes('✅') ? 'success'
                : line.includes('TASK') ? 'command'
                : 'info',
          message: line,
          phase: currentPhase,
        })
      })
    })

    child.stderr.on('data', (data) => {
      const output = data.toString()
      const lines = output.split('\n')

      lines.forEach((line: string) => {
        if (!line.trim()) return

        // Write to log file (sanitized)
        writeToLog(`[STDERR] ${line}`)

        emit('log', {
          timestamp: new Date().toISOString(),
          level: 'warning',
          message: line,
          phase: currentPhase,
        })
      })
    })

    child.on('close', async (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(0)
      writeToLog(`\n=== Process exited with code ${code} after ${duration}s ===`)

      if (code === 0) {
        try {
          // Read generated files
          const ipFilePath = join(PROJECT_ROOT, 'finland-instance-ip.txt')
          // SSH key is now server-specific
          const keyFilePath = join(PROJECT_ROOT, 'ssh-keys', `${serverName}_key`)

          // Read IP address
          let ip = serverIp
          try {
            ip = (await readFile(ipFilePath, 'utf-8')).trim()
            writeToLog(`Server IP: ${ip}`)
          } catch {
            // If file doesn't exist, use extracted IP from logs
            writeToLog('Failed to read IP file, using IP from logs')
          }

          // Read SSH private key
          let sshPrivateKey = ''
          try {
            sshPrivateKey = await readFile(keyFilePath, 'utf-8')
            writeToLog('SSH private key read successfully')
          } catch (error) {
            const errorMsg = `Could not read SSH key file: ${error}`
            writeToLog(errorMsg)
            emit('log', {
              timestamp: new Date().toISOString(),
              level: 'warning',
              message: errorMsg,
            })
          }

          if (!ip) {
            const errorMsg = 'Failed to determine server IP address'
            writeToLog(`ERROR: ${errorMsg}`)
            throw new Error(errorMsg)
          }

          const successMsg = `Deployment completed in ${duration}s`
          writeToLog(successMsg)
          writeToLog(`\n=== Deployment finished successfully at ${new Date().toISOString()} ===`)

          emit('log', {
            timestamp: new Date().toISOString(),
            level: 'success',
            message: successMsg,
          })

          emit('progress', { percent: 100 })

          emit('success', {
            ip,
            serverName,
            sshPrivateKey,
            sshUser: 'root',
            nextSteps: [
              'Complete setup from the dashboard at /instances',
              `Or manually: ssh -i openclaw_key root@${ip}`,
              'sudo su - openclaw',
              'openclaw onboard',
            ],
          })

          // Close log stream
          logStream.end()
          resolve()
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          writeToLog(`ERROR: ${errorMsg}`)
          writeToLog(`\n=== Deployment failed at ${new Date().toISOString()} ===`)
          logStream.end()
          reject(error)
        }
      } else {
        const errorMsg = `Ansible playbook failed with exit code ${code}`
        writeToLog(`ERROR: ${errorMsg}`)
        writeToLog(`\n=== Deployment failed at ${new Date().toISOString()} ===`)
        logStream.end()
        reject(new Error(errorMsg))
      }
    })

    child.on('error', (error) => {
      const errorMsg = `Failed to execute ansible: ${error.message}`
      writeToLog(`ERROR: ${errorMsg}`)
      writeToLog(`\n=== Deployment failed at ${new Date().toISOString()} ===`)
      logStream.end()
      reject(new Error(errorMsg))
    })
  })
}
