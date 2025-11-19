// Shared API types for dashboard runtime/tauri clients
export interface Goblin {
    id: string;
    title: string;
    guild: string;
    responsibilities?: string[];
}

export interface GoblinTask {
    goblin: string;
    task: string;
    context?: Record<string, unknown>;
    dryRun?: boolean;
}

export interface GoblinResponse {
    goblin: string;
    task: string;
    tool?: string;
    command?: string;
    output?: string;
    reasoning: string;
    timestamp: Date;
    duration_ms: number;
    success: boolean;
    kpis?: Record<string, unknown>;
}

export interface GoblinStats {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    successRate: number;
    avgDuration: number;
    recentTasks: HistoryEntry[];
}

export interface HistoryEntry {
    id: string;
    goblin: string;
    task: string;
    response: string;
    timestamp: Date;
    kpis?: Record<string, unknown>;
    success: boolean;
}

export interface HealthResponse {
    status: "healthy" | "unhealthy";
    initialized: boolean;
    timestamp: string;
}

export interface StreamEvent {
    type: "start" | "chunk" | "complete" | "error";
    goblin: string;
    task?: string;
    data?: string;
    response?: GoblinResponse;
    error?: string;
    timestamp: string;
}

export type StreamCallback = (event: StreamEvent) => void;

export interface OrchestrationStep {
    id: string;
    goblinId: string;
    task: string;
    dependencies: string[];
    condition?: {
        stepId: string;
        operator: "IF_SUCCESS" | "IF_FAILURE" | "IF_CONTAINS";
        value?: string;
    };
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    result?: {
        output: string;
        error?: string;
        duration: number;
        startedAt: Date;
        completedAt: Date;
    };
}

export interface OrchestrationPlan {
    id: string;
    description: string;
    steps: OrchestrationStep[];
    createdAt: Date;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    metadata: {
        totalSteps: number;
        parallelBatches: number;
        estimatedDuration?: number;
    };
}

export interface OrchestrationProgress {
    planId: string;
    currentStep: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    status: OrchestrationPlan["status"];
    currentBatch?: {
        stepIds: string[];
        progress: Record<string, number>;
    };
}
