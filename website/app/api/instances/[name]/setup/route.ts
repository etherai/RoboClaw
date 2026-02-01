import { readFile } from 'fs/promises'
import { join } from 'path'
import { parse } from 'yaml'
import { Client } from 'ssh2'
import { createConnection } from 'net'
import tunnelManager from '@/lib/tunnel-manager'

// Force Node.js runtime (required for fs and ssh2)
export const runtime = 'nodejs'

// Project root
const PROJECT_ROOT = join(process.cwd(), '..')
const INSTANCES_DIR = join(PROJECT_ROOT, 'instances')

interface RouteContext {
  params: Promise<{ name: string }>
}

/**
 * Simple hash function to generate a consistent number from a string
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params
    const artifactPath = join(INSTANCES_DIR, `${name}.yml`)

    // Read and parse instance artifact
    const artifactContent = await readFile(artifactPath, 'utf-8')
    const artifact = parse(artifactContent)

    if (!artifact.instances || !artifact.instances[0]) {
      return new Response(
        JSON.stringify({ error: 'Invalid artifact format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const instance = artifact.instances[0]
    const ip = instance.ip
    const keyFile = instance.ssh?.key_file

    if (!ip || !keyFile) {
      return new Response(
        JSON.stringify({ error: 'Missing IP or SSH key in artifact' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Resolve key path (it might be relative to PROJECT_ROOT)
    const keyPath = keyFile.startsWith('/') ? keyFile : join(PROJECT_ROOT, keyFile)

    // Read SSH private key
    const privateKey = await readFile(keyPath, 'utf-8')

    console.log(`[Setup] Starting setup for ${name} at ${ip}`)

    // Generate a unique remote port for this instance (7681-7780)
    const remotePort = 7681 + (hashString(name) % 100)
    console.log(`[Setup] Using remote port ${remotePort} for ${name}`)

    // Connect to remote server via SSH and start ttyd
    console.log(`[Setup] Starting ttyd on remote server...`)
    await startTtydOnRemote(ip, privateKey, remotePort, name)
    console.log(`[Setup] ttyd started successfully`)

    // Start SSH tunnel using tunnel manager
    console.log(`[Setup] Creating SSH tunnel...`)
    const localPort = await tunnelManager.startTunnel(name, ip, keyPath, remotePort)
    console.log(`[Setup] SSH tunnel created on port ${localPort}`)

    // Wait for ttyd to be ready and accepting connections (30 second timeout)
    console.log(`[Setup] Waiting for ttyd to become available...`)
    await waitForTtyd('127.0.0.1', localPort, 30000)
    console.log(`[Setup] ttyd is ready!`)

    return new Response(
      JSON.stringify({
        url: `http://localhost:${localPort}`,
        tunnelActive: true,
        port: localPort,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error starting setup:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to start setup',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params

    // Stop the tunnel
    tunnelManager.stopTunnel(name)

    return new Response(
      JSON.stringify({ tunnelActive: false }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error stopping setup:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to stop setup',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Connects to the remote server via SSH and starts ttyd running openclaw onboard.
 */
/**
 * Execute a command via SSH and wait for it to complete
 */
function execSSHCommand(conn: Client, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stdout = ''
      let stderr = ''

      stream.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      stream.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      stream.on('close', (code: number) => {
        resolve({ stdout, stderr, code })
      })
    })
  })
}

function startTtydOnRemote(
  ip: string,
  privateKey: string,
  remotePort: number,
  instanceName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const timeout = setTimeout(() => {
      conn.end()
      reject(new Error('SSH connection timeout (10s)'))
    }, 10000)

    conn.on('ready', async () => {
      console.log(`[Setup] SSH connection established`)
      clearTimeout(timeout)

      try {
        const scriptPath = `/usr/local/bin/openclaw-onboard-${instanceName}.sh`
        const logPath = `/tmp/ttyd-${instanceName}.log`

        // Step 1: Create wrapper script
        console.log(`[Setup] Creating wrapper script`)
        await execSSHCommand(conn, `echo '#!/bin/bash' > ${scriptPath}`)
        await execSSHCommand(conn, `echo 'su -l openclaw -c "openclaw onboard"' >> ${scriptPath}`)
        await execSSHCommand(conn, `chmod +x ${scriptPath}`)

        // Step 2: Kill existing ttyd
        console.log(`[Setup] Killing existing ttyd processes`)
        await execSSHCommand(conn, `pkill -f "ttyd.*--port ${remotePort}" || true`)

        // Step 3: Start ttyd
        console.log(`[Setup] Starting ttyd on port ${remotePort}`)
        await execSSHCommand(conn, `nohup ttyd --writable --port ${remotePort} --interface 127.0.0.1 ${scriptPath} > ${logPath} 2>&1 &`)

        // Step 4: Wait for it to start
        console.log(`[Setup] Waiting for ttyd to initialize`)
        await new Promise(r => setTimeout(r, 5000))

        // Step 5: Verify it's running
        console.log(`[Setup] Verifying ttyd is running`)
        const result = await execSSHCommand(conn, `pgrep -f "ttyd.*--port ${remotePort}"`)

        if (result.code === 0 && result.stdout.trim()) {
          console.log(`[Setup] SUCCESS: ttyd is running (PID: ${result.stdout.trim()})`)
          conn.end()
          resolve()
        } else {
          const logResult = await execSSHCommand(conn, `cat ${logPath}`)
          conn.end()
          reject(new Error(`ttyd failed to start. Log:\n${logResult.stdout}`))
        }
      } catch (error) {
        conn.end()
        reject(error)
      }
    })

    conn.on('error', (err) => {
      console.error(`[Setup] SSH error:`, err)
      clearTimeout(timeout)
      reject(err)
    })

    conn.connect({
      host: ip,
      port: 22,
      username: 'root',
      privateKey,
      readyTimeout: 10000,
      hostVerifier: () => true,
    })
  })
}

/**
 * Waits for ttyd to be ready and accepting HTTP/WebSocket connections.
 * This verifies that ttyd has fully started, not just that the SSH tunnel is listening.
 */
async function waitForTtyd(
  host: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  const startTime = Date.now()
  let attempts = 0

  while (Date.now() - startTime < timeoutMs) {
    attempts++
    try {
      // Try to fetch ttyd's web UI (it serves HTML at /)
      const response = await fetch(`http://${host}:${port}/`, {
        signal: AbortSignal.timeout(2000)
      })

      if (response.ok) {
        console.log(`[Setup] ttyd is ready after ${attempts} attempts (${Date.now() - startTime}ms)`)
        return
      }
    } catch (error) {
      // Connection refused or timeout - ttyd not ready yet
      if (attempts % 10 === 0) {
        const elapsed = Date.now() - startTime
        console.log(`[Setup] Waiting for ttyd... (attempt ${attempts}, ${elapsed}ms elapsed)`)
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const elapsed = Date.now() - startTime
  console.error(`[Setup] Timeout: ttyd not ready after ${elapsed}ms`)
  throw new Error(`Timeout: ttyd not ready on ${host}:${port} after ${elapsed}ms`)
}

/**
 * Waits for a TCP port to become available.
 */
function waitForPort(
  host: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let attempts = 0

    const check = () => {
      attempts++
      const socket = createConnection({ host, port, timeout: 1000 })

      socket.on('connect', () => {
        socket.end()
        console.log(`[Setup] Port ${port} is available after ${attempts} attempts (${Date.now() - startTime}ms)`)
        resolve()
      })

      socket.on('error', (err) => {
        socket.destroy()
        const elapsed = Date.now() - startTime

        if (elapsed > timeoutMs) {
          console.error(`[Setup] Timeout waiting for port ${port} after ${attempts} attempts (${elapsed}ms)`)
          reject(new Error(`Timeout waiting for port ${port} on ${host} after ${elapsed}ms`))
        } else {
          // Log every 10th attempt to avoid spam
          if (attempts % 10 === 0) {
            console.log(`[Setup] Still waiting for port ${port}... (attempt ${attempts}, ${elapsed}ms elapsed)`)
          }
          setTimeout(check, 500)
        }
      })

      socket.on('timeout', () => {
        socket.destroy()
        const elapsed = Date.now() - startTime

        if (elapsed > timeoutMs) {
          console.error(`[Setup] Timeout waiting for port ${port} after ${attempts} attempts (${elapsed}ms)`)
          reject(new Error(`Timeout waiting for port ${port} on ${host} after ${elapsed}ms`))
        } else {
          setTimeout(check, 500)
        }
      })
    }

    check()
  })
}
