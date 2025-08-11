// All code comments must be English per user requirement

import { createBossLevel as boss, createDoorLevel as door } from './game.js';

// Re-export factories so main can import from one place
export const createBossLevel = boss;
export const createDoorLevel = door;


