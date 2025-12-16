// Utility for tracking job progress with milestone and time-based updates

export interface ProgressUpdate {
  message: string;
  stats?: {
    listings_found?: number;
    listings_new?: number;
    listings_updated?: number;
    [key: string]: unknown;
  };
}

export interface ProgressTrackerOptions {
  milestoneInterval?: number; // Update every N items (default: 10)
  timeIntervalMs?: number; // Update every N milliseconds (default: 5000)
  onUpdate: (update: ProgressUpdate) => Promise<void>;
}

export class JobProgressTracker {
  private lastUpdateTime: number = Date.now();
  private processedCount: number = 0;
  private milestoneInterval: number;
  private timeIntervalMs: number;
  private onUpdate: (update: ProgressUpdate) => Promise<void>;

  constructor(options: ProgressTrackerOptions) {
    this.milestoneInterval = options.milestoneInterval ?? 10;
    this.timeIntervalMs = options.timeIntervalMs ?? 5000;
    this.onUpdate = options.onUpdate;
  }

  /**
   * Check if an update should be sent based on milestones or time
   */
  private shouldUpdate(): boolean {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    
    // Update if we've processed enough items OR enough time has passed
    return (
      this.processedCount % this.milestoneInterval === 0 ||
      timeSinceLastUpdate >= this.timeIntervalMs
    );
  }

  /**
   * Record progress and update if needed
   */
  async recordProgress(
    message: string,
    stats?: ProgressUpdate['stats'],
    forceUpdate = false
  ): Promise<void> {
    this.processedCount++;

    if (forceUpdate || this.shouldUpdate()) {
      await this.onUpdate({ message, stats });
      this.lastUpdateTime = Date.now();
    }
  }

  /**
   * Force an immediate update
   */
  async forceUpdate(
    message: string,
    stats?: ProgressUpdate['stats']
  ): Promise<void> {
    await this.onUpdate({ message, stats });
    this.lastUpdateTime = Date.now();
  }

  /**
   * Reset the tracker (useful when starting a new phase)
   */
  reset(): void {
    this.processedCount = 0;
    this.lastUpdateTime = Date.now();
  }

  /**
   * Get current processed count
   */
  getProcessedCount(): number {
    return this.processedCount;
  }
}
