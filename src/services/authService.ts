/**
 * Service for managing ArcGIS server authentication tokens
 */
export class AuthService {
  private static readonly AUTH_TOKENS_KEY = 'arcgis-explorer-tokens';

  /**
   * Extract token from URL if present
   * @param url - Full URL potentially containing token parameter
   * @returns Object with cleanUrl (without token) and token (if found)
   */
  static extractToken(url: string): { cleanUrl: string; token: string | null } {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');

      if (token) {
        // Remove token from URL
        urlObj.searchParams.delete('token');
        return {
          cleanUrl: urlObj.toString(),
          token,
        };
      }

      return {
        cleanUrl: url,
        token: null,
      };
    } catch (error) {
      // Invalid URL format
      return {
        cleanUrl: url,
        token: null,
      };
    }
  }

  /**
   * Get the base server URL from any service URL
   * @param url - Full service URL
   * @returns Base server URL (protocol + host)
   */
  static getServerUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch (error) {
      return url;
    }
  }

  /**
   * Save token for a specific server
   * @param serverUrl - Base server URL
   * @param token - Authentication token
   */
  static saveToken(serverUrl: string, token: string): void {
    try {
      const tokens = this.getAllTokens();
      const baseUrl = this.getServerUrl(serverUrl);
      tokens[baseUrl] = token;
      localStorage.setItem(this.AUTH_TOKENS_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  }

  /**
   * Get token for a specific server
   * @param serverUrl - Base server URL or full service URL
   * @returns Token if found, null otherwise
   */
  static getToken(serverUrl: string): string | null {
    try {
      const tokens = this.getAllTokens();
      const baseUrl = this.getServerUrl(serverUrl);
      return tokens[baseUrl] || null;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Remove token for a specific server
   * @param serverUrl - Base server URL
   */
  static removeToken(serverUrl: string): void {
    try {
      const tokens = this.getAllTokens();
      const baseUrl = this.getServerUrl(serverUrl);
      delete tokens[baseUrl];
      localStorage.setItem(this.AUTH_TOKENS_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  }

  /**
   * Get all stored tokens
   * @returns Object mapping server URLs to tokens
   */
  static getAllTokens(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.AUTH_TOKENS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get tokens:', error);
      return {};
    }
  }

  /**
   * Clear all stored tokens
   */
  static clearAllTokens(): void {
    try {
      localStorage.removeItem(this.AUTH_TOKENS_KEY);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}
