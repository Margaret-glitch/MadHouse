import React from 'react';

export const CATEGORIES = [
  'All',
  'Latest',
  'Horror',
  'Action',
  'Anime',
  'Hollywood',
  'Bollywood',
  'Korean',
  'TV Series'
];

interface CategoryCarouselProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  className?: string;
}

export const CategoryCarousel: React.FC<CategoryCarouselProps> = ({
  selectedCategory,
  onSelectCategory,
  className = ''
}) => {
  return (
    <div
      className={`flex items-center space-x-2 overflow-x-auto no-scrollbar scroll-smooth ${className}`}
    >
      {CATEGORIES.map(category => {
        const isActive = selectedCategory === category;
        return (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={`${
              isActive
                ? 'glass-pill-active'
                : 'glass-pill text-white active:opacity-70'
            } px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all cursor-pointer select-none`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
};
