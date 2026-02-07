/**
 * Docker image building from OpenClaw repository
 */

import type { SSHClient } from './ssh-client.js'
import type { UserInfo } from './types.js'
import * as logger from './logger.js'

/**
 * Build OpenClaw Docker image from GitHub
 */
export async function buildImage(
  ssh: SSHClient,
  userInfo: UserInfo,
  branch: string = 'main'
): Promise<string> {
  const { username, uid, gid, home } = userInfo
  const imageName = 'roboclaw/openclaw:local'
  const repoPath = `${home}/openclaw-src`

  // Check if image already exists and is usable
  const imageExists = await checkImageExists(ssh, imageName)

  if (imageExists) {
    logger.success(`Image already built: ${imageName}`)

    // Verify image is usable
    const isUsable = await verifyImage(ssh, imageName, uid, gid)

    if (isUsable) {
      logger.success('Image verified')
      return imageName
    } else {
      logger.warn('Image exists but corrupted, rebuilding...')
      await ssh.exec(`docker rmi ${imageName}`)
    }
  }

  logger.info('Building OpenClaw image...')

  // Check if repository exists
  const repoExists = await checkRepoExists(ssh, repoPath)

  if (repoExists) {
    logger.info('Repository already cloned, updating...')

    const updateCmd = `
      cd ${repoPath}
      sudo -u ${username} git fetch origin
      sudo -u ${username} git checkout ${branch}
      sudo -u ${username} git pull
    `

    await ssh.execStream(updateCmd.trim())
  } else {
    logger.info(`Cloning https://github.com/openclaw/openclaw.git (branch: ${branch})`)

    const cloneCmd = `
      sudo -u ${username} git clone https://github.com/openclaw/openclaw.git ${repoPath}
      cd ${repoPath}
      sudo -u ${username} git checkout ${branch}
    `

    await ssh.execStream(cloneCmd.trim())
  }

  // Build image
  logger.info('Building Docker image (this may take several minutes)...')

  const buildCmd = `
    cd ${repoPath}
    docker build -t ${imageName} .
  `

  const buildResult = await ssh.execStream(buildCmd.trim())

  if (buildResult !== 0) {
    throw new Error('Docker image build failed')
  }

  // Verify image was built
  if (!(await checkImageExists(ssh, imageName))) {
    throw new Error('Image build completed but image not found')
  }

  // Verify image runs correctly as non-root user
  const isUsable = await verifyImage(ssh, imageName, uid, gid)

  if (!isUsable) {
    throw new Error('Built image failed verification')
  }

  logger.success(`Image built: ${imageName}`)
  logger.success(`Container verified: runs as UID ${uid} (non-root)`)

  return imageName
}

/**
 * Check if Docker image exists
 */
async function checkImageExists(ssh: SSHClient, imageName: string): Promise<boolean> {
  const result = await ssh.exec(`docker images -q ${imageName}`)
  return result.exitCode === 0 && result.stdout.trim().length > 0
}

/**
 * Check if git repository exists
 */
async function checkRepoExists(ssh: SSHClient, repoPath: string): Promise<boolean> {
  const result = await ssh.exec(`test -d ${repoPath}/.git`)
  return result.exitCode === 0
}

/**
 * Verify image can run as the specified user
 */
async function verifyImage(ssh: SSHClient, imageName: string, uid: number, gid: number): Promise<boolean> {
  const result = await ssh.exec(
    `docker run --rm --user ${uid}:${gid} ${imageName} id -u`
  )

  if (result.exitCode !== 0) {
    return false
  }

  const containerUid = parseInt(result.stdout.trim(), 10)
  return containerUid === uid
}

/**
 * Get image ID
 */
export async function getImageId(ssh: SSHClient, imageName: string): Promise<string | null> {
  const result = await ssh.exec(`docker images -q ${imageName}`)

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return null
  }

  return result.stdout.trim()
}
