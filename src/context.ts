import { Request } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtPayload {
  id: string
  email: string
  role: 'admin' | 'manager' | 'cashier'
  tenantId: string
}

export interface GraphQLContext {
  user: JwtPayload | null
  token: string | null
  tenantId: string
}

export function buildContext(req: Request): GraphQLContext {
  const tenantId = (req.headers['x-tenant-id'] as string) || 'aura-bkk'

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) return { user: null, token: null, tenantId }

  try {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = jwt.verify(token, secret) as JwtPayload
    return { user, token, tenantId }
  } catch {
    return { user: null, token: null, tenantId }
  }
}
