import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSelector } from './LanguageSelector';

describe('<LanguageSelector />', () => {
  it('renders the menu selector and reports language changes', () => {
    const handleLangChange = jest.fn();

    render(
      <LanguageSelector
        selectedLang="en-US"
        onLangChange={handleLangChange}
        isMenu
      />
    );

    const selector = screen.getByRole('combobox', { name: '選擇語音辨識語言' });

    expect(selector).toHaveValue('en-US');
    expect(screen.getByText('English (US)')).toBeInTheDocument();
    expect(screen.getByText('中文 (繁體)')).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'en-GB' } });

    expect(handleLangChange).toHaveBeenCalledWith('en-GB');
  });

  it('renders the compact selector with the current language', () => {
    render(<LanguageSelector selectedLang="zh-TW" onLangChange={jest.fn()} />);

    expect(screen.getByRole('combobox', { name: '選擇語音辨識語言' })).toHaveValue('zh-TW');
    expect(screen.getByText('English (UK)')).toBeInTheDocument();
  });
});
