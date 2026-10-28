import React from 'react';
import { ImageWithFallback } from './ImageWithFallback';

interface StoryCategory {
  id: string;
  name: string;
  image: string;
}

interface StoryCategoryCarouselProps {
  categories: StoryCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export const StoryCategoryCarousel: React.FC<StoryCategoryCarouselProps> = ({
  categories,
  selectedCategory,
  onSelectCategory
}) => {
  return (
    <div className="w-full overflow-x-auto no-scrollbar py-6 flex items-center space-x-5 px-4 bg-black">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.name;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.name)}
            className="flex flex-col items-center space-y-2 flex-shrink-0 active:scale-95 transition-transform"
          >
            <div className={`relative p-[3px] rounded-full transition-all duration-300 ${
              isActive 
                ? 'bg-gradient-to-tr from-butterYellow to-yellow-500' 
                : 'bg-white/10'
            }`}>
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] border-black">
                <ImageWithFallback
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all"
                />
              </div>
            </div>
            <span className={`text-[11px] font-bold tracking-tight uppercase transition-colors ${
              isActive ? 'text-butterYellow' : 'text-white/50'
            }`}>
              {cat.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
