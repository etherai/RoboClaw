# Specification Primer

**Purpose:** This document helps LLMs quickly route user queries to the right specification file(s). Read this first to understand the project and determine which detailed specs to consult.

**Last Updated:** 2026-02-05

---

## Quick Project Overview

**RoboClaw** is a deployment system for **OpenClaw** (an AI assistant platform). The current tool is **clawctl**, a Node.js CLI that deploys OpenClaw instances to remote servers via SSH and Docker.

**Key Components:**
- **clawctl** - Node.js CLI tool (TypeScript, published to npm)
- **OpenClaw** - Runs in Docker containers (cli + gateway services)
- **Deployment** - SSH-based, deploys to Ubuntu servers with root access
- **Architecture** - Docker Compose with non-root containers, state-tracked deployment phases

---

## Quick Routing Table

Use this to find the right spec(s) for common query types:

| User Query Topic | Primary Spec | Also Check |
|-----------------|--------------|------------|
| **What is OpenClaw, how does it work** | openclaw-architecture.md | docker-openclaw.md |
| **OpenClaw services (CLI, Gateway)** | openclaw-architecture.md | docker-openclaw.md |
| **Gateway API, device pairing** | openclaw-architecture.md | clawctl-spec.md (Auto-Connect) |
| **Testing, development workflow** | testing-guide.md | - |
| **Deployment errors, troubleshooting** | troubleshooting-guide.md | clawctl-spec.md (Error Handling) |
| **Deployment process, phases, error recovery** | clawctl-spec.md | troubleshooting-guide.md |
| **CLI commands, flags, usage** | clawctl-cli-spec.md | clawctl-spec.md |
| **Docker setup, containers, images** | docker-openclaw.md | openclaw-architecture.md |
| **Strategy, why Node.js, goals** | clawctl-strategy.md | - |
| **Old Ansible approach** | deployment-workflow.md | - |
| **Configuration system (flags, env, files)** | clawctl-cli-spec.md (Config) | clawctl-spec.md (src/lib/config.ts) |
| **Auto-connect feature** | clawctl-spec.md (Auto-Connect) | openclaw-architecture.md (Gateway API) |
| **SSH operations, user setup** | clawctl-spec.md (SSH, Phase 4) | troubleshooting-guide.md (Phase 1) |
| **Template literals, Docker Compose variables** | clawctl-spec.md (Phase 7) | docker-openclaw.md |
| **Instance artifacts** | clawctl-cli-spec.md (Artifacts) | clawctl-spec.md (Phase 9) |
| **Idempotency, resume, state** | clawctl-spec.md (Idempotency) | troubleshooting-guide.md (Recovery) |
| **Development vs production mode** | docker-openclaw.md (Deployment Modes) | - |
| **TypeScript modules, architecture** | clawctl-spec.md (Architecture) | - |

---

## Specification Files Overview

### 1. clawctl-spec.md - Technical Implementation (PRIMARY)

**Read this for:** Technical implementation details, deployment phases, code architecture, error recovery

**Key Topics:**
- 11 deployment phases (0-10) with detailed task breakdowns
- Idempotency and error recovery strategy
- State tracking via `/home/roboclaw/.clawctl-deploy-state.json`
- SSH operations (exec, upload, PTY)
- Docker Compose variable substitution (${USER_UID} preserved, .env provides values)
- Module responsibilities (ssh-client, docker-setup, user-setup, etc.)
- Auto-connect feature implementation
- File structure and dependencies

**When to read:**
- Implementing or debugging deployment logic
- Understanding how phases work
- Troubleshooting state/resume behavior
- Working with SSH, Docker, or Compose generation
- Understanding module architecture

---

### 2. clawctl-cli-spec.md - Command-Line Interface

**Read this for:** CLI commands, user-facing interface, arguments, configuration

**Key Topics:**
- Command structure and arguments (deploy, list, status, logs, etc.)
- Configuration hierarchy (flags > env > config files > defaults)
- Instance artifacts (location, schema, resolution order)
- Output formats (human-readable vs JSON)
- Environment variables (CLAWCTL_* prefix)
- Configuration files (~/.clawctl/config.yml, ./clawctl.yml)
- Error messages and exit codes
- Future commands (destroy, tunnel, onboard, etc.)

**When to read:**
- Designing or implementing new CLI commands
- Understanding configuration system
- Working with instance artifacts
- User experience and output formatting
- Environment variable handling

---

### 3. docker-openclaw.md - Docker Containerization

**Read this for:** Docker setup, containers, images, deployment modes

**Key Topics:**
- Deployment modes (development: build on remote, production: pull from registry)
- Docker Compose configuration (openclaw-cli, openclaw-gateway)
- Non-root container user (UID 1000, maps to roboclaw)
- Volume mounts and data persistence
- Image build and testing scripts
- Security (isolation, non-root, network)
- Migration from native to containerized
- Health checks and monitoring

**When to read:**
- Understanding Docker architecture
- Working with container definitions
- Building or testing images
- Setting up registries
- Transitioning between dev and production modes
- File ownership and permissions

---

### 4. clawctl-strategy.md - Strategic Direction

**Read this for:** High-level vision, motivation, design principles

**Key Topics:**
- Why Node.js/npm instead of Python/Ansible
- Strategic goals (minimal prerequisites, single command, Docker-first)
- Architecture overview
- Design principles (convention over configuration, fail fast)
- Migration path from Ansible
- Success metrics

**When to read:**
- Understanding project direction
- Making architectural decisions
- Explaining to stakeholders
- Planning future enhancements

---

### 5. deployment-workflow.md - Legacy Ansible Approach

**Read this for:** Historical context, comparison with old system

**Key Topics:**
- Original Ansible-based deployment
- Three-step process (setup.sh, create-inventory.sh, run-deploy.sh)
- Ansible playbooks and tasks
- Python/virtual environment setup
- Hetzner Cloud provisioning

**When to read:**
- Understanding how deployment used to work
- Comparing old vs new approaches
- Migrating from Ansible to clawctl
- Reference for equivalent functionality

**Note:** This spec describes the OLD system, not clawctl. Use for historical context only.

---

### 6. openclaw-architecture.md - OpenClaw System Architecture

**Read this for:** Understanding what OpenClaw is and how its components work

**Key Topics:**
- What OpenClaw is (AI assistant platform)
- Two-service architecture (CLI + Gateway)
- Gateway API commands and device pairing system
- Configuration file structure (`~/.openclaw/openclaw.json`)
- Onboarding process internals
- Container architecture and security
- Service communication patterns
- Health checks and monitoring

**When to read:**
- Understanding what clawctl deploys
- Working with auto-connect or pairing features
- Implementing gateway interactions
- Debugging OpenClaw service issues
- Understanding onboarding wizard
- Working with OpenClaw configuration

---

### 7. testing-guide.md - Testing and Development Guide

**Read this for:** How to safely test clawctl changes

**Key Topics:**
- Development environment setup
- Test server setup (VPS providers, snapshots)
- Testing workflows (full deployment, individual phases)
- Debugging techniques (verbose mode, state inspection)
- Testing idempotency and resume capability
- Platform-specific testing (WSL, macOS, Linux)
- Testing checklists and scenarios
- Best practices for safe testing

**When to read:**
- Before implementing new features
- Testing bug fixes
- Setting up development environment
- Understanding how to debug deployments
- Learning testing workflows
- Preparing for release

---

### 8. troubleshooting-guide.md - Deployment Troubleshooting

**Read this for:** Diagnosing and fixing deployment failures

**Key Topics:**
- Quick diagnosis table (symptom → solution)
- Phase-by-phase troubleshooting (all 11 phases)
- Common error categories and solutions
- Recovery strategies (--force, --clean, manual cleanup)
- State file manipulation
- Platform-specific issues
- Debugging commands and techniques
- When to seek help

**When to read:**
- Deployment fails or hangs
- Errors during any phase
- Recovering from failed deployment
- Understanding error messages
- Learning what can go wrong
- Supporting users with issues

---

## Topic Index (Alphabetical)

Quickly find where specific topics are covered:

| Topic | Primary Location | Section/Phase |
|-------|------------------|---------------|
| **Ansible (old approach)** | deployment-workflow.md | Entire document |
| **Architecture (modules)** | clawctl-spec.md | Architecture section |
| **Architecture (OpenClaw)** | openclaw-architecture.md | Architecture Overview |
| **Artifacts (instances/)** | clawctl-cli-spec.md | Instance Artifacts |
| **Auto-connect feature** | clawctl-spec.md | Auto-Connect to Dashboard |
| **Browser opening** | clawctl-spec.md | Auto-Connect section |
| **Debugging deployments** | testing-guide.md | Debugging Techniques |
| **Debugging techniques** | troubleshooting-guide.md | General Troubleshooting |
| **Development workflow** | testing-guide.md | Testing Workflow |
| **Device pairing** | openclaw-architecture.md | Device Pairing System |
| **CLI commands** | clawctl-cli-spec.md | All command sections |
| **Configuration files** | clawctl-cli-spec.md | Configuration section |
| **Container user (non-root)** | docker-openclaw.md | Security Considerations |
| **Dependencies (npm)** | clawctl-spec.md | Dependencies section |
| **Deployment modes** | docker-openclaw.md | Deployment Modes |
| **Deployment phases** | clawctl-spec.md | Deployment Flow (Phases 0-10) |
| **Docker Compose** | docker-openclaw.md | Docker Compose Configuration |
| **Docker installation** | clawctl-spec.md | Phase 3: Install Docker |
| **.env file** | clawctl-spec.md | Phase 7: Upload Docker Compose |
| **Environment variables** | clawctl-cli-spec.md | Configuration > Env Vars |
| **Error handling** | clawctl-spec.md | Error Handling section |
| **Error messages** | clawctl-cli-spec.md | Error Handling section |
| **Error recovery** | clawctl-spec.md | Idempotency & Error Recovery |
| **ES Modules** | clawctl-spec.md | Package Structure |
| **Exit codes** | clawctl-cli-spec.md | Per-command sections |
| **Flags (CLI)** | clawctl-cli-spec.md | Per-command options |
| **Gateway API** | openclaw-architecture.md | Gateway Service Details |
| **Gateway operations** | clawctl-cli-spec.md | Gateway Operations |
| **Health checks** | docker-openclaw.md | Container Architecture |
| **Idempotency** | clawctl-spec.md | Idempotency & Error Recovery |
| **Image building** | docker-openclaw.md | Image Build & Registry |
| **Instance management** | clawctl-cli-spec.md | Instance Management |
| **Naming conventions** | clawctl-cli-spec.md | deploy command |
| **Node.js (why?)** | clawctl-strategy.md | Motivation |
| **Onboarding internals** | openclaw-architecture.md | CLI Service Details |
| **Onboarding wizard** | clawctl-spec.md | Phase 8: Interactive Onboarding |
| **OpenClaw (what is it)** | openclaw-architecture.md | Overview |
| **OpenClaw CLI service** | openclaw-architecture.md | CLI Service Details |
| **OpenClaw Gateway service** | openclaw-architecture.md | Gateway Service Details |
| **Pairing auto-approval** | clawctl-spec.md | Auto-Connect section |
| **Phases (deployment)** | clawctl-spec.md | Deployment Flow |
| **PTY sessions** | clawctl-spec.md | SSH Operations > PTY |
| **Registry (Docker)** | docker-openclaw.md | Image Build & Registry |
| **Resume deployment** | clawctl-spec.md | Resume Detection Strategy |
| **Root SSH access** | clawctl-spec.md | Phase 1: SSH Connection |
| **roboclaw user** | clawctl-spec.md | Phase 4: Setup Deployment User |
| **Security** | docker-openclaw.md | Security Considerations |
| **SFTP upload** | clawctl-spec.md | SSH Operations > File Upload |
| **SSH operations** | clawctl-spec.md | SSH Operations section |
| **SSH tunnel** | clawctl-spec.md | Auto-Connect section |
| **State file** | clawctl-spec.md | Resume Detection Strategy |
| **Strategy** | clawctl-strategy.md | Entire document |
| **Template literals** | clawctl-spec.md | Phase 7: Upload Docker Compose |
| **Test server setup** | testing-guide.md | Test Server Setup |
| **Testing** | testing-guide.md | Entire document |
| **Troubleshooting** | troubleshooting-guide.md | Entire document |
| **TypeScript** | clawctl-spec.md | Package Structure |
| **UID/GID handling** | clawctl-spec.md | Phase 4: Setup Deployment User |
| **User setup** | clawctl-spec.md | Phase 4: Setup Deployment User |
| **Variable substitution** | clawctl-spec.md | Phase 7: Upload Docker Compose |
| **Volumes (Docker)** | docker-openclaw.md | Volume Mappings |

---

## Query Pattern Examples

Here are example user queries mapped to which spec(s) to read:

### Query: "How does the deployment work?"
**Read:** clawctl-spec.md (Deployment Flow)
**Reasoning:** Detailed phase-by-phase breakdown of entire process

### Query: "What CLI flags are available?"
**Read:** clawctl-cli-spec.md (Deployment Commands)
**Reasoning:** Complete list of options for each command

### Query: "How do I configure default SSH keys?"
**Read:** clawctl-cli-spec.md (Configuration section)
**Reasoning:** Covers config files, env vars, and hierarchy

### Query: "Why did we switch from Ansible to Node.js?"
**Read:** clawctl-strategy.md (Motivation)
**Reasoning:** Strategic reasoning for the transition

### Query: "How do Docker Compose variables work?"
**Read:** clawctl-spec.md (Phase 7: Upload Docker Compose)
**Also:** docker-openclaw.md (Docker Compose Configuration)
**Reasoning:** Technical details in spec, architecture in docker doc

### Query: "What happens if deployment fails?"
**Read:** clawctl-spec.md (Idempotency & Error Recovery)
**Reasoning:** Complete error recovery and resume strategy

### Query: "How do I build a custom OpenClaw image?"
**Read:** docker-openclaw.md (Image Build & Registry)
**Reasoning:** Build scripts and vetting workflow

### Query: "What's the difference between development and production modes?"
**Read:** docker-openclaw.md (Deployment Modes)
**Reasoning:** Mode comparison table and usage examples

### Query: "How does the auto-connect feature work?"
**Read:** clawctl-spec.md (Auto-Connect to Dashboard)
**Also:** clawctl-cli-spec.md (deploy --no-auto-connect)
**Reasoning:** Implementation details in spec, CLI usage in cli-spec

### Query: "Where are instance artifacts stored?"
**Read:** clawctl-cli-spec.md (Instance Artifacts)
**Reasoning:** Location, schema, and resolution order

### Query: "How do I run OpenClaw commands on an instance?"
**Read:** clawctl-cli-spec.md (OpenClaw Operations)
**Reasoning:** exec, onboard, and shell commands

### Query: "What user does the container run as?"
**Read:** docker-openclaw.md (Security Considerations)
**Also:** clawctl-spec.md (Phase 4: Setup Deployment User)
**Reasoning:** Security context in docker doc, implementation in spec

### Query: "How do I configure multiple instances?"
**Read:** clawctl-cli-spec.md (Configuration > Instance-Specific)
**Reasoning:** Per-instance configuration examples

### Query: "What modules are in the codebase?"
**Read:** clawctl-spec.md (Architecture > Module Responsibilities)
**Reasoning:** Complete module breakdown with responsibilities

### Query: "How do I skip onboarding?"
**Read:** clawctl-cli-spec.md (deploy command, --skip-onboard)
**Also:** clawctl-spec.md (Phase 8: Interactive Onboarding)
**Reasoning:** CLI flag in cli-spec, implementation in spec

### Query: "What is OpenClaw and how does it work?"
**Read:** openclaw-architecture.md (Overview)
**Reasoning:** Comprehensive explanation of OpenClaw system

### Query: "How does device pairing work in the gateway?"
**Read:** openclaw-architecture.md (Device Pairing System)
**Also:** clawctl-spec.md (Auto-Connect to Dashboard)
**Reasoning:** Pairing internals in architecture spec, auto-approval in clawctl spec

### Query: "How do I test my clawctl changes safely?"
**Read:** testing-guide.md (Testing Workflow)
**Reasoning:** Complete testing workflow and best practices

### Query: "My deployment failed at Phase 3, how do I fix it?"
**Read:** troubleshooting-guide.md (Phase 3: Install Docker)
**Also:** testing-guide.md (Debugging Techniques)
**Reasoning:** Specific phase troubleshooting in guide, debugging strategies in testing

### Query: "What Gateway API commands are available?"
**Read:** openclaw-architecture.md (Gateway Service Details)
**Reasoning:** Complete Gateway API reference

### Query: "How do I set up a test VPS for development?"
**Read:** testing-guide.md (Test Server Setup)
**Reasoning:** VPS providers, setup instructions, and snapshots

### Query: "Deployment hangs during onboarding, what should I do?"
**Read:** troubleshooting-guide.md (Phase 8: Onboarding)
**Also:** openclaw-architecture.md (CLI Service Details)
**Reasoning:** Troubleshooting in guide, onboarding internals in architecture

---

## Reading Strategy for Common Tasks

### Task: Implementing a new deployment phase
1. **Start:** clawctl-spec.md (Deployment Flow)
2. **Check:** Idempotency section for per-phase checks
3. **Reference:** Module Responsibilities for which modules to use

### Task: Adding a new CLI command
1. **Start:** clawctl-cli-spec.md (Command Structure)
2. **Check:** Existing commands for patterns
3. **Reference:** clawctl-spec.md (Architecture) for modules to use

### Task: Debugging deployment failure
1. **Start:** troubleshooting-guide.md (Quick Diagnosis)
2. **Check:** Phase-specific troubleshooting for your phase
3. **Reference:** clawctl-spec.md (Error Handling) for implementation details

### Task: Understanding Docker setup
1. **Start:** docker-openclaw.md (Architecture Overview)
2. **Check:** Deployment Modes section
3. **Reference:** clawctl-spec.md (Phase 6-7) for implementation

### Task: Working with configuration
1. **Start:** clawctl-cli-spec.md (Configuration section)
2. **Check:** Environment Variables subsection
3. **Reference:** clawctl-spec.md (src/lib/config.ts) for module details

### Task: Understanding project direction
1. **Start:** clawctl-strategy.md (Vision)
2. **Check:** Design Principles
3. **Reference:** clawctl-spec.md for current implementation

### Task: Understanding OpenClaw architecture
1. **Start:** openclaw-architecture.md (Overview)
2. **Check:** Service architecture diagrams
3. **Reference:** docker-openclaw.md for containerization details

### Task: Testing a new feature
1. **Start:** testing-guide.md (Testing Workflow)
2. **Check:** Testing Specific Features section
3. **Reference:** troubleshooting-guide.md for what could go wrong

### Task: Recovering from deployment failure
1. **Start:** troubleshooting-guide.md (General Troubleshooting Steps)
2. **Check:** Specific phase troubleshooting
3. **Reference:** testing-guide.md (Debugging Techniques) for inspection commands

---

## Document Maintenance

**When to update this primer:**
- New spec file added → Add to Overview section
- Major feature implemented → Update Quick Routing Table
- Common query patterns emerge → Add to Query Pattern Examples
- Topic coverage changes → Update Topic Index

**Verification checklist:**
- [x] All 8 spec files represented in Overview
- [x] Routing table covers major query categories
- [x] Topic index is alphabetically sorted
- [x] Query examples map to correct specs
- [x] Cross-references are accurate

---

## Related Files

- **Specifications:**
  - `clawctl-spec.md` - Technical implementation
  - `clawctl-cli-spec.md` - CLI interface
  - `docker-openclaw.md` - Docker containerization
  - `clawctl-strategy.md` - Strategic direction
  - `deployment-workflow.md` - Legacy Ansible approach
  - `openclaw-architecture.md` - OpenClaw system architecture
  - `testing-guide.md` - Testing and development guide
  - `troubleshooting-guide.md` - Deployment troubleshooting

- **Memory:**
  - `~/.claude/projects/-home-justin-Documents-RoboClaw/memory/MEMORY.md` - Project memory notes

- **Code:**
  - `src/` - TypeScript source files
  - `dist/` - Compiled JavaScript (gitignored)

---

**Document Status:** Active
**Last Review:** 2026-02-05
**Next Review:** When new specs are added or major features change
