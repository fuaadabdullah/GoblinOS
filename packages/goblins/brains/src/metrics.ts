import express, { Request, Response } from 'express';
import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from 'prom-client';

// Enable default metrics collection
collectDefaultMetrics();

// Custom metrics for LiteBrain scaling
const complexityScore = new Gauge({
  name: 'litebrain_complexity_score',
  help: 'Current complexity score based on request patterns (0-100)',
  labelNames: ['model', 'guild']
});

const activeRequests = new Gauge({
  name: 'litebrain_active_requests',
  help: 'Number of currently active LiteBrain requests',
  labelNames: ['model', 'guild']
});

const requestDuration = new Histogram({
  name: 'litebrain_request_duration_seconds',
  help: 'Duration of LiteBrain requests in seconds',
  labelNames: ['model', 'guild', 'complexity'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const requestTotal = new Counter({
  name: 'litebrain_requests_total',
  help: 'Total number of LiteBrain requests',
  labelNames: ['model', 'guild', 'complexity', 'status']
});

const resourceUsage = new Gauge({
  name: 'litebrain_resource_usage',
  help: 'Resource usage metrics for scaling decisions',
  labelNames: ['resource_type', 'model']
});

// Complexity calculation based on request patterns
export class ComplexityTracker {
  private complexityHistory: number[] = [];
  private readonly maxHistorySize = 100;

  addComplexityScore(score: number) {
    this.complexityHistory.push(score);
    if (this.complexityHistory.length > this.maxHistorySize) {
      this.complexityHistory.shift();
    }
  }

  getAverageComplexity(): number {
    if (this.complexityHistory.length === 0) return 0;
    return this.complexityHistory.reduce((a, b) => a + b, 0) / this.complexityHistory.length;
  }

  getComplexityTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.complexityHistory.length < 10) return 'stable';

    const recent = this.complexityHistory.slice(-10);
    const older = this.complexityHistory.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const diff = recentAvg - olderAvg;
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }
}

// Global complexity tracker
export const globalComplexityTracker = new ComplexityTracker();

// Metrics collection functions
export function recordRequestStart(model: string, guild: string) {
  activeRequests.inc({ model, guild });
}

export function recordRequestEnd(
  model: string,
  guild: string,
  complexity: 'low' | 'medium' | 'high',
  status: 'success' | 'error',
  duration: number
) {
  activeRequests.dec({ model, guild });
  requestTotal.inc({ model, guild, complexity, status });
  requestDuration.observe({ model, guild, complexity }, duration);

  // Update complexity score based on request patterns
  const score = getComplexityScore(complexity);
  globalComplexityTracker.addComplexityScore(score);

  // Update the gauge with current average
  const avgComplexity = globalComplexityTracker.getAverageComplexity();
  complexityScore.set({ model, guild }, avgComplexity);
}

export function updateResourceUsage(resourceType: string, model: string, value: number) {
  resourceUsage.set({ resource_type: resourceType, model }, value);
}

function getComplexityScore(complexity: 'low' | 'medium' | 'high'): number {
  switch (complexity) {
    case 'low': return 25;
    case 'medium': return 50;
    case 'high': return 85;
    default: return 50;
  }
}

// Express app for metrics endpoint
const app = express();

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    complexity: {
      average: globalComplexityTracker.getAverageComplexity(),
      trend: globalComplexityTracker.getComplexityTrend()
    }
  });
});

// Start metrics server
export function startMetricsServer(port: number = 9090) {
  app.listen(port, () => {
    console.log(`Metrics server listening on port ${port}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down metrics server...');
  process.exit(0);
});
