/**
 * Parses GoCD URLs to extract pipeline, stage, and job information
 */
export interface ParsedGocdUrl {
    pipelineName: string;
    pipelineCounter: number;
    stageName?: string;
    stageCounter?: number;
    jobName?: string;
}

/**
 * Parse a GoCD URL to extract pipeline, stage, and job information
 *
 * Supported URL formats:
 * - Job: https://gocd.example.com/go/tab/build/detail/PipelineName/123/StageName/1/JobName
 * - Stage: https://gocd.example.com/go/pipelines/PipelineName/123/StageName/1
 * - Pipeline: https://gocd.example.com/go/pipelines/value_stream_map/PipelineName/123
 *
 * @param url - GoCD URL
 * @returns Parsed pipeline, stage, and job information
 * @throws Error if URL format is not recognized
 */
export function parseGocdUrl(url: string): ParsedGocdUrl {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // Pattern 1: Job detail URL
        // /go/tab/build/detail/PipelineName/123/StageName/1/JobName
        const jobDetailMatch = pathname.match(/\/go\/tab\/build\/detail\/([^/]+)\/(\d+)\/([^/]+)\/(\d+)\/([^/]+)/);
        if (jobDetailMatch) {
            return {
                pipelineName: jobDetailMatch[1],
                pipelineCounter: parseInt(jobDetailMatch[2], 10),
                stageName: jobDetailMatch[3],
                stageCounter: parseInt(jobDetailMatch[4], 10),
                jobName: jobDetailMatch[5],
            };
        }

        // Pattern 2: Stage URL
        // /go/pipelines/PipelineName/123/StageName/1
        const stageMatch = pathname.match(/\/go\/pipelines\/([^/]+)\/(\d+)\/([^/]+)\/(\d+)/);
        if (stageMatch) {
            return {
                pipelineName: stageMatch[1],
                pipelineCounter: parseInt(stageMatch[2], 10),
                stageName: stageMatch[3],
                stageCounter: parseInt(stageMatch[4], 10),
            };
        }

        // Pattern 3: Pipeline value stream map URL
        // /go/pipelines/value_stream_map/PipelineName/123
        const vsmMatch = pathname.match(/\/go\/pipelines\/value_stream_map\/([^/]+)\/(\d+)/);
        if (vsmMatch) {
            return {
                pipelineName: vsmMatch[1],
                pipelineCounter: parseInt(vsmMatch[2], 10),
            };
        }

        // Pattern 4: Pipeline instance URL
        // /go/pipelines/PipelineName/123
        const pipelineMatch = pathname.match(/\/go\/pipelines\/([^/]+)\/(\d+)/);
        if (pipelineMatch) {
            return {
                pipelineName: pipelineMatch[1],
                pipelineCounter: parseInt(pipelineMatch[2], 10),
            };
        }

        throw new Error(`Unrecognized GoCD URL format: ${url}`);
    } catch (error) {
        if (error instanceof TypeError) {
            throw new Error(`Invalid URL format: ${url}`);
        }
        throw error;
    }
}
