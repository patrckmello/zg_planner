import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './TagInput.module.css';
import api from '../../services/axiosInstance';

// ===== helpers de cor =====
const DEFAULT_TAG_COLORS = [
  "#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#84cc16","#f97316","#ec4899","#14b8a6",
  "#0ea5e9","#22c55e","#eab308","#fb7185","#a78bfa",
];
function stableColorFor(name = "") {
  if (!name) return DEFAULT_TAG_COLORS[0];
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DEFAULT_TAG_COLORS[h % DEFAULT_TAG_COLORS.length];
}
function contrast(hex) {
  try {
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    const y = (r*299 + g*587 + b*114) / 1000;
    return y > 150 ? '#111' : '#fff';
  } catch { return '#111'; }
}
function normIn(item, suggMap) {
  if (typeof item === 'string') {
    const name = item.trim();
    const sug = suggMap.get(name.toLowerCase());
    return { name, color: sug?.color || stableColorFor(name) };
  }
  if (item && typeof item === 'object') {
    const name = (item.name || item.label || '').trim();
    if (!name) return null;
    const color = (item.color || '').trim() || suggMap.get(name.toLowerCase())?.color || stableColorFor(name);
    return { name, color };
  }
  return null;
}
function normOut(arr) {
  return (arr || [])
    .filter(t => t && t.name)
    .map(t => ({ name: t.name, color: (t.color || '').trim() || stableColorFor(t.name) }));
}

const TagInput = ({
  label,
  value = [],
  onChange,
  placeholder = 'Adicionar tag...',
  error,
  required = false,
  maxTags = 10,
  suggestions = [],
  className = '',
  allowColorPick = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popoverFor, setPopoverFor] = useState(null); // nome da tag com popover aberto
  const [tempHex, setTempHex] = useState('#2563eb');
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const [remoteSuggestions, setRemoteSuggestions] = useState([]);
  const [lockedNames, setLockedNames] = useState(new Set());

  // mapa de sugestões
  const suggestionsMap = useMemo(() => {
    const map = new Map();
    const source = (remoteSuggestions && Array.isArray(remoteSuggestions)) ? remoteSuggestions : (suggestions || []);
    for (const s of source) {
      const obj = typeof s === 'string' ? { name: s, color: stableColorFor(s) } : { name: s?.name || s?.label || '', color: s?.color };
      if (!obj.name) continue;
      if (!obj.color) obj.color = stableColorFor(obj.name);
      map.set(obj.name.toLowerCase(), obj);
    }
    return map;
  }, [remoteSuggestions, suggestions]);

  // value normalizado
  const normalizedValue = useMemo(() => {
    const dedup = new Map();
    for (const v of (value || [])) {
      const obj = normIn(v, suggestionsMap);
      if (!obj) continue;
      const key = obj.name.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, obj);
    }
    return Array.from(dedup.values());
  }, [value, suggestionsMap]);

  // sugestões filtradas
  const filteredSuggestions = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    const selected = new Set(normalizedValue.map(t => t.name.toLowerCase()));
    const list = Array.from(suggestionsMap.values())
      .filter(s => !selected.has(s.name.toLowerCase()) && (term ? s.name.toLowerCase().includes(term) : false));
    if (term && !selected.has(term) && !suggestionsMap.has(term)) {
      list.unshift({ name: inputValue.trim(), color: stableColorFor(inputValue.trim()), __new: true });
    }
    return list.slice(0, 8);
  }, [inputValue, suggestionsMap, normalizedValue]);

  // fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
        setPopoverFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar sugestões remotas conforme digita
  useEffect(() => {
    let active = true;
    const term = inputValue.trim();
    if (!term) {
      setRemoteSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/tags/suggestions`, { params: { q: term }, signal: ctrl.signal });
        if (active) setRemoteSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (active) setRemoteSuggestions([]);
      }
    }, 200);
    return () => { active = false; clearTimeout(timer); ctrl.abort(); };
  }, [inputValue]);

  // Travar cor das tags já existentes no catálogo
  useEffect(() => {
    const names = (normalizedValue || []).map(t => t.name).filter(Boolean);
    if (names.length === 0) { setLockedNames(new Set()); return; }
    const qs = names.join(',');
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/tags/colors`, { params: { names: qs } });
        if (!active) return;
        const next = new Set();
        (Array.isArray(data) ? data : []).forEach(row => {
          if (row && row.name && row.exists) next.add(String(row.name).toLowerCase());
        });
        setLockedNames(next);
      } catch {
        // silêncio: mantém estado atual
      }
    })();
    return () => { active = false; };
  }, [JSON.stringify((normalizedValue || []).map(t => t.name).sort())]);

  const emit = (arr) => onChange?.(normOut(arr));

  const addTag = (raw) => {
    const obj = normIn(raw, suggestionsMap);
    if (!obj) return;
    const exists = normalizedValue.some(t => t.name.toLowerCase() === obj.name.toLowerCase());
    if (exists || normalizedValue.length >= maxTags) return;

    const key = obj.name.toLowerCase();
    const existsInCatalog = (typeof raw === 'object' && raw.__new === true) ? false : suggestionsMap.has(key);
    setLockedNames((prev) => {
      const next = new Set(prev);
      if (existsInCatalog) next.add(key);
      return next;
    });

    emit([...normalizedValue, obj]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (name) => {
    const next = normalizedValue.filter(t => t.name.toLowerCase() !== name.toLowerCase());
    emit(next);
    if (popoverFor === name) setPopoverFor(null);
  };

  const updateColor = (name, color) => {
    const key = name.toLowerCase();
    if (lockedNames.has(key)) return;
    const next = normalizedValue.map(t => t.name.toLowerCase() === key ? { ...t, color } : t);
    emit(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = inputValue.trim();
      if (tag) addTag(tag);
    } else if (e.key === 'Backspace' && !inputValue && normalizedValue.length > 0) {
      removeTag(normalizedValue[normalizedValue.length - 1].name);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setPopoverFor(null);
    }
  };

  const handleSuggestionClick = (s) => addTag(s);

  const openPopover = (tag) => {
    if (!allowColorPick) return;
    if (lockedNames.has((tag.name || '').toLowerCase())) return;
    setTempHex(tag.color || stableColorFor(tag.name));
    setPopoverFor(tag.name);
  };

  const applyHex = () => {
    const hex = tempHex?.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
    updateColor(popoverFor, hex);
    setPopoverFor(null);
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
          {normalizedValue.map((t) => {
            const bg = t.color || stableColorFor(t.name);
            const fg = contrast(bg);
            const isOpen = popoverFor === t.name;

            return (
              <div key={t.name} className={styles.tagShell}>
                <div className={styles.tag} style={{ backgroundColor: bg, color: fg }}>
                  {/* swatch + nome */}
                  {allowColorPick && !lockedNames.has((t.name || '').toLowerCase()) && (
                    <button
                      type="button"
                      className={styles.colorDot}
                      title="Escolher cor"
                      onClick={(e) => { e.stopPropagation(); openPopover(t); }}
                      aria-label={`Escolher cor da tag ${t.name}`}
                    />
                  )}
                  <span className={styles.tagText}>{t.name}</span>
                  <button
                    type="button"
                    className={styles.removeTag}
                    onClick={() => removeTag(t.name)}
                    aria-label={`Remover tag ${t.name}`}
                  >
                    ×
                  </button>
                </div>

                {/* Popover de cor */}
                {allowColorPick && isOpen && (
                  <div ref={popoverRef} className={styles.colorPopover}>
                    <div className={styles.swatchGrid}>
                      {DEFAULT_TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={styles.swatch}
                          style={{ backgroundColor: c }}
                          onClick={() => { updateColor(t.name, c); setPopoverFor(null); }}
                          aria-label={`Cor ${c}`}
                          title={c}
                        />
                      ))}
                    </div>

                    <div className={styles.hexRow}>
                      <input
                        className={styles.hexInput}
                        value={tempHex}
                        onChange={(e) => setTempHex(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
                        placeholder="#RRGGBB"
                        maxLength={7}
                      />
                      <button type="button" className={styles.hexApply} onClick={applyHex}>
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <input
            ref={inputRef}
            type="text"
            className={styles.tagInput}
            value={inputValue}
            onChange={(e) => {
              const v = e.target.value;
              setInputValue(v);
              setShowSuggestions(!!v.trim());
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => { /* sem sugestões no foco; só ao digitar */ }}
            placeholder={normalizedValue.length === 0 ? placeholder : ''}
            disabled={normalizedValue.length >= maxTags}
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className={styles.suggestions}>
            {filteredSuggestions.map((s, index) => (
              <button
                key={`${s.name}-${index}`}
                type="button"
                className={styles.suggestion}
                onClick={() => handleSuggestionClick(s)}
                title={s.__new ? `Criar "${s.name}"` : s.name}
              >
                <span
                  className={styles.suggestionSwatch}
                  style={{ backgroundColor: s.color }}
                />
                {s.name}{s.__new ? ' (novo)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <span className={styles.errorMessage}>{error}</span>}

      <div className={styles.tagInfo}>
        <span className={styles.tagCount}>
          {normalizedValue.length}/{maxTags} tags
        </span>
        <span className={styles.tagHint}>
          Enter adiciona • vírgula também
        </span>
      </div>
    </div>
  );
};

export default TagInput;
