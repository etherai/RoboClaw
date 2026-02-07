# Specification Generation Prompts

This directory contains prompts for LLM agents to generate comprehensive specification documents for the RoboClaw project.

## Overview

These prompts were created to fill documentation gaps identified during development. Each prompt is designed to be given to an LLM agent that will research the codebase and create a well-structured specification document.

## Available Prompts

### 1. `openclaw-architecture-prompt.md`
**Creates:** `specs/openclaw-architecture.md`

**Purpose:** Document what OpenClaw is and how its components (CLI service, Gateway service) work together.

**Why needed:** Current specs reference OpenClaw extensively but never explain what it actually is, its architecture, or its APIs.

**Estimated agent time:** 1-2 hours (thorough codebase exploration required)

---

### 2. `testing-guide-prompt.md`
**Creates:** `specs/testing-guide.md`

**Purpose:** Provide comprehensive guide for testing clawctl changes safely without breaking production systems.

**Why needed:** No test infrastructure or documentation exists. Developers need to know how to set up test environments and verify changes.

**Estimated agent time:** 1-2 hours (requires understanding deployment workflow)

---

### 3. `troubleshooting-guide-prompt.md`
**Creates:** `specs/troubleshooting-guide.md`

**Purpose:** Help users and developers diagnose and fix common deployment failures.

**Why needed:** When deployments fail, users need quick diagnosis and clear recovery steps. This knowledge currently exists only in code.

**Estimated agent time:** 2-3 hours (requires analyzing error paths in all phases)

---

## How to Use These Prompts

### Option 1: Sequential (Recommended)

Run agents in order of priority:

1. **First:** `openclaw-architecture-prompt.md`
   - Foundational knowledge about what's being deployed
   - Other specs may reference this

2. **Second:** `testing-guide-prompt.md`
   - Enables safe development iteration
   - References deployment phases from architecture

3. **Third:** `troubleshooting-guide-prompt.md`
   - Most comprehensive (covers all error cases)
   - Benefits from understanding built in previous specs

### Option 2: Parallel

All three prompts are self-contained and can be run simultaneously:

```bash
# Launch three separate LLM sessions with each prompt
# Each will research and create their respective spec
```

### Option 3: Human-AI Collaboration

Use prompts as outlines for collaborative doc creation:
1. Human reads the prompt
2. LLM explores codebase sections
3. Human reviews and refines output
4. Iterate until complete

---

## Providing the Prompts to LLMs

### Method 1: Direct Copy-Paste
1. Open the prompt file
2. Copy entire contents
3. Paste into LLM session
4. LLM will research and create the spec

### Method 2: File Reference (if LLM has file access)
```
Please read the prompt at specs/prompts/openclaw-architecture-prompt.md
and complete the task described.
```

### Method 3: Structured Handoff
```
I need you to create a specification document. Here's your task:

[Paste prompt contents]

You have full access to the codebase. Take your time to:
1. Read the prompt carefully
2. Explore the referenced files
3. Create the spec following the structure provided
4. Validate against the checklist

Let me know when you're ready to begin or if you have questions.
```

---

## What to Expect

### Agent Behavior

The agent should:
1. ✅ Read the prompt thoroughly
2. ✅ Explore referenced files (using Read, Grep, Glob tools)
3. ✅ Follow the document structure provided
4. ✅ Include real code examples from the codebase
5. ✅ Validate against the checklist
6. ✅ Create the spec at the specified location

### Output Quality Indicators

Good output will:
- Follow the specified document structure
- Include code examples from actual codebase
- Cross-reference other specs appropriately
- Be comprehensive (10-50 pages depending on spec)
- Include quick reference sections
- Use consistent markdown formatting

### Common Issues

**Agent skips research:**
- Prompt them: "Please explore the codebase files mentioned in the 'Where to Look' section before writing"

**Output too brief:**
- Prompt them: "This spec should be comprehensive. Please expand each section with more detail and examples"

**Generic content (not project-specific):**
- Prompt them: "Please use actual code examples from the RoboClaw codebase, not generic examples"

---

## After Spec Creation

### Review Checklist

For each generated spec:

1. **Completeness**
   - [ ] All sections from prompt are present
   - [ ] Examples use actual code from codebase
   - [ ] Cross-references are accurate
   - [ ] Validation checklist items addressed

2. **Accuracy**
   - [ ] Technical details match implementation
   - [ ] Commands are correct and tested
   - [ ] Error messages match actual codebase
   - [ ] File paths are accurate

3. **Usability**
   - [ ] Easy to navigate (good headers)
   - [ ] Quick reference sections included
   - [ ] Examples are copy-paste-able
   - [ ] Appropriate for target audience

4. **Integration**
   - [ ] Fits with existing specs
   - [ ] PRIMER.md updated with routing
   - [ ] CLAUDE.md updated if needed
   - [ ] Cross-references added to other specs

### Post-Creation Tasks

After each spec is created:

1. **Update PRIMER.md**
   ```markdown
   # Add to Quick Routing Table
   | Topic | Primary Spec | Also Check |
   | What OpenClaw is | openclaw-architecture.md | docker-openclaw.md |
   | Testing deployments | testing-guide.md | - |
   | Deployment failures | troubleshooting-guide.md | clawctl-spec.md |
   ```

2. **Update CLAUDE.md** (if needed)
   ```markdown
   # Add to "When You DON'T Have a Concrete Task" section
   - `specs/openclaw-architecture.md` - OpenClaw internals
   - `specs/testing-guide.md` - Testing workflows
   - `specs/troubleshooting-guide.md` - Error diagnosis
   ```

3. **Create TODO for examples**
   If spec includes untested examples, create TODOs:
   ```markdown
   - [ ] Test all commands in testing-guide.md on real VPS
   - [ ] Verify error messages in troubleshooting-guide.md
   - [ ] Validate Gateway API commands in openclaw-architecture.md
   ```

4. **Announce completion**
   Update project documentation:
   ```markdown
   ## Recent Updates
   - 2026-02-05: Added OpenClaw Architecture spec
   - 2026-02-05: Added Testing Guide
   - 2026-02-05: Added Troubleshooting Guide
   ```

---

## Prompt Maintenance

### When to Update Prompts

Update prompts when:
- New features are added to clawctl
- Codebase structure changes significantly
- Generated specs reveal missing guidance in prompts
- Common issues emerge that should be included

### Versioning

Prompts should include date stamps:
```markdown
**Prompt Version:** 1.0
**Last Updated:** 2026-02-05
**Codebase Version:** clawctl v1.0.1
```

---

## Success Metrics

These prompts are successful if:

1. **OpenClaw Architecture Spec:**
   - Developers understand what OpenClaw is without reading code
   - Gateway API is fully documented
   - Service interactions are clear

2. **Testing Guide:**
   - Developers can set up test environment in < 30 minutes
   - Testing workflow is clear and repeatable
   - Debugging techniques are practical

3. **Troubleshooting Guide:**
   - Users can self-diagnose 80% of issues
   - Error resolution time reduced significantly
   - Support requests include better diagnostic info

---

## Questions or Issues

If prompts need improvement:
1. Document what was unclear or missing
2. Update prompt with clarifications
3. Increment version number
4. Re-run agent if needed

---

## Related Files

- **Project instructions:** `/home/justin/Documents/RoboClaw/CLAUDE.md`
- **Spec navigation:** `/home/justin/Documents/RoboClaw/PRIMER.md`
- **Existing specs:** `/home/justin/Documents/RoboClaw/specs/*.md`
- **Codebase:** `/home/justin/Documents/RoboClaw/clawctl/src/`

---

**Last Updated:** 2026-02-05
**Prompt Set Version:** 1.0
**Status:** Ready for use
