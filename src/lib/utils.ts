import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Helper to retry an async function with exponential backoff.
 * Useful for handling rate limits (429) or temporary network issues.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryOn?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    retryOn = (error: any) => {
      // Default retry on 429 (Rate Limit), network errors, or quota issues
      const status = error?.status || error?.response?.status;
      const message = error?.message?.toLowerCase() || '';
      return status === 429 || 
             message.includes('quota') || 
             message.includes('rate limit') || 
             message.includes('fetch') ||
             message.includes('aborted') ||
             message.includes('network');
    }
  } = options;

  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !retryOn(error)) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s... up to maxDelay
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      console.warn(`[Retry] Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Converts a sequence number (1, 2, 3...) to a Google Maps letter (B, C, D...).
 * Origin (Hub) is always 'A'.
 * Stop 1 = 'B', Stop 2 = 'C', ..., Stop 25 = 'Z', Stop 26 = 'AA', etc.
 */
export function getGoogleMapsLetter(sequenceNumber: number): string {
  // Google Maps starts with A as the origin.
  // So Stop 1 is the 2nd point (index 1).
  const index = sequenceNumber; 
  let letter = '';
  let tempIndex = index;

  while (tempIndex >= 0) {
    letter = String.fromCharCode(65 + (tempIndex % 26)) + letter;
    tempIndex = Math.floor(tempIndex / 26) - 1;
  }
  return letter;
}
