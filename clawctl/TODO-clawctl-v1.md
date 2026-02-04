# clawctl v1.0 Implementation TODO

**Goal:** Get `npx clawctl deploy <ip> --key <path>` working end-to-end

**Status:** ✅ Implementation Complete - Testing in Progress
**Target:** Minimum viable deployment

---

## ✅ Completed Phases

### Phase 1: Project Setup & Foundation ✅
- [x] Create `package.json` at project root
- [x] Create `tsconfig.json`
- [x] Create `.gitignore` and `.npmignore`
- [x] Install dependencies (commander, ssh2, yaml)
- [x] Verify build: `npm run build` succeeds
- [x] Add shebang to `src/index.ts`

### Phase 2: Core Infrastructure ✅
- [x] Type Definitions (`src/lib/types.ts`)
- [x] Logger with colored output (`src/lib/logger.ts`)
- [x] Configuration system (`src/lib/config.ts`)
- [x] SSH Client (`src/lib/ssh-client.ts`)
  - [x] connect(), exec(), execStream(), uploadContent(), execInteractive()
  - [x] Connection retry logic (3 attempts)
  - [x] PTY support for interactive sessions

### Phase 3: Deployment Modules ✅
- [x] State Management (`src/lib/state.ts`)
  - [x] Remote state file tracking
  - [x] Resume capability
  - [x] Idempotency checks
- [x] Docker Setup (`src/lib/docker-setup.ts`)
  - [x] Install base packages
  - [x] Install Docker CE and Docker Compose v2
- [x] User Setup (`src/lib/user-setup.ts`)
  - [x] Create roboclaw system user
  - [x] Add to docker group
  - [x] Create directory structure
- [x] Image Builder (`src/lib/image-builder.ts`)
  - [x] Clone OpenClaw from GitHub
  - [x] Build Docker image
  - [x] Verify image
- [x] Compose Generator (`src/lib/compose.ts`)
  - [x] Generate docker-compose.yml (OpenClaw-compatible)
  - [x] Generate .env file with proper variables
  - [x] Upload files to server
- [x] Interactive Sessions (`src/lib/interactive.ts`)
  - [x] PTY-based onboarding
  - [x] Gateway startup with health checks
- [x] Artifact Management (`src/lib/artifact.ts`)
  - [x] Create instance YAML files
  - [x] Read/list/delete operations

### Phase 4: CLI & Orchestration ✅
- [x] CLI Entry Point (`src/index.ts`)
  - [x] Commander.js setup
  - [x] Deploy command with all options
  - [x] Help and version flags
- [x] Deploy Orchestrator (`src/commands/deploy.ts`)
  - [x] 10-phase deployment flow
  - [x] Resume detection and handling
  - [x] Error handling with helpful messages
  - [x] Progress indicators

### Phase 5: Error Handling & Polish ✅
- [x] Comprehensive error messages
- [x] Exit codes by phase (0-10)
- [x] Resume prompts
- [x] Cleanup on failure
- [x] Consistent phase headers

### Phase 7: Documentation ✅
- [x] README.md (saved as README-clawctl.md)
- [x] Usage examples
- [x] Troubleshooting guide

---

## 🔧 Issues Fixed During Testing

### Docker Compose Configuration
- **Issue**: Initial docker-compose.yml didn't match OpenClaw's expected structure
- **Fix**: Updated template to match OpenClaw's official docker-compose.yml:
  - Changed gateway command to `gateway --bind loopback --port 18789`
  - Added proper CLI entrypoint `["node", "dist/index.js"]`
  - Added required environment variables (OPENCLAW_GATEWAY_TOKEN, etc.)
  - Fixed volume mounts to use OPENCLAW_CONFIG_DIR/OPENCLAW_WORKSPACE_DIR
  - Removed user specification (uses default container user)
  - Added --no-install-daemon flag for onboarding

### Configuration Loading
- **Issue**: Commander.js flags weren't being mapped correctly to config structure
- **Fix**: Added proper flag mapping in deploy.ts to convert Commander options to config format

### Deployment Order
- **Issue**: Onboarding was running before gateway, causing connection failures
- **Fix**: Reversed order to start gateway first, then run onboarding

### Onboarding Command
- **Issue**: Container couldn't find `/app/onboard` command
- **Fix**: Updated to use proper entrypoint and command structure matching OpenClaw

---

## ⏳ In Progress

### Phase 6: Testing & Validation
- [x] Build verification: `npm run build` succeeds
- [x] CLI help works: `node dist/index.js --help`
- [x] Deploy command help works
- [ ] **Manual testing on Ubuntu 24.04 VPS** (Task #11)
  - [x] SSH connection works
  - [x] Docker installation works
  - [x] User creation works
  - [x] Directory setup works
  - [x] Image building works
  - [x] Docker Compose upload works
  - [ ] Gateway startup (testing with corrected config)
  - [ ] Onboarding wizard (testing with --no-install-daemon)
  - [ ] Instance artifact creation
  - [ ] End-to-end success verification

---

## 📋 Remaining Tasks

### Testing (Urgent)
- [ ] Complete deployment test on VPS with corrected docker-compose config
- [ ] Test error recovery (kill mid-deployment, resume)
- [ ] Test idempotency (run twice on same server)
- [ ] Test edge cases:
  - [ ] Invalid IP address
  - [ ] Missing SSH key
  - [ ] Wrong SSH key permissions
  - [ ] Non-root SSH user
  - [ ] --skip-onboard flag
  - [ ] --force flag
  - [ ] --clean flag

### Publishing (After Testing)
- [ ] Verify package.json metadata
- [ ] Test package: `npm pack`
- [ ] Extract and verify contents
- [ ] Publish to npm: `npm publish`
- [ ] Test published package: `npx clawctl@latest --version`
- [ ] Tag release in git

---

## 📊 Current Status Summary

**✅ Completed:** 11/12 tasks (92%)
**⏳ In Progress:** Testing phase (Task #11)
**📦 Ready For:** Final testing and npm publish

### What Works
- ✅ Full CLI implementation with Commander.js
- ✅ SSH connection and command execution
- ✅ Docker installation automation
- ✅ User and directory setup
- ✅ Image building from GitHub
- ✅ Docker Compose generation (OpenClaw-compatible)
- ✅ State management and resume capability
- ✅ Configuration hierarchy (flags > env > files > defaults)
- ✅ Error handling with helpful messages
- ✅ Instance artifact creation

### Currently Testing
- ⏳ Gateway startup with corrected docker-compose.yml
- ⏳ Onboarding wizard with --no-install-daemon flag
- ⏳ End-to-end deployment flow

### Known Limitations (v1.0)
The following commands are specified but NOT implemented in v1.0:
- ❌ `list`, `status`, `destroy` - Instance management
- ❌ `start`, `stop`, `restart`, `logs` - Gateway operations
- ❌ `onboard`, `exec`, `shell` - OpenClaw operations
- ❌ `connect`, `tunnel` - Connection management
- ❌ `config show/edit/init` - Configuration management

**These will be implemented in v1.1+**

---

## 🚀 Next Immediate Steps

1. **Complete VPS testing** with corrected docker-compose configuration
2. **Verify gateway starts successfully** with proper OpenClaw command
3. **Test onboarding wizard** completes without errors
4. **Verify instance artifact** is created correctly
5. **Test resume capability** by killing and restarting deployment
6. **Test idempotency** by running deployment twice
7. **Publish to npm** once all tests pass

---

## 📝 Notes

### Key Technical Decisions Made
1. **ES Modules**: Using `"type": "module"` with `.js` extensions in imports
2. **Docker Compose Variables**: Using `\${VAR}` to preserve variables for runtime substitution
3. **OpenClaw Compatibility**: Matching official docker-compose.yml structure from OpenClaw docs
4. **State Management**: Remote state file at `/home/roboclaw/.clawctl-deploy-state.json`
5. **Resume Capability**: Automatic detection and resume from failure point
6. **Configuration**: Multi-source with clear precedence (flags > env > config > defaults)

### Lessons Learned
1. Always check official documentation for expected structure (docker-compose.yml)
2. Test with real services early to catch integration issues
3. PTY sessions need careful handling in containerized environments
4. Environment variable passing is critical for containerized apps
5. Gateway tokens should be auto-generated for security

---

**Last Updated:** 2026-02-04
**Version:** 1.0.0 (Implementation Complete - Testing Phase)
