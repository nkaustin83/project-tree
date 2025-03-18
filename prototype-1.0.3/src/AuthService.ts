// src/services/AuthService.ts
import axios from 'axios';

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at: number;
}

class AuthService {
  private static readonly TOKEN_KEY = 'procore_auth_tokens';
  private static readonly CLIENT_ID = import.meta.env.VITE_PROCORE_CLIENT_ID || '';
  private static readonly CLIENT_SECRET = import.meta.env.VITE_PROCORE_CLIENT_SECRET || '';
  private static readonly REDIRECT_URI = import.meta.env.VITE_PROCORE_REDIRECT_URI || '';
  private static readonly AUTH_URL = '/oauth/token'; // Use OAuth proxy path
  private static tokenRequestInProgress = false; // Flag to prevent concurrent requests
  
  // Initialize with environment variables
  static init(): void {
    console.log('AuthService initialized with:');
    console.log(`- Client ID: ${this.CLIENT_ID ? this.CLIENT_ID.substring(0, 5) + '...' : 'MISSING'}`);
    console.log(`- Client Secret: ${this.CLIENT_SECRET ? '[PRESENT]' : 'MISSING'}`);
    console.log(`- Redirect URI: ${this.REDIRECT_URI}`);
  }
  
  // Get stored tokens
  static getTokens(): AuthTokens | null {
    const tokensJson = localStorage.getItem(this.TOKEN_KEY);
    console.log(`Getting tokens from localStorage (key: ${this.TOKEN_KEY}): ${tokensJson ? 'FOUND' : 'NOT FOUND'}`);
    
    if (!tokensJson) return null;
    
    try {
      const tokens = JSON.parse(tokensJson) as AuthTokens;
      console.log(`Parsed tokens successfully. Access token: ${tokens.access_token.substring(0, 5)}...`);
      return tokens;
    } catch (error) {
      console.error('Failed to parse auth tokens:', error);
      return null;
    }
  }
  
  // Save tokens to storage
  static saveTokens(tokens: AuthTokens): void {
    console.log(`Saving tokens to localStorage. Access token: ${tokens.access_token.substring(0, 5)}...`);
    
    // Ensure created_at is set if not provided by the API
    if (!tokens.created_at) {
      tokens.created_at = Math.floor(Date.now() / 1000);
      console.log(`Added created_at timestamp: ${tokens.created_at}`);
    }
    
    // Store tokens in localStorage
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokens));
    console.log('Tokens saved to localStorage successfully');
  }
  
  // Clear stored tokens
  static clearTokens(): void {
    console.log('Clearing tokens from localStorage');
    localStorage.removeItem(this.TOKEN_KEY);
  }
  
  // Check if tokens exist and are valid
  static isAuthenticated(): boolean {
    const tokens = this.getTokens();
    if (!tokens) {
      console.log('Not authenticated: No tokens found');
      return false;
    }
    
    // Check if token is expired (with 5-minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = tokens.created_at + tokens.expires_in - 300; // 5-minute buffer
    const isValid = now < expirationTime;
    
    console.log(`Token expiration check: now=${now}, expiration=${expirationTime}, valid=${isValid}`);
    return isValid;
  }
  
  // Get access token (refreshing if necessary)
  static async getAccessToken(): Promise<string> {
    const tokens = this.getTokens();
    if (!tokens) {
      console.error('getAccessToken failed: Not authenticated (no tokens)');
      throw new Error('Not authenticated');
    }
    
    // Check if token is expired (with 5-minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = tokens.created_at + tokens.expires_in - 300; // 5-minute buffer
    
    if (now >= expirationTime) {
      // Token is expired, try to refresh
      console.log('Access token expired, attempting to refresh');
      try {
        const refreshSuccess = await this.refreshToken();
        if (!refreshSuccess) {
          console.error('Token refresh failed');
          this.clearTokens();
          throw new Error('Authentication expired. Please log in again.');
        }
        
        const newTokens = this.getTokens();
        if (!newTokens) {
          console.error('Failed to get tokens after refresh');
          throw new Error('Failed to refresh token');
        }
        
        console.log('Using refreshed access token');
        return newTokens.access_token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearTokens();
        throw new Error('Authentication expired. Please log in again.');
      }
    }
    
    console.log('Using existing valid access token');
    return tokens.access_token;
  }
  
  // Authenticate with authorization code (from OAuth redirect)
  static async authenticate(code: string): Promise<void> {
    // Check if a token request is already in progress
    if (this.tokenRequestInProgress) {
      console.log('Token request already in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (this.isAuthenticated()) {
        console.log('Authentication completed by another request');
        return;
      }
    }
    
    try {
      this.tokenRequestInProgress = true;
      
      // Log detailed request info for debugging
      console.log('Authentication request details:');
      console.log(`- Code: ${code.substring(0, 5)}...`);
      console.log(`- Redirect URI: ${this.REDIRECT_URI}`);
      console.log(`- Client ID: ${this.CLIENT_ID ? this.CLIENT_ID.substring(0, 5) + '...' : 'MISSING'}`);
      console.log(`- Client Secret: ${this.CLIENT_SECRET ? '[PRESENT]' : 'MISSING'}`);
      console.log(`- Auth URL: ${this.AUTH_URL}`);
      
      // Create form data for the request (this is important for OAuth)
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('code', code);
      formData.append('client_id', this.CLIENT_ID);
      formData.append('client_secret', this.CLIENT_SECRET);
      formData.append('redirect_uri', this.REDIRECT_URI);
      
      const response = await axios.post(this.AUTH_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Log token response details (safe parts only)
      console.log('Authentication response received:');
      console.log(`- Status: ${response.status}`);
      console.log(`- Access token received: ${response.data.access_token ? 'Yes (first 5 chars: ' + response.data.access_token.substring(0, 5) + '...)' : 'No'}`);
      console.log(`- Refresh token received: ${response.data.refresh_token ? 'Yes' : 'No'}`);
      console.log(`- Expires in: ${response.data.expires_in} seconds`);
      
      // Save tokens including timestamp
      const tokensToSave = {
        ...response.data,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      this.saveTokens(tokensToSave);
      console.log('🎉 Authentication successful! Token saved to localStorage.');
    } catch (error) {
      // Detailed error logging
      console.error('Authentication failed:');
      if (axios.isAxiosError(error)) {
        console.error(`Status: ${error.response?.status}`);
        console.error('Response data:', error.response?.data);
        
        // Guidance based on specific errors
        if (error.response?.status === 401) {
          console.error('LIKELY ISSUE: Client ID or Client Secret is incorrect');
        } else if (error.response?.status === 400) {
          console.error('LIKELY ISSUE: Invalid authorization code or redirect URI mismatch');
        }
      } else {
        console.error(error);
      }
      throw error;
    } finally {
      this.tokenRequestInProgress = false;
    }
  }
  
  // Refresh the access token
  static async refreshToken(): Promise<boolean> {
    const tokens = this.getTokens();
    if (!tokens) {
      console.error('refreshToken failed: No refresh token available');
      throw new Error('No refresh token available');
    }
    
    // Check if a token request is already in progress
    if (this.tokenRequestInProgress) {
      console.log('Token refresh already in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (this.isAuthenticated()) {
        console.log('Token refresh completed by another request');
        return true;
      }
    }
    
    try {
      this.tokenRequestInProgress = true;
      
      console.log('🔄 Refreshing token using refresh_token');
      console.log(`- Using refresh token: ${tokens.refresh_token.substring(0, 5)}...`);
      
      // Create form data for the request (this is important for OAuth)
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('refresh_token', tokens.refresh_token);
      formData.append('client_id', this.CLIENT_ID);
      formData.append('client_secret', this.CLIENT_SECRET);
      
      const response = await axios.post(this.AUTH_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('Token refresh response received:');
      console.log(`- Status: ${response.status}`);
      console.log(`- New access token: ${response.data.access_token.substring(0, 5)}...`);
      
      // Make sure to set created_at timestamp
      const tokensToSave = {
        ...response.data,
        created_at: Math.floor(Date.now() / 1000)
      };
      
      this.saveTokens(tokensToSave);
      console.log('✨ Token refreshed successfully!');
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      if (axios.isAxiosError(error)) {
        console.error(`Status: ${error.response?.status}`);
        console.error('Response data:', error.response?.data);
      }
      this.clearTokens();
      return false;
    } finally {
      this.tokenRequestInProgress = false;
    }
  }
  
  // Logout
  static logout(): void {
    console.log('Logging out: clearing tokens');
    this.clearTokens();
  }
  
  // Get Procore OAuth login URL
  static getLoginUrl(): string {
    // Verify environment variables before creating URL
    if (!this.CLIENT_ID) {
      console.error('Missing VITE_PROCORE_CLIENT_ID environment variable');
    }
    if (!this.REDIRECT_URI) {
      console.error('Missing VITE_PROCORE_REDIRECT_URI environment variable');
    }
    
    // Debug log
    console.log('Creating OAuth login URL:');
    console.log(`- Client ID: ${this.CLIENT_ID ? this.CLIENT_ID.substring(0, 5) + '...' : 'MISSING'}`);
    console.log(`- Redirect URI: ${this.REDIRECT_URI}`);
    
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      response_type: 'code',
      redirect_uri: this.REDIRECT_URI
    });
    
    // We still use the direct Procore URL for the initial authorization redirect
    // since this doesn't trigger CORS (it's just a redirect, not an XHR request)
    const loginUrl = `https://login-sandbox.procore.com/oauth/authorize?${params.toString()}`;
    console.log(`- Login URL: ${loginUrl}`);
    
    return loginUrl;
  }
}

// Initialize on import
AuthService.init();

export default AuthService;