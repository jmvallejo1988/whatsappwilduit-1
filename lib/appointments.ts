import redis from './redis'

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

export type Appointment = {
  id: string
  phone: string
  name: string
  email?: string         // client email for email notifications (optional)
  service: string
  datetime: string       // ISO 8601 — e.g. "2026-07-01T10:00:00"
  status: AppointmentStatus
  gcal_event_id?: string
  meet_link?: string     // Google Meet URL
  notes?: string
  created_at: string
}

const APPTS_ZSET = 'appts:all' // sorted set: score = unix ms, member = id

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createAppointment(
  data: Omit<Appointment, 'id' | 'created_at' | 'status'> & { email?: string }
): Promise<Appointment> {
  const id = crypto.randomUUID()
  const appt: Appointment = {
    ...data,
    id,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  const score = new Date(data.datetime).getTime()
  await redis.hset(`appt:${id}`, appt as unknown as Record<string, unknown>)
  await redis.zadd(APPTS_ZSET, { score, member: id })
  await redis.sadd(`appts:phone:${data.phone}`, id)

  return appt
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const data = await redis.hgetall(`appt:${id}`)
  if (!data || Object.keys(data).length === 0) return null
  return data as unknown as Appointment
}

export async function updateAppointment(
  id: string,
  updates: Partial<Omit<Appointment, 'id' | 'created_at'>>
): Promise<Appointment | null> {
  const existing = await getAppointment(id)
  if (!existing) return null

  await redis.hset(`appt:${id}`, updates as Record<string, unknown>)

  // Re-index sorted set if datetime changed
  if (updates.datetime) {
    await redis.zrem(APPTS_ZSET, id)
    await redis.zadd(APPTS_ZSET, { score: new Date(updates.datetime).getTime(), member: id })
  }

  return { ...existing, ...updates }
}

export async function deleteAppointment(id: string): Promise<void> {
  const appt = await getAppointment(id)
  if (!appt) return
  await redis.del(`appt:${id}`)
  await redis.zrem(APPTS_ZSET, id)
  await redis.srem(`appts:phone:${appt.phone}`, id)
}

// ── QUERIES ───────────────────────────────────────────────────────────────────

export async function listAppointments(opts?: {
  from?: Date
  to?: Date
  limit?: number
}): Promise<Appointment[]> {
  const min = opts?.from ? opts.from.getTime() : '-inf'
  const max = opts?.to ? opts.to.getTime() : '+inf'

  // @upstash/redis uses zrange with byScore option instead of zrangebyscore
  const ids = await redis.zrange(APPTS_ZSET, min, max, {
    byScore: true,
    count: opts?.limit ?? 200,
    offset: 0,
  }) as string[]

  const appts = await Promise.all(ids.map(id => getAppointment(id)))
  return appts.filter(Boolean) as Appointment[]
}

export async function getAppointmentsByPhone(phone: string): Promise<Appointment[]> {
  const ids = await redis.smembers(`appts:phone:${phone}`) as string[]
  const appts = await Promise.all(ids.map(id => getAppointment(id)))
  return (appts.filter(Boolean) as Appointment[]).sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  )
}

// ── CONFIRMATION FLOW ─────────────────────────────────────────────────────────

/** Set which appointment is awaiting a SÍ/NO reply from this phone */
export async function setPendingConfirm(phone: string, apptId: string): Promise<void> {
  await redis.set(`appt:confirm_pending:${phone}`, apptId, { ex: 86400 })
}

export async function getPendingConfirm(phone: string): Promise<string | null> {
  return redis.get<string>(`appt:confirm_pending:${phone}`)
}

export async function clearPendingConfirm(phone: string): Promise<void> {
  await redis.del(`appt:confirm_pending:${phone}`)
}

// ── SCHEDULER DEDUP ───────────────────────────────────────────────────────────

export type ScheduledMsgType = 'confirm' | 'reminder' | 'post'

export async function markSchedulerSent(id: string, type: ScheduledMsgType): Promise<void> {
  await redis.set(`scheduler:sent:${id}:${type}`, '1', { ex: 172800 }) // 48h
}

export async function isSchedulerSent(id: string, type: ScheduledMsgType): Promise<boolean> {
  const v = await redis.get(`scheduler:sent:${id}:${type}`)
  return v === '1'
}
