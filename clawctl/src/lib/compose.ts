/**
 * Docker Compose file generation and upload
 */

import type { SSHClient } from './ssh-client.js'
import type { UserInfo } from './types.js'
import { generateDockerCompose } from '../templates/docker-compose.js'
import * as logger from './logger.js'

/**
 * Generate .env file with actual values
 * These values are substituted by Docker Compose at runtime
 */
export function generateEnvFile(userInfo: UserInfo, imageName: string): string {
  // Generate a gateway token
  const gatewayToken = generateRandomToken()

  return `# OpenClaw Docker image
OPENCLAW_IMAGE=${imageName}

# OpenClaw configuration directories
OPENCLAW_CONFIG_DIR=${userInfo.home}/.openclaw
OPENCLAW_WORKSPACE_DIR=${userInfo.home}/.openclaw/workspace

# Gateway settings
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_BIND=loopback
OPENCLAW_GATEWAY_TOKEN=${gatewayToken}

# Deployment user info
DEPLOY_USER=${userInfo.username}
DEPLOY_UID=${userInfo.uid}
DEPLOY_GID=${userInfo.gid}
DEPLOY_HOME=${userInfo.home}
`
}

/**
 * Generate a random hex token for gateway authentication
 */
function generateRandomToken(): string {
  const chars = '0123456789abcdef'
  let token = ''
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

/**
 * Upload docker-compose.yml and .env to server
 */
export async function uploadComposeFiles(
  ssh: SSHClient,
  userInfo: UserInfo,
  imageName: string
): Promise<void> {
  const { username, home } = userInfo
  const composeDir = `${home}/docker`

  logger.info('Generating Docker Compose files...')

  // Generate files
  const composeContent = generateDockerCompose()
  const envContent = generateEnvFile(userInfo, imageName)

  logger.verbose('docker-compose.yml generated with variable placeholders')
  logger.verbose(`.env generated with actual values (UID: ${userInfo.uid}, GID: ${userInfo.gid})`)

  // Upload docker-compose.yml
  const composePath = `${composeDir}/docker-compose.yml`
  await ssh.uploadContent(composeContent, composePath)
  logger.success('Uploaded docker-compose.yml')

  // Upload .env
  const envPath = `${composeDir}/.env`
  await ssh.uploadContent(envContent, envPath)
  logger.success('Uploaded .env')

  // Set ownership
  const chownResult = await ssh.exec(
    `chown ${username}:${username} ${composePath} ${envPath}`
  )

  if (chownResult.exitCode !== 0) {
    throw new Error('Failed to set file ownership')
  }

  logger.indent(`Ownership: ${username}:${username}`)
}

/**
 * Test docker-compose.yml syntax
 */
export async function validateCompose(ssh: SSHClient, composeDir: string): Promise<boolean> {
  const result = await ssh.exec(`cd ${composeDir} && docker compose config > /dev/null`)
  return result.exitCode === 0
}

/**
 * Get expanded docker-compose config (for debugging)
 */
export async function getExpandedConfig(ssh: SSHClient, composeDir: string): Promise<string> {
  const result = await ssh.exec(`cd ${composeDir} && docker compose config`)

  if (result.exitCode !== 0) {
    throw new Error('Failed to get docker-compose config')
  }

  return result.stdout
}
