import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import idLocale from 'date-fns/locale/id';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CompanyCalendar.css';

const locales = {
  'id': idLocale,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function CompanyCalendar({ events, onSelectEvent, onNavigate, date }) {
  // Convert event string dates to Date objects if needed
  const formattedEvents = events.map(event => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end)
  }));

  const eventStyleGetter = (event, start, end, isSelected) => {
    let backgroundColor = '#3b82f6'; // Default shift blue
    
    if (event.type === 'leave') {
      backgroundColor = '#f59e0b'; // Amber/Yellow
    } else if (event.type === 'off_day' || event.type === 'national_holiday') {
      backgroundColor = '#ef4444'; // Red
    } else if (event.type === 'overtime') {
      backgroundColor = '#8b5cf6'; // Purple
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        display: 'block'
      }
    };
  };

  return (
    <div className="company-calendar-container">
      <Calendar
        localizer={localizer}
        events={formattedEvents}
        date={date}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        culture="id"
        eventPropGetter={eventStyleGetter}
        onSelectEvent={onSelectEvent}
        onNavigate={onNavigate}
        components={{
          month: {
            dateHeader: ({ date, label }) => {
              const day = date.getDay();
              const isHoliday = formattedEvents.some(e => 
                (e.type === 'off_day' || e.type === 'national_holiday') && 
                e.start.getDate() === date.getDate() && 
                e.start.getMonth() === date.getMonth() && 
                e.start.getFullYear() === date.getFullYear()
              );
              
              let color = 'inherit';
              if (day === 0 || isHoliday) color = '#ef4444'; // Red
              else if (day === 6) color = '#3b82f6'; // Blue
              
              return (
                <button type="button" className="rbc-button-link" style={{ color, fontWeight: 600 }}>
                  {label}
                </button>
              );
            }
          }
        }}
        popup
        messages={{
          next: "Selanjutnya",
          previous: "Sebelumnya",
          today: "Hari Ini",
          month: "Bulan",
          week: "Minggu",
          day: "Hari",
          agenda: "Agenda",
          date: "Tanggal",
          time: "Waktu",
          event: "Kegiatan",
          noEventsInRange: "Tidak ada jadwal pada rentang ini."
        }}
      />
      
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#3b82f6' }}></span> Shift Kerja
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span> Cuti / Izin
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span> Libur
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#8b5cf6' }}></span> Lembur
        </div>
      </div>
    </div>
  );
}

export default CompanyCalendar;
