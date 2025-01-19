/**
 * @fileoverview Validation constants for form validation and data sanitization
 * @version 1.0.0
 * Implements WCAG 2.1 AA compliance and robust data security measures
 */

/**
 * RFC 5322 compliant regular expression for validating email addresses
 * Handles all valid email formats including IP addresses and quoted strings
 */
export const EMAIL_REGEX = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f!#-[]-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f!-ZS-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])+)\])$/;

/**
 * Enhanced password validation regular expression
 * Requires:
 * - 8-72 characters (bcrypt max length)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (@$!%*?&)
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,72}$/;

/**
 * Maximum length limits for input fields
 * Optimized for security and usability based on common standards
 * and database field constraints
 */
export const INPUT_LENGTH_LIMITS: Record<string, number> = {
  name: 100,        // Standard name field limit
  email: 255,       // RFC 5321 email length limit
  password: 72,     // bcrypt maximum length
  description: 1000,// Standard description field
  title: 200,       // Typical title/heading length
  content: 5000,    // Long-form content limit
  comment: 500,     // Standard comment length
  url: 2083,        // Maximum URL length (IE limit)
  phone: 20,        // International phone number with symbols
  address: 300,     // Standard address field length
  searchQuery: 150, // Search query length limit
  tags: 50          // Tag/label character limit
} as const;

/**
 * Validation error messages
 * WCAG 2.1 AA compliant with clear instructions and screen reader support
 * Messages follow best practices for user experience and accessibility
 */
export const VALIDATION_MESSAGES: Record<string, string> = {
  // Required field validation
  required: "This field is required. Please provide a value.",
  
  // Format validation messages
  email: "Please enter a valid email address in the format: example@domain.com",
  password: "Password must be 8-72 characters long and include: uppercase letter, lowercase letter, number, and special character (@$!%*?&)",
  
  // Length validation messages
  maxLength: "Input exceeds maximum allowed length of {limit} characters",
  minLength: "Input must be at least {limit} characters long",
  
  // General format validation
  invalidFormat: "Please check the format and try again",
  
  // Authentication related messages
  passwordMismatch: "The passwords you entered do not match. Please try again",
  invalidCredentials: "The email or password you entered is incorrect. Please try again",
  
  // System and server errors
  serverError: "A system error occurred. Please try again or contact support if the problem persists",
  
  // Unique constraint validation
  uniqueEmail: "This email address is already registered. Please use a different email",
  
  // Specific format validation
  invalidPhone: "Please enter a valid phone number in the format: +1-234-567-8900",
  invalidUrl: "Please enter a valid URL starting with http:// or https://",
  invalidDate: "Please enter a valid date in the format: MM/DD/YYYY",
  invalidTime: "Please enter a valid time in 24-hour format: HH:MM",
  
  // File upload validation
  invalidFileType: "This file type is not supported. Please upload a {allowedTypes} file",
  invalidFileSize: "File size exceeds the maximum limit of {maxSize}MB",
  
  // Network and session errors
  networkError: "Unable to connect to the server. Please check your internet connection",
  sessionExpired: "Your session has expired. Please sign in again to continue",
  
  // Rate limiting messages
  rateLimited: "Too many attempts. Please try again in {timeLeft} minutes"
} as const;