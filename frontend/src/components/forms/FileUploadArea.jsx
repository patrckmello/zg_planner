import React, { useRef, useState } from 'react';
import styles from './FileUploadArea.module.css';

const FileUploadArea = ({ 
  label,
  value = [],
  onChange,
  error,
  required = false,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = [], // Array vazio = aceita todos os tipos
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📋';
    if (type.includes('zip') || type.includes('rar')) return '🗜️';
    return '📎';
  };

  const validateFile = (file) => {
    if (file.size > maxFileSize) {
      return `Arquivo muito grande. Máximo: ${formatFileSize(maxFileSize)}`;
    }
    
    // Aceitar todos os tipos de arquivo se acceptedTypes estiver vazio
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `Tipo de arquivo não permitido: ${file.type}`;
    }
    
    return null;
  };

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push({
          id: Date.now() + Math.random(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          isNew: true
        });
      }
    });

    if (errors.length > 0) {
      alert('Erros encontrados:\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      const newFiles = [...value, ...validFiles].slice(0, maxFiles);
      onChange(newFiles);
    }
  };

  const removeFile = (id) => {
    onChange(value.filter(file => file.id !== id));
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const isMaxFiles = value.length >= maxFiles;

  return (
    <div className={`${styles.fileUploadGroup} ${className}`}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={styles.uploadContainer}>
        {/* Upload Area */}
        {!isMaxFiles && (
          <div
            className={`${styles.uploadArea} ${isDragging ? styles.dragging : ''} ${error ? styles.error : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={styles.uploadContent}>
              <div className={styles.uploadIcon}>📁</div>
              <div className={styles.uploadText}>
                Clique para selecionar arquivos
              </div>
              <div className={styles.uploadSubtext}>
                ou arraste e solte aqui
              </div>
              <div className={styles.uploadInfo}>
                Máximo: {maxFiles} arquivos, {formatFileSize(maxFileSize)} cada
                {acceptedTypes.length === 0 && <br />}
                {acceptedTypes.length === 0 && <span>Todos os tipos de arquivo aceitos</span>}
              </div>
            </div>
          </div>
        )}

        {/* Files Grid */}
        {value.length > 0 && (
          <div className={styles.filesGrid}>
            {value.map(fileObj => (
              <div key={fileObj.id} className={styles.fileItem}>
                <div className={styles.fileIcon}>
                  {getFileIcon(fileObj.type)}
                </div>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName} title={fileObj.name}>
                    {fileObj.name}
                  </div>
                  <div className={styles.fileSize}>
                    {formatFileSize(fileObj.size)}
                  </div>
                  {fileObj.isNew && (
                    <div className={styles.fileStatus}>Novo</div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={() => removeFile(fileObj.id)}
                  aria-label={`Remover arquivo ${fileObj.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.hiddenInput}
          onChange={handleFileInputChange}
          accept={acceptedTypes.length > 0 ? acceptedTypes.join(',') : undefined}
        />
      </div>

      {error && <span className={styles.errorMessage}>{error}</span>}
      
      <div className={styles.uploadInfo}>
        <span className={styles.fileCount}>
          {value.length}/{maxFiles} arquivos
        </span>
        {acceptedTypes.length > 0 && (
          <span className={styles.acceptedTypes}>
            Tipos aceitos: {acceptedTypes.map(type => type.split('/')[1]).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
};

export default FileUploadArea;

