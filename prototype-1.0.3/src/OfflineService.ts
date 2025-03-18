// OfflineService.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Define types directly inside the file for independence
type InteractionType = 'rfi' | 'submittal' | 'email' | 'change' | 'financial';
type InteractionStatus = 'open' | 'in_progress' | 'resolved' | 'critical';

interface Interaction {
  id: string;
  title: string;
  description?: string;
  type: InteractionType | string;
  status: InteractionStatus | string;
  day: number;
  number?: string;
  createdAt?: string;
  dueDate?: Date;
  resolvedDate?: Date;
  questionText?: string;
  answerText?: string;
  assignedTo?: string;
  specSection?: string;
  revisionNumber?: string;
  approvalStatus?: string;
  costImpact?: number;
  scheduleImpact?: number;
  _syncPending?: boolean;
  _localStatus?: string;
}

// Interface for queued operations
interface SyncOperation {
  id: string;
  action: 'create' | 'update' | 'delete';
  timestamp: number;
  resource: 'interaction' | 'project';
  data: any;
  status: 'pending' | 'failed' | 'synced';
  retryCount: number;
  error?: string;
}

// Interface for sync status notification event
interface SyncStatusEvent {
  isOnline: boolean;
  pendingCount: number;
  syncInProgress: boolean;
  lastSyncTime: number | null;
}

class OfflineService {
  private static instance: OfflineService;
  private supabase: SupabaseClient;
  private isInitialized: boolean = false;
  private isOnline: boolean = true;
  private syncIntervalId: number | null = null;
  private pendingSyncCount: number = 0;
  private isSyncing: boolean = false;
  private lastSyncTime: number | null = null;
  private syncStatusListeners: ((status: SyncStatusEvent) => void)[] = [];

  // Private constructor - this is a singleton
  private constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('🚨 Supabase configuration missing! Please check your .env file');
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.isInitialized = true;
    
    // Setup online/offline event listeners
    window.addEventListener('online', this.handleConnectionChange);
    window.addEventListener('offline', this.handleConnectionChange);
    
    // Check initial status
    this.isOnline = navigator.onLine;
    
    // Start sync interval
    this.startSyncInterval();
    
    console.log(`🔄 OfflineService initialized. Network status: ${this.isOnline ? 'online ✅' : 'offline ❌'}`);
  }

  // Get singleton instance
  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }
  
  // Handle online/offline events
  private handleConnectionChange = () => {
    const wasOnline = this.isOnline;
    this.isOnline = navigator.onLine;
    
    console.log(`🌐 Network status changed: ${this.isOnline ? 'online ✅' : 'offline ❌'}`);
    
    // If we just came back online, trigger a sync
    if (!wasOnline && this.isOnline) {
      console.log('🔄 Back online, starting sync...');
      this.syncPendingOperations();
    }
    
    // Notify listeners of status change
    this.notifySyncStatusListeners();
  };
  
  // Notify all registered listeners of sync status change
  private notifySyncStatusListeners(): void {
    const status: SyncStatusEvent = {
      isOnline: this.isOnline,
      pendingCount: this.pendingSyncCount,
      syncInProgress: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    };
    
    this.syncStatusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }
  
  // Start background sync interval
  private startSyncInterval() {
    if (this.syncIntervalId !== null) return;
    
    this.syncIntervalId = window.setInterval(() => {
      this.refreshPendingCount();
      
      // Only attempt sync if online
      if (this.isOnline && this.pendingSyncCount > 0 && !this.isSyncing) {
        console.log(`🔄 Sync interval triggered with ${this.pendingSyncCount} pending operations`);
        this.syncPendingOperations();
      }
    }, 60000); // Check every minute
  }
  
  // Register for sync status updates
  public addSyncStatusListener(callback: (status: SyncStatusEvent) => void): () => void {
    this.syncStatusListeners.push(callback);
    
    // Immediately call with current status
    callback({
      isOnline: this.isOnline,
      pendingCount: this.pendingSyncCount,
      syncInProgress: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    });
    
    // Return a function to remove the listener
    return () => {
      this.syncStatusListeners = this.syncStatusListeners.filter(listener => listener !== callback);
    };
  }
  
  // Get network status
  public isNetworkOnline(): boolean {
    return this.isOnline;
  }
  
  // Get number of pending operations
  public async getPendingSyncCount(): Promise<number> {
    await this.refreshPendingCount();
    return this.pendingSyncCount;
  }
  
  // Refresh the pending count from storage
  private async refreshPendingCount(): Promise<void> {
    if (!this.isInitialized) {
      this.pendingSyncCount = 0;
      return;
    }
    
    try {
      const { count, error } = await this.supabase
        .from('sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (error) throw error;
      
      const oldCount = this.pendingSyncCount;
      this.pendingSyncCount = count || 0;
      
      // Notify if count changed
      if (oldCount !== this.pendingSyncCount) {
        this.notifySyncStatusListeners();
      }
    } catch (error) {
      console.error('Failed to get pending sync count:', error);
      // Don't update count on error
    }
  }
  
  // Add operation to sync queue
  public async queueOperation(
    action: 'create' | 'update' | 'delete',
    resource: 'interaction' | 'project',
    data: any
  ): Promise<boolean> {
    if (!this.isInitialized) return false;
    
    try {
      const operation: SyncOperation = {
        id: `${resource}-${data.id}-${Date.now()}`,
        action,
        timestamp: Date.now(),
        resource,
        data,
        status: 'pending',
        retryCount: 0
      };
      
      const { error } = await this.supabase
        .from('sync_queue')
        .insert(operation);
      
      if (error) throw error;
      
      // Update pending count
      await this.refreshPendingCount();
      
      // If online, attempt immediate sync
      if (this.isOnline && !this.isSyncing) {
        this.syncPendingOperations();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to queue operation:', error);
      return false;
    }
  }
  
  // Process any pending operations in the sync queue
  public async syncPendingOperations(): Promise<void> {
    if (!this.isInitialized || !this.isOnline || this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      this.notifySyncStatusListeners();
      
      // Get pending operations ordered by timestamp
      const { data: operations, error } = await this.supabase
        .from('sync_queue')
        .select('*')
        .eq('status', 'pending')
        .order('timestamp', { ascending: true })
        .limit(10); // Process in batches
      
      if (error) throw error;
      
      if (!operations || operations.length === 0) {
        console.log('✅ No pending operations to sync');
        this.isSyncing = false;
        this.lastSyncTime = Date.now();
        this.notifySyncStatusListeners();
        return;
      }
      
      console.log(`🔄 Syncing ${operations.length} pending operations`);
      
      // Process each operation
      for (const operation of operations) {
        try {
          // Send to server (this would be your API call)
          await this.processOperation(operation);
          
          // Mark as synced
          await this.supabase
            .from('sync_queue')
            .update({ 
              status: 'synced',
              last_sync: new Date().toISOString()
            })
            .eq('id', operation.id);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          
          // Increment retry count and maybe mark as failed
          const retryCount = operation.retryCount + 1;
          const status = retryCount >= 3 ? 'failed' : 'pending';
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          await this.supabase
            .from('sync_queue')
            .update({ 
              status, 
              retryCount,
              error: errorMessage
            })
            .eq('id', operation.id);
        }
      }
      
      // Update pending count
      await this.refreshPendingCount();
      this.lastSyncTime = Date.now();
      
      // If we had operations and there might be more, continue syncing
      if (operations.length === 10 && this.pendingSyncCount > 0) {
        setTimeout(() => this.syncPendingOperations(), 1000); // Small delay before continuing
      } else {
        this.isSyncing = false;
        this.notifySyncStatusListeners();
      }
    } catch (error) {
      console.error('Error during sync process:', error);
      this.isSyncing = false;
      this.notifySyncStatusListeners();
    }
  }
  
  // Process an individual operation - this is where you'd make API calls
  private async processOperation(operation: SyncOperation): Promise<void> {
    // This would be replaced with your actual API calls to Procore or other backend
    
    if (operation.resource === 'interaction') {
      const interaction = operation.data as Interaction;
      
      // Mock API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // For demo purposes, we're assuming success, but in a real implementation
      // you would call the real API endpoints here.
      console.log(`Successfully processed ${operation.action} for interaction ${interaction.id}`);
    } else if (operation.resource === 'project') {
      // Similar logic for projects
      console.log(`Would process ${operation.action} for project`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Create an interaction that works offline
  public async createInteraction(interaction: Interaction, projectId: number): Promise<Interaction> {
    // First, save to local database
    const dbRecord = this.mapInteractionToDbRecord(interaction, projectId);
    
    const { data, error } = await this.supabase
      .from('interactions')
      .insert({
        ...dbRecord,
        _local_status: 'created',
        _sync_pending: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Queue for server sync
    await this.queueOperation('create', 'interaction', interaction);
    
    // Return the created interaction
    return this.mapDbRecordToInteraction(data);
  }
  
  // Update an interaction with offline support
  public async updateInteraction(interaction: Interaction, projectId: number): Promise<Interaction> {
    // First, update in local database
    const dbRecord = this.mapInteractionToDbRecord(interaction, projectId);
    
    const { data, error } = await this.supabase
      .from('interactions')
      .update({
        ...dbRecord,
        _local_status: 'updated',
        _sync_pending: true
      })
      .eq('id', interaction.id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Queue for server sync
    await this.queueOperation('update', 'interaction', interaction);
    
    // Return the updated interaction
    return this.mapDbRecordToInteraction(data);
  }
  
  // Delete an interaction with offline support
  public async deleteInteraction(interactionId: string, projectId: number): Promise<void> {
    // First, mark as deleted in local database
    const { error } = await this.supabase
      .from('interactions')
      .update({
        _local_status: 'deleted',
        _sync_pending: true
      })
      .eq('id', interactionId);
    
    if (error) throw error;
    
    // Queue for server sync
    await this.queueOperation('delete', 'interaction', { id: interactionId, projectId });
  }
  
  // Helper to map Interaction to database record
  private mapInteractionToDbRecord(interaction: Interaction, projectId: number): any {
    const { 
      id, title, description, type, status, day, 
      number, createdAt, questionText, answerText, 
      assignedTo, specSection, revisionNumber, 
      approvalStatus, costImpact, scheduleImpact,
      ...otherFields
    } = interaction;
    
    // Put non-standard fields in json_data
    const json_data = {
      questionText, answerText, assignedTo, specSection, 
      revisionNumber, approvalStatus, costImpact, 
      scheduleImpact, ...otherFields
    };
    
    // Parse the procore_id from the id if available
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
  
  // Helper to map database record to Interaction
  private mapDbRecordToInteraction(data: any): Interaction {
    return {
      id: data.id,
      title: data.title,
      description: data.description || '',
      type: data.type,
      status: data.status,
      day: data.day,
      number: data.number,
      createdAt: data.created_at,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      resolvedDate: data.resolved_date ? new Date(data.resolved_date) : undefined,
      questionText: data.json_data?.questionText,
      answerText: data.json_data?.answerText,
      assignedTo: data.json_data?.assignedTo,
      specSection: data.json_data?.specSection,
      revisionNumber: data.json_data?.revisionNumber,
      approvalStatus: data.json_data?.approvalStatus,
      costImpact: data.json_data?.costImpact,
      scheduleImpact: data.json_data?.scheduleImpact,
      // Include _sync_pending and _local_status for UI indicators
      _syncPending: data._sync_pending,
      _localStatus: data._local_status
    };
  }
  
  // Get interactions with offline support
  public async getInteractions(projectId: number): Promise<Interaction[]> {
    const { data, error } = await this.supabase
      .from('interactions')
      .select('*')
      .eq('project_id', projectId)
      .neq('_local_status', 'deleted'); // Don't show locally deleted items
    
    if (error) throw error;
    
    return (data || []).map(this.mapDbRecordToInteraction);
  }
  
  // Get failed sync operations
  public async getFailedSyncOperations(): Promise<SyncOperation[]> {
    const { data, error } = await this.supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'failed')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  }
  
  // Retry failed operations
  public async retryFailedOperation(operationId: string): Promise<boolean> {
    // Reset retry count and status
    const { error } = await this.supabase
      .from('sync_queue')
      .update({ 
        status: 'pending', 
        retryCount: 0,
        error: null
      })
      .eq('id', operationId);
    
    if (error) {
      console.error('Failed to retry operation:', error);
      return false;
    }
    
    // Update pending count
    await this.refreshPendingCount();
    
    // If online, trigger sync
    if (this.isOnline && !this.isSyncing) {
      this.syncPendingOperations();
    }
    
    return true;
  }
  
  // Manual sync trigger
  public async manualSync(): Promise<boolean> {
    if (!this.isOnline || this.isSyncing) {
      return false;
    }
    
    await this.refreshPendingCount();
    
    if (this.pendingSyncCount > 0) {
      await this.syncPendingOperations();
      return true;
    }
    
    return false;
  }
  
  // Cleanup when no longer needed
  public cleanup(): void {
    // Remove event listeners
    window.removeEventListener('online', this.handleConnectionChange);
    window.removeEventListener('offline', this.handleConnectionChange);
    
    // Clear sync interval
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    
    // Clear listeners
    this.syncStatusListeners = [];
  }
}

// SyncStatusIndicator React component for UI
/*
import React, { useState, useEffect } from 'react';
import OfflineService from './OfflineService';

export const SyncStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState({
    isOnline: true,
    pendingCount: 0,
    syncInProgress: false,
    lastSyncTime: null as number | null
  });
  
  useEffect(() => {
    const offlineService = OfflineService.getInstance();
    
    // Register for status updates
    const unsubscribe = offlineService.addSyncStatusListener(setStatus);
    
    // Cleanup on unmount
    return unsubscribe;
  }, []);
  
  // Format time relative to now (e.g., "5 minutes ago")
  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };
  
  return (
    <div className="sync-status-indicator">
      <div className={`status-icon ${status.isOnline ? 'online' : 'offline'}`}>
        {status.isOnline ? '🟢' : '🔴'}
      </div>
      <div className="status-text">
        {status.isOnline ? 'Online' : 'Offline'}
        {status.pendingCount > 0 && (
          <span className="pending-count">
            {status.pendingCount} pending {status.pendingCount === 1 ? 'change' : 'changes'}
          </span>
        )}
        {status.syncInProgress && <span className="sync-progress">Syncing...</span>}
        {status.lastSyncTime && (
          <span className="last-sync">
            Last synced: {formatTime(status.lastSyncTime)}
          </span>
        )}
      </div>
      {status.isOnline && status.pendingCount > 0 && !status.syncInProgress && (
        <button 
          className="sync-button"
          onClick={() => OfflineService.getInstance().manualSync()}
        >
          Sync Now
        </button>
      )}
    </div>
  );
};
*/

export default OfflineService;

// SQL for table creation
/*
-- Create sync_queue table for offline operations
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  resource TEXT NOT NULL,
  data JSONB NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  last_sync TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);

-- Add columns to interactions table for offline status
ALTER TABLE interactions 
ADD COLUMN IF NOT EXISTS _sync_pending BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS _local_status TEXT;

-- Create RLS policies for sync_queue
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_queue_select_policy" 
ON sync_queue FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "sync_queue_insert_policy" 
ON sync_queue FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "sync_queue_update_policy" 
ON sync_queue FOR UPDATE TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "sync_queue_delete_policy" 
ON sync_queue FOR DELETE TO authenticated 
USING (true);
*/