import { Response, CookieOptions } from 'express'

const IS_PROD = process.env.NODE_ENV === 'production'

/** Shared base options for all auth cookies */
export const getCookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,               // ← Not accessible via JS (prevents XSS token theft)
  secure: IS_PROD,              // ← HTTPS only in production
  sameSite: 'strict',           // ← No cross-site requests (CSRF protection)
  path: '/',
  maxAge: maxAgeMs,
})

const ACCESS_TOKEN_TTL  = 15 * 60 * 1000          // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie('access_token',  accessToken,  getCookieOptions(ACCESS_TOKEN_TTL))
  res.cookie('refresh_token', refreshToken, getCookieOptions(REFRESH_TOKEN_TTL))
}

export function clearAuthCookies(res: Response): void {
  const expired: CookieOptions = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  }
  res.cookie('access_token',  '', expired)
  res.cookie('refresh_token', '', expired)
}
