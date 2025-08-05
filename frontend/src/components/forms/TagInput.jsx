import React, { useState, useRef, useEffect } from 'react';
import styles from './TagInput.module.css';

const TagInput = ({ 
  label,
  value = [],
  onChange,
  placeholder = 'Adicionar tag...',
  error,
  required = false,
  maxTags = 10,
  suggestions = [],
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const filteredSuggestions = suggestions.filter(
    suggestion => 
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.includes(suggestion)
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tag) => {
    const trimmedTag = tag.trim();
    if (
      trimmedTag && 
      !value.includes(trimmedTag) && 
      value.length < maxTags
    ) {
      onChange([...value, trimmedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion) => {
    addTag(suggestion);
  };

  return (
    <div className={`${styles.tagInputGroup} ${className}`} ref={containerRef}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={`${styles.tagContainer} ${error ? styles.error : ''}`}>
        <div className={styles.tagsWrapper}>
          {value.map((tag, index) => (
            <div key={index} className={styles.tag}>
              <span className={styles.tagText}>{tag}</span>
              <button
                type="button"
                className={styles.removeTag}
                onClick={() => removeTag(tag)}
                aria-label={`Remover tag ${tag}`}
              >
                ×
              </button>
            </div>
          ))}
          
          <input
            ref={inputRef}
            type="text"
            className={styles.tagInput}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={value.length >= maxTags}
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className={styles.suggestions}>
            {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className={styles.suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <span className={styles.errorMessage}>{error}</span>}
      
      <div className={styles.tagInfo}>
        <span className={styles.tagCount}>
          {value.length}/{maxTags} tags
        </span>
        <span className={styles.tagHint}>
          Pressione Enter para adicionar
        </span>
      </div>
    </div>
  );
};

export default TagInput;

