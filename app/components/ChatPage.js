'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import styles from './ChatPage.module.css'

const SUGGESTIONS = ['What can you do?', 'Explain AI simply', 'Write me a poem', 'Help me code']
const WEBLLM_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
const SYSTEM = 'You are JhayemAI, a personal AI assistant by Jhayem Cuysona, BSIT student at Trinidad Municipal College, Bohol PH. Be helpful, smart, casual. Reply in English or Bisaya depending on the user. Keep responses concise and mobile-friendly.'
const M = { ONLINE: 'online', OFFLINE: 'offline', LOADING: 'loading' }

export default function ChatPage({ user, onAbout, onQuiz, onLogout }) {
  const [msgs, setMsgs]       = useState([{ role: 'assistant', content: `Hey ${user}! 👋 I'm JhayemAI. Ask me anything!` }])
  const [input, setInput]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [menu, setMenu]       = useState(false)
  const [online, setOnline]   = useState(true)
  const [mode, setMode]       = useState(M.ONLINE)
  const [dlPct, setDlPct]     = useState(0)
  const [dlTxt, setDlTxt]     = useState('')
  const [banner, setBanner]   = useState(false)
  const bottomRef = useRef(null)
  const engineRef = useRef(null)

  useEffect(() => {
    const update = () => {
      const on = navigator.onLine
      setOnline(on)
      if (!on) { setBanner(true); setTimeout(() => setBanner(false), 4000) }
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  const loadWebLLM = useCallback(async () => {
    if (engineRef.current) { setMode(M.OFFLINE); return }
    setMode(M.LOADING)
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(WEBLLM_MODEL, {
        initProgressCallback: p => { setDlPct(Math.round((p.progress || 0) * 100)); setDlTxt(p.text || '') },
      })
      engineRef.current = engine
      setMode(M.OFFLINE)
      setMsgs(p => [...p, { role: 'assistant', content: '✅ Offline mode ready! Chat without internet now.' }])
    } catch (e) {
      setMode(M.ONLINE)
      setMsgs(p => [...p, { role: 'assistant', content: `❌ Offline model failed: ${e.message}` }])
    }
  }, [])

  const send = async (text) => {
    const content = (text || input).trim()
    if (!content || busy) return
    setInput('')
    setMenu(false)
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setBusy(true)
    const apiMsgs = next.map(m => ({ role: m.role, content: m.content }))
    try {
      let reply = ''
      if (mode === M.OFFLINE && engineRef.current) {
        const r = await engineRef.current.chat.completions.create({
          messages: [{ role: 'system', content: SYSTEM }, ...apiMsgs],
          max_tokens: 512,
        })
        reply = r.choices[0]?.message?.content || ''
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMsgs }),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error)
        reply = d.content
      }
      setMsgs(p => [...p, { role: 'assistant', content: reply || 'No response.' }])
    } catch (e) {
      const msg = !navigator.onLine ? '📵 No internet. Tap the mode pill to switch to Offline AI.' : `Error: ${e.message}`
      setMsgs(p => [...p, { role: 'assistant', content: msg }])
    } finally {
      setBusy(false)
    }
  }

  const clearChat = () => {
    setMsgs([{ role: 'assistant', content: `Chat cleared! What\'s up, ${user}?` }])
    setMenu(false)
  }

  const toggleMode = () => {
    if (mode === M.ONLINE) loadWebLLM()
    else if (mode === M.OFFLINE) {
      setMode(M.ONLINE)
      setMsgs(p => [...p, { role: 'assistant', content: '🌐 Switched to Online mode (Groq).' }])
    }
  }

  const pillLabel = mode === M.OFFLINE ? '📴 Offline' : mode === M.LOADING ? '⏳ Loading...' : '🌐 Online'
  const pillCls   = mode === M.OFFLINE ? styles.pillOff : mode === M.LOADING ? styles.pillLoad : styles.pillOn

  return (
    <div className={styles.page}>
      {banner && <div className={styles.offBanner}>📵 No internet — switch to Offline Mode</div>}

      <header className={styles.header}>
        <div className={styles.hLeft}>
          <div className={styles.hAvatar}>
            <img src="/jhayem.jpg" alt="AI" className={styles.hImg} />
            <span className={`${styles.hDot} ${!online ? styles.hDotRed : ''}`} />
          </div>
          <div>
            <div className={styles.hTitle}>JhayemAI</div>
            <div className={styles.hSub}>
              {busy ? <><span className={styles.td}/><span className={styles.td}/><span className={styles.td}/> thinking...</> : online ? 'Online' : 'No internet'}
            </div>
          </div>
        </div>
        <div className={styles.hRight}>
          <button className={`${styles.pill} ${pillCls}`} onClick={toggleMode} disabled={mode === M.LOADING}>{pillLabel}</button>
          <button className={styles.iconBtn} onClick={() => setMenu(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="4" r="1.5" fill="currentColor"/><circle cx="10" cy="10" r="1.5" fill="currentColor"/><circle cx="10" cy="16" r="1.5" fill="currentColor"/></svg>
          </button>
        </div>
        {menu && (
          <div className={styles.drop}>
            <button className={styles.dItem} onClick={onAbout}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v5M8 5.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> About
            </button>
            <button className={styles.dItem} onClick={onQuiz}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> Quiz Generator
            </button>
            <button className={styles.dItem} onClick={clearChat}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> Clear chat
            </button>
            <div className={styles.dDiv} />
            <button className={`${styles.dItem} ${styles.dRed}`} onClick={onLogout}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 3H3a1 1 0 00-1 1v8a1 1 0 001 1h7M11 5l3 3-3 3M6 8h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> Sign out
            </button>
          </div>
        )}
      </header>

      {mode === M.LOADING && (
        <>
          <div className={styles.pBar}><div className={styles.pFill} style={{ width: `${dlPct}%` }} /><span className={styles.pTxt}>{dlTxt} {dlPct}%</span></div>
          <div className={styles.infoBanner}>⏬ Downloading AI model (~2GB) — once only, cached forever after!</div>
        </>
      )}

      <div className={styles.msgs} onClick={() => setMenu(false)}>
        {msgs.map((m, i) => (
          <div key={i} className={`${styles.bub} ${m.role === 'user' ? styles.bubU : styles.bubA}`}>
            {m.role === 'assistant' && <div className={styles.aiIco}>✦</div>}
            <div className={`${styles.bubC} ${m.role === 'user' ? styles.bubCU : styles.bubCA}`}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className={`${styles.bub} ${styles.bubA}`}>
            <div className={styles.aiIco}>✦</div>
            <div className={`${styles.bubC} ${styles.bubCA}`}><div className={styles.dots}><span/><span/><span/></div></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {msgs.length === 1 && (
        <div className={styles.suggs}>
          {SUGGESTIONS.map((s, i) => <button key={i} className={styles.sug} onClick={() => send(s)}>{s}</button>)}
        </div>
      )}

      <div className={styles.inputRow}>
        <div className={styles.inputWrap}>
          <textarea
            className={styles.ta}
            placeholder={mode === M.LOADING ? 'Wait for model...' : 'Message JhayemAI...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            maxLength={2000}
            disabled={mode === M.LOADING}
          />
          <button className={styles.sendBtn} onClick={() => send()} disabled={!input.trim() || busy || mode === M.LOADING}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9l14-7-5 7 5 7-14-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
