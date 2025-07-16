import { useState, useEffect, useRef } from 'react';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Kick off the Slurm job if needed
    fetch('launch', { method: 'POST' }).catch(() => {});
    const keep = setInterval(() => {
      fetch('keepalive', { method: 'POST' }).catch(() => {});
    }, 30000);
    const end = () => navigator.sendBeacon('end');
    window.addEventListener('beforeunload', end);
    return () => {
      clearInterval(keep);
      window.removeEventListener('beforeunload', end);
      end();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const prompt = input;
    setInput('');

    try {
      const res = await fetch('api/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const text = await res.text();
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      const msg = err.message.includes('LLaMA server not ready') ?
        'Server is starting, please wait...' : 'Error: ' + err.message;
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>{m.content}</div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <input
          type="text"
          placeholder="Send a message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

