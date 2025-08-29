"use client";

import { useState, useRef, useEffect } from 'react';
import { useSymbolSuggestions, SymbolSuggestion } from '../hooks/useSymbolSuggestions';

interface SymbolAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: SymbolSuggestion) => void;
  placeholder?: string;
  className?: string;
}

export function SymbolAutocomplete({ 
  value, 
  onChange, 
  onSelect, 
  placeholder = "Entrez un symbole...",
  className = ""
}: SymbolAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  
  const { suggestions, loading } = useSymbolSuggestions(value);

  useEffect(() => {
    setIsOpen(suggestions.length > 0 && value.length >= 2);
    setSelectedIndex(-1);
  }, [suggestions, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value.toUpperCase());
  };

  const handleSuggestionClick = (suggestion: SymbolSuggestion) => {
    onChange(suggestion.symbol);
    setIsOpen(false);
    onSelect?.(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleBlur = () => {
    // Délai pour permettre le clic sur une suggestion
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 && value.length >= 2) {
            setIsOpen(true);
          }
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
        autoComplete="off"
      />
      
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.symbol}-${suggestion.coingecko_id}`}
              className={`px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-900 ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">
                    {suggestion.symbol}
                  </span>
                  {suggestion.name && (
                    <span className="ml-2 text-sm text-gray-500">
                      {suggestion.name}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
