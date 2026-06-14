import { useState, useRef } from 'react';
import api from '@services/api.js';
import './VoiceExpenseBtn.css';

/**
 * A self-contained mic button.
 * Props:
 *   onExpenseAdded(expense) — called with the saved expense on success
 */
const VoiceExpenseBtn = ({ onExpenseAdded, inline = false, spaceId = null }) => {
  const [status, setStatus] = useState('idle'); // idle | listening | processing | done | error
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = () => {
    if (!isSupported) {
      setErrorMsg('Speech recognition not supported in this browser.');
      setStatus('error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN'; // accepts Hindi + English (Hinglish works too)
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    setTranscript('');
    setErrorMsg('');
    setStatus('listening');

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setStatus('processing');
      await sendToAI(text);
    };

    recognition.onerror = (event) => {
      setErrorMsg('Mic error: ' + event.error);
      setStatus('error');
    };

    recognition.onend = () => {
      if (status === 'listening') setStatus('idle');
    };

    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setStatus('idle');
  };

  const sendToAI = async (text) => {
    try {
      const url = spaceId ? `/spaces/${spaceId}/expenses/voice` : '/expenses/voice';
      const res = await api.post(url, { transcript: text });
      const { expenses } = res.data;
      // Call onExpenseAdded for each saved expense
      expenses.forEach(expense => onExpenseAdded(expense));
      setStatus('done');
      // Show how many were added
      setTranscript(
        expenses.length === 1
          ? `✓ ₹${expenses[0].amount} · ${expenses[0].category}`
          : `✓ ${expenses.length} expenses added`
      );
      setTimeout(() => {
        setStatus('idle');
        setTranscript('');
      }, 2500);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to process. Try again.');
      setStatus('error');
    }
  };

  const reset = () => { setStatus('idle'); setTranscript(''); setErrorMsg(''); };

  const icons = {
    idle:       '🎤',
    listening:  '⏹',
    processing: '⏳',
    done:       '✅',
    error:      '❌',
  };

  const labels = {
    idle:       'Voice',
    listening:  'Stop',
    processing: 'AI...',
    done:       'Added!',
    error:      'Retry',
  };

  if (!isSupported) return null;

  if (inline) {
    // Compact square button for inline row
    return (
      <button
        type="button"
        className={`voice-inline-btn voice-inline-btn--${status}`}
        onClick={status === 'listening' ? stopListening : status === 'error' ? reset : startListening}
        disabled={status === 'processing'}
        title={status === 'listening' ? 'Stop recording' : 'Add expense by voice'}
      >
        {status === 'listening' && <span className="voice-pulse-inline" />}
        <span className="voice-inline-icon">{icons[status]}</span>
      </button>
    );
  }

  return (
    <div className="voice-btn-wrap">
      <button
        type="button"
        className={`voice-btn voice-btn--${status}`}
        onClick={status === 'listening' ? stopListening : status === 'error' ? reset : startListening}
        disabled={status === 'processing'}
        title="Add expense by voice"
      >
        <span className="voice-btn-icon">{icons[status]}</span>
        <span className="voice-btn-label">{labels[status]}</span>
        {status === 'listening' && <span className="voice-pulse" />}
      </button>

      {(transcript || errorMsg) && (
        <div className={`voice-feedback ${errorMsg ? 'error' : ''}`}>
          {errorMsg || `"${transcript}"`}
        </div>
      )}
    </div>
  );
};

export default VoiceExpenseBtn;
