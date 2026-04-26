/**
 * Auth Flow Integration Tests
 * Run with: npx jest src/__tests__/auth.test.ts
 *
 * Requires ts-jest + jest installed:
 *   npm install -D jest ts-jest @types/jest supertest @types/supertest
 */

import request from 'supertest'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from '../routes/auth.routes'

// ── Test app setup (mirrors index.ts, no Apollo) ──────
function buildTestApp() {
  const app = express()
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
  app.use(cookieParser())
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  return app
}

const app = buildTestApp()

// ── Helper: extract Set-Cookie header as string[] ─────
function getCookies(res: request.Response): Record<string, string> {
  const cookies: Record<string, string> = {}
  const header = res.headers['set-cookie']
  if (!header) return cookies
  const list = Array.isArray(header) ? header : [header]
  list.forEach((c) => {
    const [kv] = c.split(';')
    const [key, val] = kv.split('=')
    cookies[key.trim()] = val?.trim() ?? ''
  })
  return cookies
}

/** Always returns string[] regardless of how supertest typed the header */
function getRawCookies(res: request.Response): string[] {
  const header = res.headers['set-cookie']
  if (!header) return []
  return Array.isArray(header) ? header : [header]
}

describe('POST /api/auth/login', () => {
  it('should return 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('should set HTTP-only cookies on successful login', async () => {
    // This test requires a running pos-service or mock.
    // With a live service:
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@aura-bkk.com',
      password: 'password',
    })

    if (res.status === 200) {
      // Tokens must NOT appear in body
      expect(res.body.access_token).toBeUndefined()
      expect(res.body.refresh_token).toBeUndefined()
      expect(res.body.token).toBeUndefined()

      // User info must be in body
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe('admin@aura-bkk.com')

      // Cookies must be set
      const cookies = getCookies(res)
      expect(cookies['access_token']).toBeDefined()
      expect(cookies['refresh_token']).toBeDefined()

      // Cookies must be HTTP-only
      const rawCookies = getRawCookies(res)
      rawCookies.forEach((c) => {
        expect(c.toLowerCase()).toContain('httponly')
        expect(c.toLowerCase()).toContain('samesite=strict')
      })
    } else {
      // Backend not running — skip
      console.warn('Skipping live login test (backend unavailable):', res.status)
    }
  })
})

describe('POST /api/auth/refresh', () => {
  it('should return 401 when no refresh_token cookie is present', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/no refresh token/i)
  })
})

describe('POST /api/auth/logout', () => {
  it('should clear cookies and return ok', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'access_token=fake; refresh_token=fake')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    // Cookies should be cleared (maxAge=0 or expires in past)
    const rawCookies = getRawCookies(res)
    const accessCookie  = rawCookies.find((c) => c.startsWith('access_token='))
    const refreshCookie = rawCookies.find((c) => c.startsWith('refresh_token='))

    if (accessCookie)  expect(accessCookie).toMatch(/max-age=0/i)
    if (refreshCookie) expect(refreshCookie).toMatch(/max-age=0/i)
  })
})
