import { NextRequest } from 'next/server';
import { adminAuth } from './admin';

/**
 * Extracts and verifies the Bearer token from the request header.
 * Returns the decoded token if valid, otherwise null.
 */
export async function verifyAuth(request: Request | NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

/**
 * Checks if the request is made by a superadmin.
 */
export async function verifySuperAdmin(request: Request | NextRequest) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) return null;
  
  if (decodedToken.role === 'superadmin') {
    return decodedToken;
  }
  return null;
}

/**
 * Checks if the request is made by an admin or superadmin.
 */
export async function verifyAdmin(request: Request | NextRequest) {
  const decodedToken = await verifyAuth(request);
  if (!decodedToken) return null;
  
  if (decodedToken.role === 'admin' || decodedToken.role === 'superadmin') {
    return decodedToken;
  }
  return null;
}
