/**
 * Console logger with colored output
 */

let verboseMode = false

/**
 * Set verbose mode
 */
export function setVerbose(enabled: boolean): void {
  verboseMode = enabled
}

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
}

/**
 * Format message with color
 */
function colorize(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * Log a success message
 */
export function success(message: string): void {
  console.log(`${colorize('green', '✓')} ${message}`)
}

/**
 * Log an error message
 */
export function error(message: string): void {
  console.error(`${colorize('red', '✗')} ${message}`)
}

/**
 * Log a warning message
 */
export function warn(message: string): void {
  console.log(`${colorize('yellow', '⚠️')} ${message}`)
}

/**
 * Log an info message
 */
export function info(message: string): void {
  console.log(`${colorize('blue', 'ℹ')} ${message}`)
}

/**
 * Log a phase header
 */
export function phase(phaseNumber: number, phaseName: string): void {
  console.log()
  console.log(colorize('bright', `Phase ${phaseNumber}: ${phaseName}`))
}

/**
 * Log a verbose message (only shown if verbose mode enabled)
 */
export function verbose(message: string): void {
  if (verboseMode) {
    console.log(colorize('gray', `  [verbose] ${message}`))
  }
}

/**
 * Log a plain message
 */
export function log(message: string): void {
  console.log(message)
}

/**
 * Log an indented message
 */
export function indent(message: string, level: number = 1): void {
  const spaces = '  '.repeat(level)
  console.log(`${spaces}${message}`)
}

/**
 * Log a dimmed/gray message
 */
export function dim(message: string): void {
  console.log(colorize('gray', message))
}

/**
 * Log a command being executed (in verbose mode)
 */
export function command(cmd: string): void {
  if (verboseMode) {
    console.log(colorize('gray', `  $ ${cmd}`))
  }
}

/**
 * Clear the current line (for progress indicators)
 */
export function clearLine(): void {
  process.stdout.write('\r\x1b[K')
}

/**
 * Print a progress message (without newline)
 */
export function progress(message: string): void {
  process.stdout.write(`  ${message}`)
}

/**
 * Print a blank line
 */
export function blank(): void {
  console.log()
}

/**
 * Print a divider
 */
export function divider(): void {
  console.log(colorize('gray', '─'.repeat(60)))
}

/**
 * Print a header
 */
export function header(title: string): void {
  console.log()
  console.log(colorize('bright', title))
  console.log(colorize('gray', '─'.repeat(title.length)))
}

/**
 * Print an error message with details and suggestions
 */
export function errorBlock(
  title: string,
  details?: Record<string, string>,
  causes?: string[],
  suggestions?: string[]
): void {
  console.log()
  error(title)
  console.log()

  if (details) {
    console.log('Details:')
    for (const [key, value] of Object.entries(details)) {
      console.log(`  ${colorize('dim', '-')} ${key}: ${value}`)
    }
    console.log()
  }

  if (causes && causes.length > 0) {
    console.log('Possible causes:')
    causes.forEach((cause, i) => {
      console.log(`  ${i + 1}. ${cause}`)
    })
    console.log()
  }

  if (suggestions && suggestions.length > 0) {
    console.log('To debug:')
    suggestions.forEach(suggestion => {
      console.log(`  ${suggestion}`)
    })
    console.log()
  }
}

/**
 * Print a final success message with details
 */
export function deploymentComplete(
  instanceName: string,
  ip: string,
  port: number = 18789,
  gatewayToken?: string
): void {
  console.log()
  console.log(colorize('green', '✅ Deployment complete!'))
  console.log()
  console.log('Instance Details:')
  console.log(`  Name: ${instanceName}`)
  console.log(`  IP: ${ip}`)
  console.log(`  Gateway: Running at ${colorize('cyan', `http://localhost:${port}`)} ${colorize('dim', '(localhost only)')}`)
  console.log()
  console.log('Next steps:')
  console.log(`  ${colorize('dim', '1.')} Create SSH tunnel to access gateway:`)
  console.log(`     ${colorize('cyan', `ssh -L ${port}:localhost:${port} -i <key> root@${ip} -N -f`)}`)
  console.log()
  console.log(`  ${colorize('dim', '2.')} Access gateway in your browser:`)
  console.log(`     ${colorize('cyan', `http://localhost:${port}`)}`)
  console.log()

  if (gatewayToken) {
    console.log(`  ${colorize('dim', '3.')} Dashboard URL (with auth token):`)
    console.log(`     ${colorize('cyan', `http://localhost:${port}/?token=${gatewayToken}`)}`)
    console.log()
  }

  console.log(`  ${colorize('dim', gatewayToken ? '4.' : '3.')} Manage instance with clawctl commands ${colorize('gray', '(coming in future versions)')}:`)
  console.log(`     ${colorize('gray', `clawctl logs ${instanceName}`)}`)
  console.log(`     ${colorize('gray', `clawctl status ${instanceName}`)}`)
  console.log(`     ${colorize('gray', `clawctl restart ${instanceName}`)}`)
  console.log()
}
