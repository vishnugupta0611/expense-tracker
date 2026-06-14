import { Link, useLocation } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  const location = useLocation();

  // Hide bottom nav on full-screen pages
  const hidden = location.pathname.startsWith('/notes') || 
                 location.pathname.startsWith('/p/notes') || 
                 location.pathname.startsWith('/words') ||
                 location.pathname.startsWith('/family/messages');
  if (hidden) return null;

  const navItems = [
    { path: '/expenses', icon: '💰', label: 'Expenses' },
    { path: '/family', icon: '👨‍👩‍👧‍👦', label: 'Family' },
    { path: '/shopping', icon: '🛒', label: 'Shopping' },
    { path: '/jobs', icon: '💼', label: 'Jobs' },
    { path: '/profile', icon: '👤', label: 'Profile' }
  ];

  const isFamilyPage = location.pathname.startsWith('/family') || location.pathname === '/profile-info';

  return (
    <nav className={`bottom-nav ${isFamilyPage ? 'family-theme' : ''}`}>
      {navItems.map((item) => {
        const isActive = item.path === '/family' 
          ? location.pathname.startsWith('/family')
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