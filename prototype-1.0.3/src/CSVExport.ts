// services/CSVExport.ts - Utility for exporting interactions to CSV
import { Interaction } from '../InteractionTypes';

/**
 * Options for CSV export
 */
export interface CSVExportOptions {
  /** Include header row with column names */
  includeHeader?: boolean;
  /** CSV delimiter character */
  delimiter?: string;
  /** Quote character for fields with special characters */
  quoteChar?: string;
  /** Fields to include in the export */
  fields?: Array<keyof Interaction | string>;
  /** Filename for the download (without extension) */
  filename?: string;
  /** Custom field formatters */
  formatters?: Record<string, (value: any) => string>;
}

/**
 * Default export options
 */
const defaultOptions: CSVExportOptions = {
  includeHeader: true,
  delimiter: ',',
  quoteChar: '"',
  filename: 'aecent-export',
  fields: [
    'id',
    'title',
    'description',
    'type',
    'status',
    'day',
    'number',
    'createdAt',
    'dueDate',
    'resolvedDate',
    'assignedTo',
    'questionText',
    'answerText',
    'specSection',
    'revisionNumber'
  ],
  formatters: {
    createdAt: (value) => value ? new Date(value).toLocaleDateString() : '',
    dueDate: (value) => value instanceof Date ? value.toLocaleDateString() : value ? new Date(value).toLocaleDateString() : '',
    resolvedDate: (value) => value instanceof Date ? value.toLocaleDateString() : value ? new Date(value).toLocaleDateString() : ''
  }
};

/**
 * Format a single field for CSV export, handling special characters
 */
function formatCSVField(value: any, quoteChar: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if field needs quoting
  if (stringValue.includes(quoteChar) || stringValue.includes('\n') || stringValue.includes(',')) {
    // Escape any quote characters by doubling them
    const escapedValue = stringValue.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar);
    return `${quoteChar}${escapedValue}${quoteChar}`;
  }
  
  return stringValue;
}

/**
 * Exports interactions to CSV format and triggers a download
 */
export function exportToCSV(interactions: Interaction[], options: CSVExportOptions = {}): void {
  // Merge options with defaults
  const opts = { ...defaultOptions, ...options };
  const { includeHeader, delimiter, quoteChar, fields, filename, formatters } = opts;
  
  // Initialize CSV content
  let csvContent = '';
  
  // Add header row if requested
  if (includeHeader && fields) {
    const headerRow = fields.map(field => {
      // Convert field names to readable format (e.g., createdAt -> Created At)
      const headerText = String(field)
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();
      
      return formatCSVField(headerText, quoteChar!);
    }).join(delimiter);
    
    csvContent += headerRow + '\n';
  }
  
  // Add data rows
  interactions.forEach(interaction => {
    if (!fields) return;
    
    const row = fields.map(field => {
      // Get the raw value
      const rawValue = field in interaction 
        ? (interaction as any)[field] 
        : '';
      
      // Apply formatter if available
      let formattedValue = rawValue;
      if (formatters && field in formatters) {
        try {
          formattedValue = formatters[field](rawValue);
        } catch (error) {
          console.error(`Error formatting field ${field}:`, error);
          formattedValue = rawValue;
        }
      }
      
      return formatCSVField(formattedValue, quoteChar!);
    }).join(delimiter);
    
    csvContent += row + '\n';
  });
  
  // Create downloadable blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create download link and trigger click
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper function to export selected interactions
 */
export function exportSelectedInteractions(
  interactions: Interaction[], 
  selectedIds: string[],
  options: CSVExportOptions = {}
): void {
  // Filter to only selected interactions
  const selectedInteractions = interactions.filter(i => selectedIds.includes(i.id));
  
  // Use the export function with selected interactions
  exportToCSV(selectedInteractions, {
    ...options,
    filename: `${options.filename || 'selected-interactions'}-${new Date().toISOString().slice(0, 10)}`
  });
}

/**
 * Helper for UI component to export interactions by type
 */
export function exportByType(
  interactions: Interaction[],
  type: string,
  options: CSVExportOptions = {}
): void {
  const typeInteractions = interactions.filter(i => i.type === type);
  
  exportToCSV(typeInteractions, {
    ...options,
    filename: `${type}-${new Date().toISOString().slice(0, 10)}`
  });
}