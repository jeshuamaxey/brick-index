'use client';

import { Check, X, Loader2 } from 'lucide-react';

interface PipelineProgressProps {
  completedStages: string[];
  jobStatuses?: Record<string, 'completed' | 'running' | 'failed'>;
  className?: string;
}

// Pipeline stages in order with their display codes and job types
// Display codes use capitalized first letter + lowercase second letter
// e.g. "Ca" instead of "CA"
const PIPELINE_STAGES = [
  { code: 'Ca', name: 'Capture', jobType: 'ebay_refresh_listings' },
  { code: 'En', name: 'Enrich', jobType: 'ebay_enrich_listings' },
  { code: 'Ma', name: 'Materialize', jobType: 'ebay_materialize_listings' },
  { code: 'Sa', name: 'Sanitize', jobType: 'sanitize_listings' },
  { code: 'Re', name: 'Reconcile', jobType: 'reconcile' },
  { code: 'An', name: 'Analyze', jobType: 'analyze_listings' },
] as const;

export function PipelineProgress({ completedStages, jobStatuses = {}, className = '' }: PipelineProgressProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {PIPELINE_STAGES.map((stage, index) => {
        const status = jobStatuses[stage.jobType];
        const isCompleted = status === 'completed';
        const isRunning = status === 'running';
        const isFailed = status === 'failed';
        const isLast = index === PIPELINE_STAGES.length - 1;

        // Determine styles based on status
        let chipStyles = '';
        let connectorStyles = '';
        let icon = null;

        if (isCompleted) {
          chipStyles = 'bg-green-500/10 border-green-500 text-green-600 dark:text-green-400';
          connectorStyles = 'bg-green-500';
          icon = <Check className="absolute -top-1 -right-1 h-3 w-3 text-green-600 dark:text-green-400 bg-background rounded-full" />;
        } else if (isRunning) {
          chipStyles = 'bg-yellow-500/10 border-yellow-500 text-yellow-600 dark:text-yellow-400';
          connectorStyles = 'bg-yellow-500';
          icon = (
            <div className="absolute -top-1 -right-1 h-3 w-3 flex items-center justify-center">
              <Loader2 className="h-2.5 w-2.5 text-yellow-600 dark:text-yellow-400 animate-spin bg-background rounded-full" />
            </div>
          );
        } else if (isFailed) {
          chipStyles = 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400';
          connectorStyles = 'bg-red-500';
          icon = <X className="absolute -top-1 -right-1 h-3 w-3 text-red-600 dark:text-red-400 bg-background rounded-full" />;
        } else {
          // Not started - use muted styling
          chipStyles = 'bg-muted/30 border-muted-foreground/30 text-muted-foreground';
          connectorStyles = 'bg-muted-foreground/30';
        }

        return (
          <div key={stage.jobType} className="flex items-center">
            {/* Stage chip */}
            <div
              className={`
                relative flex items-center justify-center
                w-10 h-10
                border-2 rounded
                font-mono text-xs font-semibold
                transition-colors
                ${chipStyles}
                ${isRunning ? 'animate-pulse' : ''}
              `}
              title={`${stage.name}${status ? ` (${status})` : ''}`}
            >
              {stage.code}
              {icon}
              {/* Animated gradient overlay for running jobs */}
              {isRunning && (
                <div 
                  className="absolute inset-0 rounded pointer-events-none shimmer-animation"
                />
              )}
            </div>
            {/* Connector line */}
            {!isLast && (
              <div
                className={`
                  w-4 h-0.5 mx-0.5 transition-colors
                  ${connectorStyles}
                  ${isRunning ? 'animate-pulse' : ''}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
