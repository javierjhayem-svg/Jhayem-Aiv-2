'use client'
import styles from './AboutPage.module.css'

const STACK = ['Next.js 14', 'React 18', 'Groq API', 'WebLLM', 'Vercel', 'PWA']
const FEATURES = [
  { icon: '🤖', label: 'AI-Powered', desc: 'Groq LLaMA — fast online responses' },
  { icon: '📴', label: 'Works Offline', desc: 'WebLLM runs AI inside your browser' },
  { icon: '📝', label: 'Quiz Generator', desc: 'Upload PDF/Word/Excel/Image → instant quiz' },
  { icon: '📱', label: 'Mobile PWA', desc: 'Install on home screen like a native app' },
]

export default function AboutPage({ onBack }) {
  return (
    <div className={styles.page}>
      <div className={styles.blob} />
      <header className={styles.header}>
        <button className="btn-ghost" onClick={onBack} style={{ padding: '8px 12px', fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>
        <span className={styles.hTitle}>About</span>
        <div style={{ width: 64 }} />
      </header>

      <div className={styles.scroll}>
        <div className={styles.hero}>
          <div className={styles.imgWrap}>
            <img src="/jhayem.jpg" alt="Jhayem" className={styles.img} />
          </div>
          <div className={styles.badges}>
            <span className={styles.badge}>BSIT Student</span>
            <span className={`${styles.badge} ${styles.badgeP}`}>Developer</span>
          </div>
          <h1 className={styles.name}>Jhayem J. Cuysona</h1>
          <div className={styles.school}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 6l6-4 6 4M2 6v5a1 1 0 001 1h8a1 1 0 001-1V6M5 12V9h4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Trinidad Municipal College
          </div>
          <p className={styles.schoolSub}>Trinidad, Bohol, Philippines</p>
        </div>

        <div className={styles.sec}>
          <div className={styles.secLabel}>About JhayemAI</div>
          <p className={styles.txt}>JhayemAI is a personal AI assistant built by Jhayem Cuysona as a showcase project. It combines Next.js with Groq&apos;s LLaMA API for fast online responses, and WebLLM for fully offline AI — all running in the browser.</p>
          <p className={styles.txt}>It also includes a Quiz Generator that reads PDF, Word, Excel, PPT, and images — then generates multiple choice and identification questions automatically.</p>
        </div>

        <div className={styles.sec}>
          <div className={styles.secLabel}>Features</div>
          {FEATURES.map((f, i) => (
            <div key={i} className={styles.fCard}>
              <span className={styles.fIco}>{f.icon}</span>
              <div><div className={styles.fLabel}>{f.label}</div><div className={styles.fDesc}>{f.desc}</div></div>
            </div>
          ))}
        </div>

        <div className={styles.sec}>
          <div className={styles.secLabel}>Tech Stack</div>
          <div className={styles.stack}>{STACK.map((s, i) => <span key={i} className={styles.chip}>{s}</span>)}</div>
        </div>

        <div className={styles.credit}>
          <span className={styles.cStar}>✦</span>
          <div>
            <div className={styles.cMain}>Built with 💜 by Jhayem Cuysona</div>
            <div className={styles.cSub}>TMC · Bohol · Philippines · 2025</div>
          </div>
        </div>
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
