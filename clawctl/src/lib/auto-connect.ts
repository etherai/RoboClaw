import { spawn, ChildProcess } from 'child_process'
import * as readline from 'readline'
import type { SSHClient } from './ssh-client.js'
import type { SSHConfig, UserInfo } from './types.js'
import * as logger from './logger.js'

interface PairingRequest {
  requestId: string
  deviceId: string
  ip: string
  age: string
}

/**
 * Prompt user to auto-connect (Y/n)
 */
export async function promptAutoConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log()
    console.log('┌─ Auto-connect to Dashboard ─────────────────────────────────┐')
    console.log('│ Would you like to open the dashboard now?                   │')
    console.log('└─────────────────────────────────────────────────────────────┘')

    rl.question('  [Y/n]: ', (answer) => {
      rl.close()
      resolve(answer.toLowerCase() !== 'n')
    })
  })
}

/**
 * Create SSH tunnel for port forwarding
 */
export function createSSHTunnel(sshConfig: SSHConfig, port: number = 18789): ChildProcess {
  const args = [
    '-L', `${port}:localhost:${port}`,
    '-i', sshConfig.privateKeyPath,
    '-p', String(sshConfig.port),
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-N',  // No remote command
    `${sshConfig.username}@${sshConfig.host}`
  ]

  const tunnel = spawn('ssh', args, {
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false
  })

  return tunnel
}

/**
 * Open browser with URL (cross-platform)
 */
export function openBrowser(url: string): void {
  const platform = process.platform
  let command: string
  let args: string[]

  if (platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '', url]
  } else {
    // Linux/WSL
    command = 'xdg-open'
    args = [url]
  }

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref()
  } catch (error) {
    logger.warn(`Failed to open browser automatically: ${error}`)
    logger.info(`Please open manually: ${url}`)
  }
}

/**
 * Get pending pairing requests from gateway
 */
export async function getPendingRequests(
  ssh: SSHClient,
  userInfo: UserInfo
): Promise<PairingRequest[]> {
  const cmd = `cd ${userInfo.home}/docker && sudo -u ${userInfo.username} docker compose exec -T openclaw-gateway node dist/index.js devices list 2>/dev/null`

  try {
    const result = await ssh.exec(cmd)
    if (result.exitCode !== 0) return []

    // Parse the table output - extract request IDs from Pending section
    const lines = result.stdout.split('\n')
    const requests: PairingRequest[] = []

    let inPending = false
    for (const line of lines) {
      if (line.includes('Pending (')) {
        inPending = true
        continue
      }
      if (line.includes('Paired (')) {
        inPending = false
        continue
      }
      if (inPending && line.startsWith('│') && !line.includes('Request')) {
        // Parse table row: │ requestId │ deviceId │ role │ ip │ age │ flags │
        const parts = line.split('│').map(p => p.trim()).filter(p => p)
        if (parts.length >= 4 && parts[0].match(/^[0-9a-f-]{36}$/)) {
          requests.push({
            requestId: parts[0],
            deviceId: parts[1],
            ip: parts[3],
            age: parts[4] || ''
          })
        }
      }
    }

    return requests
  } catch (error) {
    logger.verbose(`Failed to get pending requests: ${error}`)
    return []
  }
}

/**
 * Wait for a new pairing request to appear
 */
export async function waitForNewPairingRequest(
  ssh: SSHClient,
  userInfo: UserInfo,
  existingIds: Set<string>,
  timeoutMs: number = 60000
): Promise<PairingRequest | null> {
  const startTime = Date.now()
  const pollInterval = 2000

  while (Date.now() - startTime < timeoutMs) {
    const requests = await getPendingRequests(ssh, userInfo)

    for (const req of requests) {
      if (!existingIds.has(req.requestId)) {
        return req
      }
    }

    await sleep(pollInterval)
  }

  return null
}

/**
 * Approve a device pairing request
 */
export async function approveDevice(
  ssh: SSHClient,
  userInfo: UserInfo,
  requestId: string
): Promise<boolean> {
  const cmd = `cd ${userInfo.home}/docker && sudo -u ${userInfo.username} docker compose exec -T openclaw-gateway node dist/index.js devices approve ${requestId}`

  try {
    const result = await ssh.exec(cmd)
    return result.exitCode === 0
  } catch (error) {
    logger.verbose(`Failed to approve device: ${error}`)
    return false
  }
}

/**
 * Main auto-connect orchestrator
 */
export async function autoConnect(
  ssh: SSHClient,
  sshConfig: SSHConfig,
  userInfo: UserInfo,
  port: number = 18789
): Promise<void> {
  // Step 1: Prompt user
  const shouldConnect = await promptAutoConnect()
  if (!shouldConnect) {
    logger.dim('  Skipping auto-connect')
    return
  }

  // Step 2: Get existing pending requests (to detect new ones)
  logger.info('Checking existing pairing requests...')
  const existingRequests = await getPendingRequests(ssh, userInfo)
  const existingIds = new Set(existingRequests.map(r => r.requestId))
  logger.verbose(`Found ${existingIds.size} existing pending requests`)

  // Step 3: Create SSH tunnel
  logger.info('Creating SSH tunnel on port 18789...')
  const tunnel = createSSHTunnel(sshConfig, port)

  // Wait for tunnel to establish
  await sleep(2000)

  if (tunnel.killed || tunnel.exitCode !== null) {
    logger.error('Failed to create SSH tunnel')
    return
  }

  logger.success(`Tunnel established (PID ${tunnel.pid})`)

  // Step 4: Open browser
  logger.info('Opening browser...')
  const url = `http://localhost:${port}`
  openBrowser(url)
  logger.success('Browser opened')

  // Step 5: Wait for new pairing request
  logger.info('Waiting for device pairing request...')
  logger.dim('  (press Ctrl+C to skip)')

  const newRequest = await waitForNewPairingRequest(ssh, userInfo, existingIds, 60000)

  if (!newRequest) {
    logger.warn('No new pairing request detected within 60 seconds')
    logger.info('You may need to refresh the browser or approve manually:')
    logger.indent(`ssh root@${sshConfig.host} "cd /home/${userInfo.username}/docker && sudo -u ${userInfo.username} docker compose exec openclaw-gateway node dist/index.js devices list"`)
    tunnel.kill()
    return
  }

  logger.success('New pairing request detected')
  logger.verbose(`Request ID: ${newRequest.requestId}`)

  // Step 6: Approve the device
  logger.info('Auto-approving device...')
  const approved = await approveDevice(ssh, userInfo, newRequest.requestId)

  if (approved) {
    logger.success('Device approved!')
    logger.blank()
    logger.success('Dashboard is ready!')
    logger.dim('  Tunnel will stay open. Press Ctrl+C to exit.')
  } else {
    logger.error('Failed to approve device')
  }

  // Keep process alive until Ctrl+C
  await waitForExit(tunnel)
}

/**
 * Wait for Ctrl+C, then cleanup
 */
function waitForExit(tunnel: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      logger.blank()
      logger.info('Closing SSH tunnel...')
      tunnel.kill()
      process.off('SIGINT', handler)
      resolve()
    }

    process.on('SIGINT', handler)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
