"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./server/db");
const dev = process.env.NODE_ENV !== 'production';
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 5000;
app.prepare().then(() => {
    const server = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(server);
    const io = new socket_io_1.Server(httpServer, {
    // path: '/socket.io', // default is /socket.io
    });
    server.use(express_1.default.json());
    server.use((0, cors_1.default)()); // Useful if API is accessed from elsewhere, but same-origin is default
    // --- API Routes (Ported from existing server) ---
    server.post('/api/join', (req, res) => {
        const { displayName, roomId } = req.body;
        if (!displayName) {
            res.status(400).json({ message: 'Display name is required' });
            return;
        }
        let user = (0, db_1.findUserByUsername)(displayName);
        if (!user) {
            user = (0, db_1.createUser)(displayName);
        }
        if (roomId) {
            const team = (0, db_1.findTeamById)(roomId);
            if (!team) {
                res.status(404).json({ message: 'Team not found' });
                return;
            }
            (0, db_1.addTeamMember)(team.id, user.id);
            res.status(200).json({ teamId: team.id });
        }
        else {
            const team = (0, db_1.createTeam)(`${displayName}'s Room`, user.id);
            res.status(200).json({ teamId: team.id });
        }
    });
    server.post('/api/teams', (req, res) => {
        const { name, ownerName } = req.body;
        if (!name || !ownerName) {
            res.status(400).json({ message: 'Team name and owner name are required' });
            return;
        }
        let user = (0, db_1.findUserByUsername)(ownerName);
        if (!user) {
            user = (0, db_1.createUser)(ownerName);
        }
        const team = (0, db_1.createTeam)(name, user.id);
        res.status(201).json({ message: 'Team created successfully', team });
    });
    server.post('/api/teams/:id/join', (req, res) => {
        const teamId = req.params.id;
        const { username } = req.body;
        if (!username) {
            res.status(400).json({ message: 'Username is required' });
            return;
        }
        let user = (0, db_1.findUserByUsername)(username);
        if (!user) {
            user = (0, db_1.createUser)(username);
        }
        const team = (0, db_1.findTeamById)(teamId);
        if (!team) {
            res.status(404).json({ message: 'Team not found' });
            return;
        }
        if ((0, db_1.addTeamMember)(teamId, user.id)) {
            res.status(200).json({ message: 'Joined team successfully' });
        }
        else {
            res.status(400).json({ message: 'Already a member or cannot join' });
        }
    });
    server.delete('/api/teams/:id/members/:memberId', (req, res) => {
        const teamId = req.params.id;
        const memberId = req.params.memberId;
        const { username } = req.body;
        if (!username) {
            res.status(400).json({ message: 'Username is required for authorization' });
            return;
        }
        const user = (0, db_1.findUserByUsername)(username);
        if (!user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const team = (0, db_1.findTeamById)(teamId);
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
        if ((0, db_1.removeTeamMember)(teamId, memberId)) {
            res.status(200).json({ message: 'Member removed successfully' });
        }
        else {
            res.status(404).json({ message: 'Member not found in team' });
        }
    });
    const pokerSessions = new Map();
    io.on('connection', (socket) => {
        console.log('a user connected', socket.id);
        socket.on('joinSession', async ({ teamId, username, isSpectator }) => {
            let user = (0, db_1.findUserByUsername)(username);
            if (!user) {
                user = (0, db_1.createUser)(username);
            }
            const userId = user.id;
            const team = (0, db_1.findTeamById)(teamId);
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
            }
            else {
                if (user) {
                    delete session.votes[user.id];
                }
            }
            if (!session.members.some(m => m.userId === userId)) {
                session.members.push({ userId: user.id, username: user.username, isSpectator });
            }
            else {
                // Update spectator status if re-joining
                const member = session.members.find(m => m.userId === userId);
                if (member)
                    member.isSpectator = isSpectator;
            }
            socket.join(teamId);
            io.to(teamId).emit('sessionUpdate', session);
            socket.emit('sessionJoined', { userId });
        });
        socket.on('vote', ({ vote }) => {
            const { rooms } = socket;
            const teamId = Array.from(rooms).find(room => room !== socket.id);
            const username = socket.handshake.query.username;
            const user = (0, db_1.findUserByUsername)(username);
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
            const username = socket.handshake.query.username;
            const user = (0, db_1.findUserByUsername)(username);
            const team = (0, db_1.findTeamById)(teamId);
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
                let minVoter;
                let maxVoter;
                if (votes.length > 1) {
                    const minVote = votes[0];
                    const maxVote = votes[votes.length - 1];
                    if (maxVote - minVote > 2) {
                        for (const userId in session.votes) {
                            if (parseFloat(session.votes[userId]) === minVote)
                                minVoter = userId;
                            if (parseFloat(session.votes[userId]) === maxVote)
                                maxVoter = userId;
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
            const username = socket.handshake.query.username;
            const user = (0, db_1.findUserByUsername)(username);
            const team = (0, db_1.findTeamById)(teamId);
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
            const username = socket.handshake.query.username;
            const user = (0, db_1.findUserByUsername)(username);
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
    server.all('*', (req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        return handle(req, res, parsedUrl);
    });
    httpServer.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
