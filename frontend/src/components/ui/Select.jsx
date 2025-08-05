import React, { forwardRef } from 'react';
import styles from './Select.module.css';

const Select = forwardRef(({ 
  label,
  error,
  required = false,
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  className = '',
  options = [],
  placeholder = 'Selecione...',
  icon,
  ...props 
}, ref) => {
  const selectClass = [
    styles.select,
    error && styles.error,
    disabled && styles.disabled,
    icon && styles.withIcon,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.selectGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.selectWrapper}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <select
          ref={ref}
          className={selectClass}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.chevron}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;

