# LLM Navigation and Tools

This directory contains documentation and tools specifically designed for Large Language Model (LLM) agents working with the RoboClaw codebase.

**Target Audience:** AI assistants (Claude, GPT, etc.)
**Not for:** Human developers (see main `specs/` directory instead)

---

## Contents

### `NAVIGATION.md` - Spec Routing Guide

**Purpose:** Helps LLMs quickly find the right specification file(s) for any query.

**Contents:**
- Quick routing table (query type → spec file)
- Specification file overviews (all 8 specs)
- Alphabetical topic index
- Query pattern examples
- Reading strategies for common tasks

**When to use:** Start here when you need to understand the codebase or answer user questions about the project.

---

### `prompts/` - Spec Generation Prompts

**Purpose:** Self-contained prompts for regenerating specification documents.

**Files:**
- `README.md` - How to use the prompts
- `openclaw-architecture-prompt.md` - Prompt for OpenClaw architecture spec
- `testing-guide-prompt.md` - Prompt for testing guide spec
- `troubleshooting-guide-prompt.md` - Prompt for troubleshooting guide spec

**When to use:**
- A spec needs updating with new information
- A spec was accidentally deleted
- You want to generate a new spec following the same pattern

---

## Usage Flow for LLMs

```
LLM Agent starts work
    ↓
Read: CLAUDE.md (project root)
    ↓
Question or explanation needed?
    ↓
   Yes → Read: .llm/NAVIGATION.md
    |    Find relevant spec(s)
    |    Read targeted spec sections
    |    Answer user's question
    |
   No → Concrete implementation task?
    ↓
   Yes → Read code directly
    |    Implement changes
    |    Update memory if needed
    |
  Done
```

---

## File Organization

```
RoboClaw/
├── CLAUDE.md                    # Main LLM instructions (START HERE)
├── .llm/                        # LLM-specific tools (this directory)
│   ├── README.md                # This file
│   ├── NAVIGATION.md            # Spec routing guide
│   └── prompts/                 # Spec generation prompts
│       ├── README.md
│       ├── openclaw-architecture-prompt.md
│       ├── testing-guide-prompt.md
│       └── troubleshooting-guide-prompt.md
├── specs/                       # Human-readable specs
│   ├── clawctl-spec.md
│   ├── clawctl-cli-spec.md
│   ├── docker-openclaw.md
│   ├── clawctl-strategy.md
│   ├── openclaw-architecture.md
│   ├── testing-guide.md
│   ├── troubleshooting-guide.md
│   └── deployment-workflow.md
└── clawctl/                     # Source code
    └── src/
```

---

## Why This Directory Exists

### Problem
- LLM-specific documentation was mixed with human-facing documentation
- Not clear which files were designed for AI consumption
- Difficult to find LLM navigation tools

### Solution
- `.llm/` directory for LLM-specific tools (hidden from casual browsing)
- `CLAUDE.md` at root for discoverability (main entry point)
- Clear separation: `.llm/` = AI tools, `specs/` = human docs

### Benefits
- ✅ LLM tools are discoverable but not intrusive
- ✅ Follows existing patterns (`.github/`, `.claude/`, `.vscode/`)
- ✅ Easy to add more LLM tools later
- ✅ Clear purpose for each directory

---

## For Human Developers

If you're a human developer who found this directory:

**You probably want:** `specs/` directory instead
**Or:** `README.md` in the project root

This directory contains tools to help AI assistants navigate the codebase. The specs they reference are in the `specs/` directory and are perfectly readable by humans too!

---

## Maintenance

**When to update files here:**

- **NAVIGATION.md** - When new specs are added or major features change
- **prompts/** - When spec structure or content patterns evolve

**Who maintains this:**
- Project maintainers
- LLM agents (with guidance from humans)

**Last Updated:** 2026-02-05
