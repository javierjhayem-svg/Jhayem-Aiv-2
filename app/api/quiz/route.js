export async function POST(req) {
  try {
    const { text, numQuestions = 10 } = await req.json()
    const prompt = `Generate exactly ${numQuestions} quiz questions based on this document. Mix: ~60% multiple choice (A/B/C/D) and ~40% identification (short answer).

Return ONLY a valid JSON array, no markdown fences, no explanation:
[
  {"type":"multiple","question":"...","choices":["A. ...","B. ...","C. ...","D. ..."],"answer":"A. ..."},
  {"type":"identification","question":"...","answer":"..."}
]

Document:
${text.slice(0, 6000)}`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'Groq error')

    let raw = data.choices?.[0]?.message?.content || '[]'
    raw = raw.replace(/```json|```/g, '').trim()
    let questions
    try { questions = JSON.parse(raw) }
    catch { const m = raw.match(/\[[\s\S]*\]/); questions = m ? JSON.parse(m[0]) : [] }
    return Response.json({ questions })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
