# Prompt: Create Testing and Development Guide

## Your Task

Create a comprehensive testing and development guide at `specs/testing-guide.md` that explains how to safely test clawctl changes without breaking production systems.

## Context

You're working on the **RoboClaw** project's **clawctl** tool (Node.js/TypeScript CLI that deploys OpenClaw via SSH and Docker). Currently:

- ❌ No test infrastructure exists (no unit tests, integration tests, or test utilities)
- ❌ No documentation on how to test deployment changes safely
- ❌ No guide for setting up test environments
- ❌ Developers risk breaking production servers when testing

**Problem:** Before implementing features or fixing bugs, developers need to know:
1. How to set up a safe test environment
2. How to test individual deployment phases
3. How to verify idempotency and error recovery
4. How to debug failures effectively

## What You Need to Research

Explore the codebase to understand:

1. **Current Development Workflow:**
   - How is the CLI built? (`npm run build`, `npm run watch`)
   - How is it run locally? (`node dist/index.js`)
   - What debugging capabilities exist? (`--verbose` flag)

2. **Deployment Phases:**
   - 11 phases (0-10) in `clawctl/src/commands/deploy.ts`
   - State tracking system (`/home/roboclaw/.clawctl-deploy-state.json`)
   - Idempotency checks in each phase
   - Resume capability

3. **Testing Challenges:**
   - Requires real SSH access to a server
   - Docker installation requires root access
   - Changes are made to remote systems
   - Errors can leave system in partial state

4. **Debugging Tools:**
   - `--verbose` flag implementation in `clawctl/src/lib/logger.ts`
   - State file inspection
   - Manual SSH verification steps
   - Logger output patterns

5. **Safety Features:**
   - `--force` flag (ignore state, restart from beginning)
   - `--clean` flag (remove everything)
   - State-based resume
   - Idempotency checks

## Where to Look

**Start here:**
- `clawctl/package.json` - Build scripts and dependencies
- `clawctl/src/commands/deploy.ts` - Deployment orchestration and phases
- `clawctl/src/lib/state.ts` - State management
- `clawctl/src/lib/logger.ts` - Verbose mode and debugging output
- `clawctl/README.md` - Current usage documentation
- `specs/clawctl-spec.md` - Deployment phases and idempotency

**Also check:**
- Error handling patterns across modules
- SSH operations that could fail
- Docker commands that could fail
- State file format and location

## Document Structure

Create `specs/testing-guide.md` with these sections:

### 1. Overview
- Purpose of this guide
- Testing philosophy (fail fast, test safely, iterate quickly)
- When to test (before implementing, before merging, before releasing)

### 2. Development Environment Setup

#### Local Setup
- Prerequisites (Node.js 18+, SSH client)
- Clone and build instructions
- Running locally vs `npx`
- Development mode (`npm run watch`)

#### Test Server Setup
- Recommended providers (cheap VPS: DigitalOcean, Hetzner, Linode)
- Server specifications (Ubuntu 24.04, 1GB RAM minimum)
- SSH key setup
- Using snapshots for fast reset
- Cost considerations ($5-10/month)

### 3. Testing Workflow

#### Full Deployment Test
- Step-by-step: build, deploy to test server, verify
- Expected output at each phase
- How to verify success
- Common issues and solutions

#### Testing Individual Phases
- How to test phase in isolation
- Using state file to simulate partial completion
- Manual phase verification

#### Testing Resume/Idempotency
- How to simulate failure (kill process mid-deployment)
- Verify resume picks up where it left off
- Verify running twice doesn't break things

#### Testing Error Recovery
- Simulate common errors (network failure, permission issues)
- Verify error messages are helpful
- Verify state is left in recoverable condition

### 4. Debugging Techniques

#### Using Verbose Mode
- `--verbose` flag examples
- What verbose output shows
- How to add verbose logging to code

#### Inspecting Remote State
- SSH to server manually
- Check state file: `cat /home/roboclaw/.clawctl-deploy-state.json`
- Verify Docker containers: `docker ps`
- Check logs: `docker logs openclaw-gateway`

#### Manual Verification Steps
- Phase-by-phase verification checklist
- Docker commands to check state
- File system checks
- Process checks

#### Common Debug Scenarios
- SSH connection fails
- Docker installation hangs
- Git clone fails
- Container won't start
- Onboarding hangs

### 5. Testing Specific Features

#### Testing Auto-Connect
- How to test SSH tunnel creation
- How to test browser opening
- How to test pairing detection
- Testing `--no-auto-connect` flag

#### Testing Flags
- Testing `--force` (ignore state)
- Testing `--clean` (remove everything)
- Testing `--skip-onboard`
- Testing `--verbose`
- Testing custom names, branches, ports

#### Testing Configuration
- Environment variables
- Config files (`~/.clawctl/config.yml`)
- Instance-specific configs
- Flag precedence

### 6. Automated Testing Strategy

#### Unit Testing (Future)
- What could be unit tested (config parsing, template generation)
- Mocking SSH operations
- Testing state management logic

#### Integration Testing (Future)
- Using Docker-in-Docker for SSH server
- Automated test suite structure
- CI/CD integration

#### Current Manual Testing Checklist
- Pre-release testing checklist
- Regression testing scenarios
- Edge cases to verify

### 7. Destructive Operations

#### Using --clean Safely
- What `--clean` does
- When to use it
- Warnings and confirmations

#### Using --force Safely
- What `--force` does
- State implications
- When it's needed

#### Recovering from Mistakes
- How to manually clean up failed deployment
- Removing Docker containers/images
- Removing roboclaw user
- Resetting to clean state

### 8. Performance Testing

#### Deployment Time
- Expected time per phase
- Factors affecting speed (network, server specs)
- How to measure and profile

#### Network Usage
- What gets downloaded (Docker, git repo, images)
- Bandwidth considerations

### 9. Platform-Specific Testing

#### Testing on WSL
- SSH agent considerations
- Path handling
- Known issues

#### Testing on macOS
- SSH key permissions
- Browser opening (`open` command)

#### Testing on Linux
- Browser opening (`xdg-open` command)

### 10. Testing Checklist

Provide a comprehensive checklist for:
- [ ] Testing a new feature
- [ ] Testing a bug fix
- [ ] Pre-release testing
- [ ] Regression testing

### 11. Common Test Scenarios

Provide step-by-step instructions for:
1. **Fresh deployment test**
2. **Resume after failure test**
3. **Idempotency test (run twice)**
4. **Clean deployment test**
5. **Skip onboarding test**
6. **Custom configuration test**
7. **Error handling test**

### 12. Troubleshooting Test Failures

- Test server won't accept SSH
- Build fails locally
- Deployment hangs at specific phase
- State file corruption
- Docker issues on remote server

### 13. Best Practices

- Always test on non-production servers
- Use snapshots for quick reset
- Test both happy path and error cases
- Verify error messages are helpful
- Document new test scenarios
- Update this guide when adding features

### 14. Reference

- Build commands quick reference
- Deploy commands quick reference
- Debug commands quick reference
- Test server providers and setup links

## Style Guidelines

- **Audience:** Developers working on clawctl
- **Tone:** Practical, step-by-step, example-heavy
- **Format:** Markdown with lots of code blocks
- **Examples:** Real commands that developers can copy-paste
- **Warnings:** Highlight destructive operations clearly

## Example Section Format

```markdown
## Testing Resume Capability

### Scenario
Verify that clawctl can resume a deployment after being killed mid-process.

### Setup
1. Build the latest code:
   ```bash
   npm run build
   ```

2. Start a deployment:
   ```bash
   node dist/index.js deploy 192.168.1.100 --key ~/.ssh/test_key --verbose
   ```

3. Let it run until Phase 5 completes (watch the output)

4. Kill the process: `Ctrl+C`

### Verification
1. SSH to the server and check state:
   ```bash
   ssh root@192.168.1.100 "cat /home/roboclaw/.clawctl-deploy-state.json"
   ```

   Expected output:
   ```json
   {
     "lastCompletedPhase": 5,
     "timestamp": "2026-02-05T10:30:00Z"
   }
   ```

2. Resume the deployment:
   ```bash
   node dist/index.js deploy 192.168.1.100 --key ~/.ssh/test_key --verbose
   ```

3. Verify it continues from Phase 6 (not Phase 0)

### Expected Behavior
- Should see: "Resuming from phase 6"
- Should NOT repeat phases 0-5
- Should complete successfully

### Common Issues
- **State file not found:** Means phase 0 didn't complete
- **Resumes from wrong phase:** State file corruption, use `--force`
```

## Validation

Before considering the guide complete, verify:

- [ ] Covers both manual and automated testing approaches
- [ ] Provides practical, copy-paste-able examples
- [ ] Explains how to test all major features
- [ ] Includes debugging techniques for common issues
- [ ] Has clear testing workflow (build → test → verify)
- [ ] Explains safety features (--force, --clean)
- [ ] Platform-specific considerations covered
- [ ] Testing checklist is comprehensive

## Deliverable

Create `specs/testing-guide.md` that enables a developer to:

1. Set up a safe test environment in < 30 minutes
2. Test a new feature end-to-end confidently
3. Debug deployment failures systematically
4. Verify idempotency and error recovery
5. Know exactly what to test before releasing

The guide should be practical enough to follow step-by-step without prior knowledge of the codebase beyond reading PRIMER.md and the main specs.

---

**Note:** Since no test infrastructure currently exists, focus on manual testing workflows and suggest future automated testing strategies where appropriate.
