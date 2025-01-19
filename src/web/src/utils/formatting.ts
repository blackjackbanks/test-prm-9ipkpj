/**
 * Utility functions for formatting data values, dates, numbers, and text
 * with comprehensive input validation, error handling, and performance optimizations.
 * @version 1.0.0
 */

import { format, formatDistance } from 'date-fns'; // v2.30.0
import { BaseModel } from '../types/common';

// Cache for number formatters to improve performance
const numberFormatCache: Record<string, Intl.NumberFormat> = {};

/**
 * Formats a date string or Date object into localized display format
 * @param date - Date to format
 * @param formatString - Format string (e.g. 'yyyy-MM-dd')
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: Date | string | null | undefined,
  formatString: string
): string => {
  try {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Formats a date relative to current time (e.g. "2 hours ago")
 * @param date - Date to format
 * @returns Relative time string or empty string if invalid
 */
export const formatRelativeTime = (
  date: Date | string | null | undefined
): string => {
  try {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return '';
    
    return formatDistance(dateObj, new Date(), { addSuffix: true });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
};

/**
 * Formats a number as currency with proper localization
 * @param amount - Amount to format
 * @param currency - Currency code (e.g. 'USD')
 * @returns Formatted currency string or '0.00' if invalid
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currency: string
): string => {
  try {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }

    const cacheKey = `currency-${currency}`;
    if (!numberFormatCache[cacheKey]) {
      numberFormatCache[cacheKey] = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    return numberFormatCache[cacheKey].format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return '0.00';
  }
};

/**
 * Formats a number with proper localization and precision
 * @param value - Number to format
 * @param precision - Number of decimal places
 * @returns Formatted number string or '0' if invalid
 */
export const formatNumber = (
  value: number | null | undefined,
  precision: number = 0
): string => {
  try {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }

    const cacheKey = `number-${precision}`;
    if (!numberFormatCache[cacheKey]) {
      numberFormatCache[cacheKey] = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
    }

    return numberFormatCache[cacheKey].format(value);
  } catch (error) {
    console.error('Error formatting number:', error);
    return '0';
  }
};

/**
 * Formats a decimal number as a percentage
 * @param value - Decimal value to format (e.g. 0.15 for 15%)
 * @param precision - Number of decimal places
 * @returns Formatted percentage string or '0%' if invalid
 */
export const formatPercentage = (
  value: number | null | undefined,
  precision: number = 0
): string => {
  try {
    if (value === null || value === undefined || isNaN(value)) {
      return '0%';
    }

    const percentValue = value * 100;
    const cacheKey = `percent-${precision}`;
    
    if (!numberFormatCache[cacheKey]) {
      numberFormatCache[cacheKey] = new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
    }

    return numberFormatCache[cacheKey].format(value);
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '0%';
  }
};

/**
 * Truncates text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated text string or empty string if invalid
 */
export const truncateText = (
  text: string | null | undefined,
  maxLength: number
): string => {
  try {
    if (!text || maxLength <= 0) return '';
    
    if (text.length <= maxLength) return text;
    
    const ellipsis = '...';
    const truncateLength = maxLength - ellipsis.length;
    
    if (truncateLength <= 0) {
      return text.slice(0, maxLength);
    }
    
    return `${text.slice(0, truncateLength)}${ellipsis}`;
  } catch (error) {
    console.error('Error truncating text:', error);
    return '';
  }
};