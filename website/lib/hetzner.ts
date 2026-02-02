import type {
  HetznerSSHKey,
  HetznerServer,
  HetznerAPIError as APIError,
} from './types'

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1'

export class HetznerAPIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'HetznerAPIError'
  }
}

async function makeRequest<T>(
  token: string,
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  const url = `${HETZNER_API_BASE}${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()

  if (!response.ok) {
    const error = data.error as APIError
    throw new HetznerAPIError(
      response.status,
      error.code,
      error.message,
      error.details
    )
  }

  return data as T
}

/**
 * Validates a Hetzner API token by making a lightweight API call
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    await makeRequest(token, 'GET', '/servers?per_page=1')
    return true
  } catch {
    return false
  }
}

/**
 * Creates an SSH key in Hetzner Cloud
 * Handles conflict (409) if key already exists by retrieving it
 */
export async function createSSHKey(
  token: string,
  name: string,
  publicKey: string
): Promise<HetznerSSHKey> {
  try {
    const response = await makeRequest<{ ssh_key: HetznerSSHKey }>(
      token,
      'POST',
      '/ssh_keys',
      {
        name,
        public_key: publicKey,
      }
    )
    return response.ssh_key
  } catch (error) {
    if (
      error instanceof HetznerAPIError &&
      error.code === 'uniqueness_error'
    ) {
      // Key already exists, retrieve it
      const response = await makeRequest<{ ssh_keys: HetznerSSHKey[] }>(
        token,
        'GET',
        '/ssh_keys'
      )
      const existingKey = response.ssh_keys.find((key) => key.name === name)
      if (existingKey) {
        return existingKey
      }
    }
    throw error
  }
}

/**
 * Creates a server in Hetzner Cloud
 */
export async function createServer(
  token: string,
  opts: {
    name: string
    serverType: string
    image: string
    location: string
    sshKeyIds: number[]
  }
): Promise<HetznerServer> {
  const response = await makeRequest<{ server: HetznerServer }>(
    token,
    'POST',
    '/servers',
    {
      name: opts.name,
      server_type: opts.serverType,
      image: opts.image,
      location: opts.location,
      ssh_keys: opts.sshKeyIds,
      start_after_create: true,
    }
  )

  return response.server
}

/**
 * Gets server information
 */
export async function getServer(
  token: string,
  serverId: number
): Promise<HetznerServer> {
  const response = await makeRequest<{ server: HetznerServer }>(
    token,
    'GET',
    `/servers/${serverId}`
  )
  return response.server
}

/**
 * Polls server status until it's running
 * @param onProgress Callback for progress messages
 */
export async function waitForServerRunning(
  token: string,
  serverId: number,
  onProgress: (msg: string) => void,
  timeoutMs = 120000
): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 3000 // 3 seconds

  while (Date.now() - startTime < timeoutMs) {
    const server = await getServer(token, serverId)
    onProgress(`Server status: ${server.status}`)

    if (server.status === 'running') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  throw new Error(
    `Server failed to start within ${timeoutMs / 1000} seconds`
  )
}

/**
 * Deletes a server
 */
export async function deleteServer(
  token: string,
  serverId: number
): Promise<void> {
  await makeRequest(token, 'DELETE', `/servers/${serverId}`)
}

/**
 * Deletes an SSH key
 */
export async function deleteSSHKey(
  token: string,
  keyId: number
): Promise<void> {
  await makeRequest(token, 'DELETE', `/ssh_keys/${keyId}`)
}

/**
 * Lists all servers
 */
export async function listServers(token: string): Promise<HetznerServer[]> {
  const response = await makeRequest<{ servers: HetznerServer[] }>(
    token,
    'GET',
    '/servers'
  )
  return response.servers
}
