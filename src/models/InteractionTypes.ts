// src/models/InteractionTypes.ts

// Core interaction interface that all types extend
export interface BaseInteraction {
    id: string;
    title: string;
    description: string;
    created_at: string; // ISO date string
    updated_at: string;
    status: "Open" | "In Progress" | "Resolved" | "Closed" | "Approved" | "Rejected";
    day: number; // Position on timeline (days from project start)
    owner: string;
    due_date?: string; // ISO date string
    type: "rfi" | "submittal" | "email" | "change_event" | "financial" | "projectstart";
  }
  
  // RFI specific properties
  export interface RFI extends BaseInteraction {
    type: "rfi";
    question: string;
    answer?: string;
    assignee: string;
    cost_impact?: number;
    schedule_impact?: number;
  }
  
  // Submittal specific properties
  export interface Submittal extends BaseInteraction {
    type: "submittal";
    spec_section: string;
    submission_date: string;
    review_date?: string;
    reviewer: string;
    revision_number: number;
  }
  
  // Email specific properties
  export interface Email extends BaseInteraction {
    type: "email";
    sender: string;
    recipients: string[];
    subject: string;
    attachments?: string[];
    thread_id?: string;
  }
  
  // Change Event specific properties
  export interface ChangeEvent extends BaseInteraction {
    type: "change_event";
    change_type: "PCO" | "COR" | "ASI" | "RFP" | "CO";
    cost_impact: number;
    schedule_impact: number;
    approval_required_by: string[];
  }
  
  // Financial specific properties
  export interface Financial extends BaseInteraction {
    type: "financial";
    financial_type: "Budget Update" | "Cost Impact" | "Invoice" | "Payment";
    amount: number;
    currency: string;
    related_interactions?: string[]; // IDs of related interactions
  }
  
  // Union type for all interaction types
  export type Interaction = RFI | Submittal | Email | ChangeEvent | Financial;
  
  // Timeline data structure
  export interface TimelineData {
    project: {
      id: string;
      name: string;
      start_date: string; // ISO date string
      end_date?: string;  // ISO date string
      duration_days: number;
    };
    interactions: Interaction[];
  }