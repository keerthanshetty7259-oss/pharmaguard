import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const SUGGESTIONS = [
  'What are the symptoms of dengue?',
  'What is fever?',
  'What is paracetamol generally used for?',
  'What are the common side effects of ibuprofen?',
];

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hi! I can answer general questions about medicines, diseases and symptoms. I can\'t check drug interactions — PharmaGuard does that automatically when you add a medicine.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      // the first assistant greeting is not sent to the model
      const history = next.filter((m, i) => !(i === 0 && m.role === 'assistant'));
      const res = await api.post('/chat', { messages: history });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat-page">
      <div className="page-head">
        <div>
          <h2>AI health assistant</h2>
          <p className="muted">General information about medicines, diseases and symptoms.</p>
        </div>
      </div>

      <div className="alert alert-info small">
        General information only — not medical advice or a diagnosis. For personal medical decisions or emergencies, contact a doctor, pharmacist or local emergency services.
      </div>

      <div className="chat-box">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.role} ${m.error ? 'bubble-error' : ''}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="bubble bubble-assistant">
              <span className="spinner" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 1 && (
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip chip-button" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a medicine, disease or symptom…" maxLength={1000} />
          <button className="btn btn-primary" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
