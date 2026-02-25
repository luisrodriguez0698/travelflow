import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe ser una cadena hex de 64 caracteres (32 bytes). Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a plain text string.
 * Returns a string with format: enc:{iv}.{authTag}.{ciphertext} (all hex)
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted}`;
}

/**
 * Decrypts a value encrypted with encrypt().
 * If the value does NOT start with "enc:" (legacy plain text), returns it as-is.
 * This allows backwards compatibility during migration.
 */
export function decrypt(value: string): string {
  if (!value || !value.startsWith('enc:')) return value; // plain text (legacy)

  const key = getKey();
  const parts = value.slice(4).split('.');
  if (parts.length !== 3) throw new Error('Formato de valor cifrado inválido');

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Returns true if the value is already encrypted */
export function isEncrypted(value: string): boolean {
  return value?.startsWith('enc:') ?? false;
}
