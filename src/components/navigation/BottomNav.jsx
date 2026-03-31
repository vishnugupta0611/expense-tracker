import { Link, useLocation } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  const location = useLocation();

  // Hide bottom nav on full-screen pages
  const hidden = location.pathname.startsWith('/notes') || location.pathname.startsWith('/p/notes') || location.pathname.startsWith('/words');
  if (hidden) return null;

  const navItems = [
    { path: '/expenses', icon: '💰', label: 'Expenses' },
    { path: '/spaces', icon: '👥', label: 'Spaces' },
    { path: '/shopping', icon: '🛒', label: 'Shopping' },
    { path: '/profile', icon: '👤', label: 'Profile' }
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = item.path === '/spaces' 
          ? location.pathname.startsWith('/spaces')
          : item.path === '/history'
          ? location.pathname === '/history'
          : location.pathname === item.path;
        
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;