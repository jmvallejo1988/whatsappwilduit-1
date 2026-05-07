import { Redis } from '@upstash/redis'

// KV_REST_API_URL is https:// (Upstash REST) - preferred over REDIS_URL (rediss://)
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  ''

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  ''

const redis = new Redis({ url, token })

export default redis
