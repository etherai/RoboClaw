# Prompt: Create OpenClaw Architecture Specification

## Your Task

Create a comprehensive specification document at `specs/openclaw-architecture.md` that explains what OpenClaw is and how its components work together.

## Context

You're working on the **RoboClaw** project, which deploys **OpenClaw** instances to remote servers. The current specs (`clawctl-spec.md`, `clawctl-cli-spec.md`, `docker-openclaw.md`) reference OpenClaw extensively but never explain what it actually is or how it works internally.

**Problem:** When working on features like auto-connect, gateway interactions, or debugging deployment issues, there's no single document explaining OpenClaw's architecture, services, APIs, or configuration.

## What You Need to Research

Explore the codebase to understand:

1. **What OpenClaw is:**
   - Is it an AI assistant platform? A CLI tool? Both?
   - What problems does it solve?
   - How does it relate to Claude Code or other AI assistants?

2. **Service Architecture:**
   - Two services are deployed: `openclaw-cli` and `openclaw-gateway`
   - What does each service do?
   - How do they communicate (if at all)?
   - Why are there two separate services?

3. **Gateway Service Details:**
   - What is the gateway's purpose?
   - What API commands does it expose? (You'll find references in `clawctl/src/lib/auto-connect.ts` and `clawctl/src/lib/interactive.ts`)
   - Device pairing system (pairing requests, approval flow)
   - Health check mechanisms
   - Authentication model

4. **CLI Service Details:**
   - What commands does the CLI provide?
   - How does onboarding work?
   - What is `openclaw onboard --no-install-daemon`?

5. **Configuration:**
   - Config file location: `~/.openclaw/openclaw.json`
   - What's stored in the config?
   - How does authentication/credentials work?

6. **Docker Architecture:**
   - Why containerized?
   - Volume mounts and data persistence
   - Non-root user (UID 1000) implications
   - Network configuration

## Where to Look

**Start here:**
- `clawctl/src/lib/auto-connect.ts` - Gateway API usage (device pairing)
- `clawctl/src/lib/interactive.ts` - Onboarding process, CLI commands
- `clawctl/src/templates/docker-compose.ts` - Service definitions
- `specs/docker-openclaw.md` - Docker configuration details
- `README.md` - User-facing description

**Also check:**
- Any references to gateway commands in the codebase
- Docker Compose configuration generation
- Health check implementations
- Onboarding flow and what it creates

## Document Structure

Create `specs/openclaw-architecture.md` with these sections:

### 1. Overview
- What OpenClaw is (2-3 paragraphs)
- Key capabilities
- Use cases

### 2. Architecture Overview
- High-level architecture diagram (ASCII art or description)
- Two-service model (CLI + Gateway)
- Data flow
- Deployment context (how clawctl fits in)

### 3. OpenClaw CLI Service
- Purpose and responsibilities
- Available commands
- Onboarding process detailed walkthrough
- Container details (image, entrypoint, volumes)
- Configuration it creates/uses

### 4. OpenClaw Gateway Service
- Purpose and responsibilities
- Long-running daemon vs CLI tool
- Device management system
- API reference (commands discovered in codebase)
- Health checks
- Authentication

### 5. Configuration System
- Config file structure (`openclaw.json`)
- What data is stored
- How credentials are managed
- Config creation (during onboarding)

### 6. Device Pairing System
- How pairing works
- Pairing request lifecycle
- Auto-approval (from auto-connect feature)
- Device IDs and tracking

### 7. Docker Containerization
- Why containers?
- Image: `roboclaw/openclaw`
- Non-root user (node:1000)
- Volume mounts
- Network ports (18789 for gateway)
- Security considerations

### 8. Integration Points
- How clawctl interacts with OpenClaw
- SSH + Docker Compose exec pattern
- PTY sessions for interactive commands
- Streaming output

### 9. Common Operations
- Onboarding a new instance
- Starting/stopping services
- Checking health status
- Running CLI commands
- Approving pairing requests

### 10. Reference
- Gateway API commands (full list)
- CLI commands (full list)
- Exit codes
- Configuration schema
- Related files in codebase

## Style Guidelines

- **Audience:** Developers working on clawctl or debugging OpenClaw deployments
- **Tone:** Technical but clear
- **Format:** Markdown with code examples
- **Cross-references:** Link to other specs where relevant
- **Examples:** Include real command examples from the codebase
- **Diagrams:** Use ASCII art for architecture diagrams

## Example Section Format

```markdown
## OpenClaw Gateway Service

### Purpose

The OpenClaw Gateway is a long-running daemon service that manages device pairing, authentication, and coordination between OpenClaw CLI instances and remote clients.

### API Commands

The gateway exposes a command-line API accessed via Docker Compose:

**List pending pairing requests:**
```bash
docker compose exec openclaw-gateway node dist/index.js devices list
```

Returns JSON:
```json
{
  "requests": [
    {
      "requestId": "abc123",
      "deviceId": "device-456",
      "ip": "192.168.1.50",
      "timestamp": "2026-02-05T10:30:00Z"
    }
  ]
}
```

[Continue with more commands...]
```

## Validation

Before considering the spec complete, verify:

- [ ] All gateway commands used in `auto-connect.ts` are documented
- [ ] Onboarding process is clear and detailed
- [ ] Service interaction is explained
- [ ] Configuration schema is specified
- [ ] Docker setup is fully explained
- [ ] Examples use actual code patterns from the codebase
- [ ] Cross-references to other specs are accurate

## Deliverable

Create `specs/openclaw-architecture.md` following the structure above. The document should be comprehensive enough that:

1. A developer can understand what OpenClaw is without reading any other docs
2. Someone implementing gateway features knows what APIs are available
3. Someone debugging deployment can understand what should be running where
4. The spec serves as the authoritative reference for OpenClaw internals

---

**Note:** If you discover that OpenClaw is actually a Git submodule or external project, document what you can infer from how clawctl uses it, and note where information is missing. The goal is to document OpenClaw from the perspective of clawctl integration.
