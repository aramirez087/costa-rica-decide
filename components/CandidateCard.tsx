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
        relative group cursor-pointer rounded-2xl p-4 transition-all duration-300 border-2
        ${isSelected
          ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-white shadow-lg shadow-blue-100 scale-[1.02]'
          : 'border-transparent bg-white shadow-md hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5'
        }
      `}
    >
      <div className="flex items-center space-x-4">
        <div className={`
          relative h-16 w-16 overflow-hidden rounded-full flex-shrink-0
          ${isSelected ? 'ring-4 ring-blue-200' : 'ring-2 ring-gray-100 group-hover:ring-blue-100'}
          transition-all duration-300
        `}>
          <img
            src={candidate.imageUrl}
            alt={candidate.name}
            className={`
              h-full w-full object-cover transition-all duration-500
              ${isSelected ? 'grayscale-0' : 'grayscale-[30%] group-hover:grayscale-0'}
            `}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold text-lg truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
            {candidate.name}
          </h3>
          <p className="text-sm text-gray-500">Candidato Presidencial</p>
        </div>
        <div className={`
          flex-shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all duration-300
          ${isSelected
            ? 'border-blue-600 bg-blue-600 scale-110'
            : 'border-gray-300 group-hover:border-blue-400 group-hover:bg-blue-50'
          }
        `}>
          {isSelected && <CheckCircle size={18} className="text-white" />}
        </div>
      </div>
    </div>
  );
};
