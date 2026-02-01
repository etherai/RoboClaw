import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { parse } from 'yaml'
import type { Instance } from '@/lib/types'

// Force Node.js runtime (required for fs)
export const runtime = 'nodejs'

// Project root is one level up from website directory
const PROJECT_ROOT = join(process.cwd(), '..')
const INSTANCES_DIR = join(PROJECT_ROOT, 'instances')

export async function GET() {
  try {
    // Read all files in instances/ directory
    const files = await readdir(INSTANCES_DIR)

    // Filter for .yml files
    const ymlFiles = files.filter(f => f.endsWith('.yml'))

    // Parse each instance artifact
    const instances: Instance[] = []

    for (const file of ymlFiles) {
      try {
        const filePath = join(INSTANCES_DIR, file)
        const content = await readFile(filePath, 'utf-8')
        const data = parse(content)

        // The YAML structure has an 'instances' array with a single element
        if (data.instances && data.instances[0]) {
          const inst = data.instances[0]

          // Determine status from filename
          const isDeleted = file.endsWith('_deleted.yml')

          // Map YAML structure to Instance interface
          const instance: Instance = {
            name: inst.name,
            ip: inst.ip,
            serverType: inst.server_type,
            location: inst.location,
            image: inst.image,
            provisionedAt: inst.provisioned_at,
            installMode: inst.install_mode,
            status: isDeleted ? 'deleted' : 'active',
            onboardingCompleted: inst.onboarding_completed ?? false,
            software: {
              os: inst.software?.os ?? '',
              kernel: inst.software?.kernel ?? '',
              docker: inst.software?.docker ?? '',
              nodejs: inst.software?.nodejs ?? '',
              pnpm: inst.software?.pnpm ?? '',
              openclaw: inst.software?.openclaw ?? inst.software?.clawdbot ?? '',
              ttyd: inst.software?.ttyd,
            },
            configuration: {
              openclawUser: inst.configuration?.openclaw_user ?? inst.configuration?.clawdbot_user ?? '',
              openclawHome: inst.configuration?.openclaw_home ?? inst.configuration?.clawdbot_home ?? '',
              openclawConfigDir: inst.configuration?.openclaw_config_dir ?? inst.configuration?.clawdbot_config_dir ?? '',
            },
            firewall: inst.firewall ? {
              ufwEnabled: inst.firewall.ufw_enabled ?? false,
              allowedPorts: inst.firewall.allowed_ports ?? [],
            } : undefined,
            ssh: {
              keyFile: inst.ssh?.key_file ?? '',
              publicKeyFile: inst.ssh?.public_key_file ?? '',
            },
          }

          instances.push(instance)
        }
      } catch (error) {
        console.error(`Error parsing ${file}:`, error)
        // Skip files that can't be parsed
      }
    }

    // Sort: active instances first, then by provisioned date (newest first)
    instances.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1
      }
      return new Date(b.provisionedAt).getTime() - new Date(a.provisionedAt).getTime()
    })

    return new Response(JSON.stringify({ instances }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error reading instances:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to read instances',
        instances: []
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
