'use client'
import { useState, useRef } from 'react'
import styles from './QuizPage.module.css'

// Wraps URL imports so webpack never statically analyzes the URL string.
// Without this, Next.js build fails trying to bundle https://esm.run/* URLs.
const dynImport = (url) => new Function('u', 'return import(u)')(url)

const WEBLLM_MODEL = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'
const ST = { UPLOAD: 'upload', EXTRACTING: 'extracting', GENERATING: 'generating', QUIZ: 'quiz', RESULT: 'result' }

export default function QuizPage({ onBack }) {
  const [step, setStep]       = useState(ST.UPLOAD)
  const [fileName, setFName]  = useState('')
  const [docText, setDocText] = useState('')
  const [questions, setQs]    = useState([])
  const [cur, setCur]         = useState(0)
  const [answers, setAns]     = useState({})
  const [ident, setIdent]     = useState('')
  const [status, setStatus]   = useState('')
  const [numQ, setNumQ]       = useState(10)
  const [aiMode, setAiMode]   = useState('online')
  const [dlPct, setDlPct]     = useState(0)
  const engineRef = useRef(null)
  const fileRef   = useRef(null)

  // ── Extract text from file ──────────────────────────────────────
  const readFile = async (file) => {
    if (!file) return
    setFName(file.name)
    setDocText('')
    setStatus('Reading file...')
    setStep(ST.EXTRACTING)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      let text = ''

      if (ext === 'txt') {
        text = await file.text()
      } else if (ext === 'pdf') {
        setStatus('Loading PDF reader...')
        const pdfjs = await dynImport('https://esm.run/pdfjs-dist@4.4.168')
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.run/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'
        const buf = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          setStatus(`Reading page ${i}/${pdf.numPages}...`)
          const pg = await pdf.getPage(i)
          const ct = await pg.getTextContent()
          text += ct.items.map(s => s.str).join(' ') + '\n'
        }
      } else if (ext === 'docx') {
        setStatus('Loading Word reader...')
        const mammoth = await dynImport('https://esm.run/mammoth@1.8.0')
        const buf = await file.arrayBuffer()
        const r = await mammoth.extractRawText({ arrayBuffer: buf })
        text = r.value
      } else if (ext === 'xlsx' || ext === 'xls') {
        setStatus('Loading Excel reader...')
        const XLSX = await dynImport('https://esm.run/xlsx@0.18.5')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        wb.SheetNames.forEach(n => { text += `Sheet: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n]) + '\n' })
      } else if (ext === 'pptx') {
        setStatus('Reading PowerPoint...')
        const JSZip = await dynImport('https://esm.run/jszip@3.10.1')
        const buf = await file.arrayBuffer()
        const zip = await JSZip.default.loadAsync(buf)
        const slides = Object.keys(zip.files).filter(f => /ppt\/slides\/slide\d+\.xml/.test(f)).sort()
        for (const s of slides) {
          const xml = await zip.files[s].async('text')
          text += xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') + '\n'
        }
      } else if (/^(jpg|jpeg|png|gif|webp|bmp)$/.test(ext)) {
        setStatus('Loading OCR (~50MB, please wait)...')
        const Tesseract = await dynImport('https://esm.run/tesseract.js@5.1.0')
        const worker = await Tesseract.createWorker('eng', 1, {
          logger: m => { if (m.status === 'recognizing text') setStatus(`OCR: ${Math.round(m.progress * 100)}%`) },
        })
        const url = URL.createObjectURL(file)
        const { data } = await worker.recognize(url)
        text = data.text
        await worker.terminate()
        URL.revokeObjectURL(url)
      } else {
        throw new Error(`Unsupported file type: .${ext}`)
      }

      const clean = text.trim()
      if (!clean) throw new Error('No text found in file.')
      setDocText(clean)
      setStatus(`✅ Done! ${clean.length.toLocaleString()} characters extracted.`)
      setStep(ST.UPLOAD)
    } catch (e) {
      setStatus(`❌ ${e.message}`)
      setStep(ST.UPLOAD)
    }
  }

  // ── Generate questions ──────────────────────────────────────────
  const generate = async () => {
    if (!docText) return
    setStep(ST.GENERATING)
    setStatus('Generating questions...')
    try {
      let qs = []
      if (aiMode === 'online') {
        const res = await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: docText, numQuestions: numQ }),
        })
        const d = await res.json()
        if (d.error) throw new Error(d.error)
        qs = d.questions
      } else {
        qs = await genOffline(docText, numQ, setStatus, setDlPct, engineRef)
      }
      if (!qs || !qs.length) throw new Error('No questions generated. Try a different file.')
      setQs(qs); setCur(0); setAns({}); setIdent('')
      setStep(ST.QUIZ)
    } catch (e) {
      setStatus(`❌ ${e.message}`)
      setStep(ST.UPLOAD)
    }
  }

  const genOffline = async (text, numQ, setStatus, setDlPct, engineRef) => {
    if (!engineRef.current) {
      setStatus('Loading offline AI (~2GB, once only)...')
      const { CreateMLCEngine } = await dynImport('https://esm.run/@mlc-ai/web-llm')
      const engine = await CreateMLCEngine(WEBLLM_MODEL, {
        initProgressCallback: p => { setDlPct(Math.round((p.progress || 0) * 100)); setStatus(p.text || 'Downloading...') },
      })
      engineRef.current = engine
    }
    setStatus('AI is writing questions...')
    const prompt = `Generate exactly ${numQ} quiz questions based on this content. Mix ~60% multiple choice and ~40% identification. Return ONLY a JSON array, no markdown:
[{"type":"multiple","question":"...","choices":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ..."},{"type":"identification","question":"...","answer":"..."}]

Content: ${text.slice(0, 3000)}`
    const r = await engineRef.current.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    })
    let raw = r.choices[0]?.message?.content || '[]'
    raw = raw.replace(/```json|```/g, '').trim()
    try { return JSON.parse(raw) } catch { const m = raw.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : [] }
  }

  // ── Answer logic ────────────────────────────────────────────────
  const pickChoice = (c) => { if (answers[cur] === undefined) setAns(p => ({ ...p, [cur]: c })) }
  const submitIdent = () => { if (!ident.trim()) return; setAns(p => ({ ...p, [cur]: ident.trim() })); setIdent('') }

  const goNext = () => {
    if (cur < questions.length - 1) { setCur(c => c + 1); setIdent('') }
    else setStep(ST.RESULT)
  }
  const goPrev = () => { if (cur > 0) { setCur(c => c - 1); setIdent('') } }

  const calcScore = () => {
    let s = 0
    questions.forEach((q, i) => {
      const ua = (answers[i] || '').toLowerCase().trim()
      const ca = (q.answer || '').toLowerCase().trim()
      if (q.type === 'multiple') { if (ua === ca) s++ }
      else { const cw = ca.split(' ').filter(w => w.length > 3); if (cw.some(w => ua.includes(w)) || ua === ca) s++ }
    })
    return s
  }

  const reset = () => { setStep(ST.UPLOAD); setFName(''); setDocText(''); setQs([]); setCur(0); setAns({}); setIdent(''); setStatus('') }

  const q = questions[cur]
  const score = step === ST.RESULT ? calcScore() : 0
  const pct   = questions.length ? Math.round((score / questions.length) * 100) : 0
  const r     = 42
  const circ  = 2 * Math.PI * r

  return (
    <div className={styles.page}>
      <div className={styles.blob} />

      {/* Header */}
      <header className={styles.header}>
        <button className="btn-ghost" onClick={onBack} style={{ padding: '8px 12px', fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <span className={styles.hTitle}>
          {step === ST.QUIZ ? `Q${cur + 1} / ${questions.length}` : '📝 Quiz Generator'}
        </span>
        <div style={{ width: 64 }} />
      </header>

      {/* Quiz progress */}
      {step === ST.QUIZ && (
        <div className={styles.qProg}><div className={styles.qProgFill} style={{ width: `${((cur + 1) / questions.length) * 100}%` }} /></div>
      )}

      {/* ── UPLOAD ── */}
      {(step === ST.UPLOAD || step === ST.EXTRACTING) && (
        <div className={styles.scroll}>
          <div className={styles.sec}>
            <div className={styles.secLabel}>Upload File</div>
            <div
              className={styles.drop}
              onClick={() => step !== ST.EXTRACTING && fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files[0]) }}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.xls,.pptx,.txt,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => readFile(e.target.files[0])} />
              {step === ST.EXTRACTING
                ? <><div className={styles.spin} /><div className={styles.dropTxt}>{status}</div></>
                : <><div className={styles.dropIco}>📂</div><div className={styles.dropTitle}>{fileName || 'Tap to choose file'}</div><div className={styles.dropSub}>PDF · Word · Excel · PPT · Image · TXT</div></>
              }
            </div>
            {status && step !== ST.EXTRACTING && (
              <div className={`${styles.statusBox} ${status.startsWith('❌') ? styles.sErr : styles.sOk}`}>{status}</div>
            )}
          </div>

          {docText && (
            <>
              <div className={styles.sec}>
                <div className={styles.secLabel}>Settings</div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Questions</span>
                  <div className={styles.numRow}>
                    {[5,10,15,20].map(n => (
                      <button key={n} className={`${styles.nBtn} ${numQ===n ? styles.nBtnA : ''}`} onClick={() => setNumQ(n)}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>AI Mode</span>
                  <div className={styles.numRow}>
                    <button className={`${styles.nBtn} ${aiMode==='online' ? styles.nBtnA : ''}`} onClick={() => setAiMode('online')}>🌐 Online</button>
                    <button className={`${styles.nBtn} ${aiMode==='offline' ? styles.nBtnA : ''}`} onClick={() => setAiMode('offline')}>📴 Offline</button>
                  </div>
                </div>
                {aiMode === 'offline' && <div className={styles.offNote}>⚠️ Downloads ~2GB AI model (once only). Slow on mobile.</div>}
              </div>

              <div className={styles.sec}>
                <button className="btn-primary" onClick={generate}>✨ Generate {numQ} Questions</button>
              </div>

              <div className={styles.sec}>
                <div className={styles.secLabel}>Text Preview</div>
                <div className={styles.preview}>{docText.slice(0, 400)}{docText.length > 400 ? '...' : ''}</div>
              </div>
            </>
          )}
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* ── GENERATING ── */}
      {step === ST.GENERATING && (
        <div className={styles.center}>
          <div className={styles.genIco}>🧠</div>
          <div className={styles.genTitle}>Generating Quiz...</div>
          <div className={styles.genSub}>{status}</div>
          {aiMode === 'offline' && dlPct > 0 && (
            <div className={styles.dlWrap}>
              <div className={styles.dlBar}><div className={styles.dlFill} style={{ width: `${dlPct}%` }} /></div>
              <span className={styles.dlPct}>{dlPct}%</span>
            </div>
          )}
        </div>
      )}

      {/* ── QUIZ ── */}
      {step === ST.QUIZ && q && (
        <div className={styles.quizBody}>
          <div className={styles.typeBadge}>{q.type === 'multiple' ? '🔵 Multiple Choice' : '✏️ Identification'}</div>

          <div className={styles.qCard}>
            <div className={styles.qNum}>Question {cur + 1}</div>
            <div className={styles.qText}>{q.question}</div>
          </div>

          {q.type === 'multiple' ? (
            <div className={styles.choices}>
              {(q.choices || []).map((c, i) => {
                const picked = answers[cur] === c
                const done = answers[cur] !== undefined
                const correct = c === q.answer
                let cls = styles.choice
                if (done && correct) cls += ' ' + styles.choiceOk
                else if (done && picked) cls += ' ' + styles.choiceBad
                else if (picked) cls += ' ' + styles.choiceSel
                return (
                  <button key={i} className={cls} onClick={() => pickChoice(c)}>
                    <span className={styles.choiceLtr}>{['A','B','C','D'][i]}</span>
                    <span>{c.replace(/^[A-D]\.\s*/,'')}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className={styles.identWrap}>
              {answers[cur] === undefined ? (
                <>
                  <input className="input-field" placeholder="Type your answer..." value={ident} onChange={e => setIdent(e.target.value)} onKeyDown={e => { if (e.key==='Enter') submitIdent() }} autoFocus />
                  <button className="btn-primary" onClick={submitIdent} disabled={!ident.trim()} style={{ marginTop: 10 }}>Submit Answer</button>
                </>
              ) : (
                <div className={styles.identRes}>
                  <div className={styles.identYours}>Your answer: <strong>{answers[cur]}</strong></div>
                  <div className={styles.identAns}>Correct: <strong>{q.answer}</strong></div>
                </div>
              )}
            </div>
          )}

          <div className={styles.navRow}>
            <button className="btn-ghost" onClick={goPrev} disabled={cur === 0} style={{ flex: 1 }}>← Prev</button>
            <button className="btn-primary" onClick={goNext} disabled={answers[cur] === undefined} style={{ flex: 2 }}>
              {cur === questions.length - 1 ? 'Finish 🏁' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {step === ST.RESULT && (
        <div className={styles.scroll}>
          <div className={styles.scoreHero}>
            <div className={styles.scoreWrap}>
              <svg width="120" height="120" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg3)" strokeWidth="8"/>
                <circle cx="50" cy="50" r={r} fill="none"
                  stroke={pct>=75 ? '#22c55e' : pct>=50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - pct / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className={styles.scorePct}>{pct}%</div>
            </div>
            <div className={styles.scoreLabel}>{pct>=75 ? '🎉 Excellent!' : pct>=50 ? '👍 Good job!' : '📚 Keep studying!'}</div>
            <div className={styles.scoreSub}>{score} / {questions.length} correct</div>
          </div>

          <div className={styles.sec}>
            <div className={styles.secLabel}>Review</div>
            {questions.map((q, i) => {
              const ua = (answers[i] || '').toLowerCase().trim()
              const ca = (q.answer || '').toLowerCase().trim()
              let ok = false
              if (q.type === 'multiple') ok = ua === ca
              else { const cw = ca.split(' ').filter(w => w.length > 3); ok = cw.some(w => ua.includes(w)) || ua === ca }
              return (
                <div key={i} className={`${styles.revItem} ${ok ? styles.revOk : styles.revBad}`}>
                  <div className={styles.revQ}><span className={styles.revN}>{i+1}</span>{q.question}</div>
                  <div className={styles.revA}>
                    <span>You: <strong>{answers[i] || '—'}</strong></span>
                    {!ok && <span className={styles.revC}> · Correct: <strong>{q.answer}</strong></span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.sec}>
            <button className="btn-primary" onClick={reset}>🔄 New Quiz</button>
          </div>
          <div style={{ height: 24 }} />
        </div>
      )}
    </div>
  )
}
