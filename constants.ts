import { Candidate } from './types';

export const CANDIDATES: Candidate[] = [
  { id: 'lf', name: 'Laura Fernandez', imageUrl: '/candidates/LauraFernandez.webp' },
  { id: 'ar', name: 'Álvaro Ramos', imageUrl: '/candidates/AlvaroRamos.webp' },
  { id: 'cd', name: 'Claudia Dobles', imageUrl: '/candidates/ClaudiaDobles.webp' },
  { id: 'arr', name: 'Ariel Robles', imageUrl: '/candidates/ArielRobles.webp' },
  { id: 'fa', name: 'Fabricio Alvarado', imageUrl: '/candidates/FabricioAlvarado.webp' },
  { id: 'jch', name: 'Juan Carlos Hidalgo', imageUrl: '/candidates/JuanCarlos.webp' },
  { id: 'jab', name: 'Jose Aguilar Berrocal', imageUrl: '/candidates/JoseAguilar.webp' },
];


export const STORAGE_KEY_VOTED = 'cr_decide_has_voted_v1';
export const STORAGE_KEY_RESULTS = 'cr_decide_results_v1';
