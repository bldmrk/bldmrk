export class AuthError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message)
    this.name = 'AuthError'
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token has expired')
    this.name = 'TokenExpiredError'
  }
}

export class TokenTypeError extends Error {
  constructor(message = 'Invalid token type') {
    super(message)
    this.name = 'TokenTypeError'
  }
}
