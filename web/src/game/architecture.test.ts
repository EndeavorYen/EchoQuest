import fs from 'fs';
import path from 'path';

const gameSourceFiles = ['gameLogic.ts', 'gameReducer.ts'];

describe('game architecture boundaries', () => {
  it('keeps game modules independent from UI components', () => {
    for (const fileName of gameSourceFiles) {
      const source = fs.readFileSync(path.join(__dirname, fileName), 'utf8');

      expect(source).not.toMatch(/from ['"]\.\.\/components\//);
    }
  });
});
