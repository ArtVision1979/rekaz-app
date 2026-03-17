import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Projects from './pages/Projects.jsx'
import Visits from './pages/Visits.jsx'
import Tasks from './pages/Tasks.jsx'
import { Reports } from './pages/Reports.jsx'
import Schedule from './pages/Schedule.jsx'
import DailyLogs from './pages/DailyLogs.jsx'
import Milestones from './pages/Milestones.jsx'
import Photos from './pages/Photos.jsx'
import Drawings from './pages/Drawings.jsx'
import Users from './pages/Users.jsx'
import Consultations from './pages/Consultations.jsx'
import ProjectVisits from './pages/ProjectVisits.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#888',fontSize:14}}>Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="project-visits" element={<ProjectVisits />} />
        <Route path="visits" element={<Visits />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="milestones" element={<Milestones />} />
        <Route path="daily-logs" element={<DailyLogs />} />
        <Route path="photos" element={<Photos />} />
        <Route path="drawings" element={<Drawings />} />
        <Route path="reports" element={<Reports />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="users" element={<Users />} />
        <Route path="consultations" element={<Consultations />} />
        <Route path="consultations" element={<Consultations />} />
      </Route>
    </Routes>
  )
}
