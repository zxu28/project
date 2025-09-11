const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Pomfret School campus locations data
const campusLocations = {
  academic: [
    { id: 'library', name: 'Maxwell Library', coordinates: { x: 200, y: 150 }, accessible: true, genderRestricted: false },
    { id: 'science', name: 'Science Building', coordinates: { x: 300, y: 200 }, accessible: true, genderRestricted: false },
    { id: 'arts', name: 'Arts Building', coordinates: { x: 150, y: 250 }, accessible: true, genderRestricted: false },
    { id: 'math', name: 'Mathematics Building', coordinates: { x: 250, y: 180 }, accessible: true, genderRestricted: false }
  ],
  residential: [
    { id: 'boys_dorm', name: 'Boys Dormitory', coordinates: { x: 100, y: 100 }, accessible: true, genderRestricted: true, gender: 'male' },
    { id: 'girls_dorm', name: 'Girls Dormitory', coordinates: { x: 400, y: 100 }, accessible: true, genderRestricted: true, gender: 'female' },
    { id: 'senior_dorm', name: 'Senior Dormitory', coordinates: { x: 200, y: 80 }, accessible: true, genderRestricted: true, gender: 'mixed' }
  ],
  dining: [
    { id: 'dining_hall', name: 'Dining Hall', coordinates: { x: 300, y: 120 }, accessible: true, genderRestricted: false },
    { id: 'cafe', name: 'Student Cafe', coordinates: { x: 180, y: 200 }, accessible: true, genderRestricted: false }
  ],
  athletic: [
    { id: 'gym', name: 'Athletic Center', coordinates: { x: 350, y: 250 }, accessible: true, genderRestricted: false },
    { id: 'field', name: 'Athletic Field', coordinates: { x: 400, y: 300 }, accessible: false, genderRestricted: false },
    { id: 'pool', name: 'Swimming Pool', coordinates: { x: 320, y: 280 }, accessible: true, genderRestricted: false }
  ],
  administrative: [
    { id: 'main_office', name: 'Main Office', coordinates: { x: 250, y: 50 }, accessible: true, genderRestricted: false },
    { id: 'health_center', name: 'Health Center', coordinates: { x: 150, y: 120 }, accessible: true, genderRestricted: false }
  ]
};

// Chatbot knowledge base for Pomfret School
const chatbotKnowledge = {
  greetings: [
    "Hello! I'm here to help you navigate Pomfret School. What can I help you with?",
    "Hi! Welcome to Pomfret School. How can I assist you today?",
    "Greetings! I'm your Pomfret School assistant. What do you need help with?"
  ],
  school_info: {
    "what is pomfret school": "Pomfret School is a coeducational, independent boarding and day school serving students in grades 9-12. Founded in 1894, we're located in Pomfret, Connecticut.",
    "history": "Pomfret School was founded in 1894 and has been providing excellent education for over 125 years.",
    "location": "Pomfret School is located in Pomfret, Connecticut, about 60 miles northeast of Hartford.",
    "grades": "Pomfret School serves students in grades 9-12 (freshman through senior year).",
    "boarding": "Yes, Pomfret School offers both boarding and day student options.",
    "tuition": "For current tuition information, please contact the admissions office at (860) 963-6100.",
    "admissions": "For admissions information, visit our website or contact admissions at (860) 963-6100."
  },
  campus_info: {
    "library": "The Maxwell Library is our main academic library, open 7 days a week with extensive resources and quiet study spaces.",
    "dining": "Our dining hall serves three meals daily with various dietary options. There's also a student cafe for snacks.",
    "dormitories": "We have separate dormitories for boys and girls, plus a senior dormitory for upperclassmen.",
    "athletics": "Our athletic facilities include a gymnasium, swimming pool, and athletic fields for various sports.",
    "health center": "The health center provides medical care and counseling services for all students."
  },
  navigation: {
    "directions": "I can help you find the fastest route between campus locations. Just tell me where you're going!",
    "map": "Use the campus map tab to see all locations and get directions between any two points.",
    "accessibility": "Most campus buildings are wheelchair accessible. I can provide accessible routes when needed."
  }
};

// Sample data (keeping for compatibility)
let tasks = [
  { id: 1, title: 'Learn Express.js', completed: false },
  { id: 2, title: 'Build a REST API', completed: false },
  { id: 3, title: 'Create a frontend', completed: true }
];

// Routes

// Campus locations API
app.get('/api/campus-locations', (req, res) => {
  res.json(campusLocations);
});

// Chatbot API
app.post('/api/chatbot', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const response = generateChatbotResponse(message.toLowerCase());
  res.json({ response });
});

// Campus navigation API
app.post('/api/navigation', (req, res) => {
  const { from, to, accessibility, gender } = req.body;
  
  if (!from || !to) {
    return res.status(400).json({ error: 'From and to locations are required' });
  }
  
  const route = calculateRoute(from, to, accessibility, gender);
  res.json(route);
});

// Helper function to generate chatbot responses
function generateChatbotResponse(message) {
  // Check for greetings
  if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
    return chatbotKnowledge.greetings[Math.floor(Math.random() * chatbotKnowledge.greetings.length)];
  }
  
  // Check school info
  for (const [key, response] of Object.entries(chatbotKnowledge.school_info)) {
    if (message.includes(key)) {
      return response;
    }
  }
  
  // Check campus info
  for (const [key, response] of Object.entries(chatbotKnowledge.campus_info)) {
    if (message.includes(key)) {
      return response;
    }
  }
  
  // Check navigation
  for (const [key, response] of Object.entries(chatbotKnowledge.navigation)) {
    if (message.includes(key)) {
      return response;
    }
  }
  
  // Default responses
  if (message.includes('help')) {
    return "I can help you with information about Pomfret School, campus locations, directions, and general questions. What would you like to know?";
  }
  
  return "I'm not sure about that. I can help you with information about Pomfret School, campus locations, or directions. Try asking about our history, facilities, or how to get around campus!";
}

// Helper function to calculate routes
function calculateRoute(from, to, accessibility = false, gender = null) {
  const allLocations = Object.values(campusLocations).flat();
  const fromLocation = allLocations.find(loc => loc.id === from);
  const toLocation = allLocations.find(loc => loc.id === to);
  
  if (!fromLocation || !toLocation) {
    return { error: 'Location not found' };
  }
  
  // Check gender restrictions
  if (gender && toLocation.genderRestricted) {
    if (toLocation.gender !== 'mixed' && toLocation.gender !== gender) {
      return { 
        error: `Access denied: ${toLocation.name} is restricted to ${toLocation.gender} students only`,
        accessible: false
      };
    }
  }
  
  // Check accessibility
  if (accessibility && !toLocation.accessible) {
    return { 
      error: `${toLocation.name} is not wheelchair accessible`,
      accessible: false
    };
  }
  
  // Calculate distance (simple Euclidean distance)
  const distance = Math.sqrt(
    Math.pow(toLocation.coordinates.x - fromLocation.coordinates.x, 2) +
    Math.pow(toLocation.coordinates.y - fromLocation.coordinates.y, 2)
  );
  
  // Generate route steps (simplified)
  const steps = [
    `Start at ${fromLocation.name}`,
    `Walk towards ${toLocation.name}`,
    `Arrive at ${toLocation.name}`
  ];
  
  return {
    from: fromLocation,
    to: toLocation,
    distance: Math.round(distance),
    estimatedTime: Math.round(distance / 2), // Assuming 2 units per minute walking
    steps: steps,
    accessible: toLocation.accessible,
    genderRestricted: toLocation.genderRestricted
  };
}

// Original task management routes (keeping for compatibility)
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const newTask = {
    id: tasks.length + 1,
    title,
    completed: false
  };
  
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;
  
  const task = tasks.find(t => t.id === parseInt(id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  if (title !== undefined) task.title = title;
  if (completed !== undefined) task.completed = completed;
  
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const taskIndex = tasks.findIndex(t => t.id === parseInt(id));
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/`);
});
