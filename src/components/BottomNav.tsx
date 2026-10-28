import React from 'react';
import {
  House,
  YoutubeLogo,
  ClockCounterClockwise,
  User
} from '@phosphor-icons/react';
import { NavTab } from '../types';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        width: '100%'
      }}
      className="glass-nav-bottom px-8 py-3.5 select-none w-full"
    >
      <ul className="flex justify-between items-center w-full max-w-md mx-auto">
        {/* Home */}
        <li>
          <button
            onClick={() => onTabChange('home')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors focus:outline-none ${
              activeTab === 'home'
                ? 'text-butterYellow'
                : 'text-white hover:text-butterYellow active:text-butterYellow'
            }`}
            aria-label="Home"
          >
            <House size={26} weight={activeTab === 'home' ? 'fill' : 'bold'} />
          </button>
        </li>

        {/* YouTube */}
        <li>
          <button
            onClick={() => onTabChange('youtube')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors focus:outline-none ${
              activeTab === 'youtube'
                ? 'text-butterYellow'
                : 'text-white hover:text-butterYellow active:text-butterYellow'
            }`}
            aria-label="YouTube"
          >
            <YoutubeLogo
              size={26}
              weight={activeTab === 'youtube' ? 'fill' : 'bold'}
            />
          </button>
        </li>

        {/* History */}
        <li>
          <button
            onClick={() => onTabChange('history')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors focus:outline-none ${
              activeTab === 'history'
                ? 'text-butterYellow'
                : 'text-white hover:text-butterYellow active:text-butterYellow'
            }`}
            aria-label="History"
          >
            <ClockCounterClockwise
              size={26}
              weight={activeTab === 'history' ? 'fill' : 'bold'}
            />
          </button>
        </li>

        {/* Profile */}
        <li>
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center justify-center cursor-pointer transition-colors focus:outline-none ${
              activeTab === 'profile'
                ? 'text-butterYellow'
                : 'text-white hover:text-butterYellow active:text-butterYellow'
            }`}
            aria-label="Profile"
          >
            <User size={26} weight={activeTab === 'profile' ? 'fill' : 'bold'} />
          </button>
        </li>
      </ul>
    </nav>
  );
};
