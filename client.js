/**
 * my-global-rules — Client half.
 *
 * One settings page under Settings → 全局规则. It reads and writes the same
 * `rules.json` the Host half injects, through this plugin's own JSON route.
 */
window.__ModuleLoader__.load({
  id: 'my-global-rules',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'my-global-rules'
    const SLOT = 'settings.section'
    const ENDPOINT = new URL('my-global-rules/state', document.baseURI).toString()

    const DICTS = {
      en: {
        sectionTitle: 'Global rules',
        title: 'Global rules',
        description: 'Text injected into the system prompt of every session in this profile. Stored in rules.json beside the plugin, so it stays on the same drive as the workspace.',
        enabled: 'Inject into system prompt',
        enabledHint: 'Turning this off keeps the text and sends nothing.',
        rulesText: 'Rules text',
        placeholder: 'Write the rules the model should always follow…',
        save: 'Save',
        reload: 'Reload',
        clear: 'Clear text',
        filePath: 'File',
        chars: 'characters',
        loading: 'Loading…',
        saved: 'Saved. The next model step uses the new text.',
        cleared: 'Text cleared.',
        enabledNotice: 'Injection enabled.',
        disabledNotice: 'Injection disabled.',
        loadFailed: 'Could not load the rules file',
        saveFailed: 'Could not save',
      },
      zh: {
        sectionTitle: '全局规则',
        title: '全局规则',
        description: '这段文字会被注入到本 profile 下每个会话的 system prompt 中，保存在插件目录下的 rules.json，不占用 C 盘。',
        enabled: '注入到 system prompt',
        enabledHint: '关闭后保留文本，但不发送任何内容。',
        rulesText: '规则文本',
        placeholder: '写下希望模型始终遵守的规则…',
        save: '保存',
        reload: '重新读取',
        clear: '清空文本',
        filePath: '文件',
        chars: '字符',
        loading: '加载中…',
        saved: '已保存，下一步模型请求即使用新文本。',
        cleared: '文本已清空。',
        enabledNotice: '已开启注入。',
        disabledNotice: '已关闭注入。',
        loadFailed: '读取规则文件失败',
        saveFailed: '保存失败',
      },
    }

    const CSS = `
      .mgr-page { display: flex; flex-direction: column; gap: 18px; max-width: 760px; }
      .mgr-head { display: flex; flex-direction: column; gap: 6px; }
      .mgr-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .mgr-desc { margin: 0; font-size: 13px; line-height: 1.55; color: var(--dsw-alias-label-secondary); }
      .mgr-card { display: flex; flex-direction: column; gap: 16px; padding: 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-1); }
      .mgr-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .mgr-labels { display: flex; flex-direction: column; gap: 4px; }
      .mgr-label { font-size: 13px; font-weight: 600; color: var(--dsw-alias-label-primary); }
      .mgr-hint { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
      .mgr-switch { flex: none; width: 42px; height: 24px; padding: 2px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-2); cursor: pointer; display: flex; align-items: center; transition: background 120ms ease, border-color 120ms ease; }
      .mgr-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
      .mgr-switch:disabled { cursor: default; opacity: 0.6; }
      .mgr-knob { width: 18px; height: 18px; border-radius: 50%; background: var(--dsw-alias-label-secondary); transition: transform 120ms ease, background 120ms ease; }
      .mgr-switch[aria-checked="true"] .mgr-knob { transform: translateX(18px); background: #fff; }
      .mgr-field { display: flex; flex-direction: column; gap: 6px; }
      .mgr-textarea { width: 100%; box-sizing: border-box; min-height: 240px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 1.6; resize: vertical; }
      .mgr-textarea:focus { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; border-color: transparent; }
      .mgr-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .mgr-btn { padding: 7px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; }
      .mgr-btn:disabled { cursor: default; opacity: 0.45; }
      .mgr-btn-primary { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-brand-primary); color: #fff; }
      .mgr-status { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-success-primary); }
      .mgr-error { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
      .mgr-warn { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-warn-primary); }
      .mgr-foot { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); word-break: break-all; }
      .mgr-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
    `

    let localeService
    let translate

    function fallbackTranslate(key) {
      const language = String((navigator.language || 'en').split('-')[0]).toLowerCase()
      const dict = DICTS[language] || DICTS.en
      return dict[key] || DICTS.en[key] || key
    }

    function tr(key) {
      return translate ? translate(key) : fallbackTranslate(key)
    }

    async function requestJson(method, body) {
      const response = await fetch(ENDPOINT, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }
      if (!response.ok || payload === undefined || payload.ok !== true) {
        const reason = payload && typeof payload.message === 'string' ? payload.message : `HTTP ${response.status}`
        throw new Error(reason)
      }
      return payload
    }

    function Switch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': props.checked,
        'aria-label': props.label,
        className: 'mgr-switch',
        disabled: props.disabled,
        onClick: props.onChange,
      }, h('span', { className: 'mgr-knob' }))
    }

    function SettingsPage() {
      const [enabled, setEnabled] = React.useState(true)
      const [draft, setDraft] = React.useState('')
      const [savedText, setSavedText] = React.useState('')
      const [file, setFile] = React.useState('')
      const [warning, setWarning] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [failure, setFailure] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [reloadKey, setReloadKey] = React.useState(0)

      React.useSyncExternalStore(
        React.useCallback((notify) => (localeService ? localeService.subscribe(notify) : () => {}), []),
        React.useCallback(() => (localeService ? localeService.getSnapshot().revision : 0), []),
        () => 0,
      )

      React.useEffect(() => {
        let cancelled = false
        setBusy(true)
        setFailure('')
        requestJson('GET')
          .then((data) => {
            if (cancelled) return
            setEnabled(data.enabled !== false)
            setDraft(typeof data.text === 'string' ? data.text : '')
            setSavedText(typeof data.text === 'string' ? data.text : '')
            setFile(typeof data.file === 'string' ? data.file : '')
            setWarning(typeof data.warning === 'string' ? data.warning : '')
          })
          .catch((error) => {
            if (!cancelled) setFailure(`${tr('loadFailed')}: ${error.message}`)
          })
          .finally(() => {
            if (!cancelled) setBusy(false)
          })
        return () => {
          cancelled = true
        }
      }, [reloadKey])

      const dirty = draft !== savedText

      const commit = async (patch, successKey) => {
        setBusy(true)
        setFailure('')
        setNotice('')
        try {
          const data = await requestJson('POST', patch)
          setEnabled(data.enabled !== false)
          const nextText = typeof data.text === 'string' ? data.text : draft
          setDraft(nextText)
          setSavedText(nextText)
          setFile(typeof data.file === 'string' ? data.file : file)
          setWarning(typeof data.warning === 'string' ? data.warning : '')
          setNotice(successKey)
        } catch (error) {
          setFailure(`${tr('saveFailed')}: ${error.message}`)
        } finally {
          setBusy(false)
        }
      }

      const toggle = () => {
        if (busy) return
        const next = !enabled
        setEnabled(next)
        commit({ enabled: next }, next ? 'enabledNotice' : 'disabledNotice')
      }

      return h('div', { className: 'mgr-page' },
        h('style', null, CSS),
        h('header', { className: 'mgr-head' },
          h('h1', { className: 'mgr-title' }, tr('title')),
          h('p', { className: 'mgr-desc' }, tr('description')),
        ),
        h('section', { className: 'mgr-card' },
          h('div', { className: 'mgr-row' },
            h('div', { className: 'mgr-labels' },
              h('span', { className: 'mgr-label' }, tr('enabled')),
              h('span', { className: 'mgr-hint' }, tr('enabledHint')),
            ),
            h(Switch, {
              checked: enabled,
              disabled: busy,
              label: tr('enabled'),
              onChange: toggle,
            }),
          ),
          h('div', { className: 'mgr-field' },
            h('label', { className: 'mgr-label', htmlFor: 'mgr-rules-text' }, tr('rulesText')),
            h('textarea', {
              id: 'mgr-rules-text',
              className: 'mgr-textarea',
              value: draft,
              placeholder: tr('placeholder'),
              spellCheck: false,
              onChange: (event) => {
                setDraft(event.target.value)
                setNotice('')
              },
            }),
            h('span', { className: 'mgr-hint' }, `${draft.length} ${tr('chars')}`),
          ),
          h('div', { className: 'mgr-actions' },
            h('button', {
              type: 'button',
              className: 'mgr-btn mgr-btn-primary',
              disabled: busy || !dirty,
              onClick: () => commit({ text: draft }, 'saved'),
            }, tr('save')),
            h('button', {
              type: 'button',
              className: 'mgr-btn',
              disabled: busy,
              onClick: () => setReloadKey((value) => value + 1),
            }, tr('reload')),
            h('button', {
              type: 'button',
              className: 'mgr-btn',
              disabled: busy || (draft.length === 0 && savedText.length === 0),
              onClick: () => commit({ text: '' }, 'cleared'),
            }, tr('clear')),
          ),
          notice.length > 0 ? h('p', { className: 'mgr-status' }, tr(notice)) : null,
          failure.length > 0 ? h('p', { className: 'mgr-error' }, failure) : null,
          warning.length > 0 ? h('p', { className: 'mgr-warn' }, warning) : null,
          file.length > 0
            ? h('p', { className: 'mgr-foot' }, `${tr('filePath')}: `, h('span', { className: 'mgr-code' }, file))
            : null,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        if (locale) {
          localeService = locale
          ctx.effect(() => locale.register(NS, 'en', DICTS.en))
          ctx.effect(() => locale.register(NS, 'zh', DICTS.zh))
          translate = locale.bind(NS)
        }
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: NS,
          order: 35,
          label: () => tr('sectionTitle'),
        }, SettingsPage))
      },
    }
  },
})
