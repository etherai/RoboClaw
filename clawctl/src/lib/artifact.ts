/**
 * Instance artifact management
 * Creates and reads instance metadata files in YAML format
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import type { InstanceArtifact, DeploymentConfig, UserInfo } from './types.js'
import * as logger from './logger.js'

/**
 * Get the version of clawctl
 */
function getVersion(): string {
  return '1.0.0'
}

/**
 * Create an instance artifact file
 */
export async function createInstanceArtifact(
  config: DeploymentConfig,
  userInfo: UserInfo,
  imageName: string
): Promise<string> {
  const artifact: InstanceArtifact = {
    name: config.instanceName,
    ip: config.ip,
    deployedAt: new Date().toISOString(),
    deploymentMethod: 'clawctl',
    version: getVersion(),

    ssh: {
      keyFile: config.ssh.privateKeyPath,
      user: config.ssh.username,
      port: config.ssh.port,
    },

    docker: {
      image: imageName,
      composeFile: `${userInfo.home}/docker/docker-compose.yml`,
      branch: config.branch,
    },

    deployment: {
      user: userInfo.username,
      uid: userInfo.uid,
      gid: userInfo.gid,
      home: userInfo.home,
    },

    status: {
      onboardingCompleted: !config.skipOnboard,
    },
  }

  // Determine artifact path
  const artifactPath = getArtifactPath(config.instanceName, config.global, config.instancesDir)

  // Ensure directory exists
  await ensureDirectoryExists(path.dirname(artifactPath))

  // Write YAML file
  const yamlContent = YAML.stringify(artifact)
  await fs.writeFile(artifactPath, yamlContent, 'utf-8')

  logger.success(`Saved to ${artifactPath}`)

  return artifactPath
}

/**
 * Read an instance artifact
 */
export async function readInstanceArtifact(instanceName: string): Promise<InstanceArtifact> {
  // Try local instances first, then global
  const localPath = path.join('./instances', `${instanceName}.yml`)
  const globalPath = path.join(os.homedir(), '.clawctl', 'instances', `${instanceName}.yml`)

  let artifactPath: string

  try {
    await fs.access(localPath)
    artifactPath = localPath
  } catch {
    try {
      await fs.access(globalPath)
      artifactPath = globalPath
    } catch {
      throw new Error(`Instance '${instanceName}' not found`)
    }
  }

  // Read and parse YAML
  const content = await fs.readFile(artifactPath, 'utf-8')
  const artifact = YAML.parse(content) as InstanceArtifact

  return artifact
}

/**
 * List all instances
 */
export async function listInstances(): Promise<string[]> {
  const instances: string[] = []

  // Check local instances
  try {
    const localDir = './instances'
    const files = await fs.readdir(localDir)

    for (const file of files) {
      if (file.endsWith('.yml')) {
        instances.push(file.replace('.yml', ''))
      }
    }
  } catch {
    // Directory doesn't exist, that's OK
  }

  // Check global instances
  try {
    const globalDir = path.join(os.homedir(), '.clawctl', 'instances')
    const files = await fs.readdir(globalDir)

    for (const file of files) {
      if (file.endsWith('.yml')) {
        const name = file.replace('.yml', '')
        if (!instances.includes(name)) {
          instances.push(name)
        }
      }
    }
  } catch {
    // Directory doesn't exist, that's OK
  }

  return instances.sort()
}

/**
 * Delete an instance artifact
 */
export async function deleteInstanceArtifact(instanceName: string): Promise<void> {
  // Try both local and global
  const localPath = path.join('./instances', `${instanceName}.yml`)
  const globalPath = path.join(os.homedir(), '.clawctl', 'instances', `${instanceName}.yml`)

  let deleted = false

  try {
    await fs.unlink(localPath)
    logger.verbose(`Deleted local artifact: ${localPath}`)
    deleted = true
  } catch {
    // File doesn't exist locally
  }

  try {
    await fs.unlink(globalPath)
    logger.verbose(`Deleted global artifact: ${globalPath}`)
    deleted = true
  } catch {
    // File doesn't exist globally
  }

  if (!deleted) {
    throw new Error(`Instance '${instanceName}' not found`)
  }
}

/**
 * Get artifact file path
 */
function getArtifactPath(instanceName: string, global: boolean, instancesDir: string): string {
  if (global) {
    return path.join(os.homedir(), '.clawctl', 'instances', `${instanceName}.yml`)
  } else {
    return path.join(instancesDir, `${instanceName}.yml`)
  }
}

/**
 * Ensure directory exists
 */
async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}
