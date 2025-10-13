import React from "react";
import { FiCalendar } from "react-icons/fi";
import styles from "./IntegrationGate.module.css";

export default function IntegrationGate({ connected, onConnect, children, onAttemptWhileLocked }) {
  return (
    <div className={styles.gateWrap}>
      {/* Desabilita semanticamente (acessibilidade) */}
      <fieldset disabled={!connected} className={styles.fieldsetReset}>
        {children}
      </fieldset>

      {/* Overlay clicável quando desconectado */}
      {!connected && (
        <button
          type="button"
          onClick={onAttemptWhileLocked}
          className={styles.overlayButton}
          aria-label="Conectar para usar"
        />
      )}

      {/* Mensagem + CTA */}
      {!connected && (
        <div className={styles.permissionNote}>
          <FiCalendar className={styles.noteIcon} />
          <span>
            Conecte sua conta Microsoft para adicionar eventos ao Outlook.
          </span>
          <button type="button" className={styles.inlineCta} onClick={onConnect}>
            Conectar agora
          </button>
        </div>
      )}
    </div>
  );
}
