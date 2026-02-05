/**
 * TypeScript type definitions for clawctl
 */

// ============================================================================
// Deployment Configuration
// ============================================================================

/**
 * Resolved configuration for a deployment
 * Combines CLI flags, env vars, config files, and defaults
 */
export interface DeploymentConfig {
  // Target server
  ip: string
  instanceName: string

  // SSH connection
  ssh: SSHConfig

  // Deployment options
  branch: string
  skipOnboard: boolean
  noAutoConnect: boolean // Skip auto-connect to dashboard
  global: boolean // Save artifact to ~/.clawctl/instances/
  force: boolean  // Ignore partial deployment state
  clean: boolean  // Remove everything and start fresh
  verbose: boolean

  // Resolved paths
  instancesDir: string // Where to store instance artifacts
}

/**
 * SSH connection configuration
 */
export interface SSHConfig {
  host: string
  port: number
  username: string
  privateKeyPath: string
  privateKey?: Buffer // Loaded key content
}

// ============================================================================
// Deployment State (on remote server)
// ============================================================================

/**
 * Deployment state tracked on remote server
 * Stored at: /home/roboclaw/.clawctl-deploy-state.json
 */
export interface DeploymentState {
  instanceName: string
  deploymentId: string // UUID v4
  startedAt: string    // ISO 8601 timestamp
  lastPhase: number    // Last completed or failed phase
  phases: Record<number, PhaseStatus>
  metadata: DeploymentMetadata
}

/**
 * Status of a deployment phase
 */
export type PhaseStatus = 'pending' | 'complete' | 'failed'

/**
 * Metadata about the deployment (for resume/idempotency)
 */
export interface DeploymentMetadata {
  deployUser: string      // System user (roboclaw)
  deployUid: number       // UID (typically 1000)
  deployGid: number       // GID (typically 1000)
  deployHome: string      // Home directory (/home/roboclaw)
  image: string           // Docker image tag
  branch: string          // Git branch deployed
}

// ============================================================================
// Deployment Phases
// ============================================================================

/**
 * Deployment phase definition
 */
export interface DeploymentPhase {
  number: number
  name: string
  description: string
  execute: () => Promise<void>
  verify?: () => Promise<boolean> // Optional verification step
  idempotent: boolean // Can be safely re-run
}

// ============================================================================
// Instance Artifacts (local)
// ============================================================================

/**
 * Instance artifact stored locally
 * Location: instances/<name>.yml or ~/.clawctl/instances/<name>.yml
 */
export interface InstanceArtifact {
  name: string
  ip: string
  deployedAt: string           // ISO 8601 timestamp
  deploymentMethod: 'clawctl'  // Always 'clawctl'
  version: string              // clawctl version used

  ssh: {
    keyFile: string            // Absolute path to private key
    user: string               // SSH username (typically root)
    port: number               // SSH port (typically 22)
  }

  docker: {
    image: string              // Docker image tag
    composeFile: string        // Path to docker-compose.yml on server
    branch: string             // OpenClaw git branch
  }

  deployment: {
    user: string               // System user (roboclaw)
    uid: number                // Container UID
    gid: number                // Container GID
    home: string               // Deployment user's home directory
  }

  status: {
    onboardingCompleted: boolean
  }
}

// ============================================================================
// Configuration Files
// ============================================================================

/**
 * Configuration file schema (clawctl.yml or ~/.clawctl/config.yml)
 */
export interface ConfigFile {
  defaults?: ConfigDefaults
  instances?: Record<string, ConfigDefaults> // Instance-specific overrides
}

/**
 * Default configuration values
 */
export interface ConfigDefaults {
  // SSH connection
  sshKey?: string
  sshUser?: string
  sshPort?: number

  // Deployment
  branch?: string
  skipOnboard?: boolean

  // Paths
  instancesDir?: string

  // Behavior
  verbose?: boolean
  autoResume?: boolean
  autoClean?: boolean
}

// ============================================================================
// Runtime Data
// ============================================================================

/**
 * User information from remote server
 */
export interface UserInfo {
  username: string
  uid: number
  gid: number
  home: string
  inDockerGroup: boolean
}

/**
 * Docker version information
 */
export interface DockerInfo {
  version: string
  composeVersion: string
}

/**
 * SSH command execution result
 */
export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Gateway health status
 */
export interface GatewayHealth {
  running: boolean
  healthy: boolean
  uptime?: number // seconds
  lastRestart?: string // ISO 8601
}
