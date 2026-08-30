import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { createServer as createViteServer } from 'vite';

// Handle __dirname and __filename in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Async Job Queue for Non-Blocking SQLite Dual-Write Operations
class AsyncJobQueue {
  private queue: Array<() => void | Promise<void>> = [];
  private isProcessing = false;

  add(job: () => void | Promise<void>) {
    this.queue.push(job);
    this.processNext();
  }

  private processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    // Defer execution to the next event loop tick to ensure non-blocking thread behavior
    setImmediate(async () => {
      const job = this.queue.shift();
      if (job) {
        try {
          await job();
        } catch (err) {
          console.error('[SQLITE QUEUE ERROR]', err);
        }
      }
      this.isProcessing = false;
      this.processNext();
    });
  }
}

const sqliteQueue = new AsyncJobQueue();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite Database natively in Node 22
  const dbPath = path.join(process.cwd(), 'mtfeed_backup.db');
  console.log(`[SQLITE] Initializing local backup SQLite database at: ${dbPath}`);
  const db = new DatabaseSync(dbPath);

  // 1. Smart WAL Mode Optimization & Disk/Memory Tuning
  console.log('[SQLITE] Applying WAL mode and performance optimizations...');
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -2000;'); // Optimize cache allocation to ~2MB
    db.exec('PRAGMA wal_autocheckpoint = 1000;'); // Trigger automatic checkpointing after 1000 pages of logs
    console.log('[SQLITE] WAL mode and performance optimizations applied successfully!');
  } catch (err) {
    console.error('[SQLITE] Failed to apply WAL/Performance PRAGMAs:', err);
  }

  // 2. Periodic WAL Checkpoint & Auto-Truncation (Disk Footprint reduction)
  setInterval(() => {
    try {
      console.log('[SQLITE PERIODIC CHECKPOINT] Running WAL truncate to clean disk logs...');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      console.log('[SQLITE PERIODIC CHECKPOINT] Completed successfully!');
    } catch (err) {
      console.error('[SQLITE PERIODIC CHECKPOINT ERROR]', err);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  // Create tables for backing up posts and profiles to prevent data loss
  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_posts (
      id TEXT PRIMARY KEY,
      content TEXT,
      author_id TEXT,
      author_name TEXT,
      author_username TEXT,
      post_json TEXT,
      created_at_ms INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_users (
      uid TEXT PRIMARY KEY,
      username TEXT,
      name TEXT,
      user_json TEXT,
      updated_at INTEGER
    );
  `);

  console.log('[SQLITE] Database tables created or verified successfully!');

  // Middleware
  app.use(express.json({ limit: '20mb' }));

  // Prepared SQL Statements
  const insertPostStmt = db.prepare(`
    INSERT OR REPLACE INTO backup_posts (id, content, author_id, author_name, author_username, post_json, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUserStmt = db.prepare(`
    INSERT OR REPLACE INTO backup_users (uid, username, name, user_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const deletePostStmt = db.prepare(`
    DELETE FROM backup_posts WHERE id = ?
  `);

  const deleteUserStmt = db.prepare(`
    DELETE FROM backup_users WHERE uid = ?
  `);

  // --- API BACKUP ROUTES ---

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'sqlite', walMode: true });
  });

  // Backup or update posts (Dual-write or Firestore sync mirror)
  app.post('/api/backup/posts', (req, res) => {
    try {
      const posts = req.body;
      if (!Array.isArray(posts)) {
        res.status(400).json({ error: 'Payload must be an array of posts' });
        return;
      }

      // Async Non-Blocking Queue writes
      sqliteQueue.add(() => {
        let count = 0;
        for (const post of posts) {
          if (!post.id) continue;
          const authorId = post.author?.uid || post.author?.id || '';
          const authorName = post.author?.name || '';
          const authorUsername = post.author?.username || '';
          const content = post.content || '';
          const createdAtMs = post.createdAtMs || Date.now();
          const postJson = JSON.stringify(post);

          insertPostStmt.run(post.id, content, authorId, authorName, authorUsername, postJson, createdAtMs);
          count++;
        }
        console.log(`[SQLITE QUEUE] Async backed up ${count} posts successfully.`);
      });

      res.json({ success: true, queued: true, message: 'Posts backup synced successfully to local SQLite (Queued)' });
    } catch (error: any) {
      console.error('[SQLITE BACKUP POSTS ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Backup or update user profile
  app.post('/api/backup/user', (req, res) => {
    try {
      const user = req.body;
      const uid = user.uid || user.id;
      if (!uid) {
        res.status(400).json({ error: 'User must have a valid uid or id' });
        return;
      }

      // Async Non-Blocking Queue writes
      sqliteQueue.add(() => {
        const username = user.username || '';
        const name = user.name || '';
        const updatedAt = user.updatedAt || Date.now();
        const userJson = JSON.stringify(user);

        insertUserStmt.run(uid, username, name, userJson, updatedAt);
        console.log(`[SQLITE QUEUE] Async backed up profile for user: ${uid}`);
      });

      res.json({ success: true, queued: true, message: 'User profile backup synced successfully to local SQLite (Queued)' });
    } catch (error: any) {
      console.error('[SQLITE BACKUP USER ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk backup of multiple users
  app.post('/api/backup/users', (req, res) => {
    try {
      const users = req.body;
      if (!Array.isArray(users)) {
        res.status(400).json({ error: 'Payload must be an array of users' });
        return;
      }

      // Async Non-Blocking Queue writes
      sqliteQueue.add(() => {
        let count = 0;
        for (const user of users) {
          const uid = user.uid || user.id;
          if (!uid) continue;
          const username = user.username || '';
          const name = user.name || '';
          const updatedAt = user.updatedAt || Date.now();
          const userJson = JSON.stringify(user);

          insertUserStmt.run(uid, username, name, userJson, updatedAt);
          count++;
        }
        console.log(`[SQLITE QUEUE] Async backed up ${count} users successfully.`);
      });

      res.json({ success: true, queued: true, message: 'Users backup synced successfully to local SQLite (Queued)' });
    } catch (error: any) {
      console.error('[SQLITE BACKUP USERS ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete post from SQLite
  app.delete('/api/backup/posts/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // Async Non-Blocking Queue writes
      sqliteQueue.add(() => {
        deletePostStmt.run(id);
        console.log(`[SQLITE QUEUE] Async deleted post ${id}`);
      });

      res.json({ success: true, queued: true, message: `Post ${id} removed from SQLite backup (Queued)` });
    } catch (error: any) {
      console.error('[SQLITE DELETE POST ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete user from SQLite
  app.delete('/api/backup/users/:uid', (req, res) => {
    try {
      const { uid } = req.params;
      
      // Async Non-Blocking Queue writes
      sqliteQueue.add(() => {
        deleteUserStmt.run(uid);
        console.log(`[SQLITE QUEUE] Async deleted user ${uid}`);
      });

      res.json({ success: true, queued: true, message: `User ${uid} removed from SQLite backup (Queued)` });
    } catch (error: any) {
      console.error('[SQLITE DELETE USER ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all SQLite backed-up posts
  app.get('/api/backup/posts', (req, res) => {
    try {
      const rows = db.prepare('SELECT post_json FROM backup_posts ORDER BY created_at_ms DESC').all() as any[];
      const posts = rows.map(row => JSON.parse(row.post_json));
      res.json(posts);
    } catch (error: any) {
      console.error('[SQLITE GET POSTS ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all SQLite backed-up users
  app.get('/api/backup/users', (req, res) => {
    try {
      const rows = db.prepare('SELECT user_json FROM backup_users').all() as any[];
      const users = rows.map(row => JSON.parse(row.user_json));
      res.json(users);
    } catch (error: any) {
      console.error('[SQLITE GET USERS ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all backups (Admin only or system reset fallback)
  app.post('/api/backup/clear', (req, res) => {
    try {
      db.exec('DELETE FROM backup_posts');
      db.exec('DELETE FROM backup_users');
      res.json({ success: true, message: 'All SQLite backups cleared successfully' });
    } catch (error: any) {
      console.error('[SQLITE CLEAR ERROR]', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- VITE MIDDLEWARE / SPA FALLBACK ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Note: Since this project uses Express v5, we MUST use '*all' for fallback wildcard matching
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[SERVER START ERROR]', err);
});
