type Handler<T> = (payload: T) => void | Promise<void>

export class HookSystem<H extends Record<string, unknown>> {
  private handlers = new Map<keyof H, Handler<unknown>[]>()

  on<K extends keyof H>(hook: K, handler: Handler<H[K]>): void {
    const list = this.handlers.get(hook) ?? []
    list.push(handler as Handler<unknown>)
    this.handlers.set(hook, list)
  }

  off<K extends keyof H>(hook: K, handler: Handler<H[K]>): void {
    const list = this.handlers.get(hook) ?? []
    this.handlers.set(hook, list.filter(h => h !== handler))
  }

  async emit<K extends keyof H>(hook: K, payload: H[K]): Promise<void> {
    const list = this.handlers.get(hook) ?? []
    for (const handler of list) {
      try {
        await handler(payload)
      } catch (err) {
        console.error(`[HookSystem] Error in handler for "${String(hook)}":`, err)
      }
    }
  }
}
