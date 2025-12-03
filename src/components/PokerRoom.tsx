'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import Card from './Card';
import { playJoinSound, playVoteSound, playRevealSound, playTimerSound, playFanfareSound } from '../utils/sounds';
import { useUser } from './UserContext';

interface Member {
  userId: string;
  username: string;
  isSpectator: boolean;
}

interface PokerSession {
  teamId: string;
  sessionId: string;
  storyName: string;
  state: 'voting' | 'revealed';
  votes: { [userId: string]: string };
  members: Member[];
  ownerId: string;
}

interface PokerRoomProps {
  teamId: string;
}

export const PokerRoom: React.FC<PokerRoomProps> = ({ teamId }) => {
  const { username, isSpectator, setIsSpectator } = useUser();
  const router = useRouter();
  const [session, setSession] = useState<PokerSession | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [median, setMedian] = useState<number | null>(null);
  const [minVoter, setMinVoter] = useState<string | null>(null);
  const [maxVoter, setMaxVoter] = useState<string | null>(null);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const pokerCards = ['0', '1', '2', '3', '5', '8', '13', '21', '?', '∞'];

  const prevMembersCount = useRef(0);

  useEffect(() => {
    if (!username) return;

    const socket = io({
      query: { username, teamId, isSpectator: isSpectator.toString() },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinSession', { teamId, username, isSpectator });
    });

    socket.on('sessionJoined', (data) => {
      setUserId(data.userId);
    });

    socket.on('sessionUpdate', (updatedSession) => {
      if (updatedSession.members.length > prevMembersCount.current) {
        playJoinSound();
      }
      prevMembersCount.current = updatedSession.members.length;
      setSession(updatedSession);
      if (updatedSession.state === 'voting') {
        if (userId && updatedSession.votes[userId]) {
          setMyVote(updatedSession.votes[userId]);
        } else {
          setMyVote(null);
        }
      }
    });
    socket.on('reveal', (data) => {
      playRevealSound();
      setSession(prevSession => (prevSession ? { ...prevSession, ...data } : null));
      setMedian(data.median);
      setMinVoter(data.minVoter);
      setMaxVoter(data.maxVoter);
    });

    socket.on('consensusReached', () => {
      setShowConfetti(true);
      playFanfareSound();
      setTimeout(() => setShowConfetti(false), 5000);
    });

    socket.on('reactionReceived', (emoji) => {
      const newReaction = { id: Date.now(), emoji };
      setReactions(prev => [...prev, newReaction]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      }, 4000);
    });

    socket.on('sessionError', (message) => {
      console.error('Session error:', message);
      router.push('/');
    });

    return () => {
      socket.disconnect();
    };
  }, [teamId, username, router, isSpectator, userId]); // Removed setShowConfetti dep

  const sendReaction = (emoji: string) => {
    if (socketRef.current) {
      socketRef.current.emit('sendReaction', { emoji });
    }
  };

  const handleSwitchRole = (newIsSpectator: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('switchRole', { isSpectator: newIsSpectator });
      setIsSpectator(newIsSpectator);
    }
  };

  const handleVote = (vote: string) => {
    if (socketRef.current && session?.state === 'voting') {
      socketRef.current.emit('vote', { vote });
      setMyVote(vote);
      playVoteSound();
    }
  };

  const handleRevealVotes = () => {
    if (socketRef.current) {
      socketRef.current.emit('revealVotes', { teamId });
    }
  };

  const handleResetRound = () => {
    if (socketRef.current) {
      socketRef.current.emit('resetRound', { teamId, newStoryName: '' });
      setMyVote(null);
    }
  };

  if (!session || !username) {
    return (
      <div className="container mt-4">
        <div className="alert alert-info">Loading poker session...</div>
      </div>
    );
  }

  // Calculate average vote if revealed
  const revealedVotes = Object.values(session.votes).filter(v => v !== '?');
  const averageVote = session.state === 'revealed' && revealedVotes.length > 0
    ? (revealedVotes.reduce((sum, v) => sum + parseFloat(v), 0) /
       revealedVotes.length).toFixed(2)
    : null;

  const getVoterClass = (memberId: string) => {
    if (session?.state === 'revealed') {
      if (memberId === minVoter) {
        return 'outlier-voter-min';
      }
      if (memberId === maxVoter) {
        return 'outlier-voter-max';
      }
    }
    return '';
  };

  const voters = session.members.filter(member => !member.isSpectator);
  const observers = session.members.filter(member => member.isSpectator);

  return (
    <>
      {showConfetti && <ReactConfetti width={window.innerWidth} height={window.innerHeight} />}
      <div className="poker-room-container">
        <div className="poker-board">
          {/* Floating Reactions Container */}
          <div className="reactions-container">
            {reactions.map(reaction => (
              <motion.div
                key={reaction.id}
                className="floating-emoji"
                initial={{ y: 0, opacity: 1, x: Math.random() * 200 - 100 }}
                animate={{ y: -200, opacity: 0 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 4, ease: 'easeOut' }}
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </div>

          {/* Live Reactions Sidebar */}
          <div className="live-reactions-sidebar">
            <button className="reaction-button" onClick={() => sendReaction('👍')}>👍</button>
            <button className="reaction-button" onClick={() => sendReaction('❤️')}>❤️</button>
                      <button className="reaction-button" onClick={() => sendReaction('🎉')}>🎉</button>
                      <button className="reaction-button" onClick={() => sendReaction('💩')}>💩</button>
                    </div>
          {/* Main Poker Board Area */}
          <div className="main-board-area">
            <h1 className="waiting-text">{session.state === 'voting' ? 'POKER' : ''}</h1>
            <div className="members-display">
              {voters.map((member) => (
                <div
                  key={member.userId}
                  className={`member-card ${getVoterClass(member.userId)}`}
                >
                  <div className="vote-status">
                    <AnimatePresence>
                      {session.votes[member.userId] && (
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <Card isFlipped={session.state === 'revealed'} vote={session.votes[member.userId] || null} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {session.state !== 'revealed' && !session.votes[member.userId] && <div className="waiting-message">Waiting...</div>}
                  </div>
                  <div className="member-name">
                    {member.username}
                    {member.userId === userId && <span className="you-badge">✅</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {session.state === 'revealed' && (
            <div className="revealed-votes-container">
              <div className="stat-box">
                <div className="stat-title">AVERAGE</div>
                <div className="stat-value">{averageVote}</div>
              </div>
              <div className="stat-box">
                <div className="stat-title">MEDIAN</div>
                <div className="stat-value">{median}</div>
              </div>
            </div>
          )}

          {/* Poker Cards Footer */}
          <div className="poker-footer">
            <div className="poker-cards-container">
              {session.state === 'voting' && !isSpectator && pokerCards.map(card => (
                <motion.button
                  key={card}
                  onClick={() => handleVote(card)}
                  disabled={!!myVote}
                  className={`poker-card ${myVote === card ? 'selected selected-card-animate' : ''}`}
                  whileTap={{ scale: 0.9 }}
                >
                  {card}
                </motion.button>
              ))}
            </div>

            {/* Session Controls */}
            <div className="poker-controls">

              {session.ownerId === userId && (
                <>
                                  <button className="control-button" onClick={handleRevealVotes} disabled={session.state === 'revealed'}>Reveal Votes</button>
                                  <button className="control-button" onClick={() => handleResetRound()} disabled={!session || session.state === 'voting'}>Reset Round</button>
                                </>
                              )}              {!isSpectator ? (
                <button className="control-button" onClick={() => handleSwitchRole(true)} disabled={isSpectator}>Switch to Observer</button>
              ) : (
                <button className="control-button" onClick={() => handleSwitchRole(false)} disabled={!isSpectator}>Switch to Voter</button>
              )}
            </div>
          </div>
        </div>
        {observers.length > 0 && (
          <div className="observers-display">
            <h2>Observers</h2>
            <div className="observer-list">
              {observers.map(observer => (
                <span key={observer.userId} className="observer-name">{observer.username}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};