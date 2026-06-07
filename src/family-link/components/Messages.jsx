import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import './Messages.css';

const MessagesButton = () => {
  return (
    <div className="messages-button-container">
      <Link
        to="/family/messages"
        className="messages-fab"
        aria-label="Open messages"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="messages-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 8h10M7 12h6m-6 4h4M21 12c0 3.866-3.582 7-8 7a9.003 9.003 0 01-4-.88L3 21l1.88-5.19A7.002 7.002 0 013 12c0-3.866 3.582-7 8-7s8 3.134 8 7z"
          />
        </svg>
      </Link>

      <Link
        to="/profile-info"
        className="profile-fab"
        aria-label="Open family profile info"
      >
        <UserRound className="messages-icon" size={22} />
      </Link>
    </div>
  );
};

export default MessagesButton;
