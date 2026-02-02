import { generateKeyPairSync, KeyObject } from 'crypto'
import type { SSHKeypair } from './types'

/**
 * Generates an Ed25519 SSH keypair in OpenSSH format
 * Uses crypto's built-in OpenSSH support
 */
export function generateOpenSSHKeypair(): SSHKeypair {
  // Generate with both keys - private in OpenSSH format, public in DER for conversion
  const pair = generateKeyPairSync('ed25519', {
    privateKeyEncoding: {
      type: 'openssh',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'der',
    },
  })

  const privateKey = pair.privateKey as unknown as string
  const publicKeyDer = pair.publicKey as unknown as Buffer

  // Convert DER public key to OpenSSH format
  const rawKey = publicKeyDer.subarray(12) // Skip ASN.1 header

  const keyTypeBuffer = Buffer.from('ssh-ed25519')
  const keyTypeLength = Buffer.allocUnsafe(4)
  keyTypeLength.writeUInt32BE(keyTypeBuffer.length, 0)

  const keyLength = Buffer.allocUnsafe(4)
  keyLength.writeUInt32BE(rawKey.length, 0)

  const wireFormat = Buffer.concat([
    keyTypeLength,
    keyTypeBuffer,
    keyLength,
    rawKey,
  ])

  const opensshPublicKey = `ssh-ed25519 ${wireFormat.toString('base64')} roboclaw-deploy@generated`

  return {
    privateKey,
    publicKey: opensshPublicKey,
  }
}
