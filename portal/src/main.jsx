import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#0d1b2a' }}>
        <h2>Something went wrong</h2>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13 }}>
          {this.state.error.message}{'\n'}{this.state.error.stack}
        </pre>
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 20px', background: '#0d1b2a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
