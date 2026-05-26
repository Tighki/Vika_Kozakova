const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

function dataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) return '/var/data';
  if (process.env.NODE_ENV === 'production') return path.join(process.cwd(), 'data');
  return path.join(__dirname, '../../data');
}
const DATA_DIR = dataDir();

const DB_PATH = path.join(DATA_DIR, 'docflow.db');
let db;

const getDb = () => {
  if (!db) throw new Error('База данных не инициализирована');
  return db;
};

function seed() {
  if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c) return;

  const ins = db.prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
  ins.run('admin@docflow.local', bcrypt.hashSync('Admin123!', 10), 'Администратор Системы', 'admin');
  ins.run('user@docflow.local', bcrypt.hashSync('User123!', 10), 'Пользователь Тестовый', 'user');

  const admin = db.prepare("SELECT id FROM users WHERE email='admin@docflow.local'").get();
  const user = db.prepare("SELECT id FROM users WHERE email='user@docflow.local'").get();
  const doc = db.prepare(
    'INSERT INTO documents (title, doc_number, type, status, content, author_id, assignee_id) VALUES (?,?,?,?,?,?,?)'
  );
  const hist = db.prepare(
    'INSERT INTO document_history (document_id, user_id, action, comment) VALUES (?,?,?,?)'
  );

  const d1 = doc.run('Заявка на канцелярию', 'ВН-2026-001', 'internal', 'pending', 'Прошу выделить канцелярские принадлежности.', user.id, admin.id).lastInsertRowid;
  hist.run(d1, user.id, 'created', 'Документ создан');
  hist.run(d1, user.id, 'submitted', 'Отправлен на согласование');

  const d2 = doc.run('Договор поставки', 'ВХ-2026-002', 'incoming', 'draft', 'Входящий договор от поставщика.', admin.id, user.id).lastInsertRowid;
  hist.run(d2, admin.id, 'created', 'Документ создан');
}

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const isNew = !fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  seed();
  console.log(`SQLite: ${DB_PATH}${isNew ? ' (создана)' : ''}`);
  return db;
}

module.exports = { initDatabase, getDb, DB_PATH, DATA_DIR };
