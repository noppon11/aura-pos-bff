import axios from 'axios'
import type { GraphQLResolveInfo } from 'graphql'
import { BffContext } from '../context'

const BACKEND_URL = process.env.BACKEND_API_URL || process.env.POS_SERVICE_URL || 'http://localhost:8080/api/v1'

export const productResolvers = {
  Query: {
    products: async (
      _parent: object,
      args: { tenantId: string },
      ctx: BffContext,
      _info: GraphQLResolveInfo,
    ) => {
      if (!ctx.user && !args.tenantId) {
        throw new Error('tenantId required')
      }
      const tenantId = args.tenantId || ctx.user?.tenantId
      const { data } = await axios.get(`${BACKEND_URL}/products`, {
        params: { tenantId },
        headers: ctx.accessToken ? { Authorization: `Bearer ${ctx.accessToken}` } : {},
      })
      return data
    },
  },
}
