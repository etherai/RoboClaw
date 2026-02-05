/**
 * Docker Compose template for OpenClaw
 * Based on OpenClaw's official docker-compose.yml structure
 *
 * IMPORTANT: Variables like ${OPENCLAW_IMAGE} are NOT substituted by TypeScript.
 * They are left intact and substituted by Docker Compose at runtime using the .env file.
 */

/**
 * Generate docker-compose.yml content
 * Variables are left as ${VARIABLE} for Docker Compose to substitute
 */
export function generateDockerCompose(): string {
  // Using template literals with escaped $ to preserve ${VAR} for Docker Compose
  return `services:
  openclaw-gateway:
    image: \${OPENCLAW_IMAGE:-openclaw:local}
    user: "\${DEPLOY_UID}:\${DEPLOY_GID}"
    environment:
      HOME: /home/node
      TERM: xterm-256color
      OPENCLAW_GATEWAY_TOKEN: \${OPENCLAW_GATEWAY_TOKEN}
    volumes:
      - \${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - \${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      - "127.0.0.1:\${OPENCLAW_GATEWAY_PORT:-18789}:18789"
    init: true
    restart: unless-stopped
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "\${OPENCLAW_GATEWAY_BIND:-loopback}",
        "--port",
        "18789",
      ]

  openclaw-cli:
    image: \${OPENCLAW_IMAGE:-openclaw:local}
    user: "\${DEPLOY_UID}:\${DEPLOY_GID}"
    environment:
      HOME: /home/node
      TERM: xterm-256color
      OPENCLAW_GATEWAY_TOKEN: \${OPENCLAW_GATEWAY_TOKEN}
      BROWSER: echo
    volumes:
      - \${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - \${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    stdin_open: true
    tty: true
    init: true
    entrypoint: ["node", "dist/index.js"]
`
}
