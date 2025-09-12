# Canvas Calendar

A React.js webapp that displays Canvas LMS assignments and automatically generated study blocks using react-big-calendar.

## Features

- 📅 **Interactive Calendar**: Month, week, and day views
- 🎯 **Canvas Integration**: Fetches real assignments from Canvas API
- 📚 **Study Blocks**: Automatically creates study sessions the day before each assignment
- 🎨 **Color Coding**: Assignments in red, study blocks in green
- 📱 **Responsive Design**: Works on desktop and mobile

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:**
   Navigate to `http://localhost:5173`

## Canvas Configuration

The app uses your Canvas API token to fetch events. Update `src/config/canvas.js` with your Canvas domain and API token.

## How It Works

1. **Fetches Canvas Events**: Uses Canvas API to get calendar events
2. **Parses Assignments**: Identifies assignments by `event.type === 'assignment'` or `event.assignment_id`
3. **Due Date Logic**: Uses `event.assignment?.due_at || event.end_at || event.start_at` for due dates
4. **Study Block Generation**: Creates 1-hour study sessions at 7:00 PM the day before each assignment
5. **Calendar Display**: Shows assignments in red and study blocks in green

## Dependencies

- **React**: Frontend framework
- **Vite**: Build tool and dev server
- **react-big-calendar**: Calendar component
- **moment**: Date handling

## API Endpoints

- Calendar Events: `/api/v1/calendar_events`
- Assignments: `/api/v1/courses/{course_id}/assignments`
- Courses: `/api/v1/courses`