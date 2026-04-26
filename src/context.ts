import { Request } from 'express'
import jwt from 'jsonwebtoken'
import { AuthenticatedRequest, JwtPayload } from './types/auth.types'

export interface BffContext {
  user?: {
    id: string
    email: string
    role: string
    tenantId?: string
  }
  /** Raw access token, forwarded to pos-service in resolver Authorization headers */
  accessToken?: string
  req: Request
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * Builds the GraphQL context from the Express request.
 *
 * Reads the access_token HTTP-only cookie directly here rather than via
 * a preceding Express middleware — this avoids the Apollo/Express dual
 * @types/express type incompatibility.
 */
export function buildContext(req: Request): BffContext {
  // If auth middleware already ran (e.g. in tests), reuse its result
  const authReq = req as AuthenticatedRequest
  if (authReq.user) {
    return {
      user: authReq.user,
      accessToken: req.cookies?.access_token,
      req,
    }
  }

  const accessToken = req.cookies?.access_token
  if (!accessToken) {
    return { req }
  }

  try {
    const payload = jwt.verify(accessToken, JWT_SECRET) as JwtPayload
    return {
      user: {
        id:       payload.sub ?? payload.user_id ?? payload.id ?? '',
        email:    payload.email,
        role:     payload.role,
        tenantId: payload.tenant_id ?? payload.tenantId,
      },
      accessToken,
      req,
    }
  } catch {
    return { req }
  }
}
