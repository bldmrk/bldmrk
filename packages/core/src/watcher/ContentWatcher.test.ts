import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// Create a reusable fake FSWatcher
class FakeWatcher extends EventEmitter {
  close = vi.fn().mockResolvedValue(undefined)
}

const fakeWatcher = new FakeWatcher()

vi.mock('chokidar', () => ({
  watch: vi.fn(() => fakeWatcher),
}))

// Import after mock is set up
const { watch } = await import('chokidar')
const { ContentWatcher } = await import('./ContentWatcher.js')

function makeWatcher() {
  const pageLoader = { invalidateAll: vi.fn() }
  const buildQueue = { enqueue: vi.fn() }
  return {
    watcher: new ContentWatcher(pageLoader as any, buildQueue as any),
    pageLoader,
    buildQueue,
  }
}

beforeEach(() => {
  vi.mocked(watch).mockClear().mockReturnValue(fakeWatcher as any)
  fakeWatcher.removeAllListeners()
  fakeWatcher.close.mockClear()
})

describe('ContentWatcher', () => {
  it('start() registers change, add, and unlink listeners', () => {
    const { watcher } = makeWatcher()
    watcher.start('/content')

    expect(fakeWatcher.listenerCount('change')).toBeGreaterThan(0)
    expect(fakeWatcher.listenerCount('add')).toBeGreaterThan(0)
    expect(fakeWatcher.listenerCount('unlink')).toBeGreaterThan(0)
    watcher.stop()
  })

  it('change event calls pageLoader.invalidateAll() and buildQueue.enqueue()', () => {
    const { watcher, pageLoader, buildQueue } = makeWatcher()
    watcher.start('/content')

    fakeWatcher.emit('change', '/content/pages/home/index.mdx')

    expect(pageLoader.invalidateAll).toHaveBeenCalledOnce()
    expect(buildQueue.enqueue).toHaveBeenCalledOnce()
    watcher.stop()
  })

  it('add event calls pageLoader.invalidateAll() and buildQueue.enqueue()', () => {
    const { watcher, pageLoader, buildQueue } = makeWatcher()
    watcher.start('/content')

    fakeWatcher.emit('add', '/content/pages/new/index.mdx')

    expect(pageLoader.invalidateAll).toHaveBeenCalledOnce()
    expect(buildQueue.enqueue).toHaveBeenCalledOnce()
    watcher.stop()
  })

  it('unlink event calls pageLoader.invalidateAll() and buildQueue.enqueue()', () => {
    const { watcher, pageLoader, buildQueue } = makeWatcher()
    watcher.start('/content')

    fakeWatcher.emit('unlink', '/content/pages/old/index.mdx')

    expect(pageLoader.invalidateAll).toHaveBeenCalledOnce()
    expect(buildQueue.enqueue).toHaveBeenCalledOnce()
    watcher.stop()
  })

  it('stop() closes the watcher', async () => {
    const { watcher } = makeWatcher()
    watcher.start('/content')
    await watcher.stop()

    expect(fakeWatcher.close).toHaveBeenCalledOnce()
  })

  it('calling start() twice does not create a second watcher', () => {
    const { watcher } = makeWatcher()
    watcher.start('/content')
    watcher.start('/content')

    expect(vi.mocked(watch)).toHaveBeenCalledTimes(1)
    watcher.stop()
  })
})
