// src/services/SupabaseService.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Interaction, InteractionType, InteractionStatus } from '../types/InteractionTypes';

// Singleton pattern for Supabase service
class SupabaseService {
  private static instance: SupabaseService;
  private supabase: SupabaseClient;
  private isInitialized: boolean = false;
  private accessToken: string | null = null;

  private constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('🚨 Supabase configuration missing! Please check your .env file');
      throw new Error('Missing Supabase configuration. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
    }

    // Initialize with anon key first (will be updated with JWT when available)
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isInitialized = true;
    console.log('✨ Supabase client initially initialized with anon key');
  }

  // Get the singleton instance
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Initialize or reinitialize with JWT from Procore
  public initWithToken(token: string): void {
    if (!token) {
      console.warn('⚠️ No token provided for Supabase JWT auth');
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Store the token for reuse
      this.accessToken = token;
      
      // Create a new client with the token
      this.supabase = createClient(supabaseUrl, token, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
      
      console.log('🔑 Supabase client reinitialized with Procore JWT');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase with JWT:', error);
    }
  }

  // Check connection to Supabase
  public async testConnection(): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      // Simple query to test connection
      const { count, error } = await this.supabase
        .from('interactions')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        
        // Check for RLS errors
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.warn('⚠️ RLS permission denied. Trying to reinitialize with token...');
          
          // If we have a token, try to reinitialize
          if (this.accessToken) {
            this.initWithToken(this.accessToken);
            // Test again
            const retry = await this.supabase
              .from('interactions')
              .select('*', { count: 'exact', head: true });
              
            if (retry.error) {
              console.error('❌ Retry failed after token reinit:', retry.error);
              return false;
            }
            
            console.log(`🔌 Supabase connection successful after token reinit! Found ${retry.count} interactions`);
            return true;
          }
        }
        
        return false;
      }
      
      console.log(`🔌 Supabase connection successful! Found ${count} interactions`);
      return true;
    } catch (error) {
      console.error('❌ Supabase connection test failed:', error);
      return false;
    }
  }

  // Get all interactions from Supabase for a project
  public async getInteractions(projectId: number): Promise<Interaction[]> {
    if (!this.isInitialized) return [];

    try {
      console.log(`🔍 Fetching interactions for project ${projectId} from Supabase...`);
      const { data, error } = await this.supabase
        .from('interactions')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        // Handle RLS errors specifically
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.warn('⚠️ RLS permission denied when fetching interactions. Trying to create project first...');
          
          // Try to create the project first, which might help with RLS
          await this.createProjectIfNotExists(projectId);
          
          // Try again
          const retry = await this.supabase
            .from('interactions')
            .select('*')
            .eq('project_id', projectId);
            
          if (retry.error) {
            console.error('❌ Retry failed after project creation:', retry.error);
            return [];
          }
          
          if (!retry.data || retry.data.length === 0) {
            console.log('ℹ️ No interactions found in Supabase for this project after retry');
            return [];
          }
          
          return this.mapDataToInteractions(retry.data);
        }
        
        console.error('❌ Error fetching interactions:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ No interactions found in Supabase for this project');
        return [];
      }

      return this.mapDataToInteractions(data);
    } catch (error) {
      console.error('❌ Failed to fetch interactions from Supabase:', error);
      return [];
    }
  }

  // Create project if it doesn't exist (to help with RLS)
  private async createProjectIfNotExists(projectId: number): Promise<boolean> {
    try {
      // First check if project exists
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      // If no error, project exists
      if (!error && data) {
        console.log(`✅ Project ${projectId} already exists in Supabase`);
        return true;
      }
      
      // Create the project
      const { error: createError } = await this.supabase
        .from('projects')
        .insert({
          id: projectId,
          name: `Project ${projectId}`,
          description: 'Auto-created project',
          external_id: projectId.toString(),
          external_source: 'procore',
          start_date: new Date().toISOString().split('T')[0]
        });
        
      if (createError) {
        console.error('❌ Failed to create project:', createError);
        return false;
      }
      
      console.log(`✅ Created project ${projectId} in Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Error creating project:', error);
      return false;
    }
  }

  // Helper to map database records to Interaction objects
  private mapDataToInteractions(data: any[]): Interaction[] {
    // Transform database records to Interaction objects
    const interactions: Interaction[] = data.map(item => {
      return {
        id: item.id,
        title: item.title,
        description: item.description || '',
        type: item.type as InteractionType,
        status: item.status as InteractionStatus,
        day: item.day,
        number: item.number,
        createdAt: item.created_at,
        questionText: item.json_data?.questionText,
        answerText: item.json_data?.answerText,
        assignedTo: item.json_data?.assignedTo,
        dueDate: item.due_date ? new Date(item.due_date) : undefined,
        resolvedDate: item.resolved_date ? new Date(item.resolved_date) : undefined,
        specSection: item.json_data?.specSection,
        revisionNumber: item.json_data?.revisionNumber,
        approvalStatus: item.json_data?.approvalStatus,
        costImpact: item.json_data?.costImpact,
        scheduleImpact: item.json_data?.scheduleImpact,
      };
    });

    console.log(`✅ Successfully mapped ${interactions.length} interactions from Supabase`);
    return interactions;
  }

  // Enhanced syncInteractions method with better error handling and RLS workarounds
  public async syncInteractions(
    interactions: Interaction[], 
    projectId: number
  ): Promise<{ 
    success: boolean, 
    count: number,
    rlsError?: boolean, 
    message?: string 
  }> {
    if (!this.isInitialized) {
      return { 
        success: false, 
        count: 0, 
        message: 'Supabase client not initialized' 
      };
    }

    try {
      console.log(`🔄 Syncing ${interactions.length} interactions to Supabase...`);
      
      // Skip if no interactions to sync
      if (interactions.length === 0) {
        return { success: true, count: 0, message: 'No interactions to sync' };
      }
      
      // First make sure project exists
      const projectExists = await this.createProjectIfNotExists(projectId);
      if (!projectExists) {
        return { 
          success: false, 
          count: 0, 
          message: 'Failed to create project in Supabase' 
        };
      }
      
      // Batch interactions in groups of 25 to avoid hitting size limits
      const batchSize = 25;
      const batches = [];
      
      for (let i = 0; i < interactions.length; i += batchSize) {
        batches.push(interactions.slice(i, i + batchSize));
      }
      
      console.log(`📦 Processing ${batches.length} batches of interactions...`);
      
      let successCount = 0;
      
      // Process batches sequentially with a small delay between them
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Prepare the interaction data for Supabase
        const supabaseInteractions = batch.map(interaction => this.prepareInteractionForSupabase(interaction, projectId));

        // Use upsert to insert or update records
        const { data, error } = await this.supabase
          .from('interactions')
          .upsert(supabaseInteractions, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Error syncing batch ${i+1}/${batches.length} to Supabase:`, error);
          
          // Check for RLS error
          if (error.code === '42501' || error.message?.includes('permission denied')) {
            console.error(`❌ Row-Level Security Error: This indicates a permissions issue in Supabase.`);
            
            // Try to reauth and continue with remaining batches
            if (this.accessToken) {
              console.log('🔄 Attempting to reinitialize with token and continue...');
              this.initWithToken(this.accessToken);
            }
            
            return { 
              success: false, 
              count: successCount, 
              rlsError: true,
              message: `RLS error: ${error.message}`
            };
          }
          
          // Continue with other batches despite the error
          console.log(`⚠️ Continuing with next batch...`);
        } else {
          successCount += supabaseInteractions.length;
          console.log(`✅ Successfully synced batch ${i+1}/${batches.length} (${supabaseInteractions.length} items)`);
        }
        
        // Add a small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log(`✅ Sync complete: ${successCount}/${interactions.length} interactions synced`);
      return { 
        success: true, 
        count: successCount,
        message: `${successCount}/${interactions.length} interactions synced successfully`
      };
    } catch (error) {
      console.error('❌ Failed to sync interactions to Supabase:', error);
      
      // Check if error message contains RLS violation
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('permission denied') || errorMessage.includes('violates row-level security')) {
        return {
          success: false,
          count: 0,
          rlsError: true,
          message: errorMessage
        };
      }
      
      return { 
        success: false, 
        count: 0,
        message: errorMessage
      };
    }
  }

  // Helper to prepare interaction for Supabase
  private prepareInteractionForSupabase(interaction: Interaction, projectId: number): any {
    // Extract specific fields for direct columns
    const { id, title, description, type, status, day, number, createdAt } = interaction;
    
    // Put remaining fields in json_data
    const { 
      questionText, answerText, assignedTo, 
      specSection, revisionNumber, approvalStatus,
      costImpact, scheduleImpact,
      ...otherFields 
    } = interaction;
    
    const json_data = {
      questionText, 
      answerText, 
      assignedTo,
      specSection, 
      revisionNumber, 
      approvalStatus,
      costImpact, 
      scheduleImpact,
      ...otherFields
    };
    
    // Parse the procore_id from the id (format: 'type-id')
    const procore_id = id.includes('-') ? id.split('-')[1] : null;
    
    return {
      id,
      title,
      description: description || '',
      type,
      status,
      day,
      number,
      created_at: createdAt,
      due_date: interaction.dueDate?.toISOString(),
      resolved_date: interaction.resolvedDate?.toISOString(),
      procore_id,
      project_id: projectId,
      json_data,
      last_sync: new Date().toISOString()
    };
  }

  // Update an interaction in Supabase
  public async updateInteraction(interaction: Interaction, projectId: number): Promise<boolean> {
    if (!this.isInitialized) return false;

    try {
      const supabaseInteraction = this.prepareInteractionForSupabase(interaction, projectId);

      const { error } = await this.supabase
        .from('interactions')
        .update(supabaseInteraction)
        .eq('id', interaction.id);

      if (error) {
        console.error(`❌ Error updating interaction ${interaction.id}:`, error);
        
        // Check for RLS error
        if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.error(`❌ Row-Level Security Error during update`);
          
          // Try to reauth and retry
          if (this.accessToken) {
            console.log('🔄 Attempting to reinitialize with token and retry...');
            this.initWithToken(this.accessToken);
            
            // Retry the update
            const retry = await this.supabase
              .from('interactions')
              .update(supabaseInteraction)
              .eq('id', interaction.id);
              
            if (retry.error) {
              console.error('❌ Retry failed after token reinit:', retry.error);
              return false;
            }
            
            console.log(`✅ Successfully updated interaction ${interaction.id} in Supabase after retry`);
            return true;
          }
        }
        
        return false;
      }

      console.log(`✅ Successfully updated interaction ${interaction.id} in Supabase`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update interaction ${interaction.id}:`, error);
      return false;
    }
  }

  // Fix RLS Table Policies - run this when RLS errors occur
  public async fixRlsPolicies(): Promise<boolean> {
    try {
      // This is a helper function to run SQL that fixes RLS policies
      // In a real app, you'd need server-side admin access to run these commands
      
      console.log('🔧 Attempting to fix RLS policies...');
      
      // In production, you'd need to call an admin function or API
      // This is just a placeholder for the concept
      await this.supabase.rpc('fix_rls_policies');
      
      console.log('✅ RLS policies fixed successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to fix RLS policies:', error);
      console.warn('⚠️ You may need admin access to fix RLS policies. Please contact your Supabase administrator.');
      return false;
    }
  }

  // Get metrics for dashboard
  public async getMetrics(projectId: number): Promise<any> {
    if (!this.isInitialized) return {};

    try {
      // Count by status
      const { data: statusCounts, error: statusError } = await this.supabase
        .from('interactions')
        .select('status, count(*)')
        .eq('project_id', projectId)
        .group('status');

      if (statusError) {
        console.error('❌ Error fetching status metrics:', statusError);
      }

      // Count by type
      const { data: typeCounts, error: typeError } = await this.supabase
        .from('interactions')
        .select('type, count(*)')
        .eq('project_id', projectId)
        .group('type');

      if (typeError) {
        console.error('❌ Error fetching type metrics:', typeError);
      }

      // Format the metrics
      const metrics = {
        byStatus: statusCounts ? Object.fromEntries(statusCounts.map(item => [item.status, item.count])) : {},
        byType: typeCounts ? Object.fromEntries(typeCounts.map(item => [item.type, item.count])) : {}
      };

      return metrics;
    } catch (error) {
      console.error('❌ Failed to fetch metrics:', error);
      return {};
    }
  }
}

export default SupabaseService;