import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parse, stringify } from 'yaml'
import { Client } from 'ssh2'
import tunnelManager from '@/lib/tunnel-manager'

// Force Node.js runtime
export const runtime = 'nodejs'

const PROJECT_ROOT = join(process.cwd(), '..')
const INSTANCES_DIR = join(PROJECT_ROOT, 'instances')

interface RouteContext {
  params: Promise<{ name: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params
    const artifactPath = join(INSTANCES_DIR, `${name}.yml`)

    // Read and parse instance artifact
    const artifactContent = await readFile(artifactPath, 'utf-8')
    const artifact = parse(artifactContent)

    if (!artifact.instances || !artifact.instances[0]) {
      return new Response(
        JSON.stringify({ error: 'Invalid artifact format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const instance = artifact.instances[0]
    const ip = instance.ip
    const keyFile = instance.ssh?.key_file

    if (!ip || !keyFile) {
      return new Response(
        JSON.stringify({ error: 'Missing IP or SSH key in artifact' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Resolve key path
    const keyPath = keyFile.startsWith('/') ? keyFile : join(PROJECT_ROOT, keyFile)
    const privateKey = await readFile(keyPath, 'utf-8')

    // Check if onboarding was completed on the remote server
    const onboardingCompleted = await checkOnboardingComplete(ip, privateKey)

    if (onboardingCompleted) {
      // Update the artifact file
      artifact.instances[0].onboarding_completed = true
      artifact.instances[0].onboarding_completed_at = new Date().toISOString()

      // Write back to file
      await writeFile(artifactPath, stringify(artifact), 'utf-8')
    }

    // Stop the SSH tunnel
    tunnelManager.stopTunnel(name)

    return new Response(
      JSON.stringify({ onboardingCompleted }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error completing setup:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to complete setup',
        onboardingCompleted: false,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Checks if the openclaw.json config file exists on the remote server.
 * This indicates that onboarding was completed.
 */
function checkOnboardingComplete(ip: string, privateKey: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const conn = new Client()

    conn.on('ready', () => {
      // Check if ~/.openclaw/openclaw.json exists
      const command = 'test -f /home/openclaw/.openclaw/openclaw.json && echo "exists" || echo "missing"'

      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end()
          reject(err)
          return
        }

        let output = ''

        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.on('close', () => {
          conn.end()
          const exists = output.trim() === 'exists'
          resolve(exists)
        })
      })
    })

    conn.on('error', (err) => {
      reject(err)
    })

    conn.connect({
      host: ip,
      port: 22,
      username: 'root',
      privateKey,
    })
  })
}
