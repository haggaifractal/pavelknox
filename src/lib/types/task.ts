export interface Task {
  id?: string; // Optional because when we create it, Firestore generates the ID
  sourceId: string; // The ID of the document/draft this task belongs to
  sourceType: 'draft' | 'knowledge';
  title: string; // The title of the source document for context
  clientName?: string; // Associated client for easy filtering
  projectName?: string; // Associated project name
  description: string; // The specific action item extracted
  assignee: string | null; // Extracted name of who is responsible or external contact name
  assigneeId?: string | null; // UID of the system user, if applicable
  externalContactName?: string | null; // Name of external contact if not a system user
  deadline: string | null; // Extracted ISO format date string for the deadline, or null if open-ended
  status: 'pending' | 'in_progress' | 'completed'; // Lifecycle state
  statusUpdatedAt?: any; // Firestore Timestamp or Date of last status change
  visibilityScope?: 'global' | 'department'; // Who can see this task
  departmentIds?: string[]; // Departments this task belongs to
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
  isBillable?: boolean; // Whether time spent on this task is billable
  timeEntries?: TimeEntry[]; // Logged time entries
  totalLoggedMinutes?: number; // Cached total of logged time
}

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  date: string;
  minutes: number;
  description?: string;
}
