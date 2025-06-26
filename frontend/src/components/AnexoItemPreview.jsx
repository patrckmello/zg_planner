import React, { useEffect } from 'react';
import styles from './TaskForm.module.css';

function AnexoItemPreview({ file, onRemove }) {
  // Cria a URL temporária para o arquivo
  const fileURL = URL.createObjectURL(file);

  useEffect(() => {
    const fileURL = URL.createObjectURL(file);
    
    return () => {
      URL.revokeObjectURL(fileURL);
      console.log(`Limpando URL do arquivo: ${file.name}`);
    };
  }, [file]);

  const isImage = file.type.startsWith('image/');

  return (
    <div className={styles.anexoItem}>
      <button type="button" onClick={onRemove}>×</button>
      
      {isImage ? (
        <img src={fileURL} alt="preview" className={styles.previewThumb} />
      ) : (
        <span className={styles.fileIcon}>📄</span>
      )}
      
      <div className={styles.fileName} title={file.name}>
        {file.name}
      </div>
      
      <div className={styles.fileSize}>
        {(file.size / 1024).toFixed(1)} KB
      </div>
    </div>
  );
}

export default AnexoItemPreview;

