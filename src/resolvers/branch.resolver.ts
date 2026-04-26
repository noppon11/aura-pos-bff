import axios from 'axios'
import type { GraphQLResolveInfo } from 'graphql'
import { BffContext } from '../context'

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.POS_SERVICE_URL || 'http://localhost:8080/api/v1'

export const branchResolvers = {
  Query: {
    branches: async (
      _parent: object,
      args: { tenantId: string },
      ctx: BffContext,
      _info: GraphQLResolveInfo,
    ) => {
      if (!ctx.user) {
        throw new Error('Unauthenticated')
      }
      const role = ctx.user.role
      if (role !== 'admin' && role !== 'manager') {
        throw new Error('Forbidden: admin or manager role required')
      }
      const tenantId = args.tenantId || ctx.user.tenantId
      const { data } = await axios.get(`${BACKEND_URL}/branches`, {
        params: { tenantId },
        headers: { Authorization: `Bearer ${ctx.accessToken}` },
      })
      return data
    },
  },
}
