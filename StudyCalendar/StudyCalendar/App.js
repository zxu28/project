import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, Modal, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Calendar } from 'react-native-calendars';
import ICAL from 'ical.js';
import EventsList from './components/EventsList';
import { useAssignments } from './AssignmentsContext';
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
  const { assignmentStatus, setAssignmentStatus } = useAssignments();
  const [events, setEvents] = useState({});
  const [courses, setCourses] = useState({});
  const [studyBlocks, setStudyBlocks] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState('list'); // 'home' | 'list' | 'progress'
  const [googleConnected, setGoogleConnected] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterFrom, setFilterFrom] = useState(''); // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState(''); // YYYY-MM-DD
  const [filterCategory, setFilterCategory] = useState(''); // e.g., Homework/Exam/Project
  const [filterRange, setFilterRange] = useState('all'); // all | this_week | this_month | next_month
  const [customFrom, setCustomFrom] = useState(''); // YYYY-MM-DD
  const [customTo, setCustomTo] = useState(''); // YYYY-MM-DD
  const [fromMonth, setFromMonth] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [toDay, setToDay] = useState('');
  const [daysFromToday, setDaysFromToday] = useState(7); // Default to 7 days from today
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
  // Track per-assignment status: 'not_started' | 'in_progress' | 'completed'
  const [statusMap, setStatusMap] = useState({}); // key: `${date}_${title}` => status
  const [progressViewMode, setProgressViewMode] = useState('weekly'); // 'weekly' | 'monthly'
  const [completedAssignments, setCompletedAssignments] = useState({}); // key: `${date}_${title}` => boolean
  // assignmentStatus moved to context
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
                  category: previousCategory || detectCategory(title),
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
      homework: { key: 'homework', color: '#1e88e5' },     // Blue
      exam: { key: 'exam', color: '#e53935' },             // Red
      project: { key: 'project', color: '#fb8c00' },       // Orange
      presentation: { key: 'presentation', color: '#8e24aa' }, // Purple
      google: { key: 'google', color: '#1e88e5' },         // Google schedules (blue)
      study: { key: 'study', color: '#4caf50' },           // Study blocks (green)
    };

    // Build dots from events by source/type
    Object.keys(events).forEach(date => {
      const day = events[date] || {};
      const assignments = day.assignments || [];
      const dots = [];

      // assignments: distinguish by category
      assignments.forEach(item => {
        if (item.type === 'assignment') {
          const cat = (item.category || '').toLowerCase();
          if (cat === 'homework' && !dots.find(d => d.key === DOTS.homework.key)) dots.push(DOTS.homework);
          else if (cat === 'exam' && !dots.find(d => d.key === DOTS.exam.key)) dots.push(DOTS.exam);
          else if (cat === 'project' && !dots.find(d => d.key === DOTS.project.key)) dots.push(DOTS.project);
          else if (cat === 'presentation' && !dots.find(d => d.key === DOTS.presentation.key)) dots.push(DOTS.presentation);
          else if (!cat) {
            // If uncategorized, fall back to project color for visibility
            if (!dots.find(d => d.key === DOTS.project.key)) dots.push(DOTS.project);
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

  // Auto-detect assignment category from title keywords
  const detectCategory = (title) => {
    if (!title || typeof title !== 'string') return '';
    const t = title.toLowerCase();
    if (/(quiz|test|exam)/.test(t)) return 'exam';
    if (/(essay|paper|project)/.test(t)) return 'project';
    if (/(presentation|slides)/.test(t)) return 'presentation';
    if (/(\bhw\b|homework|assignment)/.test(t)) return 'homework';
    // Default to homework when no keyword matches
    return 'homework';
  };

  // ----- Progress helpers -----
  const startOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun ... 6 Sat
    const diff = (day + 6) % 7; // make Monday=0
    date.setDate(date.getDate() - diff);
    date.setHours(0,0,0,0);
    return date;
  };

  const endOfWeek = (d) => {
    const sow = startOfWeek(d);
    const eow = new Date(sow);
    eow.setDate(sow.getDate() + 6);
    eow.setHours(23,59,59,999);
    return eow;
  };

  const getThisWeekAssignments = () => {
    const today = new Date();
    const sow = startOfWeek(today);
    const eow = endOfWeek(today);
    const sowStr = sow.toISOString().split('T')[0];
    const eowStr = eow.toISOString().split('T')[0];
    return getAllAssignments().filter(a => a._date >= sowStr && a._date <= eowStr);
  };
  const isCompleted = (key) => {
    if (typeof completedAssignments[key] !== 'undefined') return !!completedAssignments[key];
    if (assignmentStatus[key]) return assignmentStatus[key] === 'completed';
    return (statusMap[key] || 'not_started') === 'completed';
  };

  const toggleCompleted = (key) => {
    setCompletedAssignments(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groupByDate = (assignments) => {
    return assignments.reduce((acc, a) => {
      if (!acc[a._date]) acc[a._date] = [];
      acc[a._date].push(a);
      return acc;
    }, {});
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
        if (item.type === 'assignment') {
          all.push({ ...item, _date: date });
        }
      });
    });

    // Apply filters - prioritize daysFromToday over other date filters
    return all.filter(item => {
      if (filterClass && item.course !== filterClass) return false;
      if (filterCategory && (item.category || '').toLowerCase() !== filterCategory.toLowerCase()) return false;
      // Apply date filtering using daysFromToday when set
      if (typeof daysFromToday === 'number' && daysFromToday >= 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const end = new Date();
        end.setDate(end.getDate() + daysFromToday);
        const endStr = end.toISOString().split('T')[0];
        if (item._date < todayStr) return false;
        if (item._date > endStr) return false;
      } else {
        const from = customFrom || filterFrom;
        const to = customTo || filterTo;
        if (from && (item._date < from)) return false;
        if (to && (item._date > to)) return false;
      }
      return true;
    }).sort((a, b) => a._date.localeCompare(b._date));
  };

  // Generate month options for current year
  const getMonthOptions = () => {
    const months = [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' }
    ];
    return months;
  };

  // Generate day options (1-31)
  const getDayOptions = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push({ value: i.toString().padStart(2, '0'), label: i.toString() });
    }
    return days;
  };

  // Convert month/day to YYYY-MM-DD format
  const formatDate = (month, day) => {
    if (!month || !day) return '';
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${month}-${day}`;
  };

  // Update custom dates when month/day changes
  useEffect(() => {
    if (fromMonth && fromDay) {
      setCustomFrom(formatDate(fromMonth, fromDay));
    } else {
      setCustomFrom('');
    }
  }, [fromMonth, fromDay]);

  useEffect(() => {
    if (toMonth && toDay) {
      setCustomTo(formatDate(toMonth, toDay));
    } else {
      setCustomTo('');
    }
  }, [toMonth, toDay]);

  // Update date range based on days from today
  useEffect(() => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysFromToday);
    
    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    setCustomFrom(todayStr);
    setCustomTo(endDateStr);
  }, [daysFromToday]);

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

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setCurrentPage('progress')}
          >
            <Text style={styles.addButtonText}>Open Progress</Text>
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

          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setCurrentPage('progress')}
          >
            <Text style={styles.addButtonText}>Open Progress</Text>
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
      ) : currentPage === 'list' ? (
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
                    {Array.from(new Set(
                      getAllAssignments().map(a => a.course).filter(Boolean)
                    )).map((courseName) => (
                      <Picker.Item key={courseName} label={courseName} value={courseName} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Days from Today</Text>
                <View style={styles.modernPickerContainer}>
                  <Picker
                    selectedValue={daysFromToday}
                    onValueChange={(val) => setDaysFromToday(val)}
                    dropdownIconColor="#2196f3"
                    style={styles.modernPicker}
                  >
                    <Picker.Item label="Today Only" value={0} />
                    <Picker.Item label="Next 3 Days" value={3} />
                    <Picker.Item label="Next 7 Days" value={7} />
                    <Picker.Item label="Next 14 Days" value={14} />
                    <Picker.Item label="Next 30 Days" value={30} />
                    <Picker.Item label="Next 60 Days" value={60} />
                    <Picker.Item label="Next 90 Days" value={90} />
                    <Picker.Item label="All Future" value={365} />
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
                    <Picker.Item label="Presentation" value="presentation" />
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
                const key = `${assignmentWithChanges._date}_${assignmentWithChanges.title}`;
                const st = assignmentStatus[key] || statusMap[key] || 'not_started';
                return (
                  <TouchableOpacity 
                    key={assignment._date + assignment.title + idx} 
                    style={[styles.modernAssignmentCard,
                      st === 'completed' ? { backgroundColor: '#e8f5e9' } :
                      st === 'in_progress' ? { backgroundColor: '#fffde7' } : null
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assignmentHeader}>
                      <Text style={[styles.modernAssignmentTitle, st === 'completed' ? { textDecorationLine: 'line-through', color: '#2e7d32' } : null]}>
                        {assignmentWithChanges.title}
                      </Text>
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
                      <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                        <Text style={{fontSize: 14, marginRight: 8}}>Status:</Text>
                        <View style={styles.modernPickerContainer}>
                          <Picker
                            selectedValue={st}
                            onValueChange={(val) => { setAssignmentStatus(key, val); }}
                            dropdownIconColor="#2196f3"
                            style={styles.modernPicker}
                          >
                            <Picker.Item label="Not Started" value="not_started" />
                            <Picker.Item label="In Progress" value="in_progress" />
                            <Picker.Item label="Completed" value="completed" />
                          </Picker>
                        </View>
                      </View>
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
      ) : (
        <View style={[styles.listContainer, { flex: 1 }]}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Progress Dashboard</Text>
          </View>

          <View style={styles.primaryActionsRow}>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setCurrentPage('home')}
            >
              <Text style={styles.addButtonText}>← Back to Calendar</Text>
            </TouchableOpacity>
          </View>

          {/* Log assignments and completed state for debugging */}
          {(() => { const assignments = getAllAssignments(); console.log("Assignments in dashboard:", assignments); console.log("Completed state:", completedAssignments); console.log("Assignment Statuses:", assignmentStatus); return null; })()}

          {/* Overall Progress */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Overall Progress</Text>
            {(() => {
              const all = getAllAssignments();
              console.log('Progress view assignments count:', all.length);
              if (all.length === 0) return <Text style={styles.progressMeta}>No assignments loaded yet</Text>;
              const total = all.length;
              const completed = all.filter(a => ((assignmentStatus[`${a._date}_${a.title}`] || statusMap[`${a._date}_${a.title}`] || 'not_started') === 'completed')).length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <View>
                  <Text style={styles.progressMeta}>{completed} / {total} completed</Text>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })()}
          </View>

          {/* By Category */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>By Category</Text>
            {(['homework','exam','project','presentation']).map(cat => {
              const all = getAllAssignments().filter(a => {
                const explicit = (a.category || '').toLowerCase();
                const inferred = detectCategory(a.title || '');
                const actual = explicit || inferred;
                return actual === cat;
              });
              const total = all.length;
              const completed = all.filter(a => (
                (assignmentStatus[`${a._date}_${a.title}`] || statusMap[`${a._date}_${a.title}`] || 'not_started')
              ) === 'completed').length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
              return (
                <View key={cat} style={{ marginBottom: 12 }}>
                  <Text style={styles.progressMeta}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}: {completed}/{total}
                  </Text>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill,
                      cat === 'homework' ? styles.progressFillHomework :
                      cat === 'exam' ? styles.progressFillExam :
                      cat === 'project' ? styles.progressFillProject :
                      styles.progressFillPresentation,
                      { width: `${pct}%` }
                    ]} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* By Course */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>By Course</Text>
            {(() => {
              const all = getAllAssignments();
              const courseNames = Array.from(new Set(all.map(a => (a.course || a.courseName || 'Unknown')).filter(Boolean))).sort();
              return courseNames.map(course => {
                const group = all.filter(a => (a.course || a.courseName || 'Unknown') === course);
                const total = group.length;
                const completed = group.filter(a => (
                  (assignmentStatus[`${a._date}_${a.title}`] || statusMap[`${a._date}_${a.title}`] || 'not_started')
                ) === 'completed').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <View key={course} style={{ marginBottom: 12 }}>
                    <Text style={styles.progressMeta}>{course}: {completed}/{total}</Text>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              });
            })()}
          </View>

          {/* Weekly Assignments */}
          <View style={[styles.progressCard, { maxHeight: 600 }]}> 
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 8}}>
              <Text style={styles.progressTitle}>This Week's Assignments</Text>
              <View style={styles.modernPickerContainer}>
                <Picker
                  selectedValue={progressViewMode}
                  onValueChange={(v) => setProgressViewMode(v)}
                  dropdownIconColor="#2196f3"
                  style={styles.modernPicker}
                >
                  <Picker.Item label="Weekly" value="weekly" />
                  <Picker.Item label="Monthly" value="monthly" />
                </Picker>
              </View>
            </View>
            {(() => {
              const weekly = progressViewMode === 'weekly' ? getThisWeekAssignments() : getAllAssignments();
              const groups = groupByDate(weekly);
              const dates = Object.keys(groups).sort();
              if (dates.length === 0) return <Text style={styles.progressMeta}>No assignments loaded yet</Text>;
              return (
                <ScrollView style={{maxHeight: 540}}>
                  {dates.map(date => (
                    <View key={date} style={{ marginBottom: 12 }}>
                      <Text style={[styles.progressMeta, {fontWeight:'600', color:'#333'}]}>{date}</Text>
                      {groups[date].map((a, idx) => {
                        const key = `${a._date}_${a.title}`;
                        const st = statusMap[key] || 'not_started';
                        const completed = isCompleted(key);
                        const faded = completed;
                        const highlighted = st === 'in_progress' && !completed;
                        return (
                          <View key={key + idx} style={[styles.weekItem, faded && styles.weekItemCompleted, highlighted && styles.weekItemInProgress, completed && {backgroundColor:'#e8f5e9'}]}>
                            <Text style={[styles.weekItemTitle, faded && styles.weekItemTitleCompleted]}>
                              {a.title}
                            </Text>
                            <Text style={styles.weekItemMeta}>{a.course ? `${a.course} • ` : ''}{a._date} {a.time || ''}</Text>
                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                              <TouchableOpacity onPress={() => toggleCompleted(key)} style={[styles.checkbox, completed && styles.checkboxChecked]}>
                                {completed ? <Text style={{color:'#fff'}}>✓</Text> : null}
                              </TouchableOpacity>
                              <Text style={{marginLeft:8, color: completed ? '#2e7d32' : '#333', textDecorationLine: completed ? 'line-through' : 'none'}}>{a.title}</Text>
                            </View>
                            <View style={styles.statusRow}>
                              <TouchableOpacity
                                style={[styles.statusBtn, st === 'not_started' && styles.statusBtnActiveDefault]}
                                onPress={() => setAssignmentStatus(key, 'not_started')}
                              >
                                <Text style={[styles.statusBtnText, st === 'not_started' && styles.statusBtnTextActive]}>❌ Not Started</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.statusBtn, st === 'in_progress' && styles.statusBtnActiveInProgress]}
                                onPress={() => setAssignmentStatus(key, 'in_progress')}
                              >
                                <Text style={[styles.statusBtnText, st === 'in_progress' && styles.statusBtnTextActive]}>⏳ In Progress</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.statusBtn, st === 'completed' && styles.statusBtnActiveCompleted]}
                                onPress={() => setAssignmentStatus(key, 'completed')}
                              >
                                <Text style={[styles.statusBtnText, st === 'completed' && styles.statusBtnTextActive]}>✅ Completed</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              );
            })()}
          </View>

          {/* All Assignments with Status Controls */}
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>All Assignments</Text>
            {getAllAssignments().map((a, idx) => {
              const key = `${a._date}_${a.title}`;
              const st = statusMap[key] || 'not_started';
              const completed = isCompleted(key);
              const faded = completed;
              const highlighted = st === 'in_progress' && !completed;
              return (
                <View key={key + idx} style={[styles.weekItem, faded && styles.weekItemCompleted, highlighted && styles.weekItemInProgress, completed && {backgroundColor:'#e8f5e9'}]}>
                  <Text style={[styles.weekItemTitle, faded && styles.weekItemTitleCompleted]}>
                    {a.title} {a.course ? `• ${a.course}` : ''}
                  </Text>
                  <Text style={styles.weekItemMeta}>{a._date} {a.time || ''}</Text>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                    <TouchableOpacity onPress={() => toggleCompleted(key)} style={[styles.checkbox, completed && styles.checkboxChecked]}>
                      {completed ? <Text style={{color:'#fff'}}>✓</Text> : null}
                    </TouchableOpacity>
                    <Text style={{marginLeft:8, color: completed ? '#2e7d32' : '#333', textDecorationLine: completed ? 'line-through' : 'none'}}>{a.title}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <TouchableOpacity
                      style={[styles.statusBtn, st === 'not_started' && styles.statusBtnActiveDefault]}
                      onPress={() => setAssignmentStatus(key, 'not_started')}
                    >
                      <Text style={[styles.statusBtnText, st === 'not_started' && styles.statusBtnTextActive]}>❌ Not Started</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusBtn, st === 'in_progress' && styles.statusBtnActiveInProgress]}
                      onPress={() => setAssignmentStatus(key, 'in_progress')}
                    >
                      <Text style={[styles.statusBtnText, st === 'in_progress' && styles.statusBtnTextActive]}>⏳ In Progress</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.statusBtn, st === 'completed' && styles.statusBtnActiveCompleted]}
                      onPress={() => setAssignmentStatus(key, 'completed')}
                    >
                      <Text style={[styles.statusBtnText, st === 'completed' && styles.statusBtnTextActive]}>✅ Completed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
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
                  event.type === 'assignment' ?
                    (event.category && event.category.toLowerCase() === 'exam' ? styles.examEvent :
                      event.category && event.category.toLowerCase() === 'homework' ? styles.homeworkEvent :
                      event.category && event.category.toLowerCase() === 'project' ? styles.projectEvent :
                      event.category && event.category.toLowerCase() === 'presentation' ? styles.presentationEvent : styles.assignmentEvent)
                    : styles.studyEvent
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
                  event.type === 'assignment' ?
                    (event.category && event.category.toLowerCase() === 'exam' ? styles.examBadge :
                      event.category && event.category.toLowerCase() === 'homework' ? styles.homeworkBadge :
                      event.category && event.category.toLowerCase() === 'project' ? styles.projectBadge :
                      event.category && event.category.toLowerCase() === 'presentation' ? styles.presentationBadge : styles.assignmentBadge)
                    : styles.studyBadge
              ]}>
                <Text style={styles.eventTypeText}>
                    {event.type === 'assignment' ? (event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'Assignment') : 'Study Block'}
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
  progressCard: {
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
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  progressMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 10,
    backgroundColor: '#2196f3',
    borderRadius: 8,
    width: '0%',
  },
  progressFillHomework: {
    backgroundColor: '#43a047',
  },
  progressFillExam: {
    backgroundColor: '#e53935',
  },
  progressFillProject: {
    backgroundColor: '#fb8c00',
  },
  progressFillPresentation: {
    backgroundColor: '#8e24aa',
  },
  weekItem: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  weekItemCompleted: {
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  weekItemInProgress: {
    backgroundColor: '#fffde7',
  },
  weekItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  weekItemTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  weekItemMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  statusBtnText: {
    fontSize: 13,
    color: '#555',
  },
  statusBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statusBtnActiveDefault: {
    backgroundColor: '#9e9e9e',
    borderColor: '#9e9e9e',
  },
  statusBtnActiveInProgress: {
    backgroundColor: '#fdd835',
    borderColor: '#fdd835',
  },
  statusBtnActiveCompleted: {
    backgroundColor: '#43a047',
    borderColor: '#43a047',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9e9e9e',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#43a047',
    borderColor: '#43a047',
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
  homeworkEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#1e88e5',
  },
  examEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#e53935',
  },
  projectEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#fb8c00',
  },
  presentationEvent: {
    borderLeftWidth: 4,
    borderLeftColor: '#8e24aa',
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
  homeworkBadge: {
    backgroundColor: '#e3f2fd',
  },
  examBadge: {
    backgroundColor: '#ffebee',
  },
  projectBadge: {
    backgroundColor: '#fff3e0',
  },
  presentationBadge: {
    backgroundColor: '#f3e5f5',
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