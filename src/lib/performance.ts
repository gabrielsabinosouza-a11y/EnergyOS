import type { NextRequest } from "next/server";

/**
 * Performance monitoring utilities for tracking request durations and identifying slow operations.
 * This helps prevent future performance regressions.
 */

interface PerformanceMetrics {
  requestId: string;
  route: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  dbQueries: Array<{ query: string; duration: number }>;
  isSlow: boolean;
}

const activeMetrics: Map<string, PerformanceMetrics> = new Map();
const SLOW_THRESHOLD_MS = 1000; // Consider requests > 1s as slow

/**
 * Generate a unique request ID for correlation
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Start tracking performance for a request
 */
export function startPerformanceTracking(request: NextRequest): PerformanceMetrics {
  const requestId = generateRequestId();
  const route = request.nextUrl.pathname;
  const method = request.method;
  
  const metrics: PerformanceMetrics = {
    requestId,
    route,
    method,
    startTime: Date.now(),
    dbQueries: [],
    isSlow: false,
  };
  
  activeMetrics.set(requestId, metrics);
  
  // Add request ID to headers for correlation
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  
  return metrics;
}

/**
 * End tracking and log performance metrics
 */
export function endPerformanceTracking(requestId: string, status: number): PerformanceMetrics | null {
  const metrics = activeMetrics.get(requestId);
  if (!metrics) return null;
  
  metrics.endTime = Date.now();
  metrics.duration = metrics.endTime - metrics.startTime;
  metrics.isSlow = metrics.duration > SLOW_THRESHOLD_MS;
  
  activeMetrics.delete(requestId);
  
  // Log slow requests
  if (metrics.isSlow) {
    console.warn(`[PERF] Slow request: ${metrics.method} ${metrics.route} took ${metrics.duration}ms`);
    if (metrics.dbQueries.length > 0) {
      const slowQueries = metrics.dbQueries.filter(q => q.duration > 100);
      if (slowQueries.length > 0) {
        console.warn(`[PERF] Slow queries for ${requestId}:`);
        for (const q of slowQueries) {
          console.warn(`  - ${q.duration}ms: ${q.query.slice(0, 100)}...`);
        }
      }
    }
  }
  
  return metrics;
}

/**
 * Track a database query duration
 */
export function trackQuery(requestId: string, query: string, duration: number): void {
  const metrics = activeMetrics.get(requestId);
  if (metrics) {
    metrics.dbQueries.push({ query, duration });
  }
}

/**
 * Create a performance wrapper for database queries
 * Usage: const result = await trackDbQuery(requestId, pool.query(...));
 */
export async function trackDbQuery<T>(
  requestId: string,
  queryPromise: Promise<T>,
  queryDescription?: string
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryPromise;
    const duration = Date.now() - start;
    trackQuery(requestId, queryDescription || 'unknown', duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    trackQuery(requestId, queryDescription || 'failed', duration);
    throw error;
  }
}

/**
 * Get a summary of current performance metrics
 */
export function getPerformanceSummary(): {
  activeRequests: number;
  slowRequests: number;
  avgDuration: number | null;
} {
  const durations = Array.from(activeMetrics.values())
    .filter(m => m.duration)
    .map(m => m.duration!);
  
  return {
    activeRequests: activeMetrics.size,
    slowRequests: durations.filter(d => d > SLOW_THRESHOLD_MS).length,
    avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
  };
}

/**
 * Middleware wrapper for API routes
 * Usage: return withPerformanceTracking(request, handler);
 */
export async function withPerformanceTracking<T>(
  request: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  const metrics = startPerformanceTracking(request);
  
  try {
    const result = await handler();
    endPerformanceTracking(metrics.requestId, 200);
    return result;
  } catch (error) {
    endPerformanceTracking(metrics.requestId, 500);
    throw error;
  }
}
