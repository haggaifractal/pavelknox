import { adminDb } from '@/lib/firebase/admin';

export type AuditActionType = 
    | 'DELETE_DRAFT'
    | 'DELETE_KNOWLEDGE'
    | 'DELETE_TAG'
    | 'DELETE_CLIENT'
    | 'DELETE_TASK'
    | 'BULK_CLEANUP_RAW_INPUTS'
    | 'BULK_CLEANUP_ALL';

export interface AuditLogEntry {
    actionType: AuditActionType;
    userId: string;
    userEmail: string;
    targetId?: string; // e.g. the ID of the deleted draft or tag
    details?: Record<string, any>;
    timestamp: Date;
}

/**
 * Creates an audit log entry securely on the server.
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>) {
    try {
        await adminDb.collection('audit_logs').add({
            ...entry,
            timestamp: new Date()
        });
        console.log(`[AUDIT] Action ${entry.actionType} performed by ${entry.userEmail} on target ${entry.targetId}`);
    } catch (error) {
        // We log the error but do not throw it to prevent blocking the main action in case of audit failure
        console.error('Failed to create audit log:', error);
    }
}
