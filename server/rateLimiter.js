/**
 * High-Performance Token Bucket Rate Limiter
 * Low-allocation, O(1) checks for WebSocket frames and HTTP requests
 */

export class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 15;        // Max burst tokens
    this.refillRate = options.refillRate || 5;       // Tokens added per second
    this.buckets = new Map();                        // key -> { tokens, lastTime }
    this.maxPayloadBytes = options.maxPayloadBytes || 1024; // 1 KB max frame
    this.maxConnections = options.maxConnections || 1000;

    // Periodic cleanup of stale entries every 60 seconds
    setInterval(() => this.cleanup(), 60000).unref();
  }

  isAllowed(key) {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.maxTokens - 1, lastTime: now };
      this.buckets.set(key, bucket);
      return true;
    }

    // Refill tokens based on elapsed time
    const elapsedSec = (now - bucket.lastTime) / 1000;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + elapsedSec * this.refillRate);
    bucket.lastTime = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  validatePayload(data) {
    if (!data) return false;
    const len = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.length;
    return len <= this.maxPayloadBytes;
  }

  cleanup() {
    const now = Date.now();
    const staleThreshold = 120000; // 2 minutes
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastTime > staleThreshold) {
        this.buckets.delete(key);
      }
    }
  }
}
