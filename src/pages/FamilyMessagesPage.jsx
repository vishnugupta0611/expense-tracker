import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './FamilyMessagesPage.css';

const FamilyMessagesPage = () => {
  const initial = [
    {
      id: 1,
      author: 'Asha Sharma',
      text: 'Dinner at 8, bring dessert 🍰',
      time: '2h',
    },
    {
      id: 2,
      author: 'Rohit Gupta',
      text: 'Booked weekend tickets 🎟️',
      time: '4h',
    },
    {
      id: 3,
      author: 'Sita Devi',
      text: 'Uploaded old family photos ❤️',
      time: '1d',
    },
  ];

  const [messages, setMessages] = useState(initial);
  const [value, setValue] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const send = () => {
    if (!value.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        author: 'You',
        text: value,
        time: 'now',
      },
    ]);

    setValue('');
  };

  return (
    <div className="family-messages-page">
      <div className="messages-wrapper">
        {/* Header */}
        <div className="messages-header">
          <div className="header-content">
            <h1 className="header-title">Family Chat</h1>
            <p className="header-subtitle">8 members online</p>
          </div>
          <Link to="/family" className="header-back">
            Back
          </Link>
        </div>

        {/* Messages List */}
        <div ref={listRef} className="messages-list">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-item ${msg.author === 'You' ? 'sent' : 'received'}`}
            >
              {msg.author !== 'You' && (
                <img
                  src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${msg.author}`}
                  alt={msg.author}
                  className="message-avatar"
                  loading="lazy"
                />
              )}

              <div className="message-content">
                {msg.author !== 'You' && (
                  <p className="message-author">{msg.author}</p>
                )}

                <div className="message-bubble">{msg.text}</div>

                <p className="message-time">{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="messages-input-area">
          <div className="input-wrapper">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  send();
                }
              }}
              placeholder="Message family..."
              className="message-input"
            />

            <button onClick={send} className="send-btn">
              ➜
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyMessagesPage;
