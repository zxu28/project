import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CANVAS_CONFIG, buildCanvasUrl } from './config/canvas';

const locales = {
  'en-US': require('date-fns/locale/en-US')
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function CanvasCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: '',
    time: '23:59'
  });

  useEffect(() => {
    fetchCanvasEvents();
  }, []);

  const fetchCanvasEvents = async () => {
    try {
      console.log('Fetching Canvas calendar events...');
      
      // Fetch calendar events from Canvas API
      const calendarUrl = buildCanvasUrl(CANVAS_CONFIG.endpoints.calendarEvents, {
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Next 90 days
      });
      
      console.log('Canvas API URL:', calendarUrl);
      
      const response = await fetch(calendarUrl, {
        headers: {
          'Authorization': `Bearer ${CANVAS_CONFIG.apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }
      
      const canvasEvents = await response.json();
      console.log('Canvas events received:', canvasEvents.length);
      
      // Step 1: Console.log one sample event to see the raw Canvas response
      if (canvasEvents.length > 0) {
        console.log('Sample Canvas event:', JSON.stringify(canvasEvents[0], null, 2));
      }
      
      const calendarEvents = [];

      canvasEvents.forEach(event => {
        // Only process assignment events
        if (event.type === 'assignment' || event.assignment_id) {
          // Parse assignments by checking event.assignment?.due_at, then event.end_at, then event.start_at
          const dueAt = event.assignment?.due_at || event.end_at || event.start_at;
          
          if (dueAt) {
            // Always map Canvas assignments to objects with { title, start: new Date(dueAt), end: new Date(dueAt), type: "assignment" }
            calendarEvents.push({
              title: event.title || event.name || 'Assignment',
              start: new Date(dueAt),
              end: new Date(dueAt),
              type: 'assignment'
            });
          }
        }
      });

      console.log('Parsed calendar events:', calendarEvents.length);
      // Step 4: Save these into state with setEvents
      setEvents(calendarEvents);
      setLoading(false);
      
    } catch (error) {
      console.error('Error fetching Canvas events:', error);
      setLoading(false);
    }
  };

  const handleRefreshCanvas = () => {
    setLoading(true);
    fetchCanvasEvents();
  };

  const handleAddAssignment = () => {
    if (!newAssignment.title || !newAssignment.dueDate) {
      alert('Please fill in assignment title and due date');
      return;
    }

    const dueDateTime = new Date(`${newAssignment.dueDate}T${newAssignment.time}`);
    const assignmentId = `manual-${Date.now()}`;

    // Add assignment event
    const assignmentEvent = {
      title: newAssignment.title,
      start: dueDateTime,
      end: dueDateTime,
      type: 'assignment'
    };

    // Add new event to existing events
    setEvents(prevEvents => [...prevEvents, assignmentEvent]);

    // Reset form and close modal
    setNewAssignment({
      title: '',
      description: '',
      dueDate: '',
      time: '23:59'
    });
    setShowAddModal(false);
  };

  const eventStyleGetter = (event) => {
    const backgroundColor = event.type === 'assignment' ? '#ff6b6b' : '#4caf50';
    const borderColor = event.type === 'assignment' ? '#d32f2f' : '#2e7d32';
    
    return {
      style: {
        backgroundColor,
        borderColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading Canvas events...
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
        Canvas Study Calendar
      </h1>
      
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={() => setShowAddModal(true)}
            style={{
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '10px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Add Assignment
          </button>
          <button 
            onClick={handleRefreshCanvas}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🔄 Refresh Canvas
          </button>
        </div>
        <div>
          <span style={{ 
            backgroundColor: '#ff6b6b', 
            color: 'white', 
            padding: '5px 10px', 
            borderRadius: '3px',
            marginRight: '10px'
          }}>
            Assignments
          </span>
          <span style={{ 
            backgroundColor: '#4caf50', 
            color: 'white', 
            padding: '5px 10px', 
            borderRadius: '3px'
          }}>
            Study Blocks
          </span>
        </div>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 200px)' }}
        eventPropGetter={eventStyleGetter}
        views={['month', 'week', 'day']}
        defaultView="month"
        popup
        showMultiDayTimes
      />

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '400px',
            maxWidth: '90vw',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#333' }}>Add New Assignment</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Assignment Title *
              </label>
              <input
                type="text"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Enter assignment title"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Description
              </label>
              <textarea
                value={newAssignment.description}
                onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  height: '60px',
                  resize: 'vertical'
                }}
                placeholder="Enter assignment description (optional)"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Due Date *
              </label>
              <input
                type="date"
                value={newAssignment.dueDate}
                onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Due Time
              </label>
              <input
                type="time"
                value={newAssignment.time}
                onChange={(e) => setNewAssignment({...newAssignment, time: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddAssignment}
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Add Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanvasCalendar;
