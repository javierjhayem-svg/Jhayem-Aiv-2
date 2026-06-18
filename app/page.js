'use client'
import { useState } from 'react'
import LoginPage from './components/LoginPage'
import ChatPage from './components/ChatPage'
import AboutPage from './components/AboutPage'
import QuizPage from './components/QuizPage'

export default function App() {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)

  if (screen === 'login') {
    return <LoginPage onLogin={(u) => { setUser(u); setScreen('chat') }} />
  }
  if (screen === 'about') {
    return <AboutPage onBack={() => setScreen('chat')} />
  }
  if (screen === 'quiz') {
    return <QuizPage onBack={() => setScreen('chat')} />
  }
  return (
    <ChatPage
      user={user}
      onAbout={() => setScreen('about')}
      onQuiz={() => setScreen('quiz')}
      onLogout={() => { setUser(null); setScreen('login') }}
    />
  )
}
