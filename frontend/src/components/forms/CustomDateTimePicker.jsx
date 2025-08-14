import React, { useState, useEffect, useRef } from 'react';
import { 
  FiCalendar, 
  FiClock, 
  FiChevronLeft, 
  FiChevronRight, 
  FiX,
  FiCheck
} from 'react-icons/fi';
import styles from './CustomDateTimePicker.module.css';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CustomDateTimePicker({ 
  value, 
  onChange, 
  label = "Data de Vencimento",
  placeholder = "Selecione data e hora",
  disabled = false,
  error = null,
  required = false,
  minDate = null, // Data mínima permitida
  maxDate = null  // Data máxima permitida
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState({ hour: 9, minute: 0 });
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [timeInputMode, setTimeInputMode] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const containerRef = useRef(null);
  const timeInputRef = useRef(null);

  // Inicializar com valor existente
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setSelectedTime({
        hour: date.getHours(),
        minute: date.getMinutes()
      });
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
    }
  }, [value]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setTimeInputMode(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const handleToggleOpen = () => {
    if (!disabled) {
      if (!isOpen) {
        updateDropdownPosition();
      }
      setIsOpen(!isOpen);
    }
  };

  const formatDisplayValue = () => {
    if (!selectedDate) return placeholder;
    
    const date = new Date(selectedDate);
    date.setHours(selectedTime.hour, selectedTime.minute);
    
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Não permitir datas passadas
    if (date < today) return true;
    
    // Verificar data mínima
    if (minDate && date < new Date(minDate)) return true;
    
    // Verificar data máxima
    if (maxDate && date > new Date(maxDate)) return true;
    
    return false;
  };

  const getDaysInMonth = (month, year) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Dias do mês anterior
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const date = new Date(prevYear, prevMonth, day);
      days.push({
        day,
        date,
        isCurrentMonth: false,
        isDisabled: isDateDisabled(date)
      });
    }
    
    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        day,
        date,
        isCurrentMonth: true,
        isDisabled: isDateDisabled(date)
      });
    }
    
    // Dias do próximo mês
    const remainingDays = 42 - days.length; // 6 semanas * 7 dias
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(nextYear, nextMonth, day);
      days.push({
        day,
        date,
        isCurrentMonth: false,
        isDisabled: isDateDisabled(date)
      });
    }
    
    return days;
  };

  const handleDateSelect = (dayObj) => {
    if (dayObj.isDisabled) return;
    
    setSelectedDate(dayObj.date);
    if (dayObj.isCurrentMonth) {
      // Se selecionou um dia do mês atual, vai para seleção de hora
      setTimeInputMode(true);
      setTimeout(() => {
        timeInputRef.current?.focus();
      }, 100);
    } else {
      // Se selecionou um dia de outro mês, navega para esse mês
      setCurrentMonth(dayObj.date.getMonth());
      setCurrentYear(dayObj.date.getFullYear());
    }
  };

  const handleTimeChange = (type, value) => {
    const newTime = { ...selectedTime };
    
    if (type === 'hour') {
      newTime.hour = Math.max(0, Math.min(23, parseInt(value) || 0));
    } else {
      newTime.minute = Math.max(0, Math.min(59, parseInt(value) || 0));
    }
    
    setSelectedTime(newTime);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      const finalDate = new Date(selectedDate);
      finalDate.setHours(selectedTime.hour, selectedTime.minute, 0, 0);
      
      // Validar se a data/hora não é no passado
      if (finalDate < new Date()) {
        return; // Não confirmar se for no passado
      }
      
      onChange(finalDate.toISOString());
      setIsOpen(false);
      setTimeInputMode(false);
    }
  };

  const handleClear = () => {
    setSelectedDate(null);
    setSelectedTime({ hour: 9, minute: 0 });
    onChange('');
    setIsOpen(false);
    setTimeInputMode(false);
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const days = getDaysInMonth(currentMonth, currentYear);

  return (
    <div className={`${styles.container} ${isOpen ? styles.open : ''}`} ref={containerRef}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      
      <div 
        className={`${styles.input} ${disabled ? styles.disabled : ''} ${error ? styles.error : ''}`}
        onClick={handleToggleOpen}
      >
        <FiCalendar className={styles.inputIcon} />
        <span className={`${styles.inputText} ${!selectedDate ? styles.placeholder : ''}`}>
          {formatDisplayValue()}
        </span>
        {selectedDate && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <FiX />
          </button>
        )}
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {isOpen && (
        <div 
          className={styles.dropdown}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: Math.max(dropdownPosition.width, 300)
          }}
        >
          {!timeInputMode ? (
            // Calendário
            <div className={styles.calendar}>
              <div className={styles.calendarHeader}>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => navigateMonth('prev')}
                >
                  <FiChevronLeft />
                </button>
                <div className={styles.monthYear}>
                  {MONTHS[currentMonth]} {currentYear}
                </div>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => navigateMonth('next')}
                >
                  <FiChevronRight />
                </button>
              </div>

              <div className={styles.weekdays}>
                {WEEKDAYS.map(day => (
                  <div key={day} className={styles.weekday}>{day}</div>
                ))}
              </div>

              <div className={styles.daysGrid}>
                {days.map((dayObj, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`${styles.dayButton} ${
                      !dayObj.isCurrentMonth ? styles.otherMonth : ''
                    } ${
                      dayObj.isDisabled ? styles.disabled : ''
                    } ${
                      isToday(dayObj.date) ? styles.today : ''
                    } ${
                      isSelected(dayObj.date) ? styles.selected : ''
                    }`}
                    onClick={() => handleDateSelect(dayObj)}
                    disabled={dayObj.isDisabled}
                  >
                    {dayObj.day}
                  </button>
                ))}
              </div>

              {selectedDate && (
                <div className={styles.calendarFooter}>
                  <button
                    type="button"
                    className={styles.timeButton}
                    onClick={() => setTimeInputMode(true)}
                  >
                    <FiClock />
                    Definir horário
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Seleção de hora
            <div className={styles.timePicker}>
              <div className={styles.timeHeader}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setTimeInputMode(false)}
                >
                  <FiChevronLeft />
                  Voltar
                </button>
                <div className={styles.timeTitle}>Definir horário</div>
              </div>

              <div className={styles.timeInputs}>
                <div className={styles.timeField}>
                  <label>Hora</label>
                  <input
                    ref={timeInputRef}
                    type="number"
                    min="0"
                    max="23"
                    value={selectedTime.hour.toString().padStart(2, '0')}
                    onChange={(e) => handleTimeChange('hour', e.target.value)}
                    className={styles.timeInput}
                  />
                </div>
                <div className={styles.timeSeparator}>:</div>
                <div className={styles.timeField}>
                  <label>Minuto</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={selectedTime.minute.toString().padStart(2, '0')}
                    onChange={(e) => handleTimeChange('minute', e.target.value)}
                    className={styles.timeInput}
                  />
                </div>
              </div>

              <div className={styles.quickTimes}>
                <div className={styles.quickTimesLabel}>Horários sugeridos:</div>
                <div className={styles.quickTimeButtons}>
                  {[
                    { hour: 9, minute: 0, label: '09:00' },
                    { hour: 12, minute: 0, label: '12:00' },
                    { hour: 14, minute: 0, label: '14:00' },
                    { hour: 17, minute: 0, label: '17:00' },
                    { hour: 18, minute: 0, label: '18:00' }
                  ].map(time => (
                    <button
                      key={time.label}
                      type="button"
                      className={`${styles.quickTimeButton} ${
                        selectedTime.hour === time.hour && selectedTime.minute === time.minute 
                          ? styles.active : ''
                      }`}
                      onClick={() => setSelectedTime({ hour: time.hour, minute: time.minute })}
                    >
                      {time.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.timeFooter}>
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={handleConfirm}
                >
                  <FiCheck />
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomDateTimePicker;

