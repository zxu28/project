import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Calendar } from 'react-native-calendars';
import ICAL from 'ical.js';
import EventsList from './components/EventsList';

// Sample Canvas ICS feed URL (replace with a real one if needed)
const SAMPLE_ICS_URL = 'https://canvas.instructure.com/feeds/calendars/user_1234567890.ics';
// Google Apps Script Web App URL (set your deployed URL to enable Google events)
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_7O8E568a9rGV5dhciRnH81KOFGfDXBFzyH__z7kIYbvX03wkbJzAXdlBdO11Zbz0/exec';
const CANVAS_API_TOKEN = "22006~HwPkvfka8H4N4KhvnhALtHkzQGQfAQYAQFNzzyJXYL9wRwZURaHzu4Wy47vYVYnA";
// IMPORTANT: set this to your institution host, e.g., https://<school>.instructure.com/api/v1
const CANVAS_BASE_URL = "https://pomfret.instructure.com/api/v1";
// Optional: set a proxy URL (e.g., Apps Script) to bypass CORS and attach token server-side
const CANVAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbwvdn44BbxEC_UnxIWQEeTRSEd_O3q9Rh_KrASXDHc-IQ5_7op21qvz-wIRPUyclcgF7A/exec";

export default function App() {
  const [events, setEvents] = useState({});
  const [studyBlocks, setStudyBlocks] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'list'
  const [googleConnected, setGoogleConnected] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterFrom, setFilterFrom] = useState(''); // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState(''); // YYYY-MM-DD
  const [filterCategory, setFilterCategory] = useState(''); // e.g., Homework/Exam/Project
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: '',
    time: '23:59',
    course: '',
    category: '',
  });

  useEffect(() => {
    fetchCalendarEvents();
    if (googleConnected) {
      fetchGoogleEvents();
    }
    fetchCanvasAssignments();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      // For demo purposes, we'll use a sample ICS content instead of fetching from URL
      const sampleICSContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Canvas LMS//NONSGML v1.0//EN
BEGIN:VEVENT
DTSTART:20241215T235900Z
DTEND:20241216T000000Z
SUMMARY:Math Assignment Due
DESCRIPTION:Complete calculus problem set
LOCATION:Online
END:VEVENT
BEGIN:VEVENT
DTSTART:20241218T235900Z
DTEND:20241219T000000Z
SUMMARY:History Essay Due
DESCRIPTION:Write 5-page essay on World War II
LOCATION:Online
END:VEVENT
BEGIN:VEVENT
DTSTART:20241220T235900Z
DTEND:20241221T000000Z
SUMMARY:Science Lab Report Due
DESCRIPTION:Complete chemistry lab analysis
LOCATION:Online
END:VEVENT
END:VCALENDAR`;

      const jcalData = ICAL.parse(sampleICSContent);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      
      const parsedEvents = {};
      const generatedStudyBlocks = {};

      vevents.forEach(vevent => {
        const event = new ICAL.Event(vevent);
        const startDate = event.startDate.toJSDate();
        const dateKey = startDate.toISOString().split('T')[0];
        const timeText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add assignment to events
        const existing = parsedEvents[dateKey]?.assignments || [];
        const isDuplicate = existing.some(e => e.title === event.summary && e.time === timeText && e.type === 'assignment');
        if (!isDuplicate) {
          parsedEvents[dateKey] = {
            ...parsedEvents[dateKey],
            assignments: [
              ...existing,
              {
                title: event.summary,
                description: event.description,
                time: timeText,
                type: 'assignment'
              }
            ]
          };
        }

        // Generate study block for the day before
        const studyDate = new Date(startDate);
        studyDate.setDate(studyDate.getDate() - 1);
        const studyDateKey = studyDate.toISOString().split('T')[0];
        
        generatedStudyBlocks[studyDateKey] = {
          ...generatedStudyBlocks[studyDateKey],
          studyBlocks: [
            ...(generatedStudyBlocks[studyDateKey]?.studyBlocks || []),
            {
              title: `Study for ${event.summary}`,
              time: '19:00',
              duration: '1 hour',
              type: 'study'
            }
          ]
        };
      });

      // Merge parsed ICS assignments into existing events (functional update to avoid overwrite)
      setEvents(prevEvents => {
        const merged = { ...prevEvents };
        Object.keys(parsedEvents).forEach(dateKey => {
          const existing = merged[dateKey]?.assignments || [];
          const additions = parsedEvents[dateKey]?.assignments || [];
          const next = [...existing];
          additions.forEach(item => {
            const dup = next.some(e => e.title === item.title && e.time === item.time && e.type === item.type);
            if (!dup) next.push(item);
          });
        
          merged[dateKey] = {
            ...merged[dateKey],
            assignments: next,
          };
        });
        return merged;
      });

      // Merge generated study blocks into existing studyBlocks
      setStudyBlocks(prevBlocks => {
        const merged = { ...prevBlocks };
        Object.keys(generatedStudyBlocks).forEach(dateKey => {
          const existing = merged[dateKey]?.studyBlocks || [];
          const additions = generatedStudyBlocks[dateKey]?.studyBlocks || [];
          merged[dateKey] = {
            ...merged[dateKey],
            studyBlocks: [...existing, ...additions],
          };
        });
        return merged;
      });
    } catch (error) {
      console.error('Error parsing ICS:', error);
      Alert.alert('Error', 'Failed to load calendar events');
    }
  };

  const fetchGoogleEvents = async () => {
    try {
      if (!GOOGLE_APPS_SCRIPT_URL) return;
      const res = await fetch(GOOGLE_APPS_SCRIPT_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Expecting array of events with start/end and summary/description/location
      // Example item: { start: '2024-12-01T10:00:00Z', end: '...', title: '...', description: '...', location: '...' }
      setEvents(prev => {
        const merged = { ...prev };

        (Array.isArray(data) ? data : []).forEach(ev => {
          const start = ev.start || ev.startDate || ev.startTime || ev.startDateTime;
          const title = ev.title || ev.summary || 'Event';
          if (!start || !title) return;
          const startDate = new Date(start);
          if (isNaN(startDate.getTime())) return;
          const dateKey = startDate.toISOString().split('T')[0];
          const timeText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const existing = merged[dateKey]?.assignments || [];
          const isDuplicate = existing.some(e => e.title === title && e.time === timeText && e.type === 'schedule');
          if (!isDuplicate) {
            merged[dateKey] = {
              ...merged[dateKey],
              assignments: [
                ...existing,
                {
                  title,
                  description: ev.description || '',
                  time: timeText,
                  type: 'schedule',
                  course: ev.location || '',
                  category: '',
                  source: 'google',
                }
              ]
            };
          }
        });

        return merged;
      });
    } catch (error) {
      console.error('Error fetching Google events:', error);
    }
  };

  const disconnectGoogle = () => {
    // Remove items that came from Google
    const cleaned = Object.keys(events).reduce((acc, date) => {
      const items = (events[date]?.assignments || []).filter(it => it.source !== 'google');
      if (items.length > 0) {
        acc[date] = { ...events[date], assignments: items };
      }
      return acc;
    }, {});
    setEvents(cleaned);
    setGoogleConnected(false);
  };

  const connectGoogle = async () => {
    setGoogleConnected(true);
    await fetchGoogleEvents();
  };

  const fetchCanvasAssignments = async () => {
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const end = new Date(today);
      end.setDate(end.getDate() + 120);

      const url = `${CANVAS_PROXY_URL}?endpoint=calendar_events&type=assignment&per_page=50&start_date=${start.toISOString()}&end_date=${end.toISOString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn('Canvas response not an array', data);
      }

      setEvents(prev => {
        const merged = { ...prev };

        (Array.isArray(data) ? data : []).forEach(ev => {
        // Always treat all Canvas API items as assignments, regardless of type
        const title = ev.title || ev?.assignment?.title || ev.summary || 'Assignment';
        const description = ev.description || ev?.assignment?.description || '';
        const dueISO = ev.end_at || ev.start_at || ev.all_day_date;
        const course = ev.context_name || '';
        if (!dueISO || !title) return;
        const dueDate = new Date(dueISO);
        if (isNaN(dueDate.getTime())) return;
        const dateKey = dueDate.toISOString().split('T')[0];
        const timeText = dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const existing = merged[dateKey]?.assignments || [];
        const isDuplicate = existing.some(e => e.title === title && e.time === timeText && e.type === 'assignment');
        if (!isDuplicate) {
          merged[dateKey] = {
            ...merged[dateKey],
            assignments: [
              ...existing,
              {
                title,
                description,
                time: timeText,
                type: 'assignment',
                course,
                category: 'Canvas',
                source: 'canvas',
              }
            ]
          };
        }
        });

        return merged;
      });
    } catch (error) {
      console.error('Error fetching Canvas assignments:', error);
      Alert.alert('Canvas API connection failed. Please check the Apps Script proxy.');
    }
  };

  const getMarkedDates = () => {
    const marked = {};

    const DOTS = {
      canvas: { key: 'canvas', color: '#e53935' },      // Canvas assignments (red)
      google: { key: 'google', color: '#1e88e5' },      // Google schedules (blue)
      manual: { key: 'manual', color: '#fb8c00' },      // Manually added assignments (orange)
      study: { key: 'study', color: '#4caf50' },        // Study blocks (green)
    };

    // Build dots from events by source/type
    Object.keys(events).forEach(date => {
      const day = events[date] || {};
      const assignments = day.assignments || [];
      const dots = [];

      // assignments: distinguish by source
      assignments.forEach(item => {
        if (item.type === 'assignment') {
          if (item.source === 'canvas') {
            if (!dots.find(d => d.key === DOTS.canvas.key)) dots.push(DOTS.canvas);
          } else {
            if (!dots.find(d => d.key === DOTS.manual.key)) dots.push(DOTS.manual);
          }
        }
        if (item.type === 'schedule') {
          if (!dots.find(d => d.key === DOTS.google.key)) dots.push(DOTS.google);
        }
      });

      if (dots.length > 0) {
        marked[date] = {
          ...(marked[date] || {}),
          dots,
          marked: true,
        };
      }
    });

    // Add study block dots
    Object.keys(studyBlocks).forEach(date => {
      const existing = marked[date]?.dots || [];
      if (!existing.find(d => d.key === DOTS.study.key)) existing.push(DOTS.study);
      marked[date] = {
        ...(marked[date] || {}),
        dots: existing,
        marked: true,
      };
    });

    // Mark selected date
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: '#2196f3',
        selectedTextColor: '#ffffff',
      };
    }

    return marked;
  };

  const getEventsForSelectedDate = () => {
    const dateEvents = events[selectedDate]?.assignments || [];
    const dateStudyBlocks = studyBlocks[selectedDate]?.studyBlocks || [];
    return [...dateEvents, ...dateStudyBlocks];
  };

  const getAllAssignments = () => {
    // Flatten all assignment-type items across dates
    const all = [];
    Object.keys(events).forEach(date => {
      (events[date]?.assignments || []).forEach(item => {
        if (item.type === 'assignment') {
          all.push({ ...item, _date: date });
        }
      });
    });

    // Apply filters
    return all.filter(item => {
      if (filterClass && !(`${item.course || ''} ${item.title || ''}`.toLowerCase().includes(filterClass.toLowerCase()))) return false;
      if (filterCategory && (item.category || '').toLowerCase() !== filterCategory.toLowerCase()) return false;
      if (filterFrom && (item._date < filterFrom)) return false;
      if (filterTo && (item._date > filterTo)) return false;
      return true;
    }).sort((a, b) => a._date.localeCompare(b._date));
  };

  const addNewAssignment = () => {
    if (!newAssignment.title || !newAssignment.dueDate) {
      Alert.alert('Error', 'Please fill in assignment title and due date');
      return;
    }

    const dueDate = newAssignment.dueDate;
    const assignment = {
      title: newAssignment.title,
      description: newAssignment.description,
      time: newAssignment.time,
      type: 'assignment',
      course: newAssignment.course,
      category: newAssignment.category,
      source: 'manual',
    };

    // Add assignment to events
    setEvents(prevEvents => ({
      ...prevEvents,
      [dueDate]: {
        ...prevEvents[dueDate],
        assignments: [
          ...(prevEvents[dueDate]?.assignments || []),
          assignment
        ]
      }
    }));

    // Generate study block for the day before
    const studyDate = new Date(dueDate);
    studyDate.setDate(studyDate.getDate() - 1);
    const studyDateKey = studyDate.toISOString().split('T')[0];
    
    setStudyBlocks(prevBlocks => ({
      ...prevBlocks,
      [studyDateKey]: {
        ...prevBlocks[studyDateKey],
        studyBlocks: [
          ...(prevBlocks[studyDateKey]?.studyBlocks || []),
          {
            title: `Study for ${newAssignment.title}`,
            time: '19:00',
            duration: '1 hour',
            type: 'study'
          }
        ]
      }
    }));

    // Reset form and close modal
    setNewAssignment({
      title: '',
      description: '',
      dueDate: '',
      time: '23:59'
    });
    setShowAddModal(false);
    Alert.alert('Success', 'Assignment added successfully!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study Calendar</Text>

      {currentPage === 'home' && (
        <View style={styles.primaryActionsRow}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add Assignment</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setCurrentPage('list')}
          >
            <Text style={styles.addButtonText}>Open List View</Text>
          </TouchableOpacity>

          {googleConnected ? (
            <TouchableOpacity style={[styles.addButton, styles.disconnectBtn]} onPress={disconnectGoogle}>
              <Text style={styles.addButtonText}>Disconnect Google</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.addButton, styles.connectBtn]} onPress={connectGoogle}>
              <Text style={styles.addButtonText}>Connect Google</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {currentPage === 'list' && (
        <View style={styles.primaryActionsRow}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setCurrentPage('home')}
          >
            <Text style={styles.addButtonText}>← Back to Calendar</Text>
          </TouchableOpacity>

          {googleConnected ? (
            <TouchableOpacity style={[styles.addButton, styles.disconnectBtn]} onPress={disconnectGoogle}>
              <Text style={styles.addButtonText}>Disconnect Google</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.addButton, styles.connectBtn]} onPress={connectGoogle}>
              <Text style={styles.addButtonText}>Connect Google</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      
      {currentPage === 'home' ? (
        <Calendar
          style={styles.calendar}
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={getMarkedDates()}
          markingType={'multi-dot'}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#2196f3',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#2196f3',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#00adf5',
            selectedDotColor: '#ffffff',
            arrowColor: '#2196f3',
            disabledArrowColor: '#d9e1e8',
            monthTextColor: '#2196f3',
            indicatorColor: '#2196f3',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13,
          }}
        />
      ) : (
        <View style={styles.eventsContainer}>
          <Text style={styles.listTitle}>Assignments List</Text>
          <View style={styles.filtersRow}>
            <TextInput
              style={[styles.input, styles.filterInput]}
              placeholder="Filter by class/course or title"
              value={filterClass}
              onChangeText={setFilterClass}
            />
          </View>
          <View style={styles.filtersRow}>
            <TextInput
              style={[styles.input, styles.filterHalf]}
              placeholder="From (YYYY-MM-DD)"
              value={filterFrom}
              onChangeText={setFilterFrom}
            />
            <TextInput
              style={[styles.input, styles.filterHalf]}
              placeholder="To (YYYY-MM-DD)"
              value={filterTo}
              onChangeText={setFilterTo}
            />
          </View>
          <View style={styles.filtersRow}>
            <TextInput
              style={[styles.input, styles.filterInput]}
              placeholder="Category (e.g., homework, exam, project)"
              value={filterCategory}
              onChangeText={setFilterCategory}
            />
          </View>

          <EventsList 
            events={getAllAssignments()}
            studyBlocks={[]}
            selectedDate={selectedDate}
          />
        </View>
      )}

      {currentPage === 'home' && (
        <ScrollView style={styles.eventsContainer}>
          <Text style={styles.eventsTitle}>
            Events for {new Date(selectedDate).toLocaleDateString()}
          </Text>
          
          {getEventsForSelectedDate().length === 0 ? (
            <Text style={styles.noEvents}>No events scheduled for this date</Text>
          ) : (
            getEventsForSelectedDate().map((event, index) => (
              <View 
                key={index} 
                style={[
                  styles.eventItem,
                  event.type === 'assignment' ? styles.assignmentEvent : styles.studyEvent
                ]}
              >
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventTime}>{event.time}</Text>
                {event.description && (
                  <Text style={styles.eventDescription}>{event.description}</Text>
                )}
                {event.duration && (
                  <Text style={styles.eventDuration}>Duration: {event.duration}</Text>
                )}
                <View style={[
                  styles.eventTypeBadge,
                  event.type === 'assignment' ? styles.assignmentBadge : styles.studyBadge
                ]}>
                  <Text style={styles.eventTypeText}>
                    {event.type === 'assignment' ? 'Assignment' : 'Study Block'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Assignment Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Assignment</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Assignment Title"
              value={newAssignment.title}
              onChangeText={(text) => setNewAssignment({...newAssignment, title: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              value={newAssignment.description}
              onChangeText={(text) => setNewAssignment({...newAssignment, description: text})}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Class/Course (optional)"
              value={newAssignment.course}
              onChangeText={(text) => setNewAssignment({...newAssignment, course: text})}
            />

            <TextInput
              style={styles.input}
              placeholder="Category (homework / exam / project)"
              value={newAssignment.category}
              onChangeText={(text) => setNewAssignment({...newAssignment, category: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Due Date (YYYY-MM-DD)"
              value={newAssignment.dueDate}
              onChangeText={(text) => setNewAssignment({...newAssignment, dueDate: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Time (HH:MM)"
              value={newAssignment.time}
              onChangeText={(text) => setNewAssignment({...newAssignment, time: text})}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.addButton]}
                onPress={addNewAssignment}
              >
                <Text style={styles.addButtonText}>Add Assignment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  primaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: {
    backgroundColor: '#4caf50',
  },
  disconnectBtn: {
    backgroundColor: '#f44336',
  },
  calendar: {
    marginHorizontal: 16,
    marginBottom: 20,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'left',
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  noEvents: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  eventItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  assignmentEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff6b6b',
  },
  studyEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  eventDuration: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  eventTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  assignmentBadge: {
    backgroundColor: '#ffebee',
  },
  studyBadge: {
    backgroundColor: '#e8f5e8',
  },
  eventTypeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
});