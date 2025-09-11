# Pomfret School Assistant

A comprehensive campus assistant application built specifically for Pomfret School, featuring an intelligent chatbot, interactive campus map, and task management system.

## Features

### 🤖 Pomfret School Chatbot
- School-specific knowledge base about Pomfret School history, facilities, and policies
- Answers questions about academics, campus life, admissions, and more
- Natural conversation interface with contextual responses

### 🗺️ Interactive Campus Map
- Visual representation of Pomfret School campus locations
- Smart routing between any two campus locations
- Accessibility-aware navigation (wheelchair accessible routes)
- Gender-based access control for restricted areas (dormitories)
- Real-time distance and time calculations

### ✅ Task Management
- Add, edit, delete, and complete tasks
- Clean, intuitive interface
- Real-time updates and synchronization

### 🎨 Modern Design
- Responsive design that works on all devices
- Beautiful gradient backgrounds and smooth animations
- Tabbed interface for easy navigation between features
- Professional Pomfret School branding

## Project Structure

```
project1/
├── server.js          # Express.js backend server
├── index.html         # Frontend HTML file
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## Setup Instructions

### Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## API Endpoints

The backend provides the following REST API endpoints:

### Campus & Navigation
- `GET /api/campus-locations` - Get all campus locations with coordinates and restrictions
- `POST /api/navigation` - Calculate route between two locations with accessibility/gender options

### Chatbot
- `POST /api/chatbot` - Send message to Pomfret School chatbot

### Task Management
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

### System
- `GET /api/health` - Health check endpoint

### Example API Usage

**Chat with the Pomfret School assistant:**
```bash
curl -X POST http://localhost:3000/api/chatbot \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Pomfret School?"}'
```

**Get campus locations:**
```bash
curl http://localhost:3000/api/campus-locations
```

**Calculate accessible route:**
```bash
curl -X POST http://localhost:3000/api/navigation \
  -H "Content-Type: application/json" \
  -d '{"from": "library", "to": "dining_hall", "accessibility": true}'
```

**Create a task:**
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Study for exams"}'
```

## Technologies Used

### Backend
- **Express.js** - Web framework for Node.js
- **CORS** - Cross-Origin Resource Sharing middleware
- **Node.js** - JavaScript runtime

### Frontend
- **HTML5** - Markup language with semantic structure
- **CSS3** - Modern styling with gradients, flexbox, transitions, and responsive design
- **Vanilla JavaScript** - Pure JavaScript with ES6+ features
- **Fetch API** - For HTTP requests and API communication

### Features
- **Real-time Chat Interface** - Interactive chatbot with message history
- **Interactive Campus Map** - Visual map with clickable locations and route visualization
- **Smart Routing Algorithm** - Distance calculation with accessibility and gender restrictions
- **Responsive Design** - Mobile-first approach with adaptive layouts

## Development

### Running in Development Mode

Use `npm run dev` to start the server with nodemon, which will automatically restart the server when you make changes to the code.

### Customization

- **Styling**: Modify the CSS in `index.html` to change the appearance
- **API**: Add new endpoints in `server.js`
- **Features**: Extend the JavaScript functionality in `index.html`

## License

MIT License - feel free to use this project as a starting point for your own applications!
