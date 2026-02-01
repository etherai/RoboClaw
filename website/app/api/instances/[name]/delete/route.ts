import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

// Force Node.js runtime (required for child_process)
export const runtime = 'nodejs'

// Project root
const PROJECT_ROOT = join(process.cwd(), '..')

interface RouteContext {
  params: Promise<{ name: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { name } = await context.params

    console.log(`[Delete] Starting deletion for instance: ${name}`)

    // Run the delete script with auto-confirmation
    const scriptPath = join(PROJECT_ROOT, 'run-hetzner.sh')
    const command = `cd "${PROJECT_ROOT}" && ./run-hetzner.sh delete -e server_name=${name} -e confirm_delete=yes`

    console.log(`[Delete] Executing: ${command}`)

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
      env: {
        ...process.env,
        PATH: process.env.PATH,
      },
    })

    console.log(`[Delete] Script output:`, stdout)
    if (stderr) {
      console.log(`[Delete] Script stderr:`, stderr)
    }

    // Check if deletion was successful
    if (stdout.includes('PLAY RECAP') || stdout.includes('Server deleted') || !stderr.includes('fatal')) {
      console.log(`[Delete] Instance ${name} deleted successfully`)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Instance ${name} deleted successfully`,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    } else {
      throw new Error('Deletion script did not complete successfully')
    }
  } catch (error) {
    console.error('[Delete] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete instance',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
