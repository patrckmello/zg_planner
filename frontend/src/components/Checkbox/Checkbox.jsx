import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import styles from './Checkbox.module.css';
import { Check } from 'phosphor-react';

export default function Checkbox({ checked, onCheckedChange, label, id }) {
  return (
    <label
      htmlFor={id}
      className={styles.checkboxLabel}
    >
      <CheckboxPrimitive.Root
        className={styles.checkboxRoot}
        checked={checked}
        onCheckedChange={onCheckedChange}
        id={id}
      >
        <CheckboxPrimitive.Indicator className={styles.checkboxIndicator}>
          <Check weight="bold" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && <span className={styles.checkboxText}>{label}</span>}
    </label>
  );
}

