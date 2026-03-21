export interface Task {
  id?: string; // Optional because when we create it, Firestore generates the ID
  sourceId: string; // The ID of the document/draft this task belongs to
  sourceType: 'draft' | 'knowledge';
  title: string; // The title of the source document for context
  clientName?: string; // Associated client for easy filtering
  projectName?: string; // Associated project name
  description: string; // The specific action item extracted
  assignee: string | null; // Extracted name of who is responsible
  deadline: string | null; // Extracted ISO format date string for the deadline, or null if open-ended
  status: 'pending' | 'in_progress' | 'completed'; // Lifecycle state
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
}
