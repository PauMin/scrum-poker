"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTeamMember = exports.addTeamMember = exports.findTeamsByUserId = exports.findTeamById = exports.createTeam = exports.createUser = exports.findUserById = exports.findUserByUsername = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const dbPath = path_1.default.join(process.cwd(), 'server', 'db.json');
let db = { users: [], teams: [] };
// Initialize DB
if (fs_1.default.existsSync(dbPath)) {
    try {
        const data = fs_1.default.readFileSync(dbPath, 'utf-8');
        db = JSON.parse(data);
    }
    catch (error) {
        console.error("Error reading db.json, initializing empty db", error);
        db = { users: [], teams: [] };
    }
}
else {
    // Ensure directory exists
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    fs_1.default.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}
const saveDb = () => {
    fs_1.default.writeFileSync(dbPath, JSON.stringify(db, null, 2));
};
const findUserByUsername = (username) => {
    return db.users.find(user => user.username === username);
};
exports.findUserByUsername = findUserByUsername;
const findUserById = (userId) => {
    return db.users.find(user => user.id === userId);
};
exports.findUserById = findUserById;
const createUser = (username) => {
    const newUser = {
        id: (0, uuid_1.v4)(),
        username,
    };
    db.users.push(newUser);
    saveDb();
    return newUser;
};
exports.createUser = createUser;
const createTeam = (name, ownerId) => {
    const newTeam = {
        id: (0, uuid_1.v4)(),
        name,
        ownerId,
        memberIds: [ownerId], // Owner is automatically a member
    };
    db.teams.push(newTeam);
    saveDb();
    return newTeam;
};
exports.createTeam = createTeam;
const findTeamById = (teamId) => {
    return db.teams.find(team => team.id === teamId);
};
exports.findTeamById = findTeamById;
const findTeamsByUserId = (userId) => {
    return db.teams.filter(team => team.memberIds.includes(userId));
};
exports.findTeamsByUserId = findTeamsByUserId;
const addTeamMember = (teamId, userId) => {
    const team = (0, exports.findTeamById)(teamId);
    if (team && !team.memberIds.includes(userId)) {
        team.memberIds.push(userId);
        saveDb();
        return true;
    }
    return false;
};
exports.addTeamMember = addTeamMember;
const removeTeamMember = (teamId, userId) => {
    const team = (0, exports.findTeamById)(teamId);
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
exports.removeTeamMember = removeTeamMember;
