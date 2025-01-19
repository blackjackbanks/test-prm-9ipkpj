/**
 * @fileoverview Enterprise-grade validation utilities with WCAG 2.1 AA compliance
 * @version 1.0.0
 */

import { EMAIL_REGEX, PASSWORD_REGEX, INPUT_LENGTH_LIMITS, VALIDATION_MESSAGES } from '../constants/validation';
import { ApiError } from '../types/common';
import isEmail from 'validator/lib/isEmail'; // v13.9.0
import xss from 'xss'; // v1.0.14
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'; // v1.10.37

/**
 * Interface for validation results with accessibility support
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  details?: Record<string, unknown>;
  ariaMessage?: string;
}

/**
 * Options for input sanitization
 */
interface SanitizeOptions {
  allowedTags?: string[];
  stripIgnoreTag?: boolean;
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
}

/**
 * Enhanced validation error class with detailed error information
 */
export class ValidationError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly category: string;
  public readonly timestamp: Date;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    details: Record<string, unknown> = {},
    category = 'validation'
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
    this.category = category;
    this.timestamp = new Date();
    Error.captureStackTrace(this, ValidationError);
  }

  /**
   * Formats error for screen readers
   */
  public getAccessibleMessage(): string {
    return `Error: ${this.message}. Please review and correct the input.`;
  }
}

/**
 * Validates email format with enhanced security checks
 * @param email - Email address to validate
 * @returns Validation result with accessibility support
 */
export function validateEmail(email: string): ValidationResult {
  const sanitizedEmail = sanitizeInput(email);
  const errors: string[] = [];

  // Check for empty input
  if (!sanitizedEmail) {
    errors.push(VALIDATION_MESSAGES.required);
    return {
      isValid: false,
      errors,
      ariaMessage: VALIDATION_MESSAGES.required
    };
  }

  // Check length constraints
  if (sanitizedEmail.length > INPUT_LENGTH_LIMITS.email) {
    errors.push(VALIDATION_MESSAGES.maxLength.replace('{limit}', INPUT_LENGTH_LIMITS.email.toString()));
  }

  // Validate format using multiple checks
  const isValidFormat = EMAIL_REGEX.test(sanitizedEmail) && isEmail(sanitizedEmail);
  if (!isValidFormat) {
    errors.push(VALIDATION_MESSAGES.email);
  }

  return {
    isValid: errors.length === 0,
    errors,
    details: {
      emailLength: sanitizedEmail.length,
      formatValid: isValidFormat
    },
    ariaMessage: errors.join(' ')
  };
}

/**
 * Validates password strength with comprehensive security checks
 * @param password - Password to validate
 * @returns Validation result with accessibility support
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  // Check for empty input
  if (!password) {
    errors.push(VALIDATION_MESSAGES.required);
    return {
      isValid: false,
      errors,
      ariaMessage: VALIDATION_MESSAGES.required
    };
  }

  // Check length constraints
  if (password.length > INPUT_LENGTH_LIMITS.password) {
    errors.push(VALIDATION_MESSAGES.maxLength.replace('{limit}', INPUT_LENGTH_LIMITS.password.toString()));
  }
  if (password.length < 8) {
    errors.push(VALIDATION_MESSAGES.minLength.replace('{limit}', '8'));
  }

  // Validate against password regex
  if (!PASSWORD_REGEX.test(password)) {
    errors.push(VALIDATION_MESSAGES.password);
  }

  return {
    isValid: errors.length === 0,
    errors,
    details: {
      passwordLength: password.length,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[@$!%*?&]/.test(password)
    },
    ariaMessage: errors.join(' ')
  };
}

/**
 * Sanitizes user input against XSS and injection attacks
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitized input string
 */
export function sanitizeInput(input: string, options: SanitizeOptions = {}): string {
  if (!input) return '';

  const defaultOptions: SanitizeOptions = {
    allowedTags: [],
    stripIgnoreTag: true,
    allowedAttributes: {},
    maxLength: INPUT_LENGTH_LIMITS.content
  };

  const sanitizeOptions = { ...defaultOptions, ...options };

  // Apply XSS sanitization
  let sanitized = xss(input, {
    whiteList: sanitizeOptions.allowedTags?.reduce((acc, tag) => ({ ...acc, [tag]: [] }), {}),
    stripIgnoreTag: sanitizeOptions.stripIgnoreTag,
    css: false
  });

  // Trim and enforce length limit
  sanitized = sanitized.trim();
  if (sanitizeOptions.maxLength) {
    sanitized = sanitized.slice(0, sanitizeOptions.maxLength);
  }

  return sanitized;
}

/**
 * Validates phone number format using libphonenumber-js
 * @param phone - Phone number to validate
 * @param countryCode - Optional ISO country code
 * @returns Validation result with accessibility support
 */
export function validatePhoneNumber(phone: string, countryCode?: string): ValidationResult {
  const sanitizedPhone = sanitizeInput(phone);
  const errors: string[] = [];

  if (!sanitizedPhone) {
    errors.push(VALIDATION_MESSAGES.required);
    return {
      isValid: false,
      errors,
      ariaMessage: VALIDATION_MESSAGES.required
    };
  }

  try {
    const phoneNumber = parsePhoneNumber(sanitizedPhone, countryCode);
    const isValid = phoneNumber && isValidPhoneNumber(sanitizedPhone, countryCode);

    if (!isValid) {
      errors.push(VALIDATION_MESSAGES.invalidPhone);
    }

    return {
      isValid: errors.length === 0,
      errors,
      details: {
        countryCode: phoneNumber?.country,
        nationalNumber: phoneNumber?.nationalNumber,
        isValid
      },
      ariaMessage: errors.join(' ')
    };
  } catch (error) {
    errors.push(VALIDATION_MESSAGES.invalidPhone);
    return {
      isValid: false,
      errors,
      details: { error: error.message },
      ariaMessage: VALIDATION_MESSAGES.invalidPhone
    };
  }
}