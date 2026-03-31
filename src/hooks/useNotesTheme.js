import { useState, useEffect } from 'react';

export const useNotesTheme = () => {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('notes-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('notes-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark(d => !d);

  return { dark, toggle };
};
