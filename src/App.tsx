import React, { useState, useRef, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { PlayerProvider } from './context/PlayerContext';
import { HomePage } from './pages/HomePage';
import { YouTubePage } from './pages/YouTubePage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { BottomNav } from './components/BottomNav';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { NavTab } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const scrollPositions = useRef<Record<NavTab, number>>({
    home: 0,
    youtube: 0,
    history: 0,
    profile: 0
  });

  // Switch meta theme-color to pitch black (#000000) after app opens
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#000000');
    }
  }, []);

  const handleTabChange = (newTab: NavTab) => {
    if (newTab === activeTab) {
      // If tapping active tab, scroll that page to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Save current page's scroll position
    scrollPositions.current[activeTab] = window.scrollY;

    // Switch tab
    setActiveTab(newTab);
  };

  // Restore scroll position when activeTab changes
  useEffect(() => {
    const targetScroll = scrollPositions.current[activeTab] || 0;
    // Use requestAnimationFrame to ensure the new view is rendered before scrolling
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetScroll, behavior: 'instant' as ScrollBehavior });
    });
  }, [activeTab]);

  return (
    <AuthProvider>
      <PlayerProvider>
        <div className="min-h-screen bg-black text-white flex flex-col font-sans relative">
          {/* Render pages with independent DOM visibility to prevent reloading and keep state */}
          <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
            <HomePage />
          </div>

          <div style={{ display: activeTab === 'youtube' ? 'block' : 'none' }}>
            <YouTubePage />
          </div>

          <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
            <HistoryPage />
          </div>

          <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
            <ProfilePage />
          </div>

          {/* Global Floating Video & Mini Player Modal */}
          <VideoPlayerModal />

          {/* PWA Floating Install Prompt Bottomsheet */}
          <PWAInstallPrompt />

          {/* Glassmorphic Bottom Navigation */}
          <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </PlayerProvider>
    </AuthProvider>
  );
}
