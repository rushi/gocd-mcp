// Pipeline Types
export interface Pipeline {
    name: string;
    group: string;
    locked: boolean;
    pauseInfo: PauseInfo | null;
}

export interface PauseInfo {
    paused: boolean;
    pausedBy: string | null;
    pauseReason: string | null;
}

export interface PipelineStatus {
    paused: boolean;
    pausedCause: string | null;
    pausedBy: string | null;
    locked: boolean;
    schedulable: boolean;
}

export interface PipelineInstance {
    name: string;
    counter: number;
    label: string;
    naturalOrder: number;
    canRun: boolean;
    preparingToSchedule: boolean;
    comment: string | null;
    scheduledDate: number;
    buildCause: BuildCause;
    stages: StageInstance[];
}

export interface BuildCause {
    triggerMessage: string;
    triggerForced: boolean;
    approver: string;
    materialRevisions: MaterialRevision[];
}

export interface MaterialRevision {
    material: Material;
    changed: boolean;
    modifications: Modification[];
}

export interface Material {
    type: string;
    description: string;
    fingerprint: string;
}

export interface Modification {
    revision: string;
    modifiedTime: number;
    userName: string;
    comment: string;
    emailAddress: string | null;
}

export interface PipelineHistory {
    pipelines: PipelineInstance[];
}

// Stage Types
export interface StageInstance {
    name: string;
    counter: number;
    status: string;
    result: StageResult;
    approvalType: string;
    approvedBy: string | null;
    scheduledDate: number;
    rerunOfCounter: number | null;
    operatePermission: boolean;
    canRun: boolean;
    jobs: JobInstance[];
}

export type StageResult = "Passed" | "Failed" | "Cancelled" | "Unknown";

// Job Types
export interface JobInstance {
    name: string;
    state: JobState;
    result: JobResult;
    scheduledDate: number;
    agentUuid: string | null;
    originalJobId: number | null;
    rerun: boolean;
}

export type JobState = "Scheduled" | "Assigned" | "Preparing" | "Building" | "Completing" | "Completed";
export type JobResult = "Passed" | "Failed" | "Cancelled" | "Unknown";

export interface JobHistory {
    jobs: JobHistoryEntry[];
    pagination: Pagination;
}

export interface JobHistoryEntry {
    name: string;
    state: JobState;
    result: JobResult;
    scheduledDate: number;
    completedDate: number | null;
    assignedDate: number | null;
    agentUuid: string | null;
    pipelineName: string;
    pipelineCounter: number;
    stageName: string;
    stageCounter: number;
}

export interface Pagination {
    offset: number;
    total: number;
    pageSize: number;
}

// Dashboard Types (for listing pipelines)
export interface DashboardResponse {
    _embedded?: {
        pipeline_groups: PipelineGroup[];
    };
    // Fallback for config endpoint structure
    pipeline_groups?: PipelineGroup[];
}

export interface PipelineGroup {
    name: string;
    pipelines: string[] | DashboardPipeline[];
    _embedded?: {
        pipelines: DashboardPipeline[];
    };
}

export interface DashboardPipeline {
    name: string;
    locked: boolean;
    pause_info?: {
        paused: boolean;
        paused_by: string | null;
        pause_reason: string | null;
    };
}

// Trigger Options
export interface TriggerOptions {
    environmentVariables?: Record<string, string>;
    updateMaterials?: boolean;
}

// Artifact Types
export interface ArtifactFile {
    name: string;
    url: string;
    type: "file" | "folder";
    files?: ArtifactFile[];
}

// JUnit XML Test Result Types
export interface JUnitTestSuite {
    name: string;
    tests: number;
    failures: number;
    errors: number;
    skipped: number;
    time: number;
    timestamp?: string;
    testCases: JUnitTestCase[];
}

export interface JUnitTestCase {
    name: string;
    classname: string;
    time: number;
    status: "passed" | "failed" | "error" | "skipped";
    failure?: JUnitFailure;
    error?: JUnitError;
    skipped?: string;
}

export interface JUnitFailure {
    message: string;
    type: string;
    content: string;
}

export interface JUnitError {
    message: string;
    type: string;
    content: string;
}

export interface JUnitTestResults {
    suites: JUnitTestSuite[];
    summary: {
        totalTests: number;
        totalFailures: number;
        totalErrors: number;
        totalSkipped: number;
        totalTime: number;
    };
    failedTests: Array<{
        suiteName: string;
        testName: string;
        className: string;
        message: string;
        type: string;
        details: string;
    }>;
}
