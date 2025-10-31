import { useEffect, useRef } from "react";

export default function useFormAutosave(state, setState, storageKey, { throttleMs = 400 } = {}) {
  const t = useRef(null);

  // carrega na montagem
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        setState((prev) => ({ ...prev, ...data }));
      }
    } catch {}
    // salva antes de sair
    const onBeforeUnload = () => {
      try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // salva quando mudar, com throttle
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
    }, throttleMs);
    return () => t.current && clearTimeout(t.current);
  }, [state, storageKey, throttleMs]);

  const clearAutosave = () => {
    try { sessionStorage.removeItem(storageKey); } catch {}
  };

  return { clearAutosave };
}
