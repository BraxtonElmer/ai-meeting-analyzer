import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage, sessionStore } from "./storage";
import { User } from "../shared/schema";


declare global {
  namespace Express {
    // Add User properties to Express.User
    interface User {
      id: number;
      username: string;
      fullName: string;
      email: string;
      password: string;
      avatarInitials: string;
      avatarColor: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Password verification function
async function comparePasswords(supplied: string, stored: string | undefined) {
  // If there's no stored password, return false immediately
  if (!stored) return false;
  
  try {
    const [hashed, salt] = stored.split(".");
    // Extra safety check to ensure both parts exist
    if (!hashed || !salt) return false;
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Use the centralized session store from storage module which handles both PostgreSQL and memory fallback
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'ai-meeting-assistant-secret-development-only',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure the local strategy for use by Passport
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // Serialize user for session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post('/api/register', async (req, res) => {
    try {
      const { username, password, fullName, email } = req.body;

      // Simple validation
      if (!username || !password || !fullName || !email) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Generate avatar initials and color
      const initials = fullName
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase();
      
      const avatarColors = [
        "bg-gray-200", "bg-indigo-100", "bg-blue-100", 
        "bg-green-100", "bg-yellow-100", "bg-purple-100", "bg-pink-100"
      ];
      const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

      // Create the new user with hashed password
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        fullName,
        email,
        avatarInitials: initials,
        avatarColor: randomColor
      });

      // Log the user in automatically
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error logging in' });
        }
        return res.status(201).json(user);
      });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: Express.User | false, info: { message?: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error logging out' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });
  
  // Update user profile
  app.post('/api/user/update', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    try {
      const userId = (req.user as Express.User).id;
      const { fullName, email, username } = req.body;
      
      // Make sure username is unique if changed
      if (username !== (req.user as Express.User).username) {
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: 'Username already exists' });
        }
      }
      
      // Generate avatar initials if fullName changed
      let avatarInitials = (req.user as Express.User).avatarInitials;
      if (fullName !== (req.user as Express.User).fullName) {
        avatarInitials = fullName
          .split(' ')
          .map((name: string) => name[0])
          .join('')
          .toUpperCase();
      }
      
      // Update user in database
      const updatedUser = await storage.updateUserProfile(userId, {
        fullName,
        email,
        username,
        avatarInitials
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Update session user data
      Object.assign(req.user, updatedUser);
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Middleware to check if user is authenticated
  app.use('/api/protected', (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Authentication required' });
  });
}