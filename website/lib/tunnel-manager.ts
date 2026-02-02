import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'

interface TunnelInfo {
  process: ChildProcess
  port: number
  remotePort: number
  instanceName: string
  ip: string
}

class TunnelManager {
  private tunnels: Map<string, TunnelInfo> = new Map()
  private basePort = 7681

  /**
   * Starts an SSH tunnel for the given instance.
   * Returns the local port the tunnel is bound to.
   */
  async startTunnel(
    instanceName: string,
    ip: string,
    keyPath: string,
    remotePort: number
  ): Promise<number> {
    // If a tunnel already exists for this instance, return its port
    if (this.tunnels.has(instanceName)) {
      return this.tunnels.get(instanceName)!.port
    }

    // Find an available port
    const port = await this.findAvailablePort()

    console.log(`[Tunnel] Creating tunnel for ${instanceName}: localhost:${port} -> ${ip}:${remotePort}`)

    // Spawn SSH tunnel process
    // -i: identity file (SSH key)
    // -o StrictHostKeyChecking=no: don't prompt for host verification
    // -o UserKnownHostsFile=/dev/null: don't save host to known_hosts
    // -L: local port forward (localPort:remoteHost:remotePort)
    // -N: don't execute remote command (just forward ports)
    const sshProcess = spawn('ssh', [
      '-i', keyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      '-L', `${port}:localhost:${remotePort}`,
      '-N',
      `root@${ip}`
    ])

    // Handle process errors
    sshProcess.on('error', (error) => {
      console.error(`[Tunnel] SSH tunnel error for ${instanceName}:`, error)
      this.tunnels.delete(instanceName)
    })

    // Handle process exit
    sshProcess.on('exit', (code) => {
      console.log(`[Tunnel] SSH tunnel exited for ${instanceName} with code ${code}`)
      this.tunnels.delete(instanceName)
    })

    // Log stderr for debugging (don't filter - we need all errors)
    sshProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim()
      if (message) {
        // Log warnings as info, actual errors as errors
        if (message.toLowerCase().includes('warning')) {
          console.log(`[Tunnel] SSH stderr for ${instanceName}:`, message)
        } else {
          console.error(`[Tunnel] SSH stderr for ${instanceName}:`, message)
        }
      }
    })

    // Log stdout (usually empty for SSH -N, but useful for debugging)
    sshProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim()
      if (message) {
        console.log(`[Tunnel] SSH stdout for ${instanceName}:`, message)
      }
    })

    // Store tunnel info
    this.tunnels.set(instanceName, {
      process: sshProcess,
      port,
      remotePort,
      instanceName,
      ip,
    })

    // Wait for the tunnel to establish and verify it's listening
    console.log(`[Tunnel] Waiting for SSH tunnel to establish...`)
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Verify the tunnel port is actually listening
    const isListening = await this.verifyTunnelListening(port)
    if (!isListening) {
      sshProcess.kill()
      this.tunnels.delete(instanceName)
      throw new Error(`SSH tunnel failed to establish on port ${port}`)
    }

    console.log(`[Tunnel] SSH tunnel verified and ready on port ${port}`)
    return port
  }

  /**
   * Starts an SSH tunnel on a fixed local port (no dynamic port finding).
   * Returns the local port the tunnel is bound to.
   */
  async startFixedPortTunnel(
    tunnelKey: string,
    ip: string,
    keyPath: string,
    localPort: number,
    remotePort: number
  ): Promise<number> {
    // If a tunnel already exists for this key, return its port
    if (this.tunnels.has(tunnelKey)) {
      return this.tunnels.get(tunnelKey)!.port
    }

    // Check if the fixed port is available
    const available = await this.isPortAvailable(localPort)
    if (!available) {
      throw new Error(`Port ${localPort} is already in use`)
    }

    console.log(`[Tunnel] Creating fixed-port tunnel for ${tunnelKey}: localhost:${localPort} -> ${ip}:${remotePort}`)

    // Spawn SSH tunnel process
    const sshProcess = spawn('ssh', [
      '-i', keyPath,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      '-L', `${localPort}:localhost:${remotePort}`,
      '-N',
      `root@${ip}`
    ])

    // Handle process errors
    sshProcess.on('error', (error) => {
      console.error(`[Tunnel] SSH tunnel error for ${tunnelKey}:`, error)
      this.tunnels.delete(tunnelKey)
    })

    // Handle process exit
    sshProcess.on('exit', (code) => {
      console.log(`[Tunnel] SSH tunnel exited for ${tunnelKey} with code ${code}`)
      this.tunnels.delete(tunnelKey)
    })

    // Log stderr for debugging
    sshProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim()
      if (message) {
        if (message.toLowerCase().includes('warning')) {
          console.log(`[Tunnel] SSH stderr for ${tunnelKey}:`, message)
        } else {
          console.error(`[Tunnel] SSH stderr for ${tunnelKey}:`, message)
        }
      }
    })

    // Log stdout
    sshProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim()
      if (message) {
        console.log(`[Tunnel] SSH stdout for ${tunnelKey}:`, message)
      }
    })

    // Store tunnel info
    this.tunnels.set(tunnelKey, {
      process: sshProcess,
      port: localPort,
      remotePort,
      instanceName: tunnelKey,
      ip,
    })

    // Wait for the tunnel to establish and verify it's listening
    console.log(`[Tunnel] Waiting for SSH tunnel to establish...`)
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verify the tunnel port is actually listening
    const isListening = await this.verifyTunnelListening(localPort)
    if (!isListening) {
      sshProcess.kill()
      this.tunnels.delete(tunnelKey)
      throw new Error(`SSH tunnel failed to establish on port ${localPort}`)
    }

    console.log(`[Tunnel] SSH tunnel verified and ready on port ${localPort}`)
    return localPort
  }

  /**
   * Stops the SSH tunnel for the given instance.
   */
  stopTunnel(instanceName: string): void {
    const tunnel = this.tunnels.get(instanceName)
    if (tunnel) {
      tunnel.process.kill('SIGTERM')
      this.tunnels.delete(instanceName)
    }
  }

  /**
   * Checks if a tunnel is active for the given instance.
   */
  isActive(instanceName: string): boolean {
    return this.tunnels.has(instanceName)
  }

  /**
   * Gets the local port for the given instance's tunnel.
   * Returns null if no tunnel exists.
   */
  getPort(instanceName: string): number | null {
    const tunnel = this.tunnels.get(instanceName)
    return tunnel ? tunnel.port : null
  }

  /**
   * Gets all active tunnel keys.
   * Useful for finding tunnels by pattern (e.g., all :proxy tunnels).
   */
  getActiveKeys(): string[] {
    return Array.from(this.tunnels.keys())
  }

  /**
   * Stops all active tunnels.
   * Useful for cleanup on server shutdown.
   */
  stopAll(): void {
    for (const [instanceName] of this.tunnels) {
      this.stopTunnel(instanceName)
    }
  }

  /**
   * Finds an available port starting from basePort.
   * Checks for availability by attempting to bind a temporary server.
   */
  private async findAvailablePort(): Promise<number> {
    let port = this.basePort

    // Check up to 100 ports
    for (let i = 0; i < 100; i++) {
      const testPort = port + i

      // Check if already in use by our tunnels
      const inUse = Array.from(this.tunnels.values()).some(t => t.port === testPort)
      if (inUse) {
        continue
      }

      // Check if available on the system
      const available = await this.isPortAvailable(testPort)
      if (available) {
        return testPort
      }
    }

    throw new Error('No available ports found for SSH tunnel')
  }

  /**
   * Checks if a port is available by attempting to create a temporary server.
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer()

      server.once('error', () => {
        resolve(false)
      })

      server.once('listening', () => {
        server.close()
        resolve(true)
      })

      server.listen(port, '127.0.0.1')
    })
  }

  /**
   * Verifies that the SSH tunnel is listening on the specified port.
   * Returns true if the port is in use (tunnel is listening), false otherwise.
   */
  private async verifyTunnelListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer()

      server.once('error', (err: any) => {
        // Port in use (EADDRINUSE) = tunnel is listening (good!)
        resolve(err.code === 'EADDRINUSE')
      })

      server.once('listening', () => {
        // Port available = tunnel NOT listening (bad!)
        server.close()
        resolve(false)
      })

      server.listen(port, '127.0.0.1')
    })
  }
}

// Singleton instance
const tunnelManager = new TunnelManager()

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    tunnelManager.stopAll()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    tunnelManager.stopAll()
    process.exit(0)
  })
}

export default tunnelManager
