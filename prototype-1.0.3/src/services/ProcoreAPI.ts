// ProcoreAPI.ts
import axios, { AxiosInstance } from 'axios';
import { Interaction, InteractionType, InteractionStatus } from './InteractionTypes';
import SupabaseService from './SupabaseService';

// Define Procore API interfaces
interface ProcoreConfig {
  baseUrl: string;
  accessToken: string;
  projectId?: number;
  expiresAt?: Date;
  tokenRefreshCallback?: () => Promise<string>;
}

interface ProcoreRFI {
  id: number;
  number: string;
  title: string;
  description: string;
  status: string | {
    id: number;
    name: string;
    status?: string;
  };
  created_at: string;
  due_date: string | null;
  closed_date: string | null;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  question: string;
  answer: string | null;
  cost_impact: number | null;
  schedule_impact: number | null;
}

interface ProcoreSubmittal {
  id: number;
  number: string;
  title: string;
  description: string;
  status: string | {
    id: number;
    name: string;
    status?: string;
  };
  created_at: string;
  due_date: string | null;
  closed_date: string | null;
  assignee: {
    id: number;
    name: string;
    email: string;
  } | null;
  spec_section: string | null;
  revision_number: string | null;
  approval_status: string | null;
}

// Mock data for testing when API calls fail
const mockInteractions: Interaction[] = [
  {
    id: 'rfi-1',
    title: 'Foundation Depth Clarification',
    description: 'Need clarification on the foundation depth requirements for the northwest corner of the building.',
    type: 'rfi',
    status: 'open',
    day: 5,
    number: '001',
    createdAt: new Date('2025-01-05').toISOString(),
    questionText: 'What is the required foundation depth for the northwest corner of the building given the soil conditions?',
    assignedTo: 'John Architect',
    dueDate: new Date('2025-01-12')
  },
  {
    id: 'submittal-1',
    title: 'Window Frame Specs',
    description: 'Submittal for the window frame specifications as requested.',
    type: 'submittal',
    status: 'in_progress',
    day: 12,
    number: '001',
    createdAt: new Date('2025-01-12').toISOString(),
    specSection: '08 51 13',
    revisionNumber: '0',
    assignedTo: 'Sarah Engineer',
    dueDate: new Date('2025-01-19')
  },
  {
    id: 'rfi-2',
    title: 'Electrical Panel Location',
    description: 'Requesting clarification on the location of the main electrical panel.',
    type: 'rfi',
    status: 'critical',
    day: 18,
    number: '002',
    createdAt: new Date('2025-01-18').toISOString(),
    questionText: 'Can we relocate the main electrical panel to the east wall of the utility room?',
    assignedTo: 'Elena Electrical',
    dueDate: new Date('2025-01-20')
  }
];

class ProcoreAPI {
  private axiosInstance: AxiosInstance;
  private projectId?: number;
  private accessToken: string;
  private tokenExpiry?: Date;
  private tokenRefreshCallback?: () => Promise<string>;
  private lastRefreshAttempt: number = 0;
  private refreshInProgress: boolean = false;
  private supabaseService: SupabaseService;
  private useSyncToSupabase: boolean = true;

  constructor(config: ProcoreConfig) {
    this.projectId = config.projectId;
    this.accessToken = config.accessToken;
    
    // Set expiry date
    this.tokenExpiry = config.expiresAt || (() => {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);
      return expiry;
    })();
    
    this.tokenRefreshCallback = config.tokenRefreshCallback;
    
    // Initialize Supabase service
    try {
      this.supabaseService = SupabaseService.getInstance();
      console.log('📊 Supabase service initialized in ProcoreAPI');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Supabase service:', error);
      console.warn('⚠️ Will continue without Supabase syncing');
      this.useSyncToSupabase = false;
    }
    
    // Use the Vite proxy with the REST API base path
    const baseURL = '/api';
    
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor to validate token before each request
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add cache busting to prevent 304 responses
        const cacheBuster = `cacheBuster=${new Date().getTime()}`;
        config.url = config.url + (config.url?.includes('?') ? '&' : '?') + cacheBuster;
        
        // Validate token before each request
        if (!this.isTokenValid()) {
          console.log('🔄 Token expired or invalid before request, attempting refresh...');
          
          // Only refresh if we have a callback and not already refreshing
          if (this.tokenRefreshCallback && !this.refreshInProgress) {
            try {
              // Set flag to prevent concurrent refresh attempts
              this.refreshInProgress = true;
              
              // Get new token via callback
              const newToken = await this.tokenRefreshCallback();
              
              // Verify we actually got a different token
              if (newToken === this.accessToken) {
                console.warn('⚠️ Same token detected, refresh may have failed. Will continue with caution.');
              } else {
                console.log('✅ Token refreshed successfully before request');
              }
              
              // Update token in instance
              this.updateToken(newToken);
              
              // Update authorization header
              config.headers['Authorization'] = `Bearer ${newToken}`;
            } catch (error) {
              console.error('❌ Token refresh failed before request:', error);
            } finally {
              this.refreshInProgress = false;
            }
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for automatic token refresh on 401
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const statusCode = error.response?.status;
        const endpoint = error.config?.url || 'unknown endpoint';
        const originalRequest = error.config;
        
        // Handle 401 Unauthorized error - attempt token refresh
        if (statusCode === 401 && this.tokenRefreshCallback && !originalRequest._retry && !this.refreshInProgress) {
          console.log(`🔄 401 Unauthorized error for ${endpoint} - attempting token refresh...`);
          originalRequest._retry = true;
          
          try {
            // Set flag to prevent concurrent refresh attempts
            this.refreshInProgress = true;
            
            // Rate limiting - don't try to refresh more than once per 5 seconds
            const now = Date.now();
            if (now - this.lastRefreshAttempt < 5000) {
              console.log('⏱️ Token refresh attempted too recently, waiting...');
              await new Promise(resolve => setTimeout(resolve, 5000 - (now - this.lastRefreshAttempt)));
            }
            this.lastRefreshAttempt = Date.now();
            
            // Get new token via callback
            const newToken = await this.tokenRefreshCallback();
            
            // Verify we actually got a different token
            if (newToken === this.accessToken) {
              console.warn('⚠️ Same token detected after refresh, refresh may have failed!');
              throw new Error('Token refresh returned same token');
            }
            
            console.log(`🔄 Retrying request with fresh token: [${newToken.substring(0, 5)}...${newToken.substring(newToken.length - 5)}]`);
            
            // Update our stored token
            this.updateToken(newToken);
            
            // Update the authorization header in the original request
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            
            // Try the request again with new token
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            return Promise.reject(refreshError);
          } finally {
            this.refreshInProgress = false;
          }
        }
        
        // Provide specific error guidance for different status codes
        if (statusCode === 401) {
          console.error('❌ Authentication error (401): Your token may be invalid or expired. Token refresh will be attempted.');
        } else if (statusCode === 403) {
          console.error('❌ Permission error (403): Your token lacks permission for this resource. Verify the following permissions in Procore: RFI Admin, Submittals Read-Only, Projects Read.');
        } else if (statusCode === 400) {
          console.error('❌ Bad Request (400): The request was malformed. Check projectId and request format.');
        } else if (statusCode === 404) {
          console.error('❌ Not Found (404): The requested resource does not exist. Verify projectId and endpoint path.');
          
          // If project ID is the issue, suggest auto-detection
          if (endpoint.includes('/projects/')) {
            console.error('💡 Suggestion: Your project ID may be invalid. Try auto-detecting available projects.');
            // If this is a project-level endpoint (like rfis or submittals), try to auto-detect projects
            if (this.projectId) {
              this.checkAvailableProjects()
                .then(result => {
                  if (result.success && result.suggestedProjectId) {
                    console.log(`✅ Found available project: ${result.message}. Consider using project ID ${result.suggestedProjectId} instead of ${this.projectId}`);
                  }
                })
                .catch(err => {
                  console.error('❌ Failed to auto-detect projects:', err);
                });
            }
          }
        }
        
        // Log more detailed information for debugging
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response headers:', error.response.headers);
        } else if (error.request) {
          console.error('No response received. Request:', error.request);
        } else {
          console.error('Error setting up request:', error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  // Enable or disable Supabase syncing
  public setSupabaseSync(enable: boolean): void {
    this.useSyncToSupabase = enable;
    console.log(`${enable ? '✅' : '❌'} Supabase syncing is now ${enable ? 'enabled' : 'disabled'}`);
  }
  
  // Validate token
  isTokenValid(): boolean {
    // Basic validation - check if token exists and has reasonable length
    if (!this.accessToken || this.accessToken.length < 20) {
      console.error('❌ Procore API token appears invalid (too short or empty)');
      return false;
    }
    
    // Check for token expiration with 30-second buffer
    if (this.tokenExpiry) {
      const now = new Date();
      const bufferMs = 30 * 1000; // 30 seconds buffer
      
      if (now.getTime() > this.tokenExpiry.getTime() - bufferMs) {
        console.log(`⏱️ Token expires at ${this.tokenExpiry.toLocaleString()}, current time is ${now.toLocaleString()}`);
        console.log('⏱️ Token is expired or expiring soon');
        return false;
      }
    }
    
    // All checks passed
    return true;
  }
  
  // Get token expiry
  getTokenExpiry(): Date | undefined {
    return this.tokenExpiry;
  }
  
  // Update token
  updateToken(accessToken: string, expiresAt?: Date): void {
    // Sanity check - verify we're not setting the same token
    if (accessToken === this.accessToken) {
      console.warn('⚠️ WARNING: Attempting to update token with the same value. This may indicate a refresh failure.');
    }
    
    // Update the token
    this.accessToken = accessToken;
    
    // Update expiry if provided
    if (expiresAt) {
      this.tokenExpiry = expiresAt;
    } else if (this.tokenExpiry) {
      // If not provided but we have an existing expiry, extend by 1 hour
      this.tokenExpiry = new Date();
      this.tokenExpiry.setHours(this.tokenExpiry.getHours() + 1);
    }
    
    // Update axios instance header
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    console.log(`✅ Procore API token updated, expires: ${this.tokenExpiry?.toLocaleString() || 'unknown'}`);
  }
  
  // Set project ID after initialization
  setProjectId(projectId: number): void {
    this.projectId = projectId;
    console.log(`🏗️ Project ID set to: ${projectId}`);
  }
  
  // Check if project ID is set
  private ensureProjectId(): void {
    if (!this.projectId) {
      throw new Error('Project ID is required. Call setProjectId() first.');
    }
  }
  
  // Check for available projects and suggest a valid one
  async checkAvailableProjects(): Promise<{success: boolean, suggestedProjectId?: number, message?: string}> {
    try {
      if (!this.isTokenValid()) {
        return {success: false, message: 'Token validation failed. Check your authentication.'};
      }
      
      // Use REST API endpoint for projects
      console.log('🔍 Checking for available projects...');
      const response = await this.axiosInstance.get('/rest/v1.0/projects');
      const projects = response.data;
      
      console.log('📋 Available projects:', projects);
      
      if (Array.isArray(projects) && projects.length > 0) {
        // Find a sandbox project if possible
        const sandboxProject = projects.find(project => 
          project.name.toLowerCase().includes('sandbox') || 
          project.name.toLowerCase().includes('test')
        );
        
        if (sandboxProject) {
          return {
            success: true, 
            suggestedProjectId: sandboxProject.id,
            message: `Found sandbox project: ${sandboxProject.name} (ID: ${sandboxProject.id})`
          };
        } else {
          // Return the first project if no sandbox is found
          return {
            success: true,
            suggestedProjectId: projects[0].id,
            message: `No sandbox project found. Using first available project: ${projects[0].name} (ID: ${projects[0].id})`
          };
        }
      } else {
        return {success: false, message: 'No projects found in your Procore account. Create a project first.'};
      }
    } catch (error) {
      console.error('❌ Failed to check for available projects:', error);
      return {success: false, message: 'Error checking for projects. Check your Procore permissions.'};
    }
  }
  
  // Get RFIs for the current project
  async getRFIs(): Promise<ProcoreRFI[]> {
    this.ensureProjectId();
    
    try {
      // Use REST API endpoint for RFIs
      const response = await this.axiosInstance.get(`/rest/v1.0/projects/${this.projectId}/rfis`);
      console.log('✅ Successfully fetched RFIs:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch RFIs:', error);
      throw error;
    }
  }
  
  // Get Submittals for the current project
  async getSubmittals(): Promise<ProcoreSubmittal[]> {
    this.ensureProjectId();
    
    try {
      // Use REST API endpoint for Submittals
      const response = await this.axiosInstance.get(`/rest/v1.0/projects/${this.projectId}/submittals`);
      console.log('✅ Successfully fetched Submittals:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch Submittals:', error);
      throw error;
    }
  }
  
  // Convert Procore RFI to Interaction - UPDATED to handle object status
  mapRFIToInteraction(rfi: ProcoreRFI): Interaction {
    // Calculate day value based on created_at
    const createdDate = new Date(rfi.created_at);
    const today = new Date();
    const day = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    // Map Procore status to InteractionStatus - Handle both string and object formats
    let status: InteractionStatus = 'open'; // Default to 'open'
    
    if (rfi.status) {
      // Handle status as string
      if (typeof rfi.status === 'string') {
        switch (rfi.status.toLowerCase()) {
          case 'open': status = 'open'; break;
          case 'in progress': status = 'in_progress'; break;
          case 'closed': status = 'resolved'; break;
          case 'void': status = 'resolved'; break;
          default: status = 'open';
        }
      } 
      // Handle status as object with name property (common Procore format)
      else if (typeof rfi.status === 'object' && rfi.status !== null) {
        // Extract status name from status object (try name or status property)
        const statusName = rfi.status.name || rfi.status.status || '';
        
        if (typeof statusName === 'string') {
          switch (statusName.toLowerCase()) {
            case 'open': status = 'open'; break;
            case 'in progress': status = 'in_progress'; break;
            case 'closed': status = 'resolved'; break;
            case 'void': status = 'resolved'; break;
            default: status = 'open';
          }
        } else {
          console.warn('⚠️ Could not extract status name from RFI status object:', rfi.status);
        }
      } else {
        console.warn(`⚠️ Unexpected RFI status type: ${typeof rfi.status}`, rfi.status);
      }
    } else {
      console.warn('⚠️ RFI status is null or undefined, defaulting to "open"');
    }
    
    return {
      id: `rfi-${rfi.id}`,
      title: rfi.title || `RFI #${rfi.number}`,
      description: rfi.description || '',
      type: 'rfi',
      status,
      day: Math.max(0, day), // Ensure day is not negative
      number: rfi.number,
      createdAt: rfi.created_at,
      questionText: rfi.question || '',
      answerText: rfi.answer || undefined,
      assignedTo: rfi.assignee?.name,
      dueDate: rfi.due_date ? new Date(rfi.due_date) : undefined,
      resolvedDate: rfi.closed_date ? new Date(rfi.closed_date) : undefined,
      costImpact: rfi.cost_impact || undefined,
      scheduleImpact: rfi.schedule_impact || undefined
    };
  }
  
  // Convert Procore Submittal to Interaction - UPDATED to handle object status
  mapSubmittalToInteraction(submittal: ProcoreSubmittal): Interaction {
    // Calculate day value based on created_at
    const createdDate = new Date(submittal.created_at);
    const today = new Date();
    const day = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    // Map Procore status to InteractionStatus - Handle both string and object formats
    let status: InteractionStatus = 'open'; // Default to 'open'
    
    if (submittal.status) {
      // Handle status as string
      if (typeof submittal.status === 'string') {
        switch (submittal.status.toLowerCase()) {
          case 'open': status = 'open'; break;
          case 'in progress': status = 'in_progress'; break;
          case 'closed': status = 'resolved'; break;
          default: status = 'open';
        }
      } 
      // Handle status as object with name property (common Procore format)
      else if (typeof submittal.status === 'object' && submittal.status !== null) {
        // Extract status name from status object (try name or status property)
        const statusName = submittal.status.name || submittal.status.status || '';
        
        if (typeof statusName === 'string') {
          switch (statusName.toLowerCase()) {
            case 'open': status = 'open'; break;
            case 'in progress': status = 'in_progress'; break;
            case 'closed': status = 'resolved'; break;
            default: status = 'open';
          }
        } else {
          console.warn('⚠️ Could not extract status name from submittal status object:', submittal.status);
        }
      } else {
        console.warn(`⚠️ Unexpected submittal status type: ${typeof submittal.status}`, submittal.status);
      }
    } else {
      console.warn('⚠️ Submittal status is null or undefined, defaulting to "open"');
    }
    
    return {
      id: `submittal-${submittal.id}`,
      title: submittal.title || `Submittal #${submittal.number}`,
      description: submittal.description || '',
      type: 'submittal',
      status,
      day: Math.max(0, day), // Ensure day is not negative
      number: submittal.number,
      createdAt: submittal.created_at,
      specSection: submittal.spec_section || undefined,
      revisionNumber: submittal.revision_number || undefined,
      assignedTo: submittal.assignee?.name,
      dueDate: submittal.due_date ? new Date(submittal.due_date) : undefined,
      resolvedDate: submittal.closed_date ? new Date(submittal.closed_date) : undefined,
      approvalStatus: submittal.approval_status || undefined
    };
  }
  
  // Respond to an RFI
  async respondToRFI(rfiId: number, answerText: string): Promise<boolean> {
    this.ensureProjectId();
    
    try {
      const response = await this.axiosInstance.patch(`/rest/v1.0/projects/${this.projectId}/rfis/${rfiId}`, {
        rfi: {
          answer: answerText,
          status: 'closed'
        }
      });
      console.log('✅ Successfully responded to RFI:', response.data);
      
      // Update the interaction in Supabase after successful API call
      if (this.useSyncToSupabase && this.projectId) {
        try {
          // First get the updated RFI from Procore
          const updatedRFI = await this.axiosInstance.get(`/rest/v1.0/projects/${this.projectId}/rfis/${rfiId}`);
          
          // Map to interaction
          const interaction = this.mapRFIToInteraction(updatedRFI.data);
          
          // Update in Supabase
          await this.supabaseService.updateInteraction(interaction, this.projectId);
        } catch (supabaseError) {
          console.warn('⚠️ Failed to update RFI in Supabase after response:', supabaseError);
          // Continue - this is non-critical
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to respond to RFI ${rfiId}:`, error);
      console.error('Note: Responding to RFIs requires RFI Admin permission in Procore');
      throw error;
    }
  }
  
  // Respond to a Submittal
  async respondToSubmittal(submittalId: number, status: string, comments: string): Promise<boolean> {
    this.ensureProjectId();
    
    try {
      const response = await this.axiosInstance.patch(`/rest/v1.0/projects/${this.projectId}/submittals/${submittalId}`, {
        submittal: {
          approval_status: status,
          comments: comments,
          status: status === 'approved' ? 'closed' : 'in_progress'
        }
      });
      console.log('✅ Successfully responded to Submittal:', response.data);
      
      // Update the interaction in Supabase after successful API call
      if (this.useSyncToSupabase && this.projectId) {
        try {
          // First get the updated Submittal from Procore
          const updatedSubmittal = await this.axiosInstance.get(`/rest/v1.0/projects/${this.projectId}/submittals/${submittalId}`);
          
          // Map to interaction
          const interaction = this.mapSubmittalToInteraction(updatedSubmittal.data);
          
          // Update in Supabase
          await this.supabaseService.updateInteraction(interaction, this.projectId);
        } catch (supabaseError) {
          console.warn('⚠️ Failed to update Submittal in Supabase after response:', supabaseError);
          // Continue - this is non-critical
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to respond to Submittal ${submittalId}:`, error);
      console.error('Note: Responding to Submittals requires appropriate permissions in Procore');
      throw error;
    }
  }
  
  // Fetch from Supabase first, then Procore if needed
  async getInteractionsFromSupabase(): Promise<Interaction[]> {
    if (!this.projectId) {
      console.error('❌ No project ID set for fetching from Supabase');
      return [];
    }
    
    if (!this.useSyncToSupabase) {
      console.log('ℹ️ Supabase sync is disabled, skipping Supabase fetch');
      return [];
    }
    
    try {
      // Fetch from Supabase
      const interactions = await this.supabaseService.getInteractions(this.projectId);
      console.log(`📊 Got ${interactions.length} interactions from Supabase`);
      return interactions;
    } catch (error) {
      console.error('❌ Failed to fetch interactions from Supabase:', error);
      return [];
    }
  }
  
  // Fetch and convert all interactions, with fallback to mock data
  // UPDATED with circuit breaker pattern
  async getAllInteractions(useMockDataOnFailure: boolean = false, syncToSupabase: boolean = true): Promise<Interaction[]> {
    // First try to get interactions from Supabase
    let supabaseInteractions: Interaction[] = [];
    
    if (this.useSyncToSupabase && this.projectId && syncToSupabase) {
      try {
        supabaseInteractions = await this.getInteractionsFromSupabase();
        
        // If we have data from Supabase, return it
        if (supabaseInteractions.length > 0) {
          console.log('📊 Using interactions from Supabase');
          
          // Still fetch from Procore in the background for future sync
          // Note the false flag to prevent syncing back to Supabase which would cause a loop
          setTimeout(() => {
            this.fetchFromProcoreOnly(useMockDataOnFailure, false).catch(error => {
              console.warn('⚠️ Background sync with Procore failed:', error);
            });
          }, 5000); // Delay by 5 seconds to not block the UI
          
          return supabaseInteractions;
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch from Supabase, falling back to Procore:', error);
        // Continue to fetch from Procore
      }
    }
    
    // If no data from Supabase or syncToSupabase is false, fetch from Procore
    return this.fetchFromProcoreOnly(useMockDataOnFailure, syncToSupabase);
  }
  
  // Helper method to fetch only from Procore
  private async fetchFromProcoreOnly(useMockDataOnFailure: boolean = true, syncToSupabase: boolean = true): Promise<Interaction[]> {
    // Track retry attempts
    let retryCount = 0;
    const maxRetries = 2;
    
    const attemptFetch = async (): Promise<Interaction[]> => {
      try {
        // Verify token validity before attempting
        if (!this.isTokenValid()) {
          console.warn('⚠️ Token invalid or expired before fetching interactions');
          
          // Only attempt token refresh if we have the callback
          if (this.tokenRefreshCallback && !this.refreshInProgress) {
            try {
              this.refreshInProgress = true;
              const newToken = await this.tokenRefreshCallback();
              this.updateToken(newToken);
              console.log('✅ Token refreshed before fetching interactions');
            } catch (refreshError) {
              console.error('❌ Failed to refresh token before fetching:', refreshError);
              if (useMockDataOnFailure) {
                console.warn('⚠️ Using mock data due to token refresh failure');
                return mockInteractions;
              }
              throw refreshError;
            } finally {
              this.refreshInProgress = false;
            }
          } else if (useMockDataOnFailure) {
            console.warn('⚠️ Using mock data due to invalid token (no refresh callback)');
            return mockInteractions;
          } else {
            throw new Error('Invalid token and no refresh callback available');
          }
        }
        
        // Check if projectId is valid, if not try to auto-detect
        if (!this.projectId) {
          const result = await this.checkAvailableProjects();
          if (result.success && result.suggestedProjectId) {
            console.log(`✅ Auto-detected project ID: ${result.suggestedProjectId}`);
            this.setProjectId(result.suggestedProjectId);
          } else {
            throw new Error('No project ID available and auto-detection failed');
          }
        }
        
        // Fetch data from different endpoints
        const [rfis, submittals] = await Promise.all([
          this.getRFIs().catch(error => {
            console.error('❌ Error fetching RFIs, will use empty array:', error);
            return [];
          }),
          this.getSubmittals().catch(error => {
            console.error('❌ Error fetching Submittals, will use empty array:', error);
            return [];
          })
        ]);
        
        // Debug log to see the actual data structure
        console.log(`📋 Raw RFIs from API: ${rfis.length} items`);
        console.log(`📋 Raw Submittals from API: ${submittals.length} items`);
        
        // Map to Interaction type
        const rfiInteractions = rfis.map(rfi => this.mapRFIToInteraction(rfi));
        const submittalInteractions = submittals.map(submittal => this.mapSubmittalToInteraction(submittal));
        
        // Combine all interactions
        const allInteractions = [...rfiInteractions, ...submittalInteractions];
        
        // Sync to Supabase if we have interactions and Supabase is enabled
        if (allInteractions.length > 0 && this.useSyncToSupabase && this.projectId && syncToSupabase) {
          try {
            console.log(`🔄 Syncing ${allInteractions.length} interactions to Supabase...`);
            const syncResult = await this.supabaseService.syncInteractions(allInteractions, this.projectId);
            
            if (syncResult.success) {
              console.log(`✅ Sync to Supabase successful: ${syncResult.count} interactions`);
            } else if (syncResult.rlsError) {
              // RLS error detected - disable Supabase sync temporarily
              console.error('⛔ RLS error detected - disabling Supabase sync temporarily');
              this.useSyncToSupabase = false;
              setTimeout(() => {
                // Re-enable after 5 minutes
                this.useSyncToSupabase = true;
                console.log('🔄 Re-enabling Supabase sync after timeout');
              }, 5 * 60 * 1000);
            } else {
              console.warn(`⚠️ Sync to Supabase failed: ${syncResult.message || 'Unknown error'}`);
            }
          } catch (syncError) {
            console.warn('⚠️ Failed to sync interactions to Supabase:', syncError);
            // Continue - this is non-critical
          }
        }
        
        if (allInteractions.length === 0) {
          console.warn('⚠️ No interactions found from API.');
          
          if (useMockDataOnFailure) {
            console.warn('⚠️ Using mock data since no real interactions were found');
            return mockInteractions;
          }
        }
        
        return allInteractions;
      } catch (error) {
        console.error(`❌ Failed to fetch interactions (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        // Increment retry count
        retryCount++;
        
        // If we haven't reached max retries, try again
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying fetch (attempt ${retryCount + 1}/${maxRetries})...`);
          return attemptFetch();
        }
        
        // If we've exhausted retries and mock data is allowed, return mock data
        if (useMockDataOnFailure) {
          console.warn(`⚠️ Using mock data after ${maxRetries} failed attempts`);
          return mockInteractions;
        }
        
        throw error;
      }
    };
    
    return attemptFetch();
  }
  
  // Update a single interaction (update both Procore and Supabase)
  async updateInteraction(interaction: Interaction): Promise<boolean> {
    if (!this.projectId) {
      console.error('❌ No project ID set for updating interaction');
      return false;
    }
    
    // First update in Supabase if enabled
    if (this.useSyncToSupabase) {
      try {
        await this.supabaseService.updateInteraction(interaction, this.projectId);
        console.log(`✅ Updated interaction ${interaction.id} in Supabase`);
      } catch (error) {
        console.warn(`⚠️ Failed to update interaction ${interaction.id} in Supabase:`, error);
        // Continue - we'll still try to update in Procore
      }
    }
    
    // For now, we're not updating back to Procore directly
    // This would require mapping back to Procore's data model
    // and calling the appropriate endpoint based on interaction type
    
    return true;
  }
}

export default ProcoreAPI;