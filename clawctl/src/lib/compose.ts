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
export function generateEnvFile(userInfo: UserInfo, imageName: string, gatewayToken?: string): string {
  let content = `# OpenClaw Docker image
OPENCLAW_IMAGE=${imageName}

# OpenClaw configuration directories
OPENCLAW_CONFIG_DIR=${userInfo.home}/.openclaw
OPENCLAW_WORKSPACE_DIR=${userInfo.home}/.openclaw/workspace

# Gateway settings
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_BIND=lan

# Deployment user info
DEPLOY_USER=${userInfo.username}
DEPLOY_UID=${userInfo.uid}
DEPLOY_GID=${userInfo.gid}
DEPLOY_HOME=${userInfo.home}
`

  if (gatewayToken) {
    content += `\n# Gateway authentication (from onboarding)\nOPENCLAW_GATEWAY_TOKEN=${gatewayToken}\n`
  }

  return content
}

/**
 * Update .env file with gateway token extracted from onboarding
 */
export async function updateEnvToken(
  ssh: SSHClient,
  userInfo: UserInfo,
  token: string
): Promise<void> {
  const envPath = `${userInfo.home}/docker/.env`

  logger.verbose('Updating .env with gateway token...')

  // Read existing .env
  const result = await ssh.exec(`cat ${envPath}`)
  if (result.exitCode !== 0) {
    throw new Error('Failed to read .env file')
  }

  let content = result.stdout

  // Update or append token
  if (content.includes('OPENCLAW_GATEWAY_TOKEN=')) {
    content = content.replace(/OPENCLAW_GATEWAY_TOKEN=.*/, `OPENCLAW_GATEWAY_TOKEN=${token}`)
  } else {
    content += `\n# Gateway authentication (from onboarding)\nOPENCLAW_GATEWAY_TOKEN=${token}\n`
  }

  // Upload and fix ownership
  await ssh.uploadContent(content, envPath)
  await ssh.exec(`chown ${userInfo.username}:${userInfo.username} ${envPath}`)

  logger.verbose('Token updated in .env')
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
