'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './UserContext';

const Join: React.FC = () => {
  const { setUsername, setIsSpectator: setGlobalIsSpectator } = useUser();
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      try {
        const response = await fetch('/api/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ displayName: name.trim(), roomId: roomId.trim() }),
        });

        if (response.ok) {
          const data = await response.json();
          // Update global context
          setUsername(name.trim());
          setGlobalIsSpectator(isSpectator);
          
          sessionStorage.setItem('teamId', data.teamId);
          router.push(`/room/${data.teamId}`);
        } else {
          // Handle error
          console.error('Failed to join room');
        }
      } catch (error) {
        console.error('Error joining room:', error);
      }
    }
  };

  return (
    <div className="join-container">
      <div className="join-form">
        <h1>SprintPoker</h1>
        <p>Gamified Agile Estimation</p>
        <form onSubmit={handleJoin}>
          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Room ID (Optional)</label>
            <input
              type="text"
              placeholder="Leave empty for new room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>
          <div className="form-group spectator-checkbox">
            <input
              type="checkbox"
              id="spectator-toggle"
              checked={isSpectator}
              onChange={(e) => setIsSpectator(e.target.checked)}
            />
            <label htmlFor="spectator-toggle">Join as Spectator (Observer)</label>
          </div>
          <button type="submit" className="join-button">
            {roomId.trim() ? 'Join Room' : 'Create New Room +'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Join;