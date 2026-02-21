import { useState, useEffect } from 'react';
import './InstallPrompt.css';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed in this session
    if (sessionStorage.getItem('installPromptDismissed')) return;

    // Check if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // On iOS, show custom prompt after a delay (no native beforeinstallprompt)
    if (isIOSDevice) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // On Android/Chrome, listen for the native install event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
    // On iOS we just show instructions, dismiss closes it
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt-overlay" onClick={handleDismiss}>
      <div className="install-prompt" onClick={(e) => e.stopPropagation()}>
        <button className="install-close" onClick={handleDismiss}>×</button>
        
        <div className="install-icon">📱</div>
        <h3 className="install-title">Add to Home Screen</h3>
        <p className="install-desc">
          Install Expense Tracker for a faster, app-like experience!
        </p>

        {isIOS ? (
          <div className="install-ios-steps">
            <div className="ios-step">
              <span className="step-num">1</span>
              <span>Tap the <strong>Share</strong> button <span className="ios-icon">⬆️</span></span>
            </div>
            <div className="ios-step">
              <span className="step-num">2</span>
              <span>Scroll and tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="ios-step">
              <span className="step-num">3</span>
              <span>Tap <strong>"Add"</strong> to confirm</span>
            </div>
          </div>
        ) : (
          <button className="install-btn" onClick={handleInstall}>
            Install App
          </button>
        )}

        <button className="install-later" onClick={handleDismiss}>
          Maybe Later
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
