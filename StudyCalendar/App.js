import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import ICAL from 'ical.js';

// Sample Canvas ICS feed URL (you can replace this with a real one)
const SAMPLE_ICS_URL = 'https://canvas.instructure.com/feeds/calendars/user_1234567890.ics';

export default function App() {
  const [events, setEvents] = useState({});
  const [studyBlocks, setStudyBlocks] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchCalendarEvents();
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
        
        // Add assignment to events
        parsedEvents[dateKey] = {
          ...parsedEvents[dateKey],
          assignments: [
            ...(parsedEvents[dateKey]?.assignments || []),
            {
              title: event.summary,
              description: event.description,
              time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'assignment'
            }
          ]
        };

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

      setEvents(parsedEvents);
      setStudyBlocks(generatedStudyBlocks);
    } catch (error) {
      console.error('Error parsing ICS:', error);
      Alert.alert('Error', 'Failed to load calendar events');
    }
  };

  const getMarkedDates = () => {
    const marked = {};
    
    // Mark dates with assignments
    Object.keys(events).forEach(date => {
      marked[date] = {
        marked: true,
        dotColor: '#ff6b6b',
        customStyles: {
          container: {
            backgroundColor: '#ffebee',
            borderRadius: 8,
          },
          text: {
            color: '#d32f2f',
            fontWeight: 'bold',
          },
        },
      };
    });

    // Mark dates with study blocks
    Object.keys(studyBlocks).forEach(date => {
      if (marked[date]) {
        marked[date].dots = [
          { key: 'assignment', color: '#ff6b6b' },
          { key: 'study', color: '#4caf50' }
        ];
        marked[date].customStyles.container.backgroundColor = '#e8f5e8';
      } else {
        marked[date] = {
          marked: true,
          dotColor: '#4caf50',
          customStyles: {
            container: {
              backgroundColor: '#e8f5e8',
              borderRadius: 8,
            },
            text: {
              color: '#2e7d32',
              fontWeight: 'bold',
            },
          },
        };
      }
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study Calendar</Text>
      
      <Calendar
        style={styles.calendar}
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={getMarkedDates()}
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
  calendar: {
    marginHorizontal: 16,
    marginBottom: 20,
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
});