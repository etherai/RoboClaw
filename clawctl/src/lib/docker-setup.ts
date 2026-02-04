/**
 * Docker installation and setup on remote server
 */

import type { SSHClient } from './ssh-client.js'
import type { DockerInfo } from './types.js'
import * as logger from './logger.js'

/**
 * Install base packages required for Docker installation
 */
export async function installBasePackages(ssh: SSHClient): Promise<void> {
  // Check if packages already installed
  const checkResult = await ssh.exec('command -v curl && command -v wget && command -v git')

  if (checkResult.exitCode === 0) {
    logger.success('Base packages already installed')
    return
  }

  logger.info('Installing base packages...')

  // Install packages
  const installCmd = `
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release
  `

  const result = await ssh.execStream(installCmd.trim())

  if (result !== 0) {
    throw new Error('Failed to install base packages')
  }

  logger.success('Base packages installed')
}

/**
 * Install Docker CE and Docker Compose v2
 */
export async function installDocker(ssh: SSHClient): Promise<DockerInfo> {
  // Check if Docker is already installed
  const checkResult = await ssh.exec('docker --version && docker compose version')

  if (checkResult.exitCode === 0) {
    const version = parseDockerVersion(checkResult.stdout)
    logger.success(`Docker already installed: ${version.version}`)
    logger.success(`Docker Compose: ${version.composeVersion}`)
    return version
  }

  logger.info('Installing Docker CE...')

  // Install Docker using official installation script
  const installCmd = `
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
      gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] \\
      https://download.docker.com/linux/ubuntu \\
      $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

    # Install Docker
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker service
    systemctl start docker
    systemctl enable docker
  `

  const result = await ssh.execStream(installCmd.trim())

  if (result !== 0) {
    throw new Error('Failed to install Docker')
  }

  // Verify installation
  const verifyResult = await ssh.exec('docker --version && docker compose version')

  if (verifyResult.exitCode !== 0) {
    throw new Error('Docker installation verification failed')
  }

  const version = parseDockerVersion(verifyResult.stdout)
  logger.success(`Docker installed: ${version.version}`)
  logger.success(`Docker Compose: ${version.composeVersion}`)

  return version
}

/**
 * Parse Docker version from command output
 */
function parseDockerVersion(output: string): DockerInfo {
  const dockerMatch = output.match(/Docker version ([0-9.]+)/)
  const composeMatch = output.match(/Docker Compose version v([0-9.]+)/)

  return {
    version: dockerMatch ? dockerMatch[1] : 'unknown',
    composeVersion: composeMatch ? composeMatch[1] : 'unknown',
  }
}

/**
 * Verify Docker is running and accessible
 */
export async function verifyDocker(ssh: SSHClient): Promise<boolean> {
  const result = await ssh.exec('docker ps')
  return result.exitCode === 0
}

/**
 * Check if Docker Compose v2 is available
 */
export async function verifyDockerCompose(ssh: SSHClient): Promise<boolean> {
  const result = await ssh.exec('docker compose version')
  return result.exitCode === 0
}
