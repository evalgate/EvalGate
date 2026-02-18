// src/lib/security/encryption.ts
import crypto, { createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption utilities for secure key storage.
 * Provides encryption/decryption for sensitive data like API keys.
 */

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface DecryptionResult {
  decrypted: string;
  success: boolean;
  error?: string;
}

/**
 * AES-256-GCM encryption class.
 * Uses Node.js crypto module for secure encryption operations.
 */
export class AESEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits = 32 bytes

  /**
   * Generate a random encryption key.
   * @returns Base64 encoded 256-bit key
   */
  generateKey(): string {
    return randomBytes(this.keyLength).toString('base64');
  }

  /**
   * Generate a random initialization vector.
   * @returns Base64 encoded 96-bit IV
   */
  generateIV(): string {
    return randomBytes(12).toString('base64'); // 96 bits for GCM
  }

  /**
   * Encrypt data using AES-256-GCM.
   * @param data - Plain text data to encrypt
   * @param key - Base64 encoded encryption key
   * @returns Encrypted data with IV and authentication tag
   */
  encrypt(data: string, key: string): EncryptionResult {
    try {
      const keyBuffer = Buffer.from(key, 'base64');
      const iv = this.generateIV();
      const ivBuffer = Buffer.from(iv, 'base64');

      const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, ivBuffer);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv,
        tag: tag.toString('base64'),
      };
    } catch (error: unknown) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM.
   * @param encryptedData - Encrypted data object
   * @param key - Base64 encoded encryption key
   * @returns Decrypted plain text data
   */
  decrypt(encryptedData: EncryptionResult, key: string): DecryptionResult {
    try {
      const keyBuffer = Buffer.from(key, 'base64');
      const ivBuffer = Buffer.from(encryptedData.iv, 'base64');
      const tagBuffer = Buffer.from(encryptedData.tag, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, ivBuffer);
      
      decipher.setAuthTag(tagBuffer);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        decrypted,
        success: true,
      };
    } catch (error: unknown) {
      return {
        decrypted: '',
        success: false,
        error: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Encrypt JSON object.
   * @param obj - Object to encrypt
   * @param key - Base64 encoded encryption key
   * @returns Encrypted JSON string with IV and tag
   */
  encryptJSON(obj: any, key: string): string {
    const jsonString = JSON.stringify(obj);
    const result = this.encrypt(jsonString, key);
    
    // Combine all parts into a single string for storage
    return JSON.stringify({
      encrypted: result.encrypted,
      iv: result.iv,
      tag: result.tag,
    });
  }

  /**
   * Decrypt JSON object.
   * @param encryptedJSON - Encrypted JSON string
   * @param key - Base64 encoded encryption key
   * @returns Decrypted object
   */
  decryptJSON<T = any>(encryptedJSON: string, key: string): T | null {
    try {
      const encryptedData = JSON.parse(encryptedJSON);
      const result = this.decrypt(encryptedData, key);
      
      if (!result.success) {
        return null;
      }
      
      return JSON.parse(result.decrypted);
    } catch {
      return null;
    }
  }

  /**
   * Generate a secure hash for key derivation.
   * @param input - Input string to hash
   * @param salt - Optional salt for additional security
   * @returns SHA-256 hash
   */
  hash(input: string, salt?: string): string {
    return createHash('sha256')
      .update(input)
      .update(salt || '')
      .digest('hex');
  }

  /**
   * Generate a key from password using PBKDF2.
   * @param password - Plain text password
   * @param salt - Salt for key derivation
   * @param iterations - Number of PBKDF2 iterations (default: 100000)
   * @returns Derived key
   */
  deriveKey(password: string, salt: string, iterations: number = 100000): string {
    const key = crypto.pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha256');
    return key.toString('base64');
  }
}

// Singleton instance
export const encryption = new AESEncryption();

/**
 * Convenience functions for common encryption operations.
 */
export const encryptData = (data: string, key: string): EncryptionResult => {
  return encryption.encrypt(data, key);
};

export const decryptData = (encryptedData: EncryptionResult, key: string): DecryptionResult => {
  return encryption.decrypt(encryptedData, key);
};

export const encryptJSON = <T>(obj: T, key: string): string => {
  return encryption.encryptJSON(obj, key);
};

export const decryptJSON = <T>(encryptedJSON: string, key: string): T | null => {
  return encryption.decryptJSON<T>(encryptedJSON, key);
};

/**
 * Key management utilities.
 */
export class KeyManager {
  /**
   * Generate a secure random key with metadata.
   */
  static generateKey(): { keyId: string; key: string; createdAt: string; algorithm: string } {
    const key = encryption.generateKey();
    const keyId = encryption.hash(key, Date.now().toString()).substring(0, 16);
    
    return {
      keyId,
      key,
      createdAt: new Date().toISOString(),
      algorithm: 'aes-256-gcm',
    };
  }

  /**
   * Validate key format.
   */
  static validateKey(key: string): boolean {
    try {
      const buffer = Buffer.from(key, 'base64');
      return buffer.length === 32; // 256 bits
    } catch {
      return false;
    }
  }

  /**
   * Generate a key fingerprint for comparison.
   */
  static fingerprint(key: string): string {
    return encryption.hash(key);
  }

  /**
   * Check if two keys are identical.
   */
  static keysMatch(key1: string, key2: string): boolean {
    return this.fingerprint(key1) === this.fingerprint(key2);
  }
}

/**
 * Secure random utilities.
 */
export class SecureRandom {
  /**
   * Generate a cryptographically secure random string.
   * @param length - Length of the string
   * @param charset - Character set to use (default: alphanumeric)
   * @returns Random string
   */
  static string(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    const chars = charset;
    let result = '';
    const bytes = randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    
    return result;
  }

  /**
   * Generate a UUID v4.
   */
  static uuid(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a secure token.
   * @param length - Token length (default: 32)
   * @returns Secure random token
   */
  static token(length: number = 32): string {
    return this.string(length);
  }

  /**
   * Generate a secure random number.
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns Random number
   */
  static integer(min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
    const bytes = crypto.randomBytes(4);
    const randomValue = bytes.readUInt32BE(0, false);
    return min + (randomValue % (max - min));
  }
}

/**
 * Password utilities.
 */
export class PasswordUtils {
  /**
   * Generate a strong password.
   * @param length - Password length (default: 16)
   * @param includeSymbols - Include special characters (default: true)
   * @returns Strong password
   */
  static generate(length: number = 16, includeSymbols: boolean = true): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let charset = lowercase + uppercase + numbers;
    if (includeSymbols) {
      charset += symbols;
    }
    
    const password = SecureRandom.string(length, charset);
    
    // Ensure password has at least one character from each required category
    let hasLowercase = /[a-z]/.test(password);
    let hasUppercase = /[A-Z]/.test(password);
    let hasNumbers = /\d/.test(password);
    let hasSymbols = includeSymbols ? /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) : true;
    
    // If missing required characters, regenerate
    if (!hasLowercase || !hasUppercase || !hasNumbers || (includeSymbols && !hasSymbols)) {
      return this.generate(length, includeSymbols);
    }
    
    return password;
  }

  /**
   * Check password strength.
   * @param password - Password to check
   * @returns Strength score (0-4)
   */
  static strength(password: string): 0 | 1 | 2 | 3 | 4 {
    let score = 0;
    
    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    
    // Character variety check
    if (/[a-z]/.test(password)) score++; // lowercase
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/\d/.test(password)) score++; // numbers
    if (/[^a-zA-Z0-9]/.test(password)) score++; // symbols
    
    return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  }
}
