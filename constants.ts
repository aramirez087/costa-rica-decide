import { Candidate } from './types';

export const CANDIDATES: Candidate[] = [
  { id: 'lf', name: 'Laura Fernández', imageUrl: '/candidates/LauraFernandez.webp' },
  { id: 'ar', name: 'Álvaro Ramos', imageUrl: '/candidates/AlvaroRamos.webp' },
  { id: 'cd', name: 'Claudia Dobles', imageUrl: '/candidates/ClaudiaDobles.webp' },
  { id: 'nd', name: 'Natalia Díaz', imageUrl: '/candidates/NataliaDiaz.webp' },
  { id: 'arr', name: 'Ariel Robles', imageUrl: '/candidates/ArielRobles.webp' },
  { id: 'fa', name: 'Fabricio Alvarado', imageUrl: '/candidates/FabricioAlvarado.webp' },
  { id: 'jch', name: 'Juan Carlos Hidalgo', imageUrl: '/candidates/JuanCarlos.webp' },
  { id: 'jab', name: 'José Aguilar Berrocal', imageUrl: '/candidates/JoseAguilar.webp' },
];

// Special voting options
export const SPECIAL_OPTIONS: Candidate[] = [
  { id: 'nulo', name: 'Voto Nulo', imageUrl: '' },
  { id: 'indeciso', name: 'Indeciso / No sé', imageUrl: '' },
];

// All voting options combined
export const ALL_OPTIONS = [...CANDIDATES, ...SPECIAL_OPTIONS];

export const STORAGE_KEY_VOTED = 'cr_decide_has_voted_v1';
export const STORAGE_KEY_RESULTS = 'cr_decide_results_v1';
