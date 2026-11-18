/**
 * my-global-rules — Host half.
 *
 * Two capabilities share one JSON document, `rules.json` beside this module
 * (so the data lives on the same drive as the plugin checkout, not on the
 * system drive):
 *
 *  - a system-prompt section (`my-global-rules`, order 555) whose text is
 *    re-read on every assembly, so edits apply to the next model step;
 *  - the `global_rules` tool, so an agent can read and edit the same file.
 *
 * The Web settings page talks to the same file through the small JSON route
 * registered below.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Prompt section placement. The name is unique across the prompt registry. */
const SECTION_NAME = 'my-global-rules'
const SECTION_ORDER = 555
/** Tool name shown to the model. */
const TOOL_NAME = 'global_rules'
/** Hard limits kept identical for the tool and the settings route. */
const MAX_TEXT_CHARS = 200_000
const MAX_BODY_BYTES = 1_048_576
/** Settings route owned by this plugin. */
const API_PATH = '/my-global-rules/state'

/** Package root: this module sits at the package root, so dirname is the package. */
const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url))
/**
 * The rules document lives inside the package directory. `MY_GLOBAL_RULES_FILE`
 * overrides it when another location is wanted.
 */
const RULES_FILE = process.env.MY_GLOBAL_RULES_FILE
  ? path.resolve(process.env.MY_GLOBAL_RULES_FILE)
  : path.join(PACKAGE_ROOT, 'rules.json')

function rulesDir() {
  return path.dirname(RULES_FILE)
}

/** Coerce any parsed document onto the two fields this plugin owns. */
function normalizeRules(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    text: typeof source.text === 'string' ? source.text : '',
  }
}

/**
 * Read the rules document. A missing file is the empty default; an unreadable
 * or malformed file yields the default state plus the reason, so a broken file
 * never blocks prompt assembly.
 */
function readRules() {
  let raw
  try {
    raw = fs.readFileSync(RULES_FILE, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return { enabled: true, text: '', error: undefined }
    return { enabled: true, text: '', error: `cannot read ${RULES_FILE}: ${errorMessage(error)}` }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { enabled: true, text: '', error: `${RULES_FILE} is not valid JSON: ${errorMessage(error)}` }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { enabled: true, text: '', error: `${RULES_FILE} must contain a JSON object` }
  }
  return { ...normalizeRules(parsed), error: undefined }
}

/** Merge a patch onto the stored document and replace the file atomically. */
function writeRules(patch) {
  const current = readRules()
  const next = normalizeRules({ ...current, ...patch })
  fs.mkdirSync(rulesDir(), { recursive: true })
  const temporary = `${RULES_FILE}.${process.pid}.tmp`
  const body = `${JSON.stringify({ enabled: next.enabled, text: next.text }, null, 2)}\n`
  try {
    fs.writeFileSync(temporary, body, 'utf8')
    fs.renameSync(temporary, RULES_FILE)
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true })
    } catch {
      // The temporary file is already gone or unreachable; the write failure below is what matters.
    }
    throw new Error(`cannot write ${RULES_FILE}: ${errorMessage(error)}`)
  }
  return next
}

/** Prompt text: empty unless the file is enabled and carries visible text. */
function promptText() {
  const rules = readRules()
  if (!rules.enabled) return ''
  return rules.text.trim()
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/** One bounded, model-facing summary of the current document. */
function describeRules() {
  const rules = readRules()
  const text = rules.text
  const injecting = promptText().length > 0
  const shown = text.length > 4000 ? `${text.slice(0, 4000)}\n… (truncated, ${text.length} characters total)` : text
  const lines = [
    `file: ${RULES_FILE}`,
    `enabled: ${rules.enabled ? 'yes' : 'no'}`,
    `injecting into system prompt: ${injecting ? 'yes' : 'no'}`,
    `text (${text.length} characters):`,
    shown.length > 0 ? shown : '(empty)',
  ]
  if (rules.error !== undefined) lines.push(`warning: ${rules.error}`)
  return lines.join('\n')
}

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description:
    'Read or change the global rules text this harness injects into every system prompt of this profile. '
    + `The document lives at ${RULES_FILE} and applies to every session, so changes outlive the current conversation. `
    + '`set` replaces the whole text; `clear` empties it; `enable`/`disable` toggle injection without deleting the text. '
    + 'Never edit the file directly — use this tool so the settings page and the prompt stay in sync.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'clear', 'enable', 'disable'],
        description:
          '`get` reads the current document; `set` replaces the text (requires `text`); '
          + '`clear` empties the text; `enable`/`disable` toggle injection without changing the text.',
      },
      text: {
        type: 'string',
        description:
          'Complete replacement text, at most 200000 characters. Required by `set` and ignored by every other action. '
          + 'Empty or whitespace-only text injects nothing.',
      },
    },
    required: ['action'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'string' },
    render(_args, value) {
      return [{ type: 'text', text: String(value) }]
    },
  },
  execute(args) {
    const action = args !== null && typeof args === 'object' ? args.action : undefined
    switch (action) {
      case 'get':
        break
      case 'set': {
        const text = args.text
        if (typeof text !== 'string') throw new Error('`text` is required for action "set"')
        if (text.length > MAX_TEXT_CHARS) throw new Error(`\`text\` exceeds ${MAX_TEXT_CHARS} characters`)
        writeRules({ text })
        break
      }
      case 'clear':
        writeRules({ text: '' })
        break
      case 'enable':
        writeRules({ enabled: true })
        break
      case 'disable':
        writeRules({ enabled: false })
        break
      default:
        throw new Error(`unknown action ${JSON.stringify(action)}; expected get, set, clear, enable, or disable`)
    }
    return describeRules()
  },
}

/** Loopback-only, same-origin gate for the settings route. */
function isTrustedRequest(req) {
  const headers = (req && req.headers) || {}
  let host
  try {
    host = new URL(`http://${String(headers.host || '')}`)
  } catch {
    return false
  }
  const hostname = host.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  const loopback = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  if (!loopback) return false
  if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return false
  const origin = headers.origin
  if (typeof origin === 'string' && origin.length > 0 && origin !== 'null') {
    try {
      if (new URL(origin).host.toLowerCase() !== host.host.toLowerCase()) return false
    } catch {
      return false
    }
  }
  return true
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error(`request body exceeds ${limit} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (size === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(new Error(`request body is not valid JSON: ${errorMessage(error)}`))
      }
    })
    req.on('error', reject)
  })
}

/** The settings page reads and writes the same document through this handler. */
async function handleStateRequest(req, res) {
  const send = (status, payload) => {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    })
    res.end(body)
  }
  const snapshot = () => {
    const rules = readRules()
    return {
      ok: true,
      enabled: rules.enabled,
      text: rules.text,
      injecting: promptText().length > 0,
      file: RULES_FILE,
      ...(rules.error === undefined ? {} : { warning: rules.error }),
    }
  }
  if (!isTrustedRequest(req)) {
    send(403, { ok: false, message: 'this route only accepts same-origin requests from the local machine' })
    return
  }
  try {
    if (req.method === 'GET') {
      send(200, snapshot())
      return
    }
    if (req.method === 'HEAD') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== 'POST') {
      send(405, { ok: false, message: `method ${req.method} is not supported` })
      return
    }
    const body = await readJsonBody(req, MAX_BODY_BYTES)
    const patch = {}
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
    if (typeof body.text === 'string') {
      if (body.text.length > MAX_TEXT_CHARS) {
        send(400, { ok: false, message: `text exceeds ${MAX_TEXT_CHARS} characters` })
        return
      }
      patch.text = body.text
    }
    if (Object.keys(patch).length === 0) {
      send(400, { ok: false, message: 'send `enabled`, `text`, or both' })
      return
    }
    writeRules(patch)
    send(200, snapshot())
  } catch (error) {
    send(400, { ok: false, message: errorMessage(error) })
  }
}

export const inject = ['systemPrompt']

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    text: () => promptText(),
  }))

  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.effect(() => toolsCtx.tools.register(TOOL_DEFINITION))
  })

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: API_PATH,
      handler: handleStateRequest,
    }))
  })
}
