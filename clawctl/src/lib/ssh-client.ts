/**
 * SSH client for remote command execution and file uploads
 */

import fs from 'fs/promises'
import { Client, ClientChannel } from 'ssh2'
import type { SSHConfig, ExecResult } from './types.js'
import * as logger from './logger.js'

export class SSHClient {
  private client: Client
  private config: SSHConfig
  private connected: boolean = false

  constructor(config: SSHConfig) {
    this.config = config
    this.client = new Client()
  }

  /**
   * Connect to SSH server with retry logic
   */
  async connect(maxRetries: number = 3): Promise<void> {
    if (this.connected) {
      return
    }

    // Load private key
    if (!this.config.privateKey) {
      this.config.privateKey = await fs.readFile(this.config.privateKeyPath)
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.verbose(`SSH connection attempt ${attempt}/${maxRetries}...`)

        await new Promise<void>((resolve, reject) => {
          this.client
            .on('ready', () => {
              this.connected = true
              resolve()
            })
            .on('error', (err) => {
              reject(err)
            })
            .connect({
              host: this.config.host,
              port: this.config.port,
              username: this.config.username,
              privateKey: this.config.privateKey,
              readyTimeout: 30000,
              algorithms: {
                kex: [
                  'curve25519-sha256',
                  'curve25519-sha256@libssh.org',
                  'ecdh-sha2-nistp256',
                  'ecdh-sha2-nistp384',
                  'ecdh-sha2-nistp521',
                  'diffie-hellman-group14-sha256',
                  'diffie-hellman-group16-sha512',
                  'diffie-hellman-group18-sha512',
                ],
              },
            })
        })

        logger.verbose(`Connected to ${this.config.host}`)
        return
      } catch (error) {
        logger.verbose(`Connection attempt ${attempt} failed: ${(error as Error).message}`)

        if (attempt === maxRetries) {
          throw new Error(
            `SSH connection failed after ${maxRetries} attempts: ${(error as Error).message}`
          )
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Execute a command and return result
   */
  async exec(command: string): Promise<ExecResult> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server')
    }

    logger.command(command)

    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''
        let exitCode = 0

        stream
          .on('data', (data: Buffer) => {
            stdout += data.toString()
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString()
          })

        stream.on('close', (code: number) => {
          exitCode = code || 0
          resolve({ exitCode, stdout, stderr })
        })

        stream.on('error', (err: Error) => {
          reject(err)
        })
      })
    })
  }

  /**
   * Execute a command and stream output to console
   */
  async execStream(command: string, onOutput?: (data: string) => void): Promise<number> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server')
    }

    logger.command(command)

    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let exitCode = 0

        stream.on('data', (data: Buffer) => {
          const text = data.toString()
          if (onOutput) {
            onOutput(text)
          } else {
            process.stdout.write(text)
          }
        })

        stream.stderr.on('data', (data: Buffer) => {
          const text = data.toString()
          if (onOutput) {
            onOutput(text)
          } else {
            process.stderr.write(text)
          }
        })

        stream.on('close', (code: number) => {
          exitCode = code || 0
          resolve(exitCode)
        })

        stream.on('error', (err: Error) => {
          reject(err)
        })
      })
    })
  }

  /**
   * Upload a file via SFTP
   */
  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server')
    }

    logger.verbose(`Uploading ${localPath} -> ${remotePath}`)

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          sftp.end()
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    })
  }

  /**
   * Upload string content as a file via SFTP
   */
  async uploadContent(content: string, remotePath: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server')
    }

    logger.verbose(`Uploading content -> ${remotePath}`)

    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }

        const writeStream = sftp.createWriteStream(remotePath)

        writeStream.on('close', () => {
          sftp.end()
          resolve()
        })

        writeStream.on('error', (err: Error) => {
          sftp.end()
          reject(err)
        })

        writeStream.write(content)
        writeStream.end()
      })
    })
  }

  /**
   * Execute an interactive command with PTY (for onboarding)
   */
  async execInteractive(command: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to SSH server')
    }

    logger.verbose(`Running interactive command: ${command}`)

    return new Promise((resolve, reject) => {
      this.client.exec(command, { pty: true }, (err, stream: ClientChannel) => {
        if (err) {
          reject(err)
          return
        }

        // Set local terminal to raw mode
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true)
        }

        // Pipe stdin/stdout
        process.stdin.pipe(stream)
        stream.pipe(process.stdout)

        // Handle resize events
        const handleResize = () => {
          if (process.stdout.isTTY) {
            const { rows, columns } = process.stdout
            stream.setWindow(rows, columns, 0, 0)
          }
        }

        process.stdout.on('resize', handleResize)

        stream.on('close', () => {
          // Restore terminal
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false)
          }
          process.stdin.unpipe(stream)
          stream.unpipe(process.stdout)
          process.stdout.removeListener('resize', handleResize)

          resolve()
        })

        stream.on('error', (err: Error) => {
          // Restore terminal on error
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false)
          }
          reject(err)
        })
      })
    })
  }

  /**
   * Disconnect from SSH server
   */
  disconnect(): void {
    if (this.connected) {
      this.client.end()
      this.connected = false
      logger.verbose('SSH connection closed')
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Helper function to verify SSH user is root
 */
export async function verifyRootAccess(ssh: SSHClient): Promise<boolean> {
  const result = await ssh.exec('id -u')
  return result.exitCode === 0 && result.stdout.trim() === '0'
}
