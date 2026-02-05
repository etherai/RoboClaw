/**
 * Deploy command - orchestrates the full deployment process
 */

import type { UserInfo, DeploymentConfig as Config } from '../lib/types.js'
import { SSHClient, verifyRootAccess } from '../lib/ssh-client.js'
import * as logger from '../lib/logger.js'
import * as state from '../lib/state.js'
import * as dockerSetup from '../lib/docker-setup.js'
import * as userSetup from '../lib/user-setup.js'
import * as imageBuilder from '../lib/image-builder.js'
import * as compose from '../lib/compose.js'
import * as interactive from '../lib/interactive.js'
import * as artifact from '../lib/artifact.js'
import * as autoConnect from '../lib/auto-connect.js'
import { loadConfig, validateIP, validateSSHKey } from '../lib/config.js'
import fs from 'fs/promises'

/**
 * Main deployment command
 */
export async function deployCommand(flags: any): Promise<void> {
  let config: Config | undefined
  let ssh: SSHClient | undefined

  try {
    // ====================================================================
    // Phase 0: Validation & Configuration
    // ====================================================================
    logger.header('Preparing to deploy OpenClaw')

    // Validate IP address
    if (!validateIP(flags.ip)) {
      logger.errorBlock(
        'Invalid IP address format',
        { 'Provided': flags.ip },
        ['IP address must be in format: X.X.X.X'],
        ['Example: 192.168.1.100']
      )
      process.exit(1)
    }

    // Load and merge configuration
    config = await loadConfig(flags, flags.name)

    // Validate SSH key
    try {
      await validateSSHKey(config.ssh.privateKeyPath)
    } catch (error) {
      logger.errorBlock(
        'SSH key validation failed',
        { 'Key path': config.ssh.privateKeyPath },
        [(error as Error).message],
        [`Check that the file exists and is readable`]
      )
      process.exit(1)
    }

    // Load SSH key
    config.ssh.privateKey = await fs.readFile(config.ssh.privateKeyPath)

    // Display deployment config
    logger.log(`  Target: ${config.ip}`)
    logger.log(`  Instance: ${config.instanceName}`)
    logger.log(`  SSH User: ${config.ssh.username}`)
    logger.log(`  SSH Key: ${config.ssh.privateKeyPath}`)
    logger.log(`  Branch: ${config.branch}`)
    logger.blank()

    if (config.ssh.username !== 'root') {
      logger.warn('Note: This tool requires root SSH access to install Docker')
      logger.blank()
    }

    // ====================================================================
    // Phase 1: SSH Connection
    // ====================================================================
    logger.phase(1, 'SSH Connection')

    // Create SSH client with config
    ssh = new SSHClient(config.ssh)

    logger.info('Connecting to server...')
    await ssh.connect()

    logger.success(`Connected to ${config.ip} as ${config.ssh.username}`)

    // Verify root access
    const isRoot = await verifyRootAccess(ssh)

    if (!isRoot) {
      logger.errorBlock(
        'Insufficient privileges',
        {
          'Connected as': config.ssh.username,
          'Required': 'root',
        },
        [
          'This tool requires root SSH access to:',
          '  - Install Docker and system packages',
          '  - Manage system users and groups',
          '  - Configure system services',
        ],
        [
          'Connect as root: --user root',
          'Enable root SSH access on target server',
        ]
      )
      process.exit(2)
    }

    logger.success('Root access verified')

    // ====================================================================
    // Clean Deployment (if requested)
    // ====================================================================
    if (config.clean) {
      logger.blank()
      logger.warn('⚠️  Clean deployment requested')
      logger.blank()
      logger.log('This will remove:')
      logger.log('  - All Docker containers and images')
      logger.log('  - roboclaw user and all files')
      logger.log('  - Deployment state')
      logger.blank()

      // TODO: Add confirmation prompt in future
      // For now, proceed automatically if --clean is specified

      logger.info('Cleaning previous deployment...')

      // Stop and remove all containers
      await ssh.exec('docker ps -aq | xargs -r docker stop 2>/dev/null || true')
      await ssh.exec('docker ps -aq | xargs -r docker rm 2>/dev/null || true')
      logger.verbose('Stopped and removed all containers')

      // Remove OpenClaw images
      await ssh.exec('docker images -q "roboclaw/openclaw:local" "openclaw:local" | xargs -r docker rmi 2>/dev/null || true')
      logger.verbose('Removed OpenClaw Docker images')

      // Remove roboclaw user and home directory
      await ssh.exec('userdel -r roboclaw 2>/dev/null || true')
      logger.verbose('Removed roboclaw user and home directory')

      // Remove any remaining directories
      await ssh.exec('rm -rf /root/docker /root/openclaw-build 2>/dev/null || true')
      logger.verbose('Removed remaining directories')

      // Delete state file
      await ssh.exec('rm -f /root/.clawctl-deploy-state.json /home/roboclaw/.clawctl-deploy-state.json 2>/dev/null || true')
      logger.verbose('Deleted deployment state files')

      logger.success('Cleanup complete')
      logger.blank()
    }

    // Check for partial deployment
    let existingState = await state.detectPartialDeployment(ssh)

    if (existingState && config.force) {
      logger.blank()
      logger.warn('Forcing fresh deployment (--force flag)')
      logger.info('Deleting existing deployment state...')
      await state.deleteState(ssh)
      existingState = null
      logger.blank()
    } else if (existingState) {
      logger.blank()
      logger.warn('Detected partial deployment on server')
      logger.blank()
      logger.log(`  Instance: ${existingState.instanceName}`)
      logger.log(`  Started: ${state.formatStateAge(existingState)}`)
      logger.log(`  Last phase: ${existingState.lastPhase}`)
      logger.blank()

      const progress = state.getProgressSummary(existingState)
      logger.log(`  Progress: ${progress.complete}/${progress.total} phases complete`)
      logger.blank()

      if (state.isStateStale(existingState)) {
        logger.warn('Warning: Deployment is over 24 hours old')
      }

      logger.info('Resuming from last checkpoint...')
      logger.blank()

      // Resume deployment will skip completed phases
    }

    // ====================================================================
    // Phase 2: Install Base Packages
    // ====================================================================
    if (!existingState || !state.isPhaseComplete(existingState, 2)) {
      logger.phase(2, 'Install Base Packages')
      await dockerSetup.installBasePackages(ssh)

      if (existingState) {
        await state.updateState(ssh, 2, 'complete')
      }
    } else {
      logger.phase(2, 'Install Base Packages')
      logger.dim('  (skip - already complete)')
    }

    // ====================================================================
    // Phase 3: Install Docker
    // ====================================================================
    if (!existingState || !state.isPhaseComplete(existingState, 3)) {
      logger.phase(3, 'Install Docker')
      await dockerSetup.installDocker(ssh)

      if (existingState) {
        await state.updateState(ssh, 3, 'complete')
      }
    } else {
      logger.phase(3, 'Install Docker')
      logger.dim('  (skip - already complete)')
    }

    // ====================================================================
    // Phase 4: Setup Deployment User
    // ====================================================================
    let deployUser: UserInfo

    if (!existingState || !state.isPhaseComplete(existingState, 4)) {
      logger.phase(4, 'Setup Deployment User')
      deployUser = await userSetup.createDeploymentUser(ssh)

      // Create state file with metadata
      if (!existingState) {
        await state.createState(ssh, config.instanceName, {
          deployUser: deployUser.username,
          deployUid: deployUser.uid,
          deployGid: deployUser.gid,
          deployHome: deployUser.home,
          image: 'roboclaw/openclaw:local',
          branch: config.branch,
        })
      }

      await state.updateState(ssh, 4, 'complete')
    } else {
      logger.phase(4, 'Setup Deployment User')
      logger.dim('  (skip - already complete)')

      // Load user info from state
      deployUser = {
        username: existingState.metadata.deployUser,
        uid: existingState.metadata.deployUid,
        gid: existingState.metadata.deployGid,
        home: existingState.metadata.deployHome,
        inDockerGroup: true,
      }
    }

    // ====================================================================
    // Phase 5: Create Directories
    // ====================================================================
    if (!existingState || !state.isPhaseComplete(existingState, 5)) {
      logger.phase(5, 'Create Directories')
      await userSetup.createDirectories(ssh, deployUser)

      await state.updateState(ssh, 5, 'complete')
    } else {
      logger.phase(5, 'Create Directories')
      logger.dim('  (skip - already complete)')
    }

    // ====================================================================
    // Phase 6: Build OpenClaw Image
    // ====================================================================
    let imageName: string

    if (!existingState || !state.isPhaseComplete(existingState, 6)) {
      logger.phase(6, 'Build OpenClaw Image')
      imageName = await imageBuilder.buildImage(ssh, deployUser, config.branch)

      await state.updateState(ssh, 6, 'complete')
    } else {
      logger.phase(6, 'Build OpenClaw Image')
      logger.dim('  (skip - already complete)')

      imageName = existingState.metadata.image
    }

    // ====================================================================
    // Phase 7: Upload Docker Compose
    // ====================================================================
    if (!existingState || !state.isPhaseComplete(existingState, 7)) {
      logger.phase(7, 'Upload Docker Compose')
      await compose.uploadComposeFiles(ssh, deployUser, imageName)

      await state.updateState(ssh, 7, 'complete')
    } else {
      logger.phase(7, 'Upload Docker Compose')
      logger.dim('  (skip - already complete)')
    }

    // ====================================================================
    // Phase 8: Onboarding & Gateway Startup
    // ====================================================================
    let gatewayToken: string | null = null

    if (!existingState || !state.isPhaseComplete(existingState, 8)) {
      logger.phase(8, 'Onboarding & Gateway Startup')

      // Step 1: Run onboarding FIRST (generates token in config)
      await interactive.runOnboarding(ssh, deployUser, config.skipOnboard)

      // Step 2: Extract token from config (if onboarding was completed)
      gatewayToken = await interactive.extractGatewayToken(ssh, deployUser)

      if (gatewayToken) {
        logger.success('Gateway token extracted')

        // Step 3: Stop gateway if running (to ensure clean state)
        await ssh.exec(`cd ${deployUser.home}/docker && sudo -u ${deployUser.username} docker compose stop openclaw-gateway 2>/dev/null || true`)
        logger.verbose('Stopped any existing gateway container')

        // Step 4: Update .env with the token
        await compose.updateEnvToken(ssh, deployUser, gatewayToken)
        logger.success('Updated .env with gateway token')

        // Step 5: Start gateway with correct token
        await interactive.startGateway(ssh, deployUser)
      } else {
        logger.warn('No token found - gateway may not start properly')
        logger.info('Complete onboarding manually if needed')
      }

      await state.updateState(ssh, 8, 'complete')
    } else {
      logger.phase(8, 'Onboarding & Gateway Startup')
      logger.dim('  (skip - already complete)')

      // Extract token for final output even on skip
      gatewayToken = await interactive.extractGatewayToken(ssh, deployUser)
    }

    // ====================================================================
    // Phase 9: Create Instance Artifact
    // ====================================================================
    logger.phase(9, 'Create Instance Artifact')

    await artifact.createInstanceArtifact(config, deployUser, imageName)

    // ====================================================================
    // Phase 10: Cleanup & Success
    // ====================================================================
    logger.phase(10, 'Finalize Deployment')

    // Delete state file (deployment complete)
    await state.deleteState(ssh)

    logger.success('Deployment state cleaned up')

    // Display success message
    logger.deploymentComplete(config.instanceName, config.ip, 18789, gatewayToken || undefined)

    // ====================================================================
    // Auto-Connect (Optional)
    // ====================================================================
    if (!config.noAutoConnect) {
      await autoConnect.autoConnect(ssh, config.ssh, deployUser, 18789)
    }

  } catch (error) {
    logger.blank()
    logger.error(`Deployment failed: ${(error as Error).message}`)

    if (config?.verbose) {
      logger.blank()
      logger.dim((error as Error).stack || '')
    }

    logger.blank()
    logger.info('To retry:')
    logger.indent(`npx clawctl deploy ${flags.ip} --key ${flags.key}`)
    logger.blank()
    logger.dim('The deployment will resume from the last successful phase.')
    logger.blank()

    process.exit(1)
  } finally {
    // Always disconnect SSH
    if (ssh?.isConnected()) {
      ssh.disconnect()
    }
  }
}
