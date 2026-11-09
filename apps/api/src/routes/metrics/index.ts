/**
 * Prometheus metrics endpoint.
 * Protected by METRICS_TOKEN env var (bearer token).
 * Exposes: HTTP request metrics, queue depths, DB pool, WS connections, Node.js runtime.
 * Scraped by self-hosted Prometheus every 15 seconds.
 */
import type { FastifyInstance } from 'fastify'
import { env } from '../../utils/env.js'
import { getQueueMetrics } from '../../jobs/queues/index.js'

// Simple in-process counters — no heavy SDK needed
interface MetricCounter { [label: string]: number }
interface MetricHistogram { sum: number; count: number; buckets: Record<string, number> }

const counters: Record<string, MetricCounter> = {
  http_requests_total: {},
  http_errors_total: {},
  ws_connections_total: {},
  ws_disconnections_total: {},
  job_processed_total: {},
  job_failed_total: {},
}

const histograms: Record<string, MetricHistogram> = {
  http_request_duration_ms: { sum: 0, count: 0, buckets: { '50': 0, '100': 0, '250': 0, '500': 0, '1000': 0, '2500': 0, '5000': 0 } },
}

const gauges: Record<string, number> = {
  ws_connections_active: 0,
  node_heap_used_bytes: 0,
  node_heap_total_bytes: 0,
}

export const recordRequest = (method: string, route: string, statusCode: number, durationMs: number): void => {
  const label = `method="${method}",route="${route}",status="${statusCode}"`
  counters['http_requests_total']![label] = (counters['http_requests_total']![label] ?? 0) + 1

  if (statusCode >= 500) {
    counters['http_errors_total']![label] = (counters['http_errors_total']![label] ?? 0) + 1
  }

  const h = histograms['http_request_duration_ms']!
  h.sum += durationMs
  h.count++
  for (const bucket of Object.keys(h.buckets)) {
    if (durationMs <= Number(bucket)) h.buckets[bucket]!++
  }
}

export const incrementWsConnections = (delta: 1 | -1): void => {
  gauges['ws_connections_active'] = (gauges['ws_connections_active'] ?? 0) + delta
  if (delta === 1) counters['ws_connections_total']![''] = (counters['ws_connections_total']![''] ?? 0) + 1
  else counters['ws_disconnections_total']![''] = (counters['ws_disconnections_total']![''] ?? 0) + 1
}

const formatCounter = (name: string, help: string, values: MetricCounter): string => {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} counter`]
  for (const [label, value] of Object.entries(values)) {
    lines.push(label ? `${name}{${label}} ${value}` : `${name} ${value}`)
  }
  return lines.join('\n')
}

const formatGauge = (name: string, help: string, value: number): string =>
  `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name} ${value}`

const formatHistogram = (name: string, help: string, h: MetricHistogram): string => {
  const lines = [`# HELP ${name} ${help}`, `# TYPE ${name} histogram`]
  for (const [le, count] of Object.entries(h.buckets)) {
    lines.push(`${name}_bucket{le="${le}"} ${count}`)
  }
  lines.push(`${name}_bucket{le="+Inf"} ${h.count}`)
  lines.push(`${name}_sum ${h.sum}`)
  lines.push(`${name}_count ${h.count}`)
  return lines.join('\n')
}

export const metricsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/metrics', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: { hide: true },
    handler: async (req, reply) => {
      // Bearer token auth — avoid exposing sensitive metrics publicly
      if (env.METRICS_TOKEN) {
        const auth = req.headers.authorization
        if (!auth || auth !== `Bearer ${env.METRICS_TOKEN}`) {
          reply.status(401).send('Unauthorized')
          return
        }
      }

      // Update live gauges
      const mem = process.memoryUsage()
      gauges['node_heap_used_bytes'] = mem.heapUsed
      gauges['node_heap_total_bytes'] = mem.heapTotal

      const queueMetrics = await getQueueMetrics()

      const lines: string[] = []

      // HTTP counters
      lines.push(formatCounter('http_requests_total', 'Total HTTP requests', counters['http_requests_total']!))
      lines.push(formatCounter('http_errors_total', 'Total HTTP 5xx errors', counters['http_errors_total']!))
      lines.push(formatHistogram('http_request_duration_ms', 'HTTP request duration in milliseconds', histograms['http_request_duration_ms']!))

      // WebSocket gauges
      lines.push(formatGauge('ws_connections_active', 'Active WebSocket connections', gauges['ws_connections_active']!))
      lines.push(formatCounter('ws_connections_total', 'Total WebSocket connections', counters['ws_connections_total']!))

      // Job queue gauges
      for (const q of queueMetrics) {
        const n = q.name.replace(/-/g, '_')
        lines.push(formatGauge(`job_queue_waiting{queue="${q.name}"}`, `Waiting jobs in ${q.name}`, q.waiting))
        lines.push(formatGauge(`job_queue_active{queue="${q.name}"}`, `Active jobs in ${q.name}`, q.active))
        lines.push(formatGauge(`job_queue_failed{queue="${q.name}"}`, `Failed jobs in ${q.name}`, q.failed))
        lines.push(formatGauge(`job_queue_delayed{queue="${q.name}"}`, `Delayed jobs in ${q.name}`, q.delayed))
      }

      // Node.js runtime metrics
      lines.push(formatGauge('node_heap_used_bytes', 'Node.js heap used bytes', gauges['node_heap_used_bytes']!))
      lines.push(formatGauge('node_heap_total_bytes', 'Node.js heap total bytes', gauges['node_heap_total_bytes']!))
      lines.push(formatGauge('process_uptime_seconds', 'Process uptime in seconds', process.uptime()))

      reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      reply.send(lines.join('\n\n') + '\n')
    },
  })
}
