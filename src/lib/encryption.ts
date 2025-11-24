import { createHash, createCipher, createDecipher, randomBytes } from 'crypto';

// Environment variable encryption for sensitive data
export class EnvEncryption {
  private static encryptionKey: string;

  static initialize() {
    // Use AUTH_SECRET as encryption key (in production, use a separate key)
    this.encryptionKey = process.env.AUTH_SECRET || 'default-key-for-development';
  }

  // Encrypt sensitive environment variables
  static encrypt(value: string): string {
    if (!this.encryptionKey) {
      this.initialize();
    }

    const cipher = createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  // Decrypt sensitive environment variables
  static decrypt(encryptedValue: string): string {
    if (!this.encryptionKey) {
      this.initialize();
    }

    const decipher = createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Hash sensitive data for logging (one-way)
  static hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  // Generate secure random strings
  static generateSecureString(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}

// Initialize encryption
EnvEncryption.initialize();
