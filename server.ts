import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// --- Database Logic (Merged from server/db.ts) ---

const dbPath = path.join(process.cwd(), 'data', 'db.json');

interface User {
  id: string;
  username: string;
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

interface Db {
  users: User[];
  teams: Team[];
}

let db: Db = { users: [], teams: [] };

// Initialize DB
if (fs.existsSync(dbPath)) {
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    db = JSON.parse(data);
  } catch (error) {
    console.error("Error reading db.json, initializing empty db", error);
    db = { users: [], teams: [] };
  }
} else {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

const saveDb = () => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error("Error saving to db.json at path:", dbPath, error);
  }
};

const findUserByUsername = (username: string): User | undefined => {
  return db.users.find(user => user.username === username);
};

const findUserById = (userId: string): User | undefined => {
    return db.users.find(user => user.id === userId);
};

const createUser = (username: string): User => {
  const newUser: User = {
    id: uuidv4(),
    username,
  };
  db.users.push(newUser);
  saveDb();
  return newUser;
};

const createTeam = (name: string, ownerId: string): Team => {
    const newTeam: Team = {
        id: uuidv4(),
        name,
        ownerId,
        memberIds: [ownerId], // Owner is automatically a member
    };
    db.teams.push(newTeam);
    saveDb();
    return newTeam;
};

const findTeamById = (teamId: string): Team | undefined => {
    return db.teams.find(team => team.id === teamId);
};

const findTeamsByUserId = (userId: string): Team[] => {
    return db.teams.filter(team => team.memberIds.includes(userId));
};

const addTeamMember = (teamId: string, userId: string): boolean => {
    const team = findTeamById(teamId);
    if (team && !team.memberIds.includes(userId)) {
        team.memberIds.push(userId);
        saveDb();
        return true;
    }
    return false;
};

const removeTeamMember = (teamId: string, userId: string): boolean => {
    const team = findTeamById(teamId);
    if (team) {
        const initialLength = team.memberIds.length;
        team.memberIds = team.memberIds.filter(id => id !== userId);
        if (team.memberIds.length < initialLength) {
            saveDb();
            return true;
        }
    }
    return false;
};

// --- Server Setup ---

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 5000;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    // path: '/socket.io', // default is /socket.io
  });

  server.use(express.json());
  server.use(cors()); // Useful if API is accessed from elsewhere, but same-origin is default

  // --- API Routes ---

  server.post('/api/join', (req: Request, res: Response) => {
    console.log('POST /api/join request body:', req.body);
    try {
        const { displayName, roomId } = req.body;

        if (!displayName) {
            console.error('POST /api/join error: Display name is required');
            res.status(400).json({ message: 'Display name is required' });
            return;
        }

        let user = findUserByUsername(displayName);
        if (!user) {
            user = createUser(displayName);
        }

        if (roomId) {
            const team = findTeamById(roomId);
            if (!team) {
                console.error('POST /api/join error: Team not found', roomId);
                res.status(404).json({ message: 'Team not found' });
                return;
            }
            addTeamMember(team.id, user.id);
            res.status(200).json({ teamId: team.id });
        } else {
            const team = createTeam(`${displayName}'s Room`, user.id);
            res.status(200).json({ teamId: team.id });
        }
    } catch (error) {
        console.error('POST /api/join internal server error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  server.post('/api/teams', (req: Request, res: Response) => {
    const { name, ownerName } = req.body;

    if (!name || !ownerName) {
        res.status(400).json({ message: 'Team name and owner name are required' });
        return;
    }

    let user = findUserByUsername(ownerName);
    if (!user) {
        user = createUser(ownerName);
    }

    const team = createTeam(name, user.id);
    res.status(201).json({ message: 'Team created successfully', team });
  });

  server.post('/api/teams/:id/join', (req: Request, res: Response) => {
    const teamId = req.params.id;
    const { username } = req.body;

    if (!username) {
        res.status(400).json({ message: 'Username is required' });
        return;
    }

    let user = findUserByUsername(username);
    if (!user) {
        user = createUser(username);
    }

    const team = findTeamById(teamId);
    if (!team) {
        res.status(404).json({ message: 'Team not found' });
        return;
    }

    if (addTeamMember(teamId, user.id)) {
        res.status(200).json({ message: 'Joined team successfully' });
    } else {
        res.status(400).json({ message: 'Already a member or cannot join' });
    }
  });

  server.delete('/api/teams/:id/members/:memberId', (req: Request, res: Response) => {
    const teamId = req.params.id;
    const memberId = req.params.memberId;
    const { username } = req.body;

    if (!username) {
        res.status(400).json({ message: 'Username is required for authorization' });
        return;
    }
    const user = findUserByUsername(username);
    if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const team = findTeamById(teamId);
    if (!team) {
        res.status(404).json({ message: 'Team not found' });
        return;
    }

    if (team.ownerId !== user.id) {
        res.status(403).json({ message: 'Only team owner can remove members' });
        return;
    }
    if (team.ownerId === memberId) {
        res.status(400).json({ message: 'Cannot remove owner from the team' });
        return;
    }

    if (removeTeamMember(teamId, memberId)) {
        res.status(200).json({ message: 'Member removed successfully' });
    } else {
        res.status(404).json({ message: 'Member not found in team' });
    }
  });

  // --- Socket.IO Logic (Ported) ---

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

  const pokerSessions = new Map<string, PokerSession>();

  io.on('connection', (socket: Socket) => {
    console.log('a user connected', socket.id);

    socket.on('joinSession', async ({ teamId, username, isSpectator }) => {
      let user = findUserByUsername(username);
      if (!user) {
        user = createUser(username);
      }
      const userId = user.id;

      const team = findTeamById(teamId);
      if (!team) {
        socket.emit('sessionError', 'Team not found');
        return;
      }
      if (!team.memberIds.includes(userId)) {
        socket.emit('sessionError', 'User not authorized for this team');
        return;
      }

      let session = pokerSessions.get(teamId);
      if (!session) {
        session = {
          teamId,
          sessionId: teamId,
          storyName: 'New Story',
          state: 'voting',
          votes: {},
          members: [],
          ownerId: team.ownerId,
        };
        pokerSessions.set(teamId, session);
      } else {
        if (user) {
          delete session.votes[user.id];
        }
      }

      if (!session.members.some(m => m.userId === userId)) {
        session.members.push({ userId: user.id, username: user.username, isSpectator });
      } else {
        // Update spectator status if re-joining
        const member = session.members.find(m => m.userId === userId);
        if (member) member.isSpectator = isSpectator;
      }

      socket.join(teamId);
      io.to(teamId).emit('sessionUpdate', session);
      socket.emit('sessionJoined', { userId });
    });

    socket.on('vote', ({ vote }) => {
        const { rooms } = socket;
        const teamId = Array.from(rooms).find(room => room !== socket.id);
        const username = socket.handshake.query.username as string;
        const user = findUserByUsername(username);
    
        if (!teamId || !user) {
          socket.emit('sessionError', 'Not joined to a session or unauthorized');
          return;
        }
        const userId = user.id;
    
        const session = pokerSessions.get(teamId);
        if (session && session.state === 'voting') {
          const newVotes = { ...session.votes, [userId]: vote };
          const newSession = { ...session, votes: newVotes };
          pokerSessions.set(teamId, newSession);
          io.to(teamId).emit('sessionUpdate', newSession);
        }
      });
    
        socket.on('revealVotes', ({ teamId }) => {
          const username = socket.handshake.query.username as string;
          const user = findUserByUsername(username);
          const team = findTeamById(teamId);
      
          if (!user || !team || team.ownerId !== user.id) {
            socket.emit('sessionError', 'Only the moderator can reveal votes.');
            return;
          }
      
          const session = pokerSessions.get(teamId);
          if (session) {
            session.state = 'revealed';
      
                  const votes = Object.values(session.votes).map(v => parseFloat(v)).filter(v => !isNaN(v));
                  votes.sort((a, b) => a - b);
                  const average = votes.length ? votes.reduce((a, b) => a + b) / votes.length : 0;
                  let median = 0;
                  if (votes.length > 0) {
                    const mid = Math.floor(votes.length / 2);
                    median = votes.length % 2 !== 0 ? votes[mid] : (votes[mid - 1] + votes[mid]) / 2;
                  }
      
                  let minVoter: string | undefined;
                  let maxVoter: string | undefined;
                  if (votes.length > 1) {
                    const minVote = votes[0];
                    const maxVote = votes[votes.length - 1];
                    if (maxVote - minVote > 2) {
                        for (const userId in session.votes) {
                            if (parseFloat(session.votes[userId]) === minVote) minVoter = userId;
                            if (parseFloat(session.votes[userId]) === maxVote) maxVoter = userId;
                        }
                    }
                  }
            
                  io.to(teamId).emit('reveal', { votes: session.votes, average, median, minVoter, maxVoter });
                  
                  const uniqueVotes = new Set(Object.values(session.votes));
                  if (uniqueVotes.size === 1 && Object.values(session.votes).length === session.members.length) {
                    io.to(teamId).emit('consensusReached');
                  }
                  io.to(teamId).emit('sessionUpdate', session);
                }
              });
  
    socket.on('resetRound', ({ teamId, newStoryName }) => {
      const username = socket.handshake.query.username as string;
      const user = findUserByUsername(username);
      const team = findTeamById(teamId);
  
      if (!user || !team || team.ownerId !== user.id) {
          socket.emit('sessionError', 'Only the moderator can reset the round.');
          return;
      }
  
      const session = pokerSessions.get(teamId);
      if (session) {
        session.state = 'voting';
        session.votes = {};
        session.storyName = newStoryName || 'New Story';
        io.to(teamId).emit('sessionUpdate', session);
      }
    });
  
    socket.on('sendReaction', ({ emoji }) => {
      const { rooms } = socket;
      const teamId = Array.from(rooms).find(room => room !== socket.id);
      if (teamId) {
        io.to(teamId).emit('reactionReceived', emoji);
      }
    });
  
    socket.on('switchRole', ({ isSpectator }) => {
      const { rooms } = socket;
      const teamId = Array.from(rooms).find(room => room !== socket.id);
      const username = socket.handshake.query.username as string;
      const user = findUserByUsername(username);
  
      if (teamId && user) {
        const session = pokerSessions.get(teamId);
        if (session) {
          const member = session.members.find(m => m.userId === user.id);
          if (member) {
            member.isSpectator = isSpectator;
            io.to(teamId).emit('sessionUpdate', session);
          }
        }
      }
    });

    socket.on('disconnect', () => {
      // Handle disconnect
    });
  });

  // --- Next.js Request Handling ---

  server.all(/(.*)/, (req: Request, res: Response) => {
    const parsedUrl = parse(req.url!, true);
    return handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});