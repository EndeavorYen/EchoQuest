import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VocabManager, VocabItem, fileNameToWord, parseDifficultyFromPath } from './VocabManager';

// Mock data for testing the component
const mockVocab: VocabItem[] = [
  { id: '1', word: 'apple', difficulty: 1, enabled: true, imageName: 'apple.png', size: 1, type: 'image/png' },
  { id: '2', word: 'banana', difficulty: 3, enabled: false, imageName: 'banana.png', size: 1, type: 'image/png' },
];

describe('VocabManager utility functions', () => {
  describe('fileNameToWord', () => {
    it('should extract the word from a simple filename', () => {
      expect(fileNameToWord('apple.png')).toBe('apple');
    });

    it('should handle filenames with numbers and symbols', () => {
      expect(fileNameToWord('banana-123.jpg')).toBe('banana');
    });

    it('should handle uppercase letters', () => {
      expect(fileNameToWord('Cherry.GIF')).toBe('cherry');
    });

    it('should handle filenames with no extension', () => {
      expect(fileNameToWord('date')).toBe('date');
    });

    it('should return an empty string if there are no letters', () => {
      expect(fileNameToWord('123-!@#.png')).toBe('');
    });
  });

  describe('parseDifficultyFromPath', () => {
    it('should return null if path is undefined', () => {
      expect(parseDifficultyFromPath(undefined)).toBeNull();
    });

    it('should return null if no difficulty is found', () => {
      expect(parseDifficultyFromPath('folder/image.png')).toBeNull();
    });

    it('should extract difficulty from a path segment', () => {
      expect(parseDifficultyFromPath('003-hard/image.png')).toBe(3);
    });

    it('should handle difficulty at the beginning of the path', () => {
      expect(parseDifficultyFromPath('005-very-hard/another/image.png')).toBe(5);
    });

    it('should clamp difficulty to a max of 5', () => {
      expect(parseDifficultyFromPath('009-impossible/image.png')).toBe(5);
    });

    it('should clamp difficulty to a min of 1', () => {
      expect(parseDifficultyFromPath('000-easy/image.png')).toBe(1);
    });

    it('should return the first difficulty found', () => {
      expect(parseDifficultyFromPath('004-a/002-b/image.png')).toBe(4);
    });
  });
});

describe('<VocabManager /> Component', () => {
  const mockOnVocabChange = jest.fn();
  const mockOnGoBack = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockOnVocabChange.mockClear();
    mockOnGoBack.mockClear();
    render(
      <VocabManager
        vocab={mockVocab}
        onVocabChange={mockOnVocabChange}
        onGoBack={mockOnGoBack}
      />
    );
  });

  it('should render the list of vocabulary items', () => {
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('banana')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBe(2);
  });

  it('should call onGoBack when the "返回遊戲" button is clicked', () => {
    fireEvent.click(screen.getByText('返回遊戲'));
    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it('should call onVocabChange with the item removed when delete is clicked', () => {
    // Get all delete buttons, and click the first one (for 'apple')
    const deleteButtons = screen.getAllByRole('button', { name: '刪除' });
    fireEvent.click(deleteButtons[0]);

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    // Expect the call to be with an array containing only the 'banana' item
    expect(mockOnVocabChange).toHaveBeenCalledWith([mockVocab[1]]);
  });

  it('should call onVocabChange with updated difficulty when changed', () => {
    const difficultySelects = screen.getAllByRole('combobox');
    // Change the difficulty of the first item ('apple') to 5
    fireEvent.change(difficultySelects[0], { target: { value: '5' } });

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    const expectedNewVocab = [...mockVocab];
    expectedNewVocab[0] = { ...expectedNewVocab[0], difficulty: 5 };
    expect(mockOnVocabChange).toHaveBeenCalledWith(expectedNewVocab);
  });

  it('should call onVocabChange with updated enabled status when checkbox is clicked', () => {
    const checkboxes = screen.getAllByRole('checkbox');
    // The first item 'apple' is enabled, so its checkbox is checked. Click it to disable.
    fireEvent.click(checkboxes[0]);

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    const expectedNewVocab = [...mockVocab];
    expectedNewVocab[0] = { ...expectedNewVocab[0], enabled: false };
    expect(mockOnVocabChange).toHaveBeenCalledWith(expectedNewVocab);
  });
});
