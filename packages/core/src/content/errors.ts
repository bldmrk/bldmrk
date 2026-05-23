export class PageNotFoundError extends Error {
  constructor(slug: string) {
    super(`Page not found: ${slug}`)
    this.name = 'PageNotFoundError'
  }
}
