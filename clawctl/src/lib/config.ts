/**
 * Configuration loading and resolution
 * Precedence: CLI flags > env vars > config files > defaults
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import type { ConfigFile, ConfigDefaults, DeploymentConfig, SSHConfig } from './types.js'
import * as logger from './logger.js'

/**
 * Default configuration values
 */
const DEFAULTS: Required<ConfigDefaults> = {
  sshUser: 'root',
  sshPort: 22,
  sshKey: '',
  branch: 'main',
  skipOnboard: false,
  instancesDir: './instances',
  verbose: false,
  autoResume: true,
  autoClean: false,
}

/**
 * Load and merge configuration from all sources
 */
export async function loadConfig(
  flags: any,
  instanceName?: string
): Promise<DeploymentConfig> {
  // Load config files
  const globalConfig = await loadConfigFile(path.join(os.homedir(), '.clawctl', 'config.yml'))
  const projectConfig = await loadConfigFile('./clawctl.yml')

  // Map Commander flags to config defaults
  const flagDefaults: Partial<ConfigDefaults> = {
    sshKey: flags.key,
    sshUser: flags.user,
    sshPort: flags.port ? parseInt(flags.port, 10) : undefined,
    branch: flags.branch,
    skipOnboard: flags.skipOnboard,
    verbose: flags.verbose,
  }

  // Merge configurations (precedence: flags > env > project config > global config > defaults)
  const config = mergeConfigs(
    DEFAULTS,
    globalConfig?.defaults,
    globalConfig?.instances?.[instanceName || ''],
    projectConfig?.defaults,
    projectConfig?.instances?.[instanceName || ''],
    loadEnvConfig(),
    flagDefaults
  )

  // Validate required fields
  if (!flags.ip) {
    throw new Error('IP address is required')
  }

  if (!config.sshKey) {
    throw new Error('SSH key path is required (use --key or set CLAWCTL_SSH_KEY)')
  }

  // Resolve instance name
  const finalInstanceName = instanceName || `instance-${flags.ip!.replace(/\./g, '-')}`

  // Expand paths
  const sshKeyPath = expandPath(config.sshKey)
  const instancesDir = expandPath(config.instancesDir)

  // Build SSH config
  const sshConfig: SSHConfig = {
    host: flags.ip!,
    port: config.sshPort,
    username: config.sshUser,
    privateKeyPath: sshKeyPath,
  }

  // Build final deployment config
  const deploymentConfig: DeploymentConfig = {
    ip: flags.ip!,
    instanceName: finalInstanceName,
    ssh: sshConfig,
    branch: config.branch,
    skipOnboard: config.skipOnboard,
    global: flags.global || false,
    force: flags.force || false,
    clean: flags.clean || false,
    verbose: config.verbose,
    instancesDir,
  }

  // Set verbose mode in logger
  if (deploymentConfig.verbose) {
    logger.setVerbose(true)
  }

  return deploymentConfig
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<ConfigDefaults> {
  const env = process.env
  const config: Partial<ConfigDefaults> = {}

  if (env.CLAWCTL_SSH_KEY) config.sshKey = env.CLAWCTL_SSH_KEY
  if (env.CLAWCTL_SSH_USER) config.sshUser = env.CLAWCTL_SSH_USER
  if (env.CLAWCTL_SSH_PORT) config.sshPort = parseInt(env.CLAWCTL_SSH_PORT, 10)
  if (env.CLAWCTL_DEFAULT_BRANCH) config.branch = env.CLAWCTL_DEFAULT_BRANCH
  if (env.CLAWCTL_SKIP_ONBOARD) config.skipOnboard = parseBoolean(env.CLAWCTL_SKIP_ONBOARD)
  if (env.CLAWCTL_INSTANCES_DIR) config.instancesDir = env.CLAWCTL_INSTANCES_DIR
  if (env.CLAWCTL_VERBOSE) config.verbose = parseBoolean(env.CLAWCTL_VERBOSE)

  return config
}

/**
 * Load configuration file (YAML)
 */
async function loadConfigFile(filePath: string): Promise<ConfigFile | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const config = YAML.parse(content) as ConfigFile
    logger.verbose(`Loaded config: ${filePath}`)
    return config
  } catch (error) {
    // File doesn't exist or can't be read - that's OK
    return null
  }
}

/**
 * Merge multiple config objects with precedence
 * Later arguments override earlier ones
 */
function mergeConfigs(...configs: Array<Partial<ConfigDefaults> | undefined>): Required<ConfigDefaults> {
  const result = { ...DEFAULTS }

  for (const config of configs) {
    if (config) {
      if (config.sshKey !== undefined) result.sshKey = config.sshKey
      if (config.sshUser !== undefined) result.sshUser = config.sshUser
      if (config.sshPort !== undefined) result.sshPort = config.sshPort
      if (config.branch !== undefined) result.branch = config.branch
      if (config.skipOnboard !== undefined) result.skipOnboard = config.skipOnboard
      if (config.instancesDir !== undefined) result.instancesDir = config.instancesDir
      if (config.verbose !== undefined) result.verbose = config.verbose
      if (config.autoResume !== undefined) result.autoResume = config.autoResume
      if (config.autoClean !== undefined) result.autoClean = config.autoClean
    }
  }

  return result
}

/**
 * Parse boolean from string
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false
  const lower = value.toLowerCase()
  return lower === 'true' || lower === '1' || lower === 'yes'
}

/**
 * Expand ~ and relative paths to absolute paths
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  return path.resolve(filePath)
}

/**
 * Validate IP address format
 */
export function validateIP(ip: string): boolean {
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = ip.match(ipRegex)

  if (!match) return false

  // Check each octet is 0-255
  for (let i = 1; i <= 4; i++) {
    const octet = parseInt(match[i], 10)
    if (octet < 0 || octet > 255) return false
  }

  return true
}

/**
 * Validate SSH key file
 */
export async function validateSSHKey(keyPath: string): Promise<void> {
  try {
    const stats = await fs.stat(keyPath)

    // Check if file exists and is readable
    if (!stats.isFile()) {
      throw new Error(`SSH key is not a file: ${keyPath}`)
    }

    // Check permissions (should be 600 or 400)
    const mode = stats.mode & 0o777
    if (mode !== 0o600 && mode !== 0o400) {
      logger.warn(`SSH key has insecure permissions: ${mode.toString(8)}`)
      logger.warn(`Consider running: chmod 600 ${keyPath}`)
    }

    // Try to read the key
    await fs.readFile(keyPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`SSH key not found: ${keyPath}`)
    }
    if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(`SSH key not readable: ${keyPath}`)
    }
    throw error
  }
}
