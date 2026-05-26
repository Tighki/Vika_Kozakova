const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function resolveDataDir() {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  if (process.env.NODE_ENV === 'production') {
    const renderDisk = '/var/data';
    if (fs.existsSync(renderDisk)) {
      return renderDisk;
    }
    return path.join(process.cwd(), 'data');
  }
  return path.join(__dirname, '../../data');
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'docflow.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    throw new Error('База данных не инициализирована');
  }
  return db;
}

function seedUsers() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (count > 0) return;

  const insert = db.prepare(
    'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  );

  insert.run(
    'admin@docflow.local',
    bcrypt.hashSync('Admin123!', 10),
    'Администратор Системы',
    'admin'
  );
  insert.run(
    'user@docflow.local',
    bcrypt.hashSync('User123!', 10),
    'Пользователь Тестовый',
    'user'
  );
}

function seedSampleDocuments() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM documents').get().cnt;
  if (count > 0) return;

  const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@docflow.local'").get();
  const user = db.prepare("SELECT id FROM users WHERE email = 'user@docflow.local'").get();
  if (!admin || !user) return;

  const insertDoc = db.prepare(`
    INSERT INTO documents (title, doc_number, type, status, content, author_id, assignee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHistory = db.prepare(`
    INSERT INTO document_history (document_id, user_id, action, comment)
    VALUES (?, ?, ?, ?)
  `);

  const doc1 = insertDoc.run(
    'Заявка на канцелярию',
    'ВН-2026-001',
    'internal',
    'pending',
    'Прошу выделить канцелярские принадлежности для отдела.',
    user.id,
    admin.id
  );

  insertHistory.run(doc1.lastInsertRowid, user.id, 'created', 'Документ создан');
  insertHistory.run(doc1.lastInsertRowid, user.id, 'submitted', 'Отправлен на согласование');

  const doc2 = insertDoc.run(
    'Договор поставки',
    'ВХ-2026-002',
    'incoming',
    'draft',
    'Входящий договор от поставщика на рассмотрение.',
    admin.id,
    user.id
  );

  insertHistory.run(doc2.lastInsertRowid, admin.id, 'created', 'Документ создан');
}

function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const isNew = !fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  seedUsers();
  if (isNew) {
    seedSampleDocuments();
  }

  console.log(`SQLite: ${DB_PATH}${isNew ? ' (создана)' : ''}`);

  return db;
}

module.exports = { initDatabase, getDb, DB_PATH, DATA_DIR };
