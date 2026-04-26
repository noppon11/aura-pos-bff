import { Request } from 'express'

export interface JwtPayload {
  // pos-service JWT claims
  sub?: string
  user_id?: string   // pos-service uses user_id
  id?: string
  email: string
  full_name?: string
  role: string
  tenant_id?: string  // pos-service uses tenant_id (snake_case)
  tenantId?: string
  branch_ids?: string[]
  exp?: number
  iat?: number
}

export interface AuthUser {
  id: string
  email: string
  role: string
  tenantId?: string
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser
}
