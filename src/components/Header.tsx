'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from './UserContext';

const Header: React.FC = () => {
  const { username, setUsername, isSpectator, setIsSpectator } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  const teamId = pathname?.startsWith('/room/') ? pathname.split('/')[2] : null;

  const handleLogout = () => {
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('teamId');
    setUsername(null);
    setIsSpectator(false);
    router.push('/');
  };

  const copyRoomId = () => {
    if (teamId) {
      navigator.clipboard.writeText(teamId);
    }
  };

  return (
    <header className="header">
      <Link href="/" className="logo">SprintPoker</Link>
      {teamId && (
        <div className="room-info">
          <span>Room: {teamId}</span>
          <span className="copy-icon" onClick={copyRoomId}>📋</span>
        </div>
      )}
      <div className="user-controls">
        {username ? (
          <>
            <span className="navbar-text me-3">Welcome, {username} {isSpectator && '(Spectator)'}</span>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <span className="navbar-text">Please join to start.</span>
        )}
      </div>
    </header>
  );
};

export default Header;
