# Claude Instructions for RoboClaw Project

## Project Overview

**RoboClaw** is a deployment system for OpenClaw instances. The primary tool is **clawctl**, a Node.js CLI (TypeScript) that deploys OpenClaw to remote servers via SSH and Docker.

**Key Facts:**
- **Language:** TypeScript (ES Modules)
- **Current Version:** v1.0.1
- **Status:** Production-ready, actively maintained
- **Distribution:** npm package (`npx clawctl`)

---

## Working with This Project

### When You DON'T Have a Concrete Task

**If the user asks a question or you need to understand the codebase:**

1. **Read the Primer First:** `specs/PRIMER.md`
   - This routing document will tell you which spec(s) to read
   - It contains a quick routing table, topic index, and query examples
   - Reading this first saves time vs. reading all specs

2. **Then Read the Relevant Spec(s):**
   - `specs/clawctl-spec.md` - Technical implementation
   - `specs/clawctl-cli-spec.md` - CLI interface
   - `specs/docker-openclaw.md` - Docker containerization
   - `specs/clawctl-strategy.md` - Strategic direction
   - `specs/deployment-workflow.md` - Legacy Ansible (historical only)

3. **Check Project Memory:** `~/.claude/projects/-home-justin-Documents-RoboClaw/memory/MEMORY.md`
   - Contains lessons learned and common issues
   - Updated with implementation notes and gotchas

### When You DO Have a Concrete Task

**If the user asks you to implement, fix, or modify something:**

1. **Read relevant code files directly** (don't read specs unless you need context)
2. **Consult specs only if:**
   - You need to understand overall architecture
   - You're implementing a new feature
   - You're debugging something complex
   - You need to verify design decisions

3. **Always check memory** for previous notes on similar work

---

## Specification Usage Guidelines

### Read Specs When:
- ✅ User asks "how does X work?"
- ✅ User asks for explanation or documentation
- ✅ You're planning a new feature
- ✅ You need to understand deployment phases
- ✅ You're uncertain about architecture
- ✅ You need context for debugging

### DON'T Read Specs When:
- ❌ User asks you to fix a specific bug (read the code instead)
- ❌ User points to a specific file (read that file)
- ❌ User asks you to implement a small feature (read relevant modules)
- ❌ You already understand what to do (just do it)

### Efficient Spec Reading:
1. **Start with PRIMER.md** - Find the right spec(s)
2. **Read targeted sections** - Use the topic index
3. **Cross-reference as needed** - Specs link to each other
4. **Update memory** - Note any discrepancies or learnings

---

## Key Technical Patterns

### ES Modules with TypeScript
```typescript
// Import statements MUST include .js extensions
import { foo } from './bar.js'  // Correct
import { foo } from './bar'     // Wrong
```

### Docker Compose Variable Substitution
```typescript
// Preserve ${VARIABLE} syntax in docker-compose.yml
const template = `user: "\${USER_UID}:\${USER_GID}"`  // Use escaped $

// .env file provides actual values
// USER_UID=1000
// USER_GID=1000

// Docker Compose substitutes at runtime: user: "1000:1000"
```

### Template Literals with Preserved Variables
```typescript
// Use String.raw or escape $ to prevent TypeScript substitution
String.raw`version: '3.8'
services:
  service:
    user: "${USER_UID}:${USER_GID}"
`
// Output contains ${USER_UID} literally, NOT substituted by TypeScript
```

### State Management
- Remote state file: `/home/roboclaw/.clawctl-deploy-state.json`
- Tracks deployment progress
- Enables idempotent resume on failure

### Deployment User
- Dedicated `roboclaw` user (UID 1000) created on remote server
- SSH user is `root` (required for Docker installation)
- Containers run as roboclaw UID for non-root security

---

## Common Operations

### Building the CLI
```bash
npm run build          # Compile TypeScript to dist/
npm run watch          # Watch mode for development
npm run clean          # Remove dist/
```

### Running Locally
```bash
node dist/index.js deploy <IP> --key <path>
```

### Testing
```bash
# Requires real Ubuntu 24.04 VPS
npx clawctl deploy <IP> --key <path> --verbose
```

---

## File Structure

### Source Code
```
src/
├── index.ts                 # CLI entry point (Commander.js)
├── commands/
│   └── deploy.ts           # 10-phase deployment orchestrator
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   ├── config.ts           # Configuration loading
│   ├── logger.ts           # Colored console output
│   ├── ssh-client.ts       # SSH operations
│   ├── state.ts            # Deployment state management
│   ├── docker-setup.ts     # Docker CE installation
│   ├── user-setup.ts       # User and directory creation
│   ├── image-builder.ts    # Git clone and docker build
│   ├── compose.ts          # Compose file generation
│   ├── interactive.ts      # PTY sessions for onboarding
│   ├── artifact.ts         # Instance YAML artifacts
│   └── auto-connect.ts     # Auto-connect to dashboard
└── templates/
    └── docker-compose.ts   # Template with preserved ${VARS}
```

### Specifications (Reference Documentation)
```
specs/
├── PRIMER.md                    # START HERE - Routing guide
├── clawctl-spec.md              # Technical implementation
├── clawctl-cli-spec.md          # CLI interface
├── docker-openclaw.md           # Docker containerization
├── clawctl-strategy.md          # Strategic direction
└── deployment-workflow.md       # Legacy Ansible (historical)
```

### Instance Artifacts
```
instances/
└── <instance-name>.yml          # Deployment metadata (created at runtime)
```

---

## Error Handling Principles

1. **Fail Fast, Fail Clearly** - Provide actionable error messages
2. **Idempotent Operations** - Safe to retry any phase
3. **State Tracking** - Resume from failure point automatically
4. **Exit Codes** - Each phase has specific exit code (0-10)

---

## Important Reminders

### TypeScript Errors
- **Error callbacks:** Use `(err: Error) =>` for typed callbacks
- **Unused imports:** Remove or use `import type` for types
- **Private properties:** Make public if needed externally

### Template Literal Issues
- **Problem:** `${VAR}` in template strings gets substituted by TS
- **Solution:** Use `\${VAR}` to escape, produces `${VAR}` in output
- **Example:** `` `user: "\${USER_UID}"` `` outputs `user: "${USER_UID}"`

### Memory Updates
When you encounter:
- Common errors or gotchas
- Implementation patterns that work well
- Things that need to be done differently
- Lessons learned

**Update the memory file** so future sessions benefit.

---

## Workflow Summary

```
User Query
    ↓
Is it a concrete task?
    ↓
   Yes → Read relevant code directly
    |    Execute task
    |    Update memory if needed
    |
   No → Is it a question/explanation request?
    ↓
   Yes → Read specs/PRIMER.md
    |    Follow routing to relevant spec(s)
    |    Answer based on spec content
    |
  Done
```

---

## Quick Reference Links

- **Start Here:** `specs/PRIMER.md`
- **Technical Spec:** `specs/clawctl-spec.md`
- **CLI Spec:** `specs/clawctl-cli-spec.md`
- **Docker Spec:** `specs/docker-openclaw.md`
- **Memory:** `~/.claude/projects/-home-justin-Documents-RoboClaw/memory/MEMORY.md`
- **Main Code:** `src/commands/deploy.ts`
- **Package:** `package.json`

---

**Last Updated:** 2026-02-05
**Project Status:** Production (v1.0.1)
**Next Milestone:** End-to-end testing on production VPS
