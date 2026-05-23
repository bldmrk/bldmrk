export class CacheStats {
  private _hits = 0
  private _misses = 0

  recordHit(): void {
    this._hits++
  }

  recordMiss(): void {
    this._misses++
  }

  get hits(): number {
    return this._hits
  }

  get misses(): number {
    return this._misses
  }

  get hitRate(): number {
    const total = this._hits + this._misses
    return total === 0 ? 0 : this._hits / total
  }

  reset(): void {
    this._hits = 0
    this._misses = 0
  }
}
