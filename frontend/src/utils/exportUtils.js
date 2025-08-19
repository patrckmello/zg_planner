// exportUtils.js - Utilitários para exportação de relatórios

// Função para exportar dados em CSV
export const exportToCSV = (reportData, filters) => {
  if (!reportData) return;

  // Preparar dados das tarefas para CSV
  const csvData = [];
  
  // Cabeçalhos
  const headers = [
    'ID',
    'Título',
    'Status',
    'Prioridade',
    'Categoria',
    'Data de Criação',
    'Data de Conclusão',
    'Tempo de Conclusão (dias)'
  ];
  
  csvData.push(headers);

  // Adicionar dados das tarefas (simulado - você pode ajustar conforme sua API)
  if (reportData.tasks && reportData.tasks.length > 0) {
    reportData.tasks.forEach(task => {
      const row = [
        task.id || '',
        task.title || '',
        getStatusLabel(task.status) || '',
        task.priority || '',
        task.category || '',
        task.created_at ? new Date(task.created_at).toLocaleDateString('pt-BR') : '',
        task.completed_at ? new Date(task.completed_at).toLocaleDateString('pt-BR') : '',
        task.completion_time || ''
      ];
      csvData.push(row);
    });
  } else {
    // Se não há dados de tarefas individuais, criar resumo
    const summaryData = [
      ['Métrica', 'Valor'],
      ['Total de Tarefas', reportData.total_tasks],
      ['Tarefas Concluídas no Prazo', reportData.tasks_completed_on_time],
      ['Tarefas Atrasadas', reportData.overdue_tasks],
      ['Tempo Médio de Conclusão', reportData.average_completion_time],
      ['Taxa de Conclusão (%)', reportData.total_tasks > 0 ? Math.round(((reportData.tasks_by_status.done || 0) / reportData.total_tasks) * 100) : 0]
    ];
    
    csvData.length = 0; // Limpar array
    csvData.push(...summaryData);
  }

  // Converter para string CSV
  const csvContent = csvData.map(row => 
    row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // Criar e baixar arquivo
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `relatorio-tarefas-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Função para exportar relatório em PDF
export const exportToPDF = async (reportData, filters) => {
  if (!reportData) return;

  try {
    // Importar jsPDF dinamicamente
    const { jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Configurar fonte
    doc.setFont('helvetica');

    // Título do relatório
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55); // #1f2937
    doc.text('Relatório de Tarefas Pessoais', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Data do relatório
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Filtros aplicados (se houver)
    if (filters && Object.values(filters).some(filter => filter)) {
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('Filtros Aplicados:', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      
      if (filters.start_date) {
        doc.text(`• Data Inicial: ${new Date(filters.start_date).toLocaleDateString('pt-BR')}`, 25, yPosition);
        yPosition += 6;
      }
      if (filters.end_date) {
        doc.text(`• Data Final: ${new Date(filters.end_date).toLocaleDateString('pt-BR')}`, 25, yPosition);
        yPosition += 6;
      }
      if (filters.status) {
        doc.text(`• Status: ${getStatusLabel(filters.status)}`, 25, yPosition);
        yPosition += 6;
      }
      if (filters.priority) {
        doc.text(`• Prioridade: ${filters.priority}`, 25, yPosition);
        yPosition += 6;
      }
      if (filters.category) {
        doc.text(`• Categoria: ${filters.category}`, 25, yPosition);
        yPosition += 6;
      }
      yPosition += 10;
    }

    // Métricas principais
    doc.setFontSize(16);
    doc.setTextColor(31, 41, 55);
    doc.text('Métricas Principais', 20, yPosition);
    yPosition += 15;

    // Criar tabela de métricas
    const metricsData = [
      ['Total de Tarefas', reportData.total_tasks.toString()],
      ['Concluídas no Prazo', reportData.tasks_completed_on_time.toString()],
      ['Tarefas Atrasadas', reportData.overdue_tasks.toString()],
      ['Tempo Médio de Conclusão', reportData.average_completion_time],
      ['Taxa de Conclusão', reportData.total_tasks > 0 ? `${Math.round(((reportData.tasks_by_status.done || 0) / reportData.total_tasks) * 100)}%` : '0%']
    ];

    // Desenhar tabela de métricas
    doc.setFontSize(10);
    metricsData.forEach(([label, value]) => {
      doc.setTextColor(31, 41, 55);
      doc.text(label, 25, yPosition);
      doc.setTextColor(26, 115, 232); // #1a73e8
      doc.text(value, 120, yPosition);
      yPosition += 8;
    });

    yPosition += 10;

    // Distribuição por Status
    if (reportData.tasks_by_status && Object.keys(reportData.tasks_by_status).length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('Distribuição por Status', 20, yPosition);
      yPosition += 12;

      doc.setFontSize(10);
      Object.entries(reportData.tasks_by_status).forEach(([status, count]) => {
        doc.setTextColor(31, 41, 55);
        doc.text(`• ${getStatusLabel(status)}`, 25, yPosition);
        doc.setTextColor(26, 115, 232);
        doc.text(count.toString(), 120, yPosition);
        yPosition += 7;
      });

      yPosition += 10;
    }

    // Distribuição por Prioridade
    if (reportData.tasks_by_priority && Object.keys(reportData.tasks_by_priority).length > 0) {
      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('Distribuição por Prioridade', 20, yPosition);
      yPosition += 12;

      doc.setFontSize(10);
      Object.entries(reportData.tasks_by_priority).forEach(([priority, count]) => {
        doc.setTextColor(31, 41, 55);
        doc.text(`• ${priority}`, 25, yPosition);
        doc.setTextColor(26, 115, 232);
        doc.text(count.toString(), 120, yPosition);
        yPosition += 7;
      });

      yPosition += 10;
    }

    // Distribuição por Categoria
    if (reportData.tasks_by_category && Object.keys(reportData.tasks_by_category).length > 0) {
      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55);
      doc.text('Distribuição por Categoria', 20, yPosition);
      yPosition += 12;

      doc.setFontSize(10);
      Object.entries(reportData.tasks_by_category).forEach(([category, count]) => {
        doc.setTextColor(31, 41, 55);
        doc.text(`• ${category}`, 25, yPosition);
        doc.setTextColor(26, 115, 232);
        doc.text(count.toString(), 120, yPosition);
        yPosition += 7;
      });
    }

    // Adicionar rodapé
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('ZG Planner - Sistema de Gerenciamento de Tarefas', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Salvar PDF
    doc.save(`relatorio-tarefas-${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw new Error('Erro ao gerar relatório PDF. Verifique se todas as dependências estão instaladas.');
  }
};

// Função auxiliar para obter label do status
const getStatusLabel = (status) => {
  const statusLabels = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    done: 'Concluída',
    cancelled: 'Cancelada'
  };
  return statusLabels[status] || status;
};

