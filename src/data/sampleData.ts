// src/data/sampleData.ts
import { Interaction, TimelineData } from '../models/InteractionTypes';

// Sample data for timeline
export const sampleTimelineData: TimelineData = {
  project: {
    id: "proj-001",
    name: "AEC Test Project",
    start_date: "2025-01-01T00:00:00Z",
    duration_days: 180
  },
  interactions: [
    // Project Start (added to match our existing data)
    {
      id: "proj-001",
      title: "Project Start",
      description: "Project kickoff",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      status: "Approved",
      day: 0,
      owner: "Nathan Smith",
      type: "projectstart"
    },
    // RFIs
    {
      id: "rfi-001",
      title: "TEST RFI 001",
      description: "Question about foundation details",
      created_at: "2025-01-29T10:15:00Z",
      updated_at: "2025-01-29T10:15:00Z",
      status: "Open",
      day: 28,
      owner: "Nathan Smith",
      due_date: "2025-02-05T10:15:00Z",
      type: "rfi",
      question: "What is the required concrete strength for the east foundation?",
      assignee: "Jane Engineer",
      cost_impact: 0,
      schedule_impact: 0
    },
    {
      id: "rfi-002",
      title: "TEST RFI 002",
      description: "Clarification on HVAC routing",
      created_at: "2025-02-12T14:30:00Z",
      updated_at: "2025-02-13T09:45:00Z",
      status: "In Progress",
      day: 42,
      owner: "Nathan Smith",
      due_date: "2025-02-19T14:30:00Z",
      type: "rfi",
      question: "Please clarify HVAC duct routing through structural beams on level 3",
      assignee: "Mark Architect",
      cost_impact: 5000,
      schedule_impact: 2
    },
    
    // Submittals
    {
      id: "sub-001",
      title: "Concrete Mix Design",
      description: "Submittal for foundation concrete mix",
      created_at: "2025-01-15T09:20:00Z",
      updated_at: "2025-01-20T11:35:00Z",
      status: "Approved",
      day: 14,
      owner: "Concrete Subcontractor",
      type: "submittal",
      spec_section: "03 30 00",
      submission_date: "2025-01-15T09:20:00Z",
      review_date: "2025-01-20T11:35:00Z",
      reviewer: "Structural Engineer",
      revision_number: 0
    },
    {
      id: "sub-002",
      title: "Exterior Window Shop Drawings",
      description: "Window manufacturer shop drawings",
      created_at: "2025-02-05T13:45:00Z",
      updated_at: "2025-02-07T10:10:00Z",
      status: "Rejected",
      day: 35,
      owner: "Glazing Contractor",
      type: "submittal",
      spec_section: "08 51 13",
      submission_date: "2025-02-05T13:45:00Z",
      review_date: "2025-02-07T10:10:00Z",
      reviewer: "Architect",
      revision_number: 1
    },
    
    // Emails
    {
      id: "email-001",
      title: "Weekly Progress Meeting Minutes",
      description: "Minutes from the weekly team meeting",
      created_at: "2025-01-10T16:30:00Z",
      updated_at: "2025-01-10T16:30:00Z",
      status: "Closed",
      day: 9,
      owner: "Project Manager",
      type: "email",
      sender: "project.manager@example.com",
      recipients: ["team@example.com"],
      subject: "Weekly Progress Meeting Minutes - Week 2",
      attachments: ["meeting_minutes_week2.pdf"]
    },
    
    // Change Events
    {
      id: "chg-001",
      title: "Additional Site Drainage",
      description: "Extra drainage required due to soil conditions",
      created_at: "2025-02-20T11:20:00Z",
      updated_at: "2025-02-22T09:15:00Z",
      status: "Open",
      day: 50,
      owner: "Civil Engineer",
      type: "change_event",
      change_type: "PCO",
      cost_impact: 12500,
      schedule_impact: 3,
      approval_required_by: ["Owner", "Architect"]
    },
    
    // Financials
    {
      id: "fin-001",
      title: "Initial Budget Approval",
      description: "Approval of project baseline budget",
      created_at: "2025-01-05T10:00:00Z",
      updated_at: "2025-01-05T10:00:00Z",
      status: "Approved",
      day: 4,
      owner: "Finance Department",
      type: "financial",
      financial_type: "Budget Update",
      amount: 2500000,
      currency: "USD"
    }
  ]
};