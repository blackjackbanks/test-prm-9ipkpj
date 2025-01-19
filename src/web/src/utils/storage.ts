/**
 * Browser storage utility module providing type-safe methods for managing local and session storage
 * with AES-256-GCM encryption support for sensitive data.
 * @version 1.0.0
 * @package crypto-js ^4.1.1
 */

import CryptoJS from 'crypto-js'; // ^4.1.1
import { ApiError } from '../types/common';

// Storage configuration constants
const STORAGE_PREFIX = 'coreos_';
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY || 'default-key';
const IV_LENGTH = 16;

// Error codes for storage operations
const STORAGE_ERROR_CODES = {
  QUOTA_EXCEEDED: 'STORAGE_001',
  ENCRYPTION_FAILED: 'STORAGE_002',
  DECRYPTION_FAILED: 'STORAGE_003'
} as const;

/**
 * Type guard to check if storage is available
 * @param storage Storage object to check
 */
const isStorageAvailable = (storage: Storage): boolean => {
  try {
    const testKey = `${STORAGE_PREFIX}test`;
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Encrypts data using AES-256-GCM encryption
 * @param data Data to encrypt
 * @throws {ApiError} If encryption fails
 */
const encryptData = (data: string): string => {
  try {
    const iv = CryptoJS.lib.WordArray.random(IV_LENGTH);
    const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY, {
      iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7
    });

    // Combine IV and ciphertext for storage
    const combined = CryptoJS.enc.Base64.stringify(iv.concat(encrypted.ciphertext));
    return combined;
  } catch (error) {
    throw {
      code: STORAGE_ERROR_CODES.ENCRYPTION_FAILED,
      message: 'Failed to encrypt data',
      details: { error },
      timestamp: new Date(),
      path: 'storage/encryptData'
    } as ApiError;
  }
};

/**
 * Decrypts AES-256-GCM encrypted data
 * @param encryptedData Encrypted data string
 * @throws {ApiError} If decryption fails
 */
const decryptData = (encryptedData: string): string => {
  try {
    const combined = CryptoJS.enc.Base64.parse(encryptedData);
    const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, IV_LENGTH / 4));
    const ciphertext = CryptoJS.lib.WordArray.create(combined.words.slice(IV_LENGTH / 4));

    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext },
      ENCRYPTION_KEY,
      { iv, mode: CryptoJS.mode.GCM, padding: CryptoJS.pad.Pkcs7 }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    throw {
      code: STORAGE_ERROR_CODES.DECRYPTION_FAILED,
      message: 'Failed to decrypt data',
      details: { error },
      timestamp: new Date(),
      path: 'storage/decryptData'
    } as ApiError;
  }
};

/**
 * Stores data in browser storage with optional encryption and type safety
 * @param key Storage key
 * @param value Value to store
 * @param encrypt Whether to encrypt the data
 * @param useSession Whether to use sessionStorage instead of localStorage
 * @throws {ApiError} If storage operation fails
 */
export const setItem = <T>(
  key: string,
  value: T,
  encrypt = false,
  useSession = false
): void => {
  const storage = useSession ? sessionStorage : localStorage;
  
  if (!isStorageAvailable(storage)) {
    throw {
      code: STORAGE_ERROR_CODES.QUOTA_EXCEEDED,
      message: 'Storage is not available',
      details: { key },
      timestamp: new Date(),
      path: 'storage/setItem'
    } as ApiError;
  }

  try {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (encrypt) {
      serializedValue = encryptData(serializedValue);
    }

    storage.setItem(prefixedKey, serializedValue);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw {
        code: STORAGE_ERROR_CODES.QUOTA_EXCEEDED,
        message: 'Storage quota exceeded',
        details: { key, error },
        timestamp: new Date(),
        path: 'storage/setItem'
      } as ApiError;
    }
    throw error;
  }
};

/**
 * Retrieves and automatically decrypts data from browser storage with type safety
 * @param key Storage key
 * @param encrypted Whether the data is encrypted
 * @param useSession Whether to use sessionStorage instead of localStorage
 * @returns Retrieved value or null if not found
 * @throws {ApiError} If retrieval or decryption fails
 */
export const getItem = <T>(
  key: string,
  encrypted = false,
  useSession = false
): T | null => {
  const storage = useSession ? sessionStorage : localStorage;
  const prefixedKey = `${STORAGE_PREFIX}${key}`;
  
  const value = storage.getItem(prefixedKey);
  if (!value) return null;

  try {
    let decryptedValue = encrypted ? decryptData(value) : value;
    
    // Attempt to parse JSON if the value is not a primitive string
    try {
      return JSON.parse(decryptedValue) as T;
    } catch {
      return decryptedValue as unknown as T;
    }
  } catch (error) {
    throw {
      code: STORAGE_ERROR_CODES.DECRYPTION_FAILED,
      message: 'Failed to retrieve or decrypt data',
      details: { key, error },
      timestamp: new Date(),
      path: 'storage/getItem'
    } as ApiError;
  }
};

/**
 * Securely removes an item from browser storage with cleanup
 * @param key Storage key
 * @param useSession Whether to use sessionStorage instead of localStorage
 */
export const removeItem = (key: string, useSession = false): void => {
  const storage = useSession ? sessionStorage : localStorage;
  const prefixedKey = `${STORAGE_PREFIX}${key}`;
  storage.removeItem(prefixedKey);
};

/**
 * Clears all application storage items with secure cleanup
 * @param useSession Whether to use sessionStorage instead of localStorage
 */
export const clearStorage = (useSession = false): void => {
  const storage = useSession ? sessionStorage : localStorage;
  
  // Only clear items with application prefix
  const keys = Object.keys(storage).filter(key => key.startsWith(STORAGE_PREFIX));
  keys.forEach(key => storage.removeItem(key));
};