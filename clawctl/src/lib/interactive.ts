/**
 * Interactive PTY sessions for onboarding and other interactive commands
 */

import type { SSHClient } from './ssh-client.js'
import type { UserInfo } from './types.js'
import * as logger from './logger.js'

/**
 * Run the onboarding wizard interactively
 */
export async function runOnboarding(
  ssh: SSHClient,
  userInfo: UserInfo,
  skipOnboard: boolean = false
): Promise<void> {
  const { username, home } = userInfo
  const composeDir = `${home}/docker`

  // Check if onboarding already completed
  const configExists = await checkOnboardingComplete(ssh, home)

  if (configExists) {
    logger.success('Onboarding already completed')
    return
  }

  if (skipOnboard) {
    logger.warn('Skipping onboarding wizard (--skip-onboard flag)')
    logger.blank()
    logger.warn('Gateway requires onboarding to be completed first')
    logger.blank()
    logger.info('To complete setup:')
    logger.indent(`1. SSH to server: ssh root@<IP>`, 1)
    logger.indent(`2. Switch to ${username}: sudo -u ${username} -i`, 1)
    logger.indent(`3. Run onboarding: cd ~/docker && docker compose run --rm -it openclaw-cli onboard`, 1)
    logger.indent(`4. Start gateway: docker compose up -d openclaw-gateway`, 1)
    logger.blank()
    return
  }

  logger.info('Launching onboarding wizard...')
  logger.blank()

  // OpenClaw CLI uses entrypoint ["node", "dist/index.js"], so we just pass the command
  // Use --no-install-daemon flag for containerized deployment
  const onboardCmd = `cd ${composeDir} && sudo -u ${username} docker compose run --rm -it openclaw-cli onboard --no-install-daemon`

  try {
    await ssh.execInteractive(onboardCmd)
  } catch (error) {
    // PTY session may close with non-zero exit (e.g., user Ctrl+D)
    // Check if onboarding actually succeeded before failing
    logger.blank()
  }

  // Always verify onboarding completion by checking for config file
  const onboardingComplete = await checkOnboardingComplete(ssh, home)

  if (!onboardingComplete) {
    logger.error('Onboarding did not create config file')
    throw new Error('Onboarding failed - config file not found')
  }

  logger.success('Onboarding completed')
}

/**
 * Extract gateway token from OpenClaw config file
 */
export async function extractGatewayToken(
  ssh: SSHClient,
  userInfo: UserInfo
): Promise<string | null> {
  const configPath = `${userInfo.home}/.openclaw/openclaw.json`

  logger.info('Extracting gateway token from config...')

  const result = await ssh.exec(`cat ${configPath}`)
  if (result.exitCode !== 0) {
    logger.warn('Config file not found')
    return null
  }

  try {
    const config = JSON.parse(result.stdout)
    const token = config?.gateway?.auth?.token

    if (token && typeof token === 'string') {
      logger.verbose(`Token extracted: ${token.substring(0, 8)}...`)
      return token
    }

    logger.warn('Token not found in config')
    return null
  } catch (e) {
    logger.error(`Failed to parse config: ${(e as Error).message}`)
    return null
  }
}

/**
 * Start the gateway daemon
 */
export async function startGateway(ssh: SSHClient, userInfo: UserInfo): Promise<void> {
  const { username, home } = userInfo
  const composeDir = `${home}/docker`

  logger.info('Starting OpenClaw gateway...')

  // Always use --force-recreate to ensure container uses latest docker-compose.yml
  // This will stop and recreate the container even if already running
  const startCmd = `cd ${composeDir} && sudo -u ${username} docker compose up -d --force-recreate openclaw-gateway`
  const result = await ssh.execStream(startCmd)

  if (result !== 0) {
    throw new Error('Failed to start gateway')
  }

  // Wait for gateway to start listening (check logs, not auth health check)
  // Auth health check requires config file which won't exist until after onboarding
  logger.info('Waiting for gateway to start listening...')

  const maxWaitTime = 30 // seconds
  const checkInterval = 2 // seconds
  let waited = 0

  while (waited < maxWaitTime) {
    await sleep(checkInterval * 1000)
    waited += checkInterval

    // Check if gateway logs show it's listening
    const logsResult = await ssh.exec(
      `cd ${composeDir} && sudo -u ${username} docker compose logs --tail 20 openclaw-gateway 2>/dev/null | grep -q "listening on"`
    )

    if (logsResult.exitCode === 0) {
      logger.success('Gateway container started')
      logger.success('Gateway listening on http://localhost:18789')
      logger.dim('  (authenticated health check will run after onboarding)')
      return
    }

    logger.verbose(`Waiting for gateway to start... (${waited}s / ${maxWaitTime}s)`)
  }

  logger.error('Gateway startup timeout')
  throw new Error('Gateway failed to start within 30 seconds')
}

/**
 * Check if onboarding is complete
 */
async function checkOnboardingComplete(ssh: SSHClient, home: string): Promise<boolean> {
  const result = await ssh.exec(`test -f ${home}/.openclaw/openclaw.json`)
  return result.exitCode === 0
}

/**
 * Check if gateway is healthy
 */
async function checkGatewayHealth(ssh: SSHClient, composeDir: string, username: string): Promise<boolean> {
  const result = await ssh.exec(
    `cd ${composeDir} && sudo -u ${username} docker compose exec -T openclaw-gateway node dist/index.js gateway health 2>/dev/null`
  )

  return result.exitCode === 0
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Stop the gateway daemon
 */
export async function stopGateway(ssh: SSHClient, userInfo: UserInfo): Promise<void> {
  const { username, home } = userInfo
  const composeDir = `${home}/docker`

  const stopCmd = `cd ${composeDir} && sudo -u ${username} docker compose stop openclaw-gateway`
  const result = await ssh.exec(stopCmd)

  if (result.exitCode !== 0) {
    throw new Error('Failed to stop gateway')
  }

  logger.success('Gateway stopped')
}

/**
 * Restart the gateway daemon
 */
export async function restartGateway(ssh: SSHClient, userInfo: UserInfo): Promise<void> {
  const { username, home } = userInfo
  const composeDir = `${home}/docker`

  logger.info('Restarting gateway...')

  const restartCmd = `cd ${composeDir} && sudo -u ${username} docker compose restart openclaw-gateway`
  const result = await ssh.exec(restartCmd)

  if (result.exitCode !== 0) {
    throw new Error('Failed to restart gateway')
  }

  // Wait for health check
  await sleep(5000)

  const isHealthy = await checkGatewayHealth(ssh, composeDir, username)

  if (isHealthy) {
    logger.success('Gateway restarted')
    logger.success('Health check passed')
  } else {
    logger.warn('Gateway restarted but health check failed')
  }
}
