import React, { useState } from 'react';
import { X, DownloadSimple } from '@phosphor-icons/react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('madhouse_pwa_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If app is running in standalone mode (already installed) or dismissed, hide
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('madhouse_pwa_dismissed', 'true');
    } catch {}
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback for browser environments where beforeinstallprompt hasn't fired yet
      alert('To install MadHouse on your device:\n\nChrome/Edge: Tap the menu (⋮ or ⋯) and select "Install app" or "Add to Home screen".\nSafari: Tap "Share" and select "Add to Home Screen".');
    }
  };

  return (
    <>
      {/* Flat Floating Bottomsheet - Pure Black, Off Edges */}
      <aside
        role="dialog"
        aria-label="Install MadHouse App"
        className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-[80] bg-black text-white p-6 rounded-3xl border border-white/15 shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col items-center text-center animate-fadeIn select-none"
      >
        {/* Dismiss / Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close install prompt"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Logo in the middle */}
        <div className="w-16 h-16 rounded-2xl overflow-hidden mb-3 border border-white/10 bg-black shadow-md flex items-center justify-center">
          <img
            src="/logo.png"
            alt="MadHouse Logo"
            className="w-full h-full object-cover"
          />
        </div>

        {/* App Title */}
        <h3 className="text-xl font-bold text-white tracking-tight mb-1">
          MadHouse
        </h3>

        {/* Paragraph Description */}
        <p className="text-xs text-gray-300 max-w-xs mb-5 font-medium leading-relaxed">
          Watch movies, series or the latest on YouTube, on the go!
        </p>

        {/* Pill Shaped Download Button */}
        <button
          onClick={handleInstallClick}
          className="bg-[#FFEFA0] text-black font-bold text-sm px-8 py-3.5 rounded-full flex items-center justify-center space-x-2 shadow-lg hover:opacity-95 active:scale-95 transition-all cursor-pointer"
        >
          <DownloadSimple size={18} weight="bold" />
          <span>Install 0.4mb</span>
        </button>
      </aside>

      {/* iOS Safari Guided Install Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-fadeIn">
          <div className="w-full max-w-xs rounded-3xl bg-black border border-white/15 p-6 text-center text-white shadow-2xl">
            <div className="w-12 h-12 rounded-2xl overflow-hidden mx-auto mb-3 border border-white/10">
              <img
                src="/logo.png"
                alt="MadHouse Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h4 className="text-base font-bold text-white mb-2">Install MadHouse on iOS</h4>
            <ol className="text-xs text-gray-300 text-left space-y-2 mb-5 px-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-2">
                <span className="font-bold text-[#FFEFA0]">1.</span>
                <span>Tap the <strong>Share</strong> button in Safari's toolbar.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="font-bold text-[#FFEFA0]">2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full bg-[#FFEFA0] text-black font-bold text-xs py-3 rounded-full shadow cursor-pointer active:scale-95 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
