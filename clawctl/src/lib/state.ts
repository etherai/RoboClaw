/**
 * Deployment state management on remote server
 * Tracks which phases have been completed for resume capability
 */

import type { SSHClient } from './ssh-client.js'
import type { DeploymentState, DeploymentMetadata, PhaseStatus } from './types.js'
import * as logger from './logger.js'

/**
 * State file location on remote server
 */
const STATE_FILE = '/home/roboclaw/.clawctl-deploy-state.json'

/**
 * Create a new deployment state file on the remote server
 */
export async function createState(
  ssh: SSHClient,
  instanceName: string,
  metadata: DeploymentMetadata
): Promise<void> {
  const state: DeploymentState = {
    instanceName,
    deploymentId: generateUUID(),
    startedAt: new Date().toISOString(),
    lastPhase: 0,
    phases: {
      1: 'pending',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
    metadata,
  }

  const content = JSON.stringify(state, null, 2)
  await ssh.uploadContent(content, STATE_FILE)
  logger.verbose('Created deployment state file on remote server')
}

/**
 * Update phase status in the state file
 */
export async function updateState(
  ssh: SSHClient,
  phaseNumber: number,
  status: PhaseStatus
): Promise<void> {
  const state = await loadState(ssh)

  if (!state) {
    logger.warn('State file not found, cannot update')
    return
  }

  state.phases[phaseNumber] = status
  state.lastPhase = phaseNumber

  const content = JSON.stringify(state, null, 2)
  await ssh.uploadContent(content, STATE_FILE)
  logger.verbose(`Updated phase ${phaseNumber} status: ${status}`)
}

/**
 * Load the deployment state from the remote server
 */
export async function loadState(ssh: SSHClient): Promise<DeploymentState | null> {
  try {
    const result = await ssh.exec(`cat ${STATE_FILE}`)

    if (result.exitCode !== 0) {
      return null
    }

    const state = JSON.parse(result.stdout) as DeploymentState
    return state
  } catch (error) {
    logger.verbose('No existing deployment state found')
    return null
  }
}

/**
 * Delete the deployment state file
 */
export async function deleteState(ssh: SSHClient): Promise<void> {
  const result = await ssh.exec(`rm -f ${STATE_FILE}`)

  if (result.exitCode === 0) {
    logger.verbose('Deleted deployment state file')
  }
}

/**
 * Check if there's a partial deployment on the server
 */
export async function detectPartialDeployment(ssh: SSHClient): Promise<DeploymentState | null> {
  const state = await loadState(ssh)

  if (!state) {
    return null
  }

  // Check if deployment is incomplete
  const hasFailedPhases = Object.values(state.phases).some(status => status === 'failed')
  const hasPendingPhases = Object.values(state.phases).some(status => status === 'pending')

  if (hasFailedPhases || hasPendingPhases) {
    return state
  }

  // All phases complete, this shouldn't happen (state should be deleted)
  // But if it does, treat as no partial deployment
  return null
}

/**
 * Get the next phase to execute
 */
export function getNextPhase(state: DeploymentState): number {
  for (let phase = 1; phase <= 10; phase++) {
    if (state.phases[phase] === 'pending' || state.phases[phase] === 'failed') {
      return phase
    }
  }
  return 11 // All phases complete
}

/**
 * Check if a specific phase is complete
 */
export function isPhaseComplete(state: DeploymentState, phaseNumber: number): boolean {
  return state.phases[phaseNumber] === 'complete'
}

/**
 * Get a summary of deployment progress
 */
export function getProgressSummary(state: DeploymentState): {
  total: number
  complete: number
  failed: number
  pending: number
} {
  let complete = 0
  let failed = 0
  let pending = 0

  for (const status of Object.values(state.phases)) {
    if (status === 'complete') complete++
    else if (status === 'failed') failed++
    else if (status === 'pending') pending++
  }

  return { total: 10, complete, failed, pending }
}

/**
 * Check if state is stale (older than 24 hours)
 */
export function isStateStale(state: DeploymentState): boolean {
  const startedAt = new Date(state.startedAt)
  const now = new Date()
  const ageMs = now.getTime() - startedAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  return ageHours > 24
}

/**
 * Format age of deployment state for display
 */
export function formatStateAge(state: DeploymentState): string {
  const startedAt = new Date(state.startedAt)
  const now = new Date()
  const ageMs = now.getTime() - startedAt.getTime()
  const ageMinutes = Math.floor(ageMs / (1000 * 60))
  const ageHours = Math.floor(ageMinutes / 60)
  const ageDays = Math.floor(ageHours / 24)

  if (ageDays > 0) {
    return `${ageDays} day${ageDays === 1 ? '' : 's'} ago`
  } else if (ageHours > 0) {
    return `${ageHours} hour${ageHours === 1 ? '' : 's'} ago`
  } else if (ageMinutes > 0) {
    return `${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} ago`
  } else {
    return 'just now'
  }
}

/**
 * Simple UUID v4 generator
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
