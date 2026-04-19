import axios from 'axios'

const BASE_URL = process.env.POS_SERVICE_URL || 'http://localhost:8080'

export const posApi = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export const authApi = {
  login: (email: string, password: string, tenantId: string) =>
    posApi.post('/api/v1/auth/login', { email, password }, {
      headers: { 'X-Tenant-ID': tenantId },
    }),

  me: (token: string, tenantId: string) =>
    posApi.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    }),
}

export const productApi = {
  getAll: (token: string, tenantId: string) =>
    posApi.get('/api/v1/products', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    }),

  getById: (id: string, token: string, tenantId: string) =>
    posApi.get(`/api/v1/products/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    }),
}

export const branchApi = {
  getAll: (token: string, tenantId: string) =>
    posApi.get('/api/v1/branches', {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    }),

  getById: (id: string, token: string, tenantId: string) =>
    posApi.get(`/api/v1/branches/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    }),
}
