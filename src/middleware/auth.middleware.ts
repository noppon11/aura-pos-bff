import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import { setAuthCookies } from '../config/cookies'
import { JwtPayload, AuthenticatedRequest } from '../types/auth.types'

const JWT_SECRET   = process.env.JWT_SECRET    || 'your-secret-key'
const BACKEND_URL  = process.env.BACKEND_API_URL || 'http://localhost:8080/api/v1'

/** Seconds remaining on a token before we proactively refresh */
const REFRESH_THRESHOLD_SECS = 2 * 60 // 2 minutes

/**
 * requireAuth middleware
 *
 * 1. Reads access_token from HTTP-only cookie
 * 2. Verifies the JWT
 * 3. If token is near expiry AND refresh_token exists → auto-refreshes silently
 * 4. Attaches decoded user to req.user
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken  = req.cookies?.access_token
  const refreshToken = req.cookies?.refresh_token

  if (!accessToken) {
    res.status(401).json({ error: 'Unauthorized — no access token' })
    return
  }

  try {
    const payload = jwt.verify(accessToken, JWT_SECRET) as JwtPayload

    // Check if token is about to expire
    const nowSecs = Math.floor(Date.now() / 1000)
    const secsUntilExpiry = (payload.exp ?? 0) - nowSecs

    if (secsUntilExpiry < REFRESH_THRESHOLD_SECS && refreshToken) {
      // Silently refresh in the background — don't block the request
      refreshTokens(req, res, refreshToken).catch(() => {
        // Non-fatal; current token is still valid
      })
    }

    ;(req as AuthenticatedRequest).user = {
      id:       payload.sub ?? payload.id ?? '',
      email:    payload.email,
      role:     payload.role,
      tenantId: payload.tenantId,
    }

    next()
  } catch (err) {
    // access_token invalid / expired — try refresh
    if (refreshToken) {
      try {
        const newAccessToken = await refreshTokens(req, res, refreshToken)
        const payload = jwt.verify(newAccessToken, JWT_SECRET) as JwtPayload

        ;(req as AuthenticatedRequest).user = {
          id:       payload.sub ?? payload.id ?? '',
          email:    payload.email,
          role:     payload.role,
          tenantId: payload.tenantId,
        }

        next()
        return
      } catch {
        // refresh also failed — clear everything
      }
    }

    // Clear stale cookies
    res.clearCookie('access_token')
    res.clearCookie('refresh_token')
    res.status(401).json({ error: 'Session expired — please log in again' })
  }
}

/**
 * Refresh tokens via the backend and update cookies.
 * Returns the new access token string.
 */
async function refreshTokens(
  _req: Request,
  res: Response,
  refreshToken: string,
): Promise<string> {
  const { data } = await axios.post(
    `${BACKEND_URL}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  )

  const { access_token, refresh_token: newRefresh } = data
  if (!access_token) throw new Error('No access token in refresh response')

  setAuthCookies(res, access_token, newRefresh || refreshToken)
  return access_token
}

/**
 * optionalAuth middleware
 * Like requireAuth but does NOT reject unauthenticated requests.
 * Useful for GraphQL context where some queries are public.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = req.cookies?.access_token

  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, JWT_SECRET) as JwtPayload
      ;(req as AuthenticatedRequest).user = {
        id:       payload.sub ?? payload.id ?? '',
        email:    payload.email,
        role:     payload.role,
        tenantId: payload.tenantId,
      }
    } catch {
      // Token invalid — proceed as anonymous
    }
  }

  next()
}
