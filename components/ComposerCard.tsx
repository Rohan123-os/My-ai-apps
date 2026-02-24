
import React from 'react';
import { Composer } from '../types';
import { Music, History } from 'lucide-react';

interface ComposerCardProps {
  composer: Composer;
  isSelected: boolean;
  onSelect: (composer: Composer) => void;
}

const ComposerCard: React.FC<ComposerCardProps> = ({ composer, isSelected, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(composer)}
      className={`
        p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2
        ${isSelected 
          ? `bg-zinc-800 border-${composer.color} ring-4 ring-${composer.color}/20 scale-105` 
          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80'}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-bold tracking-tight">{composer.name}</h3>
        <Music className={`w-5 h-5 ${isSelected ? `text-${composer.color}` : 'text-zinc-500'}`} />
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-zinc-500" />
        <span className="text-sm text-zinc-400 font-medium">{composer.period}</span>
      </div>

      <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed">
        {composer.description}
      </p>

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-zinc-700">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">Style Highlight</p>
          <p className="text-xs text-zinc-400 italic">{composer.style}</p>
        </div>
      )}
    </div>
  );
};

export default ComposerCard;
