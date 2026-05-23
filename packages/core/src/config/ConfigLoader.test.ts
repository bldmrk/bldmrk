import { describe, it, expect, vi, beforeEach } from 'vitest'
import { vol } from 'memfs'
import { ConfigLoader } from './ConfigLoader.js'
import { ConfigValidationError } from './errors.js'

vi.mock('fs/promises', async () => {
  const { vol } = await import('memfs')
  return { default: vol.promises, ...vol.promises }
})

const CONFIG_DIR = '/config'

beforeEach(() => {
  vol.reset()
})

describe('ConfigLoader', () => {
  it('loads valid site.yaml and system.yaml', async () => {
    vol.fromJSON({
      [`${CONFIG_DIR}/site.yaml`]: 'name: My Site\nurl: https://example.com\n',
      [`${CONFIG_DIR}/system.yaml`]: 'port: 4000\nlogLevel: debug\n',
    })
    const loader = new ConfigLoader()
    const config = await loader.load(CONFIG_DIR)
    expect(config.site.name).toBe('My Site')
    expect(config.site.url).toBe('https://example.com')
    expect(config.system.port).toBe(4000)
    expect(config.system.logLevel).toBe('debug')
  })

  it('returns defaults when config files are missing', async () => {
    const loader = new ConfigLoader()
    const config = await loader.load(CONFIG_DIR)
    expect(config.system.port).toBe(3000)
    expect(config.system.adminPath).toBe('/admin')
    expect(config.system.logLevel).toBe('info')
    expect(config.site.name).toBe('My bldmrk Site')
  })

  it('throws ConfigValidationError with path for invalid system value', async () => {
    vol.fromJSON({
      [`${CONFIG_DIR}/system.yaml`]: 'port: "not-a-number"\n',
    })
    const loader = new ConfigLoader()
    await expect(loader.load(CONFIG_DIR)).rejects.toThrow(ConfigValidationError)
    await expect(loader.load(CONFIG_DIR)).rejects.toThrow('system.port')
  })
})
