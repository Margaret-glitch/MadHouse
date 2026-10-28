import React, { useState, useEffect } from 'react';
import { Popcorn, MagnifyingGlass, X } from '@phosphor-icons/react';
import { CategoryCarousel } from './CategoryCarousel';

interface HeaderProps {
  isShrunk: boolean;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onScrollToTop: () => void;
  onSearchQuery?: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  isTransparent?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isShrunk,
  selectedCategory,
  onSelectCategory,
  onScrollToTop,
  onSearchQuery,
  isSearchActive,
  setIsSearchActive,
  isTransparent = false
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && onSearchQuery) {
      onSearchQuery(searchInput.trim());
    }
  };

  const showLiquidGlass = isShrunk || isSearchActive || !isTransparent;

  return (
    <header
      id="mainHeader"
      className={`fixed top-0 left-0 right-0 z-40 w-full flex items-center justify-between px-4 py-3 transition-all duration-500 ${
        showLiquidGlass 
          ? 'glass-nav py-3' 
          : 'bg-gradient-to-b from-black/80 via-black/40 to-transparent py-5'
      }`}
    >
      {isSearchActive ? (
        /* Borderless Expandable Search Bar */
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 flex items-center space-x-2 animate-fadeIn transition-all duration-300"
        >
          <button
            type="submit"
            className="text-butterYellow focus:outline-none p-1 cursor-pointer flex-shrink-0"
            aria-label="Submit search"
          >
            <MagnifyingGlass size={22} weight="bold" />
          </button>

          <input
            type="text"
            autoFocus
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (onSearchQuery) onSearchQuery(e.target.value);
            }}
            placeholder="Search movies, series..."
            className="w-full bg-transparent text-sm font-medium text-white placeholder-white/50 border-none outline-none focus:ring-0 px-1"
          />

          <button
            type="button"
            onClick={() => {
              setIsSearchActive(false);
              setSearchInput('');
              if (onSearchQuery) onSearchQuery('');
            }}
            className="text-white/70 hover:text-white p-1 cursor-pointer flex-shrink-0"
            aria-label="Close search"
          >
            <X size={20} weight="bold" />
          </button>
        </form>
      ) : (
        <>
          {/* Brand Logo/Title with Manifest Logo & Text */}
          <div
            id="headerBrand"
            onClick={onScrollToTop}
            className={`header-brand flex items-center space-x-2.5 cursor-pointer whitespace-nowrap transition-all duration-300 ${
              isShrunk ? 'shrunk opacity-0 max-w-0 overflow-hidden' : 'opacity-100 max-w-[170px]'
            }`}
          >
            <img
              src="/logo.png"
              alt="MadHouse Logo"
              className="w-7 h-7 rounded-lg object-cover flex-shrink-0 ring-1 ring-butterYellow/50 shadow-md"
            />
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-lg">
              MadHouse
            </span>
          </div>

          {/* Scroll Injected Category Carousel Header Slot */}
          <div
            id="inlineCategoryWrapper"
            className={`flex-1 overflow-hidden transition-all duration-300 ${
              isShrunk
                ? 'max-w-full opacity-100 mx-2 pointer-events-auto'
                : 'max-w-0 opacity-0 pointer-events-none'
            }`}
          >
            {isShrunk && (
              <CategoryCarousel
                selectedCategory={selectedCategory}
                onSelectCategory={onSelectCategory}
              />
            )}
          </div>

          {/* Right Action Icons: Only Search Icon remains */}
          <div className="flex items-center space-x-3 text-white flex-shrink-0">
            <button
              onClick={() => setIsSearchActive(true)}
              className="focus:outline-none active:opacity-60 transition-opacity p-1 cursor-pointer text-white drop-shadow-lg"
              aria-label="Open search"
            >
              <MagnifyingGlass size={24} weight="bold" />
            </button>
          </div>
        </>
      )}
    </header>
  );
};
