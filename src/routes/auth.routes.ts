import { Router, Request, Response } from 'express'
import axios from 'axios'
import { setAuthCookies, clearAuthCookies } from '../config/cookies'

const router = Router()

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8080/api/v1'

/**
 * POST /api/auth/login
 * Authenticates user and sets HTTP-only cookies.
 * Returns only user info (no tokens in body).
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    // Forward credentials to pos-service backend
    const { data } = await axios.post(`${BACKEND_URL}/auth/login`, {
      email,
      password,
    })

    // pos-service wraps response in { data: { access_token, user, ... } }
    const payload = data.data ?? data
    const access_token: string  = payload.access_token
    const refresh_token: string = payload.refresh_token
    const user = payload.user

    if (!access_token) {
      res.status(502).json({ error: 'Invalid response from auth service' })
      return
    }

    // Set tokens in HTTP-only cookies (never in response body)
    setAuthCookies(res, access_token, refresh_token)

    // Return ONLY user info — tokens stay in cookies
    res.json({ user })
  } catch (err: any) {
    const status = err.response?.status || 500
    const message = err.response?.data?.error || err.response?.data?.message || 'Login failed'
    res.status(status).json({ error: message })
  }
})

/**
 * POST /api/auth/refresh
 * Silently refreshes access_token using the refresh_token cookie.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token

    if (!refreshToken) {
      res.status(401).json({ error: 'No refresh token' })
      return
    }

    // Exchange with backend for new tokens
    const { data } = await axios.post(
      `${BACKEND_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )

    const responsePayload = data.data ?? data
    const access_token: string  = responsePayload.access_token
    const newRefreshToken: string = responsePayload.refresh_token

    if (!access_token) {
      res.status(502).json({ error: 'Invalid response from auth service' })
      return
    }

    setAuthCookies(res, access_token, newRefreshToken || refreshToken)

    res.json({ ok: true })
  } catch (err: any) {
    clearAuthCookies(res)
    const status = err.response?.status || 500
    const message = err.response?.data?.error || 'Token refresh failed'
    res.status(status).json({ error: message })
  }
})

/**
 * POST /api/auth/logout
 * Clears all auth cookies.
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token

    // Best-effort: notify backend to invalidate the token
    if (refreshToken) {
      try {
        await axios.post(
          `${BACKEND_URL}/auth/logout`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        )
      } catch {
        // Non-fatal — we still clear cookies locally
      }
    }
  } finally {
    clearAuthCookies(res)
    res.json({ ok: true })
  }
})

export default router
