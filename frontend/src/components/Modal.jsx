import React, { useEffect, useRef } from "react";
import styles from "./Modal.module.css";

export default function Modal({
  isOpen,
  onClose,
  size = "md",           // "sm" | "md" | "lg"
  title,
  children,
  closeOnBackdrop = true,
  ariaLabelledById,
}) {
  const dialogRef = useRef(null);
  const prevScroll = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    // lock scroll
    prevScroll.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${prevScroll.current}px`;

    const prevActive = document.activeElement;

    const focusTimer = setTimeout(() => {
      const el =
        dialogRef.current?.querySelector("[data-autofocus]") ||
        dialogRef.current;
      el?.focus?.();
    }, 30);

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, details, summary, [tabindex]:not([tabindex="-1"])'
        );
        const items = Array.from(focusables).filter(
          (el) => !el.hasAttribute("disabled")
        );
        if (!items.length) return;

        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      // unlock scroll
      document.body.style.position = "";
      document.body.style.top = "";
      window.scrollTo(0, prevScroll.current);
      prevActive?.focus?.();
      clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const onBackdrop = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledById}
      onMouseDown={onBackdrop}
    >
      <div
        className={`${styles.card} ${styles[size]}`}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className={styles.header}>
          {title ? (
            <h3 id={ariaLabelledById} className={styles.title}>
              {title}
            </h3>
          ) : (
            <span />
          )}
          <button className={styles.close} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
