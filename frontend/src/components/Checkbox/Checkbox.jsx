import React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import styles from './Checkbox.module.css';
import { Check } from 'phosphor-react'; // Ícone legal para o check, pode usar outro!

export default function Checkbox({ checked, onCheckedChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <CheckboxPrimitive.Root
        className={styles.checkboxRoot}
        checked={checked}
        onCheckedChange={onCheckedChange}
        id="c1"
      >
        <CheckboxPrimitive.Indicator className={styles.checkboxIndicator}>
          <Check weight="bold" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && <span>{label}</span>}
    </label>
  );
}
