import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VocabManager, fileNameToWord, mergeImportedVocab, parseDifficultyFromPath } from './VocabManager';
import type { VocabItem } from '../types/vocab';

// Mock data for testing the component
const mockVocab: VocabItem[] = [
  { id: '1', word: 'apple', difficulty: 1, enabled: true, imageName: 'apple.png', imageSrc: 'assets/generated/word-apple.png', size: 1, type: 'image/png' },
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

  describe('mergeImportedVocab', () => {
    it('skips duplicate words case-insensitively', () => {
      const incoming: VocabItem[] = [
        { ...mockVocab[0], id: '3', word: 'Apple' },
        { ...mockVocab[0], id: '4', word: 'cherry', imageName: 'cherry.png' },
      ];

      expect(mergeImportedVocab(mockVocab, incoming)).toEqual({
        vocab: [...mockVocab, incoming[1]],
        added: 1,
        skipped: 1,
      });
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
    expect(screen.getByRole('main', { name: 'EchoQuest 字彙庫' })).toHaveAttribute('data-screen', 'vocab-management');
    expect(screen.getByDisplayValue('apple')).toBeInTheDocument();
    expect(screen.getByDisplayValue('banana')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBe(2);
  });

  it('should render bundled artwork previews when imageSrc is available', () => {
    expect(screen.getByRole('img', { name: 'apple 圖片' })).toHaveAttribute('src', 'assets/generated/word-apple.png');
  });

  it('should call onGoBack when the "返回遊戲" button is clicked', () => {
    fireEvent.click(screen.getByText('返回遊戲'));
    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it('should call onVocabChange with the item removed when delete is clicked', () => {
    fireEvent.click(screen.getByRole('button', { name: '刪除 apple' }));

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    // Expect the call to be with an array containing only the 'banana' item
    expect(mockOnVocabChange).toHaveBeenCalledWith([mockVocab[1]]);
  });

  it('should call onVocabChange with updated difficulty when changed', () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'apple 難度' }), { target: { value: '5' } });

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    const expectedNewVocab = [...mockVocab];
    expectedNewVocab[0] = { ...expectedNewVocab[0], difficulty: 5 };
    expect(mockOnVocabChange).toHaveBeenCalledWith(expectedNewVocab);
  });

  it('should call onVocabChange with updated enabled status when checkbox is clicked', () => {
    fireEvent.click(screen.getByRole('checkbox', { name: 'apple 啟用' }));

    expect(mockOnVocabChange).toHaveBeenCalledTimes(1);
    const expectedNewVocab = [...mockVocab];
    expectedNewVocab[0] = { ...expectedNewVocab[0], enabled: false };
    expect(mockOnVocabChange).toHaveBeenCalledWith(expectedNewVocab);
  });

  it('filters the vocabulary list by search text and enabled state', () => {
    fireEvent.change(screen.getByRole('searchbox', { name: '搜尋單字' }), { target: { value: 'ban' } });
    expect(screen.queryByText('apple')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('banana')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '搜尋單字' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '顯示範圍' }), { target: { value: 'enabled' } });
    expect(screen.getByDisplayValue('apple')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('banana')).not.toBeInTheDocument();
  });

  it('edits a word through a labelled text field', () => {
    fireEvent.change(screen.getByRole('textbox', { name: 'apple 單字' }), { target: { value: 'apricot' } });

    expect(mockOnVocabChange).toHaveBeenCalledWith([
      { ...mockVocab[0], word: 'apricot' },
      mockVocab[1],
    ]);
  });

  it('shows import errors inline without a blocking alert', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const invalidFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const fileInput = screen.getByLabelText('新增圖片');

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('新增 0 個');
      expect(screen.getByRole('status')).toHaveTextContent('失敗 1 個');
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
