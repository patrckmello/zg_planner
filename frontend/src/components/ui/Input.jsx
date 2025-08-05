import React, { forwardRef } from 'react';
import styles from './Input.module.css';

const Input = forwardRef(({ 
  label,
  error,
  required = false,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  disabled = false,
  className = '',
  icon,
  rows,
  ...props 
}, ref) => {
  const inputClass = [
    styles.input,
    error && styles.error,
    disabled && styles.disabled,
    icon && styles.withIcon,
    className
  ].filter(Boolean).join(' ');

  const InputComponent = type === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={styles.inputGroup}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <InputComponent
          ref={ref}
          type={type === 'textarea' ? undefined : type}
          className={inputClass}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          rows={type === 'textarea' ? rows || 4 : undefined}
          {...props}
        />
      </div>
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

