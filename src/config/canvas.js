// Canvas LMS Configuration
// IMPORTANT: Update these values for your school's Canvas instance
export const CANVAS_CONFIG = {
  domain: 'canvas.instructure.com', // Change to your school's domain (e.g., 'yourschool.instructure.com')
  apiToken: '22006~yavuV4VuzeZcQGrtt2hEwLfnTn2Wm3HJeTfPyKWr49a3MnCPfQF84xPun9E9UCfR',
  baseUrl: 'https://canvas.instructure.com/api/v1', // Change to your school's Canvas URL
  
  // API endpoints
  endpoints: {
    calendarEvents: '/calendar_events',
    assignments: '/courses/{course_id}/assignments',
    courses: '/courses',
    user: '/users/self'
  }
};

// Helper function to build Canvas API URLs
export const buildCanvasUrl = (endpoint, params = {}) => {
  const baseUrl = CANVAS_CONFIG.baseUrl;
  let url = `${baseUrl}${endpoint}`;
  
  // Replace path parameters
  Object.keys(params).forEach(key => {
    if (url.includes(`{${key}}`)) {
      url = url.replace(`{${key}}`, params[key]);
    }
  });
  
  // Add query parameters (excluding access_token since we'll use Authorization header)
  const queryParams = new URLSearchParams({
    per_page: '100',
    ...params
  });
  
  return `${url}?${queryParams.toString()}`;
};
