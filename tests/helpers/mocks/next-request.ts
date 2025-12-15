// Helper functions for creating NextRequest objects in tests

import { NextRequest } from 'next/server';

/**
 * Creates a NextRequest for testing API routes
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | object;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body } = options;

  const requestInit: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body =
      typeof body === 'string' ? body : JSON.stringify(body);
  }

  // Cast to any to avoid type incompatibility between standard RequestInit and Next.js RequestInit
  return new NextRequest(url, requestInit as any);
}

