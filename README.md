# Real-Time Task Collaboration Platform

A full-stack task collaboration platform similar to Trello/Notion, built with **React**, **Node.js**, **Express**, **PostgreSQL**, and **Socket.io** for real-time updates. This application enables teams to collaborate on tasks in real-time with instant synchronization across all connected clients.

## 🎯 Features

### Core Features
- ✅ **User Authentication** - Sign up, login with JWT token-based authentication
- ✅ **Boards** - Create, read, update, delete boards with titles and descriptions
- ✅ **Lists** - Organize boards into multiple lists (columns)
- ✅ **Tasks** - Full CRUD operations on tasks with title, description, due date, and status
- ✅ **Drag & Drop** - Intuitive drag-and-drop to move tasks between lists
- ✅ **Task Assignment** - Assign multiple users to tasks with user search
- ✅ **Real-time Updates** - WebSocket-powered instant synchronization across users
- ✅ **Activity Tracking** - Complete audit log of all board changes
- ✅ **User Search** - Search and assign team members to tasks
- ✅ **Pagination** - Efficient board listing with pagination
- ✅ **Search** - Full-text search across boards

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or higher
- **PostgreSQL** v12 or higher  
- **npm** or **yarn**

### Step 1: Database Setup
```bash
psql -U postgres
CREATE DATABASE task_collaboration;
```

### Step 2: Backend Setup
```bash
cd backend
npm install
npm start
```
Server runs on `http://localhost:5000`

### Step 3: Frontend Setup (in new terminal)
```bash
cd frontend
npm install
npm start
```
App opens at `http://localhost:3000`

## 🔐 Test Credentials
- **Email**: `test@test.com`
- **Password**: `password123`

## 📁 Project Structure

```
task-collaboration-platform/
├── backend/
│   ├── db/              # Database schema initialization
│   ├── routes/          # API endpoints (auth, boards, lists, tasks, users, activities)
│   ├── middleware/      # Authentication middleware
│   ├── utils/           # Utility functions (activity logging)
│   ├── tests/           # Unit tests (auth, boards)
│   ├── server.js        # Express server + Socket.io setup
│   ├── package.json     # Backend dependencies
│   └── .env.example     # Environment template
│
├── frontend/
│   ├── src/
│   │   ├── components/  # React components (TaskCard, TaskModal, ActivitySidebar, PrivateRoute)
│   │   ├── pages/       # Page components (Login, Register, Dashboard, Board)
│   │   ├── contexts/    # Context API (AuthContext, SocketContext)
│   │   ├── App.js       # Main application component
│   │   ├── index.js     # React DOM render
│   │   └── App.css      # Global styles
│   ├── public/          # Static assets
│   ├── package.json     # Frontend dependencies
│   └── .env.example     # Environment template
│
└── README.md            # This file
```

## 🔌 API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /api/auth/register` - Register new user
  - Body: `{ name, email, password }`
  - Returns: User object + JWT token
  
- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: User object + JWT token
  
- `GET /api/auth/me` - Get current authenticated user
  - Headers: `Authorization: Bearer <token>`
  - Returns: Current user object

### Boards Routes (`/api/boards`)
- `GET /api/boards` - List user's boards with pagination & search
  - Query: `?page=1&search=projectname`
  - Returns: Array of boards with list/task counts
  
- `GET /api/boards/:id` - Get board with all lists and tasks
  - Returns: Board object with nested lists and tasks
  
- `POST /api/boards` - Create new board
  - Body: `{ title, description }`
  - Returns: Created board object
  
- `PUT /api/boards/:id` - Update board
  - Body: `{ title, description }`
  - Returns: Updated board object
  
- `DELETE /api/boards/:id` - Delete board (owner only)
  - Returns: Success message
  
- `POST /api/boards/:id/members` - Add member to board
  - Body: `{ userId }`
  - Returns: Member added confirmation

### Lists Routes (`/api/lists`)
- `POST /api/lists` - Create list
  - Body: `{ boardId, title }`
  - Returns: Created list object
  
- `PUT /api/lists/:id` - Update list
  - Body: `{ title }`
  - Returns: Updated list object
  
- `DELETE /api/lists/:id` - Delete list (CASCADE deletes tasks)
  - Returns: Success message

### Tasks Routes (`/api/tasks`)
- `POST /api/tasks` - Create task
  - Body: `{ listId, title, description, dueDate, status }`
  - Returns: Created task object
  
- `PUT /api/tasks/:id` - Update task
  - Body: `{ title, description, dueDate, status, listId }`
  - Returns: Updated task object
  
- `DELETE /api/tasks/:id` - Delete task
  - Returns: Success message
  
- `POST /api/tasks/:id/assign` - Assign user to task
  - Body: `{ userId }`
  - Returns: Assignment confirmation
  
- `DELETE /api/tasks/:id/assign/:userId` - Remove user from task
  - Returns: Unassignment confirmation

### Users Routes (`/api/users`)
- `GET /api/users/search` - Search users by name or email
  - Query: `?q=searchterm`
  - Returns: Array of matching users (max 10)

### Activities Routes (`/api/activities`)
- `GET /api/activities/board/:boardId` - Get activity log for board
  - Query: `?page=1` (pagination)
  - Returns: Array of activity records with user info

## 📊 Database Schema

**8 Tables with proper relationships and indexes:**

1. **users** - User accounts and credentials
2. **boards** - Main board entities
3. **board_members** - Board membership with roles
4. **lists** - Columns/sections within boards
5. **tasks** - Individual tasks with metadata
6. **task_assignments** - Multi-user task assignment
7. **activities** - Audit log with JSONB metadata
8. **Indexes** - 10 indexes on foreign keys and frequently queried fields

**Key Features:**
- CASCADE delete relationships (delete board → delete lists/tasks)
- JSONB metadata field for activities
- Timestamps (created_at, updated_at) on all tables
- Proper foreign key constraints

## 🔄 Real-time Events (Socket.io)

**Event Types Emitted to Connected Clients:**
- `board-updated` - Board details changed
- `board-deleted` - Board was deleted
- `list-created` - New list created
- `list-updated` - List updated
- `list-deleted` - List deleted
- `task-created` - New task created
- `task-updated` - Task details/status changed
- `task-deleted` - Task deleted
- `task-assigned` - User assigned to task
- `task-unassigned` - User removed from task
- `member-added` - New member added to board

**Socket.io Rooms:**
- Users join room: `board-{boardId}` when viewing board
- Events emitted only to users in relevant board room
- Real-time synchronization across all connected clients

## 📦 Key Dependencies

**Backend:**
- **express** - Web framework
- **socket.io** - Real-time WebSocket library
- **pg** - PostgreSQL client
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token management
- **express-validator** - Input validation
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables

**Frontend:**
- **react** (v18.2.0) - UI library
- **react-router-dom** (v6) - Client-side routing
- **axios** - HTTP client
- **socket.io-client** - WebSocket client
- **react-beautiful-dnd** - Drag-and-drop UI
- **react-hot-toast** - Toast notifications

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests use **Jest** and **Supertest** for API testing:
- `tests/auth.test.js` - Authentication endpoints
- `tests/boards.test.js` - Board operations

## 🛠️ Development

**Backend (with auto-reload using nodemon):**
```bash
cd backend
npm run dev
```

**Frontend (with hot reload):**
```bash
cd frontend
npm start
```

## 📝 Environment Variables

### Backend (.env)
Create `backend/.env` from `backend/.env.example`:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_collaboration
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
```

### Frontend (.env)
Create `frontend/.env` from `frontend/.env.example`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_WS_URL=http://localhost:5000
```

## 🏗️ Architecture

**Backend Architecture:**
- REST API endpoints with Express.js
- Socket.io for real-time synchronization
- JWT middleware for request authentication
- PostgreSQL for persistent data storage
- Activity logging for audit trail
- Input validation on all endpoints

**Frontend Architecture:**
- React components for UI
- React Router for page navigation
- Context API for global state (Auth, Socket)
- Axios for HTTP requests
- Socket.io client for real-time event listening
- React Beautiful DnD for drag-drop functionality
- Toast notifications for user feedback

**Authentication Flow:**
1. User registers/logs in
2. Backend validates credentials and returns JWT token
3. Frontend stores token in localStorage
4. Subsequent requests include token in Authorization header
5. Backend middleware verifies token on protected routes

**Real-time Flow:**
1. Frontend connects to WebSocket on login
2. User navigates to board, client emits `join-board` event
3. Server adds user to room `board-{boardId}`
4. When board is modified, server emits event to all users in room
5. All connected clients receive event and update UI instantly

## 🆘 Troubleshooting

**Database Connection Issues:**
- Verify PostgreSQL is running: `psql -U postgres`
- Check DB credentials in `.env` match your setup
- Ensure database exists: `psql -U postgres -c "CREATE DATABASE task_collaboration;"`
- Check DB logs for connection errors

**Backend Won't Start:**
- Check if port 5000 is in use: `netstat -ano | findstr :5000` (Windows)
- Verify Node.js v16+: `node --version`
- Run `npm install` in backend directory
- Check for syntax errors: `npm run lint`

**Frontend Won't Connect to Backend:**
- Verify backend is running on port 5000
- Check `REACT_APP_API_URL` in `.env` (should be `http://localhost:5000/api`)
- Check browser console for CORS errors
- Clear browser cache and restart dev server

**Real-time Updates Not Working:**
- Check WebSocket connection in DevTools > Network > WS
- Verify `FRONTEND_URL` in backend `.env` matches frontend URL
- Check Socket.io is running (should see connection in backend logs)
- Restart both frontend and backend servers

**Task Assignment Search Not Working:**
- Verify users exist in database
- Check `/api/users/search?q=term` endpoint directly
- Ensure authentication token is valid
- Check user permissions (must be board members)

## 📚 Code Examples

### Creating a Task (Frontend)
```javascript
const createTask = async (listId, taskData) => {
  const response = await axios.post('/api/tasks', {
    listId,
    ...taskData
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

### Listening to Real-time Events (Frontend)
```javascript
useEffect(() => {
  socket.on('task-created', (task) => {
    // Update UI with new task
  });
  
  socket.on('task-updated', (task) => {
    // Update UI with modified task
  });
}, [socket]);
```

### Activity Logging (Backend)
```javascript
const activity = await createActivity(
  boardId,
  userId,
  'task-created',
  'task',
  taskId,
  { title: task.title }
);
```

## 🔒 Security Considerations

- ✅ Passwords hashed with bcryptjs (salt rounds: 10)
- ✅ JWT tokens with 7-day expiration
- ✅ Input validation on all API endpoints
- ✅ CORS configured to allow only trusted origins
- ✅ Database queries use parameterized statements (SQL injection prevention)
- ✅ Protected routes require valid authentication token
- ⚠️ Change `JWT_SECRET` in production environment

## 📈 Performance Optimizations

- **Database Indexes** - 10 indexes on frequently queried columns
- **Pagination** - 12 items per page for board listing
- **Activity Search** - Efficient JSONB queries
- **Socket.io Rooms** - Users only receive events for boards they're viewing
- **Connection Pooling** - PostgreSQL connection pool for efficiency

## 🚀 Deployment

### Production Checklist
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Update `REACT_APP_API_URL` to production API domain
- [ ] Use production PostgreSQL database
- [ ] Enable HTTPS for secure connections
- [ ] Set up proper error logging
- [ ] Configure database backups

### Deployment Options
- **Vercel** (Frontend) + **Heroku/Railway** (Backend)
- **AWS EC2** with PM2 for process management
- **Docker** containerization for both services
- **DigitalOcean** App Platform (simplified deployment)

## 📄 License

This project is provided as-is for educational and interview purposes.

---

**Built with ❤️ as a full-stack task collaboration platform**
