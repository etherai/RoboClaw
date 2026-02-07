# Ansible Deployment (Deprecated)

⚠️ **This deployment system is deprecated and no longer maintained.**

## Use clawctl Instead

The Python/Ansible-based deployment system in this directory has been replaced by **clawctl**, a modern Node.js CLI tool that provides:

- One-command deployment (`npx clawctl deploy <IP> --key <path>`)
- Zero local setup (no Python/Ansible installation needed)
- Automatic error recovery and resume capability
- Better error messages and debugging output

## Migration

Instead of:
```bash
./cli/setup.sh
./cli/create-inventory.sh 192.168.1.100 prod.ini
./cli/run-deploy.sh prod.ini
```

Use:
```bash
npx clawctl deploy 192.168.1.100 --key ~/.ssh/mykey
```

## Documentation

See the [clawctl README](../clawctl/README.md) for complete documentation on the new deployment system.

---

**Note:** This directory is preserved for historical reference only. All new deployments should use clawctl.
