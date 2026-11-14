import { useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';

const SUGGESTIONS = ['Summarize this lesson', 'Explain it like I’m new to this', 'Give me a real-world example', 'Quiz me with 3 questions'];

export default function AIAssistant({ courseId, lessonId, lessonTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  // new lesson → fresh conversation
  useEffect(() => { setMessages([]); }, [lessonId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api.post('/ai/chat', { message, courseId, lessonId, history });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Sorry — ${errMsg(e)}`, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="assistant" aria-label="AI learning assistant">
      <header>
        <strong>Study assistant</strong>
        <span className="muted small">{lessonTitle ? `Focused on “${lessonTitle}”` : 'Ask about this course'}</span>
      </header>
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="suggest">
            <p className="muted">Stuck on something? Ask a question or try one of these.</p>
            {SUGGESTIONS.map((s) => <button key={s} className="pill" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.error ? 'error' : ''}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant typing">Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" maxLength={2000} aria-label="Your question" />
        <button className="btn" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
  );
}
