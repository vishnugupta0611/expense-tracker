import { useEffect, useState } from 'react';
import './SplashScreen.css';

// Show splash only once per browser session
const SPLASH_KEY = 'splash_shown';

const SplashScreen = ({ onDone }) => {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SPLASH_KEY);
    if (alreadyShown) {
      onDone();
      return;
    }

    setVisible(true);
    sessionStorage.setItem(SPLASH_KEY, '1');

    // Show GIF for 2.5s, then fade out over 0.4s
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const doneTimer = setTimeout(() => onDone(), 2900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className={`splash-screen ${fading ? 'splash-fade-out' : ''}`}>
      <img src="/animation.gif" alt="Loading" className="splash-gif" />
    </div>
  );
};

export default SplashScreen;
