/**
 * System user creation and configuration for deployment
 */

import type { SSHClient } from './ssh-client.js'
import type { UserInfo } from './types.js'
import * as logger from './logger.js'

/**
 * Create the roboclaw system user for running containers
 */
export async function createDeploymentUser(ssh: SSHClient): Promise<UserInfo> {
  const username = 'roboclaw'

  // Check if user already exists
  const checkResult = await ssh.exec(`id ${username}`)

  if (checkResult.exitCode === 0) {
    // User exists, get info
    const userInfo = await getUserInfo(ssh, username)
    logger.success(`User '${username}' already exists (UID: ${userInfo.uid}, GID: ${userInfo.gid})`)

    // Ensure user is in docker group
    if (!userInfo.inDockerGroup) {
      logger.info(`Adding '${username}' to docker group...`)
      await ssh.exec(`usermod -aG docker ${username}`)
      userInfo.inDockerGroup = true
      logger.success(`Added '${username}' to docker group`)
    }

    return userInfo
  }

  // Create user
  logger.info(`Creating user '${username}'...`)

  // Try to create with UID 1000, or let system assign next available
  const createCmd = `useradd -r -m -s /bin/bash -u 1000 ${username} 2>/dev/null || useradd -r -m -s /bin/bash ${username}`

  const createResult = await ssh.exec(createCmd)

  if (createResult.exitCode !== 0) {
    throw new Error(`Failed to create user '${username}'`)
  }

  // Get user info
  const userInfo = await getUserInfo(ssh, username)

  // Add to docker group
  logger.info(`Adding '${username}' to docker group...`)
  await ssh.exec(`usermod -aG docker ${username}`)
  userInfo.inDockerGroup = true

  logger.success(`Created user '${username}' (UID: ${userInfo.uid}, GID: ${userInfo.gid})`)
  logger.success(`Added to docker group`)
  logger.indent(`Home directory: ${userInfo.home}`)
  logger.indent(`Container will run as: ${userInfo.uid}:${userInfo.gid}`)

  return userInfo
}

/**
 * Get information about a user
 */
export async function getUserInfo(ssh: SSHClient, username: string): Promise<UserInfo> {
  const result = await ssh.exec(`id ${username} && eval echo ~${username} && groups ${username}`)

  if (result.exitCode !== 0) {
    throw new Error(`User '${username}' does not exist`)
  }

  // Parse output
  const uidMatch = result.stdout.match(/uid=(\d+)/)
  const gidMatch = result.stdout.match(/gid=(\d+)/)
  const homeMatch = result.stdout.match(/\/home\/\w+/)
  const dockerGroupMatch = result.stdout.includes('docker')

  if (!uidMatch || !gidMatch || !homeMatch) {
    throw new Error(`Failed to parse user info for '${username}'`)
  }

  return {
    username,
    uid: parseInt(uidMatch[1], 10),
    gid: parseInt(gidMatch[1], 10),
    home: homeMatch[0],
    inDockerGroup: dockerGroupMatch,
  }
}

/**
 * Create directory structure for deployment
 */
export async function createDirectories(ssh: SSHClient, userInfo: UserInfo): Promise<void> {
  const { username, home } = userInfo

  logger.info('Creating directories...')

  const createDirsCmd = `
    mkdir -p ${home}/.openclaw
    mkdir -p ${home}/.roboclaw/sessions
    mkdir -p ${home}/.roboclaw/credentials
    mkdir -p ${home}/.roboclaw/data
    mkdir -p ${home}/.roboclaw/logs
    mkdir -p ${home}/docker
    mkdir -p ${home}/openclaw-src

    # Set ownership
    chown -R ${username}:${username} \\
      ${home}/.openclaw \\
      ${home}/.roboclaw \\
      ${home}/docker \\
      ${home}/openclaw-src

    # Secure credentials directory
    chmod 700 ${home}/.roboclaw/credentials
  `

  const result = await ssh.exec(createDirsCmd.trim())

  if (result.exitCode !== 0) {
    throw new Error('Failed to create directories')
  }

  logger.success(`${home}/.openclaw`)
  logger.success(`${home}/.roboclaw`)
  logger.success(`${home}/docker`)
  logger.success(`${home}/openclaw-src`)
  logger.indent(`Ownership: ${username}:${username}`)
}

/**
 * Verify user has access to docker (by checking group membership)
 */
export async function verifyDockerAccess(ssh: SSHClient, username: string): Promise<boolean> {
  const result = await ssh.exec(`groups ${username}`)

  if (result.exitCode !== 0) {
    return false
  }

  return result.stdout.includes('docker')
}
