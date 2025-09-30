import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, Modal, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Calendar } from 'react-native-calendars';
import ICAL from 'ical.js';
import EventsList from './components/EventsList';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ICS feed URL (replace with your real one)
const ICS_URL = "https://pomfret.instructure.com/feeds/calendars/user_U5a3dGrIE7Y45lSX7KUDM87bRYen3k9NWxyuvQOn.ics";
// Google Apps Script Web App URL (set your deployed URL to enable Google events)
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx_7O8E568a9rGV5dhciRnH81KOFGfDXBFzyH__z7kIYbvX03wkbJzAXdlBdO11Zbz0/exec';
const CANVAS_API_TOKEN = "22006~HwPkvfka8H4N4KhvnhALtHkzQGQfAQYAQFNzzyJXYL9wRwZURaHzu4Wy47vYVYnA";
// IMPORTANT: set this to your institution host, e.g., https://<school>.instructure.com/api/v1
const CANVAS_BASE_URL = "https://pomfret.instructure.com/api/v1";
// Optional: set a proxy URL (e.g., Apps Script) to bypass CORS and attach token server-side
const CANVAS_PROXY_URL = "https://script.google.com/macros/s/AKfycbwxQoaSb94JLKsProThdJyZmKug2oIu9wZ7_5ut0agvLLfJibGD18IoDXVCwZb1B-TEgg/exec";
// Unified assignments API (Google Apps Script deployment)
const ASSIGNMENTS_API_URL = "https://script.google.com/macros/s/AKfycbwxQoaSb94JLKsProThdJyZmKug2oIu9wZ7_5ut0agvLLfJibGD18IoDXVCwZb1B-TEgg/exec";

export default function App() {
  const [events, setEvents] = useState({});
  const [courses, setCourses] = useState({});
  const [studyBlocks, setStudyBlocks] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('list'); // 'home' | 'list'
  const [googleConnected, setGoogleConnected] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterFrom, setFilterFrom] = useState(''); // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState(''); // YYYY-MM-DD
  const [filterCategory, setFilterCategory] = useState(''); // e.g., Homework/Exam/Project
  const [filterRange, setFilterRange] = useState('all'); // all | this_week | this_month | next_month
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    dueDate: '',
    time: '23:59',
    course: '',
    category: '',
  });
  const [assignmentsLoadError, setAssignmentsLoadError] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localAssignments, setLocalAssignments] = useState({});
  const STORAGE_KEYS = {
    events: 'events',
    courses: 'courses',
    studyBlocks: 'studyBlocks',
  };

  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
      await AsyncStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(courses));
      await AsyncStorage.setItem(STORAGE_KEYS.studyBlocks, JSON.stringify(studyBlocks));
      console.log('Progress saved');
    } catch (e) {
      console.warn('Failed to save progress', e);
    }
  };

  const loadSavedProgress = async () => {
    try {
      const [e, c, s] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.events),
        AsyncStorage.getItem(STORAGE_KEYS.courses),
        AsyncStorage.getItem(STORAGE_KEYS.studyBlocks),
      ]);
      if (e) {
        try {
          const parsed = JSON.parse(e);
          if (parsed && typeof parsed === 'object') {
            setEvents(prev => ({ ...parsed, ...prev }));
          }
        } catch {}
      }
      if (c) {
        try {
          const parsed = JSON.parse(c);
          if (parsed && typeof parsed === 'object') {
            setCourses(prev => ({ ...parsed, ...prev }));
          }
        } catch {}
      }
      if (s) {
        try {
          const parsed = JSON.parse(s);
          if (parsed && typeof parsed === 'object') {
            setStudyBlocks(prev => ({ ...parsed, ...prev }));
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Failed to load saved progress', err);
    }
  };

  // Auto-save on core state changes
  useEffect(() => {
    saveProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, courses, studyBlocks]);

  // Debug: verify courses and events shape before rendering (helps ensure Picker shows only course names)
  try {
    // Keep logs lightweight to avoid huge prints
    const coursePreview = Object.entries(courses).slice(0, 10);
    const eventDates = Object.keys(events).slice(0, 5);
    console.log('Debug[ListView]: courses preview', coursePreview);
    console.log('Debug[ListView]: events date keys preview', eventDates);
  } catch (e) {
    // no-op
  }

useEffect(() => {
  (async () => {
    await loadSavedProgress();
    // Load Canvas first so List view shows data immediately
    fetchCanvasCourses().then(() => {
      fetchCanvasAssignments();
    });
    fetchCalendarEvents();
    if (googleConnected) {
      fetchGoogleEvents();
    }
  })();
}, []);
  const fetchCanvasCourses = async () => {
    try {
      const url = `${CANVAS_PROXY_URL}?endpoint=courses&per_page=100&enrollment_state=active`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const courseMap = {};
      (Array.isArray(data) ? data : []).forEach(c => {
        if (c.id && c.name) {
          courseMap[c.id] = c.name;
        }
      });

      setCourses(courseMap);
    } catch (error) {
      console.error("Error fetching Canvas courses:", error);
    }
  };

  const fetchCalendarEvents = async () => {
    try {
      // Fetch ICS feed from ICS_URL
      const res = await fetch(ICS_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const icsText = await res.text();
      const jcalData = ICAL.parse(icsText);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      
      const generatedStudyBlocks = {};

      vevents.forEach(vevent => {
        const event = new ICAL.Event(vevent);
        const startDate = event.startDate.toJSDate();
        const dateKey = startDate.toISOString().split('T')[0];
        const timeText = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    saveProgress();
  };

  const connectGoogle = async () => {
    setGoogleConnected(true);
    await fetchGoogleEvents();
  };

  const fetchCanvasAssignments = async () => {
    try {
      const res = await fetch(ASSIGNMENTS_API_URL);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const raw = await res.json();
      // Support either a direct array or an envelope like { assignments: [...] }
      const data = Array.isArray(raw) ? raw : (Array.isArray(raw?.assignments) ? raw.assignments : []);

      // Filter to future assignments (keep items with missing due date as upcoming)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const normalized = (Array.isArray(data) ? data : []).map(item => {
        const title = item.name || item.title || 'Assignment';
        const description = item.description || '';
        const dueISO = item.due_at || item.dueDate || item.end_at || item.start_at || item.all_day_date;
        const course = item.course || item.context_name || item.course_name || '';
        const url = item.url || item.html_url || '';
        const dueDate = dueISO ? new Date(dueISO) : null;
        return { title, description, dueISO, dueDate, course, url };
      });
      const filteredAssignments = normalized.filter(it => !it.dueDate || (!isNaN(it.dueDate.getTime()) && it.dueDate >= todayStart));
      console.log("Filtered assignments:", filteredAssignments);

      setEvents(prev => {
        // Remove existing Canvas assignments before adding filtered ones
        const base = Object.keys(prev).reduce((acc, dateKey) => {
          const others = (prev[dateKey]?.assignments || []).filter(a => a.source !== 'canvas');
          if (others.length > 0) acc[dateKey] = { ...prev[dateKey], assignments: others };
          return acc;
        }, {});

        const merged = { ...base };
        filteredAssignments.forEach(item => {
          const { title, description, dueISO, dueDate, course, url } = item;
          // Treat items with missing due date as upcoming: skip if no title
          if (!title) return;
          const effectiveDate = dueDate || todayStart;
          const dateKey = effectiveDate.toISOString().split('T')[0];
          const timeText = effectiveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const existing = merged[dateKey]?.assignments || [];
          const isDuplicate = existing.some(e => e.title === title && e.time === timeText && e.type === 'assignment');
          const previousCategory = (prev[dateKey]?.assignments || []).find(e => e.title === title && e.time === timeText && e.type === 'assignment')?.category || '';
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
                  category: previousCategory || '',
                  source: 'canvas',
                  url,
                }
              ]
            };
          }
        });

        return merged;
      });
      setAssignmentsLoadError(false);
    } catch (error) {
      console.error('Error fetching Canvas assignments:', error);
      setAssignmentsLoadError(true);
    }
  };

  // Update assignment category in local state (for List View)
  const updateAssignmentCategory = (dateKey, title, newCategory) => {
    setLocalAssignments(prev => {
      const key = `${dateKey}_${title}`;
      const updated = { ...prev, [key]: { ...prev[key], category: newCategory } };
      setHasUnsavedChanges(true);
      return updated;
    });
  };

  // Save changes from List View to main events state
  const saveChanges = () => {
    if (!hasUnsavedChanges) return;

    setEvents(prevEvents => {
      const updated = { ...prevEvents };
      
      // Apply local changes to the main events state
      Object.keys(localAssignments).forEach(key => {
        const [dateKey, title] = key.split('_');
        const localChange = localAssignments[key];
        
        if (updated[dateKey] && updated[dateKey].assignments) {
          updated[dateKey] = {
            ...updated[dateKey],
            assignments: updated[dateKey].assignments.map(a =>
              a.title === title && a.type === 'assignment'
                ? { ...a, category: localChange.category }
                : a
            )
          };
        }
      });

      return updated;
    });

    // Clear local changes and reset state
    setLocalAssignments({});
    setHasUnsavedChanges(false);
    saveProgress();
    Alert.alert('Success', 'Changes saved!');
  };

  // Get assignment with local changes applied
  const getAssignmentWithLocalChanges = (assignment) => {
    const key = `${assignment._date}_${assignment.title}`;
    const localChange = localAssignments[key];
    return localChange ? { ...assignment, ...localChange } : assignment;
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

  // Convert time strings like "08:00", "8:00 AM", "08:00 PM" to minutes since midnight
  const timeToMinutes = (timeText) => {
    if (!timeText || typeof timeText !== 'string') return Number.POSITIVE_INFINITY;
    const t = timeText.trim();
    // Match 12-hour format with AM/PM
    const ampm = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
      let hours = parseInt(ampm[1], 10);
      const minutes = parseInt(ampm[2], 10);
      const isPM = ampm[3].toLowerCase() === 'pm';
      hours = hours % 12 + (isPM ? 12 : 0);
      return hours * 60 + minutes;
    }
    // Match 24-hour format HH:MM
    const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
      const hours = parseInt(hhmm[1], 10);
      const minutes = parseInt(hhmm[2], 10);
      return hours * 60 + minutes;
    }
    return Number.POSITIVE_INFINITY;
  };

  const getEventsForSelectedDate = () => {
    const dateEvents = events[selectedDate]?.assignments || [];
    const dateStudyBlocks = studyBlocks[selectedDate]?.studyBlocks || [];
    const combined = [...dateEvents, ...dateStudyBlocks];
    // Sort by time ascending; items without a valid time go to the bottom
    combined.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    return combined;
  };

  const getAllAssignments = () => {
    // Flatten all assignment-type items across dates
    const all = [];
    Object.keys(events).forEach(date => {
      (events[date]?.assignments || []).forEach(item => {
        if (item.type === 'assignment' && item.source === 'canvas') {
          all.push({ ...item, _date: date });
        }
      });
    });

    // Apply filters
    return all.filter(item => {
      if (filterClass && item.course !== filterClass) return false;
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
    saveProgress();
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
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Assignments List</Text>
            {assignmentsLoadError && (
              <Text style={styles.errorMessage}>Failed to load assignments</Text>
            )}
          </View>

          {/* Modern Filter Section */}
          <View style={styles.filtersSection}>
            <View style={styles.filtersGrid}>
              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Class</Text>
                <View style={styles.modernPickerContainer}>
                  <Picker
                    selectedValue={filterClass}
                    onValueChange={(itemValue) => setFilterClass(itemValue)}
                    dropdownIconColor="#2196f3"
                    style={styles.modernPicker}
                  >
                    <Picker.Item label="All Classes" value="" />
                    {Object.entries(courses).map(([courseId, courseName]) => (
                      <Picker.Item key={courseId} label={courseName} value={courseName} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Date Range</Text>
                <View style={styles.modernPickerContainer}>
                  <Picker
                    selectedValue={filterRange}
                    onValueChange={(val) => {
                      // Preset date ranges
                      const today = new Date();
                      const startOfWeek = new Date(today);
                      startOfWeek.setDate(today.getDate() - today.getDay());
                      startOfWeek.setHours(0,0,0,0);
                      const endOfWeek = new Date(startOfWeek);
                      endOfWeek.setDate(startOfWeek.getDate() + 6);
                      endOfWeek.setHours(23,59,59,999);
                      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
                      const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                      const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);

                      const toISODate = (d) => d.toISOString().split('T')[0];

                      switch (val) {
                        case 'all':
                          setFilterFrom('');
                          setFilterTo('');
                          setFilterRange('all');
                          break;
                        case 'this_week':
                          setFilterFrom(toISODate(startOfWeek));
                          setFilterTo(toISODate(endOfWeek));
                          setFilterRange('this_week');
                          break;
                        case 'this_month':
                          setFilterFrom(toISODate(startOfMonth));
                          setFilterTo(toISODate(endOfMonth));
                          setFilterRange('this_month');
                          break;
                        case 'next_month':
                          setFilterFrom(toISODate(startOfNextMonth));
                          setFilterTo(toISODate(endOfNextMonth));
                          setFilterRange('next_month');
                          break;
                        default:
                          setFilterFrom('');
                          setFilterTo('');
                          setFilterRange('all');
                      }
                    }}
                    dropdownIconColor="#2196f3"
                    style={styles.modernPicker}
                  >
                    <Picker.Item label="All Dates" value="all" />
                    <Picker.Item label="This Week" value="this_week" />
                    <Picker.Item label="This Month" value="this_month" />
                    <Picker.Item label="Next Month" value="next_month" />
                  </Picker>
                </View>
              </View>

              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.modernPickerContainer}>
                  <Picker
                    selectedValue={filterCategory}
                    onValueChange={(val) => setFilterCategory(val)}
                    dropdownIconColor="#2196f3"
                    style={styles.modernPicker}
                  >
                    <Picker.Item label="All Categories" value="" />
                    <Picker.Item label="Homework" value="homework" />
                    <Picker.Item label="Exam" value="exam" />
                    <Picker.Item label="Project" value="project" />
                  </Picker>
                </View>
              </View>
            </View>
          </View>

          {/* Save Changes Button */}
          <View style={styles.saveChangesSection}>
            <TouchableOpacity 
              style={[
                styles.saveChangesButton,
                !hasUnsavedChanges && styles.saveChangesButtonDisabled
              ]}
              onPress={saveChanges}
              disabled={!hasUnsavedChanges}
            >
              <Text style={[
                styles.saveChangesButtonText,
                !hasUnsavedChanges && styles.saveChangesButtonTextDisabled
              ]}>
                {hasUnsavedChanges ? 'Save Changes' : 'No Changes to Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Modern Assignment Cards */}
          <ScrollView style={styles.assignmentsScroll} showsVerticalScrollIndicator={false}>
            {getAllAssignments().length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No assignments found</Text>
                <Text style={styles.emptyStateSubtext}>Try adjusting your filters</Text>
              </View>
            ) : (
              getAllAssignments().map((assignment, idx) => {
                const assignmentWithChanges = getAssignmentWithLocalChanges(assignment);
                return (
                  <TouchableOpacity 
                    key={assignment._date + assignment.title + idx} 
                    style={styles.modernAssignmentCard}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assignmentHeader}>
                      <Text style={styles.modernAssignmentTitle}>{assignmentWithChanges.title}</Text>
                      <View style={styles.assignmentMeta}>
                        <Text style={styles.assignmentDueDate}>
                          Due: {assignmentWithChanges._date} at {assignmentWithChanges.time}
                        </Text>
                        {assignmentWithChanges.course && (
                          <Text style={styles.assignmentCourse}>{assignmentWithChanges.course}</Text>
                        )}
                      </View>
                    </View>

                    {assignmentWithChanges.description && (
                      <Text style={styles.assignmentDescription}>{assignmentWithChanges.description}</Text>
                    )}

                    {assignmentWithChanges.url && (
                      <TouchableOpacity 
                        style={styles.canvasLinkButton}
                        onPress={() => Linking.openURL(assignmentWithChanges.url)}
                      >
                        <Text style={styles.canvasLinkText}>Open in Canvas</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.categorySection}>
                      <Text style={styles.categoryLabel}>Category</Text>
                      <View style={styles.categoryPickerContainer}>
                        <Picker
                          selectedValue={assignmentWithChanges.category || ''}
                          onValueChange={(val) => updateAssignmentCategory(assignment._date, assignment.title, val)}
                          dropdownIconColor="#2196f3"
                          style={styles.categoryPicker}
                        >
                          <Picker.Item label="None" value="" />
                          <Picker.Item label="Homework" value="homework" />
                          <Picker.Item label="Exam" value="exam" />
                          <Picker.Item label="Project" value="project" />
                        </Picker>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
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
                {event.url && (
                  <Text style={styles.eventLink} onPress={() => Linking.openURL(event.url)}>
                    Open in Canvas
                  </Text>
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
  // Modern List View Styles
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  listHeader: {
    marginBottom: 24,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#f44336',
    fontStyle: 'italic',
  },
  filtersSection: {
    marginBottom: 24,
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  filterCard: {
    flex: 1,
    minWidth: 200,
    maxWidth: 300,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  modernPickerContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  modernPicker: {
    height: 48,
    color: '#333',
  },
  assignmentsScroll: {
    flex: 1,
  },
  modernAssignmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  assignmentHeader: {
    marginBottom: 12,
  },
  modernAssignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 24,
  },
  assignmentMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  assignmentDueDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  assignmentCourse: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '500',
  },
  assignmentDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  canvasLinkButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  canvasLinkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  categorySection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  categoryPickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  categoryPicker: {
    height: 40,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
  },
  saveChangesSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  saveChangesButton: {
    backgroundColor: '#2196f3',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveChangesButtonDisabled: {
    backgroundColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveChangesButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveChangesButtonTextDisabled: {
    color: '#999',
  },
  // Legacy styles for backward compatibility
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'stretch',
  },
  themedPicker: {
    borderColor: '#2196f3',
  },
  pickerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
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
  eventLink: {
    fontSize: 14,
    color: '#1e88e5',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});