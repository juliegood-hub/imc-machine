import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import ProductionCalendar from './pages/ProductionCalendar';
import WorkflowGuide from './pages/WorkflowGuide';
import AdminDashboard from './pages/AdminDashboard';
import SetupWizard from './pages/SetupWizard';
import ImageFormatter from './pages/ImageFormatter';
import Pricing from './pages/Pricing';
import ProductionOpsHub from './pages/ProductionOpsHub';
import ChatHub from './pages/ChatHub';
import { normalizeWorkflowVariant, resolvePageFlow, resolveWorkflowVariantFromSearch } from './constants/pageFlow';

// Lazy load PodcastStudio
const PodcastStudio = lazy(() => import('./pages/PodcastStudio'));

function detectIOS() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function detectIOSSafari() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIOS = detectIOS();
  if (!isIOS) return false;
  const isWebKit = /WebKit/i.test(ua);
  const isSafariToken = /Safari/i.test(ua);
  const isAltBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo)/i.test(ua);
  return isWebKit && isSafariToken && !isAltBrowser;
}

function findScrollableParent(startNode) {
  if (!startNode || typeof window === 'undefined') return null;
  let node = startNode instanceof Element ? startNode : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > (node.clientHeight + 2);
    if (canScroll) return node;
    node = node.parentElement;
  }
  return null;
}

function readWindowScrollTop() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

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
  const location = useLocation();
  const navigate = useNavigate();
  const queryWorkflowVariant = resolveWorkflowVariantFromSearch(location.search);
  const [workflowVariant, setWorkflowVariant] = useState(() => {
    if (typeof window === 'undefined') return queryWorkflowVariant;
    if (queryWorkflowVariant !== 'default') {
      window.localStorage.setItem('imc-workflow-variant', queryWorkflowVariant);
      return queryWorkflowVariant;
    }
    return normalizeWorkflowVariant(window.localStorage.getItem('imc-workflow-variant') || 'default');
  });
  const pageMeta = resolvePageFlow(location.pathname, { variant: workflowVariant });
  const mainRef = useRef(null);
  const activeScrollableRef = useRef(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const isPullingRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageActionStatus, setPageActionStatus] = useState(() => {
    if (typeof window === 'undefined') return 'in_progress';
    return window.localStorage.getItem(`imc-page-status:${resolvePageFlow(window.location.pathname).key}`) || 'in_progress';
  });
  const [pageActionNote, setPageActionNote] = useState('');
  const PULL_THRESHOLD = 72;
  const MAX_PULL = 120;
  const iosDevice = detectIOS();
  const iosSafari = detectIOSSafari();
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const useWindowScroll = iosSafari;
  const enableCustomPullToRefresh = isTouchDevice && !iosSafari;
  const showStatusTapFallback = iosDevice && isTouchDevice && !iosSafari;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (queryWorkflowVariant !== 'default') {
      window.localStorage.setItem('imc-workflow-variant', queryWorkflowVariant);
      setWorkflowVariant(queryWorkflowVariant);
      return;
    }
    const storedVariant = normalizeWorkflowVariant(window.localStorage.getItem('imc-workflow-variant') || 'default');
    setWorkflowVariant(storedVariant);
  }, [queryWorkflowVariant]);

  const appendWorkflowVariant = (path) => {
    if (!path) return '/';
    if (workflowVariant === 'default') return path;
    const [pathname, query = ''] = path.split('?');
    const params = new URLSearchParams(query);
    params.set('wf', workflowVariant);
    return `${pathname}?${params.toString()}`;
  };

  const persistPageAction = (value) => {
    setPageActionStatus(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`imc-page-status:${pageMeta.key}`, value);
    }
  };

  const markStepComplete = () => {
    persistPageAction('complete');
    setPageActionNote(pageMeta.actionMessages?.complete || 'Beautiful. This page is marked complete.');
  };

  const saveForLater = () => {
    persistPageAction('saved');
    setPageActionNote(pageMeta.actionMessages?.save || 'Saved for later. You can pick this back up anytime.');
  };

  const skipThisStep = () => {
    persistPageAction('skipped');
    setPageActionNote(pageMeta.actionMessages?.skip || 'Skipped for now. You can return here anytime.');
  };

  const goToNextStep = () => {
    navigate(appendWorkflowVariant(pageMeta.nextPath || '/'));
  };

  const pageStatusMeta = {
    complete: { label: 'Complete', className: 'bg-emerald-100 text-emerald-700' },
    saved: { label: 'Saved for Later', className: 'bg-blue-100 text-blue-700' },
    skipped: { label: 'Skipped', className: 'bg-amber-100 text-amber-800' },
    in_progress: { label: 'In Progress', className: 'bg-gray-100 text-gray-600' },
  }[pageActionStatus] || { label: 'In Progress', className: 'bg-gray-100 text-gray-600' };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(`imc-page-status:${pageMeta.key}`) || 'in_progress';
    setPageActionStatus(stored);
    setPageActionNote('');
  }, [pageMeta.key]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    activeScrollableRef.current = useWindowScroll ? window : (mainRef.current || window);
  }, [useWindowScroll]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !isTouchDevice) return undefined;
    const captureActiveScrollable = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const detected = findScrollableParent(target);
      if (detected) {
        activeScrollableRef.current = detected;
        return;
      }
      activeScrollableRef.current = useWindowScroll ? window : (mainRef.current || window);
    };

    document.addEventListener('touchstart', captureActiveScrollable, { passive: true, capture: true });
    document.addEventListener('touchmove', captureActiveScrollable, { passive: true, capture: true });
    return () => {
      document.removeEventListener('touchstart', captureActiveScrollable, { capture: true });
      document.removeEventListener('touchmove', captureActiveScrollable, { capture: true });
    };
  }, [isTouchDevice, useWindowScroll]);

  const resolveActiveScrollable = () => {
    const candidate = activeScrollableRef.current;
    if (candidate === window) return window;
    if (candidate && candidate instanceof Element && document.body.contains(candidate)) return candidate;
    if (useWindowScroll) return window;
    return mainRef.current || window;
  };

  const isAtTop = (scrollable) => {
    if (!scrollable || scrollable === window) {
      return readWindowScrollTop() <= 0;
    }
    return scrollable.scrollTop <= 0;
  };

  const scrollContainerToTop = (scrollable, behavior = 'smooth') => {
    if (!scrollable || scrollable === window) {
      window.scrollTo({ top: 0, behavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      return;
    }
    if (typeof scrollable.scrollTo === 'function') {
      scrollable.scrollTo({ top: 0, behavior });
      return;
    }
    scrollable.scrollTop = 0;
  };

  const triggerRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(PULL_THRESHOLD);
    window.setTimeout(() => window.location.reload(), 140);
    window.setTimeout(() => {
      setIsRefreshing(false);
      setPullDistance(0);
    }, 3000);
  };

  const handleTouchStart = (e) => {
    if (!enableCustomPullToRefresh || isRefreshing) return;
    const mainEl = mainRef.current;
    if (!mainEl || !e.touches?.[0]) return;
    const activeScrollable = resolveActiveScrollable();
    if (activeScrollable !== mainEl) return;
    if (!isAtTop(mainEl)) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    isPullingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!enableCustomPullToRefresh || !isPullingRef.current || !e.touches?.[0]) return;
    const mainEl = mainRef.current;
    if (!mainEl) return;
    const activeScrollable = resolveActiveScrollable();
    if (activeScrollable !== mainEl) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }
    if (!isAtTop(mainEl)) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartXRef.current);
    if (deltaY <= 0 || deltaX > 32) {
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(MAX_PULL, deltaY * 0.55));
  };

  const handleTouchEnd = () => {
    if (!enableCustomPullToRefresh || !isPullingRef.current) return;
    isPullingRef.current = false;
    if (pullDistance >= PULL_THRESHOLD) {
      triggerRefresh();
      return;
    }
    setPullDistance(0);
  };

  const scrollToTop = () => {
    const activeScrollable = resolveActiveScrollable();
    scrollContainerToTop(activeScrollable, 'smooth');
    if (activeScrollable !== window) {
      scrollContainerToTop(window, 'smooth');
    }
  };

  const showPullUI = enableCustomPullToRefresh && (pullDistance > 0 || isRefreshing);

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <Navbar />
      {showStatusTapFallback && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll current view to top"
          className="fixed left-0 right-0 top-0 z-[70] bg-transparent border-none p-0 m-0"
          style={{ height: 'max(10px, env(safe-area-inset-top))' }}
        />
      )}
      <div className="flex flex-1">
        <Sidebar />
        <main
          ref={mainRef}
          className={`flex-1 min-h-[calc(100vh-52px)] flex flex-col relative lg:ml-60 ${useWindowScroll ? 'overflow-visible' : 'overflow-auto'}`}
          onTouchStart={enableCustomPullToRefresh ? handleTouchStart : undefined}
          onTouchMove={enableCustomPullToRefresh ? handleTouchMove : undefined}
          onTouchEnd={enableCustomPullToRefresh ? handleTouchEnd : undefined}
          onTouchCancel={enableCustomPullToRefresh ? handleTouchEnd : undefined}
        >
          {showPullUI && (
            <div className="sticky top-0 z-20 pointer-events-none flex justify-center">
              <div
                className="mt-2 px-3 py-1.5 rounded-full bg-[#0d1b2a] text-white text-[11px] tracking-wide"
                style={{ transform: `translateY(${Math.max(0, pullDistance - 28)}px)` }}
              >
                {isRefreshing ? 'Refreshing…' : (pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh')}
              </div>
            </div>
          )}
          <div className="px-4 md:px-8 pt-4">
            <div className="card border border-[#c8a45e33] bg-[#faf8f3]">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 m-0">Page Features</p>
              <h1 className="text-xl md:text-2xl mt-1 mb-1">{pageMeta.title}</h1>
              <p className="text-sm text-gray-600 m-0">{pageMeta.subtitle}</p>
              <p className="text-xs text-gray-500 mt-2 mb-0">{pageMeta.features}</p>
              {pageMeta.workflowVariant !== 'default' && (
                <p className="text-[11px] text-[#0d1b2a] mt-2 mb-0">
                  Active lens: <span className="font-semibold">{pageMeta.workflowVariantLabel}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex-1">
            {children}
          </div>
          <div className="px-4 md:px-8 pb-4">
            <div className="card border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold m-0">Step Actions</p>
                  <p className="text-xs text-gray-500 m-0 mt-1">
                    {pageMeta.actionIntro || 'Choose what you want to do with this section before moving on.'}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${pageStatusMeta.className}`}>{pageStatusMeta.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-xs" onClick={markStepComplete}>✓ {pageMeta.actionLabels?.complete || 'Mark Complete'}</button>
                <button type="button" className="btn-secondary text-xs" onClick={saveForLater}>{pageMeta.actionLabels?.save || 'Save for Later'}</button>
                <button type="button" className="btn-secondary text-xs" onClick={skipThisStep}>{pageMeta.actionLabels?.skip || 'Skip This Step'}</button>
                <button type="button" className="btn-secondary text-xs" onClick={goToNextStep}>
                  {pageMeta.actionLabels?.next || 'Next Step →'}
                </button>
              </div>
              {pageActionNote && <p className="text-xs text-emerald-700 mt-2 mb-0">{pageActionNote}</p>}
              <p className="text-xs text-gray-500 mt-2 mb-0">
                Next up: <span className="font-semibold text-gray-700">{pageMeta.nextTitle}</span> — {pageMeta.nextDescription}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToTop}
            className="fixed bottom-5 right-5 z-40 px-3 py-2 rounded-full bg-[#0d1b2a] text-white text-xs border border-[#c8a45e] shadow-md"
            aria-label="Back to top"
          >
            ↑ Back to Top
          </button>
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
            <Route path="/production-ops" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-ops/staffing" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-ops/event-ops" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-ops/inventory" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-ops/training" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-ops/certifications" element={<ProtectedRoute><AppLayout><ProductionOpsHub /></AppLayout></ProtectedRoute>} />
            <Route path="/production-calendar" element={<ProtectedRoute><AppLayout><ProductionCalendar /></AppLayout></ProtectedRoute>} />
            <Route path="/press-page/:id" element={<ProtectedRoute><AppLayout><PressPage /></AppLayout></ProtectedRoute>} />
            <Route path="/media" element={<ProtectedRoute><AppLayout><MediaGallery /></AppLayout></ProtectedRoute>} />
            <Route path="/format-images" element={<ProtectedRoute><AppLayout><ImageFormatter /></AppLayout></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><AppLayout><ChatHub /></AppLayout></ProtectedRoute>} />
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
