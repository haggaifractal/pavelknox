# Epic 6: Action Items & Deadlines Extraction (AI-Powered)

## 1. Overview & Objective
The goal of this epic is to automatically extract actionable tasks, assignees, and deadlines from meeting summaries, legal drafts, or any other documents within the system. These extracted items will be managed globally in a dedicated "Task Center" and locally within each document's editor view.

## 2. Tech Stack & Services
- **Backend:** Next.js App Router API (`/api/tasks/extract`).
- **AI Model:** Azure OpenAI `gpt-4o` utilizing "Structured JSON Output" to enforce array schemas for reliable extraction.
- **Database:** Firebase Firestore (`tasks` collection) for managing task states, ownership, and deadlines globally.
- **Frontend Stack:** React, TailwindCSS, Framer Motion, Lucide Icons.
- **Date Handling:** `date-fns` (or naive JS dates) for formatting and parsing Israeli/Local timezone deadlines.

## 3. Data Architecture (Firestore)
**Collection:** `tasks`

```typescript
export interface Task {
  id: string; // Auto-generated document ID
  draftId: string; // The ID of the document/draft this task belongs to
  title: string; // The title of the source document
  clientName: string; // Associated client for easy filtering
  description: string; // The specific action item extracted
  assignee: string | null; // Extracted name of who is responsible
  deadline: string | null; // Extracted ISO format date for the deadline, or null if open-ended
  status: 'pending' | 'in_progress' | 'completed'; // Lifecycle state
  createdAt: number; // Timestamp Unix ms
  updatedAt: number; // Timestamp Unix ms
}
```

## 4. Backend Routing & API Design
1. **`POST /api/tasks/extract`**:
   - **Input:** `{ draftContent: string; currentDate: string }`
   - **Authentication Check:** `verifyAuth(req)`
   - **AI Prompt:** Instructions to extract an array of `Task` objects, interpreting relative dates (e.g., "by next week") using the `currentDate` contextual anchor.
   - **Response Structure:** `{ tasks: [...] }`
2. **`GET /api/tasks`** (Optional, if we want server-side fetching, otherwise standard Firestore SDK client-side fetching via `query(collection(db, "tasks"), orderBy("createdAt", "desc"))`).
3. **`PATCH /api/tasks/[taskId]`**:
   - Used to change `status` from `pending` to `completed`.
4. **`DELETE /api/tasks/[taskId]`**:
   - Discard an incorrectly extracted task.

## 5. Security Rules (`firestore.rules`)
```javascript
match /tasks/{taskId} {
  allow read: if request.auth != null && request.auth.token.role in ['superadmin', 'admin', 'viewer'];
  allow write: if request.auth != null && request.auth.token.role in ['superadmin', 'admin'];
}
```

## 6. Frontend UI Components & Pages

### A. The Global Dashboard "Task Center" (`/tasks`)
- A new top-level page accessible via the main sidebar.
- Displays a Kanban board or a Data Table of all pending tasks across the company.
- **Filters:** By `clientName`, by `assignee`, by `status`.
- **Sorting:** By nearest `deadline`.
- **Inline Actions:** Click checkbox to mark `completed`. Click a row to navigate to the original `draftId` that spawned the task.

### B. Draft Editor Side-Panel (`/drafts/[id]`)
- Introduce a new "Tasks / Action Items" sliding panel or Accordion tab on the right side of the editor.
- **Extract Button:** "Extract Tasks (AI)" - which calls `/api/tasks/extract` and shows a list of proposed tasks.
- The user can select the valid tasks from the AI's suggestions and hit "Save to Project".
- **List View:** Shows all *currently saved* tasks for this document and allows checking them off inline as the team works on them.

## 7. Next Steps for Implementation (Checklist for New Chat)
1. **[  ] Firestore & Models:** Create the `Task` interface definition, update security rules, and generate backend indices for querying fields (`draftId`, `assignee`, `status`).
2. **[  ] AI Route (`/api/tasks/extract`):** Build the extraction API with precise OpenAI system prompting ensuring reliable JSON output.
3. **[  ] Draft Integration:** Update the `DraftEditorPage` to include a slide-out Tasks panel where users can trigger AI extraction and save tasks.
4. **[  ] Task Center UI:** Build the `/tasks` route, implementing the table/Kanban view, status updates, and language localization (`he.ts` / `en.ts`).
