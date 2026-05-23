import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import type { UserStore } from './UserStore.js'
import { AuthError, TokenExpiredError, TokenTypeError } from './errors.js'
import type { JwtPayload, UserRole } from './types.js'

const ACCESS_TTL = '15m'
const REFRESH_TTL = '7d'

export class AuthService {
  private readonly secret: Uint8Array

  constructor(
    private readonly userStore: UserStore,
    jwtSecret: string,
  ) {
    this.secret = new TextEncoder().encode(jwtSecret)
  }

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userStore.findByEmail(email)
    if (!user) throw new AuthError()
    const valid = await this.userStore.verifyPassword(user, password)
    if (!valid) throw new AuthError()

    const base = { sub: user.id, email: user.email, role: user.role as UserRole }

    const accessToken = await new SignJWT({ ...base, typ: 'access' as const })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.secret)

    const refreshToken = await new SignJWT({ ...base, typ: 'refresh' as const })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TTL)
      .sign(this.secret)

    return { accessToken, refreshToken }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      const typed = payload as unknown as JwtPayload
      if (typed.typ !== 'access') throw new TokenTypeError('Expected access token')
      return typed
    } catch (err) {
      if (err instanceof TokenTypeError) throw err
      if (err instanceof joseErrors.JWTExpired) throw new TokenExpiredError()
      throw new AuthError('Invalid token')
    }
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    let payload: JwtPayload
    try {
      const result = await jwtVerify(token, this.secret)
      payload = result.payload as unknown as JwtPayload
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) throw new TokenExpiredError()
      throw new AuthError('Invalid token')
    }

    if (payload.typ !== 'refresh') throw new TokenTypeError()

    const accessToken = await new SignJWT({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      typ: 'access' as const,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.secret)

    return { accessToken }
  }
}
