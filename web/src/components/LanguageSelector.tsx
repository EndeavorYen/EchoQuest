import React from 'react';
import { Globe } from 'lucide-react';

type LanguageSelectorProps = {
  selectedLang: string;
  onLangChange: (lang: string) => void;
  isMenu?: boolean;
};

const languages = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'zh-TW', name: '中文 (繁體)' },
  { code: 'zh-CN', name: '中文 (简体)' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLang,
  onLangChange,
  isMenu = false,
}) => {
  const selector = (
    <select
      value={selectedLang}
      onChange={(e) => onLangChange(e.target.value)}
      aria-label="Select recognition language"
      className="eq-select"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );

  if (isMenu) {
    return (
      <div className="flex items-center gap-2">
        <Globe className="w-6 h-6 text-[color:var(--eq-river)]" />
        {selector}
      </div>
    );
  }

  return selector;
};
