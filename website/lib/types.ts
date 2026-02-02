// Deployment configuration
export interface DeployConfig {
  token: string
  serverName?: string
  serverType?: string
  location?: string
  image?: string
}

// Deployment phases
export type DeployPhase =
  | 'idle'
  | 'keygen'
  | 'ssh_key'
  | 'provisioning'
  | 'ssh_wait'
  | 'install_packages'
  | 'create_user'
  | 'install_docker'
  | 'configure_firewall'
  | 'install_nodejs'
  | 'install_roboclaw'
  | 'verify'
  | 'success'
  | 'error'

// Log entry levels
export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'command'

// Single log entry
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  phase?: DeployPhase
}

// Phase progress update
export interface PhaseUpdate {
  phase: DeployPhase
  step: number
  totalSteps: number
  label: string
}

// Progress update
export interface ProgressUpdate {
  percent: number
}

// Deployment success result
export interface DeployResult {
  ip: string
  serverName: string
  sshPrivateKey: string
  sshUser: string
  nextSteps: string[]
}

// Deployment error
export interface DeployError {
  message: string
  phase?: DeployPhase
  serverId?: number
  recoverable: boolean
}

// SSE event types
export type SSEEvent =
  | { type: 'log'; data: LogEntry }
  | { type: 'phase'; data: PhaseUpdate }
  | { type: 'progress'; data: ProgressUpdate }
  | { type: 'success'; data: DeployResult }
  | { type: 'error'; data: DeployError }
  | { type: 'heartbeat'; data: Record<string, never> }

// Hetzner API types
export interface HetznerSSHKey {
  id: number
  name: string
  fingerprint: string
  public_key: string
}

export interface HetznerServer {
  id: number
  name: string
  status: string
  public_net: {
    ipv4: {
      ip: string
    }
  }
  server_type: {
    name: string
  }
  datacenter: {
    location: {
      name: string
    }
  }
  image: {
    name: string
  }
}

export interface HetznerAPIError {
  code: string
  message: string
  details?: unknown
}

// SSH keypair
export interface SSHKeypair {
  privateKey: string
  publicKey: string
}

// Deployment state (used in deployment manager)
export interface DeploymentState {
  config: DeployConfig
  sshKeypair?: SSHKeypair
  sshKeyId?: number
  serverId?: number
  serverIp?: string
}

// Instance representation (from instances/*.yml files)
export interface Instance {
  name: string
  ip: string
  serverType: string
  location: string
  image: string
  provisionedAt: string
  installMode: string
  status: 'active' | 'deleted'
  onboardingCompleted: boolean
  software: {
    os: string
    kernel: string
    docker: string
    nodejs: string
    pnpm: string
    roboclaw: string
    gemini?: string
    ttyd?: string
  }
  configuration: {
    roboclawUser: string
    roboclawHome: string
    roboclawConfigDir: string
  }
  firewall?: {
    ufwEnabled: boolean
    allowedPorts: Array<{
      port: number
      proto: string
      description: string
    }>
  }
  ssh: {
    keyFile: string
    publicKeyFile: string
  }
  gatewayToken?: string
}
