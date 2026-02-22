import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { VenueProvider } from './context/VenueContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import VenueSetup from './pages/VenueSetup';
import EventCreate from './pages/EventCreate';
import EventDetail from './pages/EventDetail';
import IMCComposer from './pages/IMCComposer';
import RunOfShow from './pages/RunOfShow';
import CrewPortal from './pages/CrewPortal';
import ArtistSetup from './pages/ArtistSetup';
import Settings from './pages/Settings';
import CampaignTracker from './pages/CampaignTracker';
import PressPage from './pages/PressPagePreview';
import MediaGallery from './pages/MediaGallery';
import WorkflowGuide from './pages/WorkflowGuide';
import AdminDashboard from './pages/AdminDashboard';
import SetupWizard from './pages/SetupWizard';
import ImageFormatter from './pages/ImageFormatter';
import Pricing from './pages/Pricing';

// Lazy load PodcastStudio
const PodcastStudio = lazy(() => import('./pages/PodcastStudio'));

function AppFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-4 text-center">
      <p className="text-xs text-gray-500 m-0 leading-relaxed">
        The IMC Machine™ · Integrated Marketing Communications · © {new Date().getFullYear()} Julie Good. All Rights Reserved.
      </p>
      <p className="text-[10px] text-gray-400 mt-1 m-0">
        Created by Julie Good · Good Creative Media · San Antonio, TX
      </p>
    </footer>
  );
}

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100vh-52px)] overflow-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VenueProvider>
          <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/venue-setup" element={<ProtectedRoute><AppLayout><VenueSetup /></AppLayout></ProtectedRoute>} />
            <Route path="/artist-setup" element={<ProtectedRoute><AppLayout><ArtistSetup /></AppLayout></ProtectedRoute>} />
            <Route path="/events/create" element={<ProtectedRoute><AppLayout><EventCreate /></AppLayout></ProtectedRoute>} />
            <Route path="/events/:id" element={<ProtectedRoute><AppLayout><EventDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/imc-composer" element={<ProtectedRoute><AppLayout><IMCComposer /></AppLayout></ProtectedRoute>} />
            <Route path="/run-of-show" element={<ProtectedRoute><AppLayout><RunOfShow /></AppLayout></ProtectedRoute>} />
            <Route path="/crew" element={<ProtectedRoute><AppLayout><CrewPortal /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><AppLayout><CampaignTracker /></AppLayout></ProtectedRoute>} />
            <Route path="/press-page/:id" element={<ProtectedRoute><AppLayout><PressPage /></AppLayout></ProtectedRoute>} />
            <Route path="/media" element={<ProtectedRoute><AppLayout><MediaGallery /></AppLayout></ProtectedRoute>} />
            <Route path="/format-images" element={<ProtectedRoute><AppLayout><ImageFormatter /></AppLayout></ProtectedRoute>} />
            <Route path="/workflow" element={<ProtectedRoute><AppLayout><WorkflowGuide /></AppLayout></ProtectedRoute>} />
            <Route path="/podcast" element={<ProtectedRoute><AppLayout><PodcastStudio /></AppLayout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/setup" element={<ProtectedRoute><AppLayout><SetupWizard /></AppLayout></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute><AppLayout><Pricing /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
          </Routes>
          </Suspense>
        </VenueProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
