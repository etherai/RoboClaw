# Implementation Prompt for clawctl v1.0

**Use this prompt to start a new Claude session for implementation.**

---

## Context

I'm building **clawctl**, a Node.js CLI tool for deploying OpenClaw instances to remote servers via SSH and Docker. This will replace our current Python/Ansible-based deployment system.

**Key points:**
- Package name: `clawctl` (already reserved on npm)
- Technology: Node.js 18+, TypeScript, ES modules
- Goal: One command deploys everything: `npx clawctl deploy <ip> --key <path>`
- Focus: Get initial deployment working (v1.0 minimal scope)

## Specifications Available

I have three comprehensive specification documents (read these first):

1. **`specs/clawctl-strategy.md`** - Strategic vision and motivation
2. **`specs/clawctl-spec.md`** - Technical implementation (10-phase deployment)
3. **`specs/clawctl-cli-spec.md`** - Complete CLI design (all commands)

## Your Task

Implement the **initial deployment functionality** to get `npx clawctl deploy` working end-to-end.

**Scope:** Deploy command only (Phase 1-7 of TODO list)
**Out of scope:** Other commands (list, status, logs, etc.) - those come later

## Implementation Plan

Follow the detailed TODO list in `TODO-clawctl-v1.md`. The plan is broken into 7 phases:

1. **Project Setup** - npm package, TypeScript, directory structure
2. **Core Infrastructure** - Config, SSH client, logger, types
3. **Deployment Modules** - Docker setup, user setup, image builder, compose generator
4. **Deploy Command** - CLI entry point and orchestrator (10 deployment phases)
5. **Error Handling** - Comprehensive error messages, exit codes
6. **Testing** - Manual testing on real Ubuntu 24.04 VPS
7. **Documentation** - README and publish preparation

## Key Technical Requirements

### Technology Stack
- **TypeScript** with strict mode
- **ES modules** (`"type": "module"` in package.json)
- **Dependencies:** commander@^12.0.0, ssh2@^1.16.0, yaml@^2.8.2
- **Node version:** >=18.0.0
- **Target:** Compiled to `dist/` directory

### Architecture Principles
- **Idempotent operations** - Safe to run multiple times
- **Resume capability** - Continue from failure point
- **State tracking** - JSON file on remote server tracks progress
- **Configuration hierarchy** - Flags > env vars > config files > defaults
- **Good error messages** - Explain what failed and how to fix

### The 10 Deployment Phases

Each phase must:
1. Check if already complete (idempotency)
2. Execute the work if needed
3. Update state file on remote
4. Handle errors gracefully
5. Display progress clearly

**Phases:**
1. Argument validation
2. SSH connection (verify root access)
3. Install base packages (curl, wget, git, etc.)
4. Install Docker and Docker Compose v2
5. Create roboclaw system user (UID 1000, non-root)
6. Create directories (~/.openclaw, ~/.roboclaw, ~/docker, ~/openclaw-src)
7. Build OpenClaw Docker image from GitHub
8. Upload docker-compose.yml and .env files
9. Run onboarding wizard, start gateway daemon
10. Create local instance artifact (instances/*.yml)

### Critical Design Details

**SSH User:**
- Must be root (we verify this in Phase 2)
- Used for privileged operations (apt-get, useradd, etc.)

**Deployment User:**
- Create dedicated `roboclaw` user (UID 1000)
- Containers run as this user (non-root for security)
- Files in mounted volumes owned by roboclaw

**Docker Compose:**
- Use runtime variable substitution (not template substitution)
- docker-compose.yml has `${USER_UID}`, `${USER_HOME}` as-is
- .env file has actual values: `USER_UID=1000`
- Docker Compose does substitution at runtime

**State Management:**
- State file: `/home/roboclaw/.clawctl-deploy-state.json`
- Tracks which phases completed, failed, or pending
- Enables resume on retry
- Deleted on successful completion

**Configuration:**
- Support env vars: `CLAWCTL_SSH_KEY`, `CLAWCTL_DEFAULT_BRANCH`, etc.
- Support config files: `~/.clawctl/config.yml`, `./clawctl.yml`
- Precedence: CLI flags > env vars > config files > defaults

## Directory Structure to Create

```
RoboClaw/
├── package.json
├── tsconfig.json
├── .gitignore
├── .npmignore
├── README.md
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   └── deploy.ts         # Deploy orchestrator
│   ├── lib/
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── config.ts         # Configuration loading
│   │   ├── logger.ts         # Console output
│   │   ├── ssh-client.ts     # SSH operations
│   │   ├── docker-setup.ts   # Docker installation
│   │   ├── user-setup.ts     # User creation
│   │   ├── image-builder.ts  # Image building
│   │   ├── compose.ts        # Compose generation
│   │   ├── interactive.ts    # PTY sessions
│   │   ├── state.ts          # State management
│   │   └── artifact.ts       # Instance artifacts
│   └── templates/
│       └── docker-compose.ts # Compose template
├── dist/                     # Compiled output (gitignored)
├── instances/                # Instance artifacts (created at runtime)
├── specs/                    # Specification documents (already exist)
└── TODO-clawctl-v1.md        # Detailed task list
```

## Code Style Guidelines

- **Small, focused functions** - Each function does one thing
- **Descriptive names** - No abbreviations (except common ones like `ssh`, `uid`)
- **Error handling** - Try/catch with helpful error messages
- **Type safety** - Use TypeScript types for all function parameters and returns
- **Comments** - Only for complex logic, code should be self-documenting
- **Async/await** - Modern async patterns, no callbacks

## Example Code Pattern

```typescript
// src/lib/docker-setup.ts

import type { SSHClient } from './ssh-client.js'
import { logger } from './logger.js'

export async function installDocker(ssh: SSHClient): Promise<void> {
  logger.phase('Installing Docker...')

  // Check if already installed (idempotent)
  const { exitCode, stdout } = await ssh.exec('docker --version')
  if (exitCode === 0) {
    const version = stdout.trim()
    logger.success(`Docker already installed: ${version}`)
    return
  }

  // Install Docker
  logger.info('Installing Docker CE...')
  try {
    await ssh.execStream(`
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \\
        gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] \\
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \\
        > /etc/apt/sources.list.d/docker.list
      apt-get update -qq
      apt-get install -y -qq docker-ce docker-ce-cli containerd.io
      systemctl start docker
      systemctl enable docker
    `)

    // Verify installation
    const check = await ssh.exec('docker --version')
    if (check.exitCode !== 0) {
      throw new Error('Docker installation verification failed')
    }

    logger.success('Docker installed successfully')
  } catch (error) {
    logger.error('Failed to install Docker')
    throw error
  }
}
```

## Testing Approach

**Manual testing on real VPS:**
1. Provision fresh Ubuntu 24.04 VPS (DigitalOcean, Vultr, Hetzner, etc.)
2. Get root SSH access with key
3. Run: `npm run build && node dist/index.js deploy <IP> --key <path>`
4. Watch all 10 phases complete
5. Verify gateway running: `ssh <IP> "docker ps"`
6. Test resume: Kill during phase 7, re-run, verify continues
7. Test idempotency: Run twice, verify second run skips all phases

**Don't need:**
- Unit tests (manual testing is fine for v1.0)
- Integration tests
- Mocking (use real SSH to real server)

## Common Pitfalls to Avoid

1. **Don't use CommonJS** - Use ES modules with `.js` extensions in imports
2. **Don't hardcode paths** - Use configuration and env vars
3. **Don't skip idempotency checks** - Always check if work is done
4. **Don't use sudo** - SSH user is already root
5. **Don't create wrapper script** - We removed that from the spec
6. **Don't implement other commands yet** - Just `deploy` for now
7. **Don't substitute Docker Compose variables** - Leave `${USER_UID}` as-is, let Docker Compose handle it

## Getting Started

1. Read all three specification documents
2. Review the TODO list in `TODO-clawctl-v1.md`
3. Start with Phase 1: Project Setup
   - Create package.json
   - Set up TypeScript
   - Install dependencies
   - Verify build works
4. Move through phases sequentially
5. Test frequently on real VPS
6. Ask questions if anything is unclear

## Questions to Ask Me

If you need clarification:
- "Should X work like Y or Z?"
- "The spec says X, but I'm seeing Y - which is correct?"
- "Can I simplify X or do you want it exactly as specified?"
- "I'm stuck on X - can you help?"

## Success Criteria

You've succeeded when:
- ✅ `npm run build` compiles without errors
- ✅ `node dist/index.js deploy <IP> --key <path>` completes all 10 phases
- ✅ Gateway is running on remote server
- ✅ Instance artifact created in `instances/*.yml`
- ✅ Re-running the same command resumes from failure point
- ✅ Running twice on same server skips all phases (idempotent)

## Resources

- **Specifications:** Read `specs/*.md` files in this repo
- **TODO List:** `TODO-clawctl-v1.md` - detailed task breakdown
- **ssh2 docs:** https://github.com/mscdex/ssh2
- **Commander.js docs:** https://github.com/tj/commander.js
- **Docker Compose docs:** https://docs.docker.com/compose/

---

## Ready to Start?

Begin by reading the specifications, then work through the TODO list phase by phase. Start with Phase 1 (Project Setup) and build incrementally. Test frequently on a real VPS.

Ask questions early if anything is unclear - the specs are comprehensive but there may be edge cases to discuss.

Good luck! 🚀
