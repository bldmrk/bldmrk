export class ConfigValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`Config validation error at '${path}': ${message}`)
    this.name = 'ConfigValidationError'
  }
}
