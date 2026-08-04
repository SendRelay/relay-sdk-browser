/**
 * JWT token parsing utilities
 *
 * @module utils/token
 */

import { TokenError } from '../errors';

/**
 * JWT token payload
 */
export interface JwtPayload {
	/** Subject (developer ID) */
	sub?: string;
	/** Scope (allowed resources) */
	scope?: string[];
	/** Expiration timestamp (Unix seconds) */
	exp?: number;
	/** Issued at timestamp (Unix seconds) */
	iat?: number;
	/** JWT ID */
	jti?: string;
	/** Issuer */
	iss?: string;
	/** Audience */
	aud?: string;
	/** Allow additional custom fields */
	[key: string]: any;
}

/**
 * Parse JWT token without verification
 *
 * @param token - JWT token string
 * @returns Decoded payload
 * @throws {TokenError} If token format is invalid
 *
 * @example
 * ```typescript
 * const payload = parseJwt(token);
 * console.log('Expires at:', new Date(payload.exp! * 1000));
 * console.log('Scope:', payload.scope);
 * ```
 */
export function parseJwt(token: string): JwtPayload {
	try {
		const base64Url = token.split('.')[1];
		if (!base64Url) {
			throw new Error('Invalid JWT format');
		}

		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const jsonPayload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);

		return JSON.parse(jsonPayload);
	} catch (error) {
		throw new TokenError('Invalid JWT token format');
	}
}

/**
 * Check if token is expired
 *
 * @param token - JWT token string
 * @returns True if expired
 *
 * @example
 * ```typescript
 * if (isTokenExpired(token)) {
 *   console.log('Token has expired, refresh needed');
 * }
 * ```
 */
export function isTokenExpired(token: string): boolean {
	try {
		const payload = parseJwt(token);
		if (!payload.exp) {
			return false; // No expiration
		}

		return payload.exp * 1000 <= Date.now();
	} catch (error) {
		return true; // Invalid token is considered expired
	}
}

/**
 * Get time until token expiration
 *
 * @param token - JWT token string
 * @returns Milliseconds until expiration, or null if no expiration
 *
 * @example
 * ```typescript
 * const timeLeft = getTimeUntilExpiration(token);
 * if (timeLeft && timeLeft < 5 * 60 * 1000) {
 *   console.log('Token expires in less than 5 minutes');
 * }
 * ```
 */
export function getTimeUntilExpiration(token: string): number | null {
	try {
		const payload = parseJwt(token);
		if (!payload.exp) {
			return null;
		}

		const expiresAt = payload.exp * 1000;
		const now = Date.now();

		return expiresAt - now;
	} catch (error) {
		return null;
	}
}
