const RULES = {
  no_phone_in_email: (data) => !data.email || !/\d{7,}/.test(data.email),

  no_digits_in_name: (data) =>
    !data.full_name || /^[\p{L}\s\-]+$/u.test(data.full_name.trim()),

  strong_password: (data) => {
    const pwd = data.password || '';
    return pwd.length >= 8 && /[a-zA-Zа-яА-ЯёЁ]/.test(pwd) && /\d/.test(pwd);
  },

  passwords_match: (data) => {
    if (!data.password_confirm) return true;
    return data.password === data.password_confirm;
  },

  doc_number_format: (data) => {
    if (!data.doc_number) return true;
    return /^[А-ЯA-Z]{2,4}-\d{4}-\d{3}$/u.test(data.doc_number.trim());
  },

  no_phone_in_content: (data) => {
    if (!data.content) return true;
    return !/(?:\+?\d[\d\s\-()]{6,}\d)/.test(data.content);
  },

  title_min_length: (data) => {
    if (!data.title) return true;
    return data.title.trim().length >= 5;
  },
};

const RULE_MESSAGES = {
  no_phone_in_email: 'Email не должен содержать номер телефона (7+ цифр подряд).',
  no_digits_in_name: 'ФИО должно содержать только буквы, пробелы и дефис.',
  strong_password: 'Пароль: минимум 8 символов, буква и цифра.',
  passwords_match: 'Пароли не совпадают.',
  doc_number_format: 'Номер документа: формат БУКВЫ-ГГГГ-NNN (например ВХ-2026-001).',
  no_phone_in_content: 'Текст документа не должен содержать телефонные номера.',
  title_min_length: 'Заголовок должен содержать минимум 5 символов.',
};

const RULE_LABELS = {
  no_phone_in_email: 'Email без номера телефона',
  no_digits_in_name: 'ФИО без цифр',
  strong_password: 'Надёжный пароль',
  passwords_match: 'Пароли совпадают',
  doc_number_format: 'Формат номера документа',
  no_phone_in_content: 'Текст без телефонов',
  title_min_length: 'Заголовок от 5 символов',
};

const REGISTER_RULES = ['no_phone_in_email', 'no_digits_in_name', 'strong_password', 'passwords_match'];
const DOCUMENT_RULES = [
  'doc_number_format',
  'no_phone_in_content',
  'title_min_length',
];

function parseEnabledRules(body, prefix = 'rules') {
  const enabled = [];
  for (const key of Object.keys(RULES)) {
    if (body[`${prefix}_${key}`] === 'on' || body[`${prefix}_${key}`] === '1') {
      enabled.push(key);
    }
  }
  if (Array.isArray(body[prefix])) {
    enabled.push(...body[prefix]);
  }
  return [...new Set(enabled)];
}

function validateWithRules(data, enabledRuleIds) {
  const errors = [];
  for (const id of enabledRuleIds) {
    const rule = RULES[id];
    if (rule && !rule(data)) {
      errors.push(RULE_MESSAGES[id] || `Нарушено правило: ${id}`);
    }
  }
  return errors;
}

module.exports = {
  RULES,
  RULE_MESSAGES,
  RULE_LABELS,
  REGISTER_RULES,
  DOCUMENT_RULES,
  parseEnabledRules,
  validateWithRules,
};
