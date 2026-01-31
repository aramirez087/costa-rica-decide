import React from 'react';
import { Candidate } from '../types';
import { CheckCircle } from 'lucide-react';

interface CandidateCardProps {
  candidate: Candidate;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, isSelected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(candidate.id)}
      className={`
        relative group cursor-pointer rounded-xl p-4 transition-all duration-300 border-2
        ${isSelected 
          ? 'border-blue-600 bg-blue-50 shadow-lg scale-[1.02]' 
          : 'border-transparent bg-white shadow-sm hover:shadow-md hover:border-gray-200'
        }
      `}
    >
      <div className="flex items-center space-x-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-gray-100 flex-shrink-0">
          <img 
            src={candidate.imageUrl} 
            alt={candidate.name} 
            className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold text-lg ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
            {candidate.name}
          </h3>
          <p className="text-sm text-gray-500">Candidato Presidencial</p>
        </div>
        <div className={`
          flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors
          ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 group-hover:border-blue-400'}
        `}>
          {isSelected && <CheckCircle size={16} className="text-white" />}
        </div>
      </div>
    </div>
  );
};
