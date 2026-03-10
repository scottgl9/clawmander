/**
 * DeviceIdentity - ED25519 key pair for gateway device auth.
 * Mirrors the logic in openclaw-contrib/src/infra/device-identity.ts
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IDENTITY_PATH = path.join(__dirname, '..', 'storage', 'data', 'device-identity.json');

// ED25519 SPKI prefix (12 bytes)
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64UrlEncode(buf) {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: 'spki', format: 'der' });
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem) {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

function loadOrCreate() {
  try {
    if (fs.existsSync(IDENTITY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKeyPem === 'string' &&
        typeof parsed.privateKeyPem === 'string'
      ) {
        return { deviceId: parsed.deviceId, publicKeyPem: parsed.publicKeyPem, privateKeyPem: parsed.privateKeyPem };
      }
    }
  } catch {
    // fall through to generate
  }

  const identity = generateIdentity();
  fs.mkdirSync(path.dirname(IDENTITY_PATH), { recursive: true });
  fs.writeFileSync(
    IDENTITY_PATH,
    JSON.stringify({ version: 1, ...identity, createdAtMs: Date.now() }, null, 2) + '\n',
    { mode: 0o600 }
  );
  console.log('[DeviceIdentity] Generated new device identity:', identity.deviceId);
  return identity;
}

function publicKeyRawBase64Url(publicKeyPem) {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function normalizeMetaForAuth(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/**
 * Build the v3 auth payload string to sign.
 * Format: v3|deviceId|clientId|clientMode|role|scopes_csv|signedAtMs|token|nonce|platform|deviceFamily
 */
function buildAuthPayloadV3({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce, platform, deviceFamily }) {
  return [
    'v3',
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(','),
    String(signedAtMs),
    token ?? '',
    nonce,
    normalizeMetaForAuth(platform),
    normalizeMetaForAuth(deviceFamily),
  ].join('|');
}

/**
 * Sign a payload string with the device private key. Returns base64url signature.
 */
function sign(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(sig);
}

// Load (or create) identity once at module load time
const identity = loadOrCreate();

module.exports = { identity, buildAuthPayloadV3, sign, publicKeyRawBase64Url };
