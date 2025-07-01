import React from 'react';
import styles from './AnexoItemPreview.module.css';

// ✅ Mantenha apenas ESSA versão
const getFileIcon = (type, name) => {
  if (type?.startsWith('image/')) return '🖼️';
  if (type?.startsWith('video/')) return '🎥';
  if (type?.startsWith('audio/')) return '🎵';
  if (type?.includes('pdf')) return '📄';
  if (type?.includes('word') || name?.endsWith('.doc') || name?.endsWith('.docx')) return '📝';
  if (type?.includes('excel') || name?.endsWith('.xls') || name?.endsWith('.xlsx')) return '📊';
  if (type?.includes('powerpoint') || name?.endsWith('.ppt') || name?.endsWith('.pptx')) return '📋';
  if (type?.includes('zip') || type?.includes('rar') || type?.includes('7z')) return '🗜️';
  if (type?.includes('text')) return '📄';
  return '📎';
};

const AnexoItemPreview = ({ anexo, onRemove }) => {
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={styles.previewContainer}>
      <button
        className={styles.removeButton}
        onClick={onRemove}
        aria-label={`Remover arquivo ${anexo.name}`}
        title="Remover arquivo"
      >
        ×
      </button>
      
      <div className={styles.fileIcon}>
        {getFileIcon(anexo.type, anexo.name)}
      </div>
      
      <div className={styles.fileName} title={anexo.name}>
        {anexo.name}
      </div>
      
      <div className={styles.fileSize}>
        {formatFileSize(anexo.size)}
      </div>
    </div>
  );
};

export default AnexoItemPreview;
