const RULE_SPECS = {
  no_phone_in_email: {
    label: 'Email без номера телефона',
    message: 'Email не должен содержать номер телефона (7+ цифр подряд).',
    field: 'email',
    test: (d) => !d.email || !/\d{7,}/.test(d.email),
  },
  no_digits_in_name: {
    label: 'ФИО без цифр',
    message: 'ФИО должно содержать только буквы, пробелы и дефис.',
    field: 'full_name',
    test: (d) => !d.full_name || /^[\p{L}\s\-]+$/u.test(d.full_name.trim()),
  },
  strong_password: {
    label: 'Надёжный пароль',
    message: 'Пароль: минимум 8 символов, буква и цифра.',
    field: 'password',
    test: (d) => {
      const p = d.password || '';
      return p.length >= 8 && /[a-zA-Zа-яА-ЯёЁ]/.test(p) && /\d/.test(p);
    },
  },
  passwords_match: {
    label: 'Пароли совпадают',
    message: 'Пароли не совпадают.',
    field: 'password_confirm',
    test: (d) => !d.password_confirm || d.password === d.password_confirm,
  },
  doc_number_format: {
    label: 'Формат номера документа',
    message: 'Номер документа: формат БУКВЫ-ГГГГ-NNN (например ВХ-2026-001).',
    field: 'doc_number',
    test: (d) => !d.doc_number || /^[А-ЯA-Z]{2,4}-\d{4}-\d{3}$/u.test(d.doc_number.trim()),
  },
  no_phone_in_content: {
    label: 'Текст без телефонов',
    message: 'Текст документа не должен содержать телефонные номера.',
    field: 'content',
    test: (d) => !d.content || !/(?:\+?\d[\d\s\-()]{6,}\d)/.test(d.content),
  },
  title_min_length: {
    label: 'Заголовок от 5 символов',
    message: 'Заголовок должен содержать минимум 5 символов.',
    field: 'title',
    test: (d) => !d.title || d.title.trim().length >= 5,
  },
};

const REGISTER_RULES = ['no_phone_in_email', 'no_digits_in_name', 'strong_password', 'passwords_match'];
const DOCUMENT_RULES = ['doc_number_format', 'no_phone_in_content', 'title_min_length'];

const RULE_LABELS = Object.fromEntries(Object.entries(RULE_SPECS).map(([k, v]) => [k, v.label]));

function parseEnabledRules(body) {
  return Object.keys(RULE_SPECS).filter((id) => body[`rules_${id}`] === 'on' || body[`rules_${id}`] === '1');
}

function resolveRules(body, defaults) {
  const enabled = parseEnabledRules(body);
  return enabled.length ? enabled : defaults;
}

function validateWithRules(data, ids) {
  return ids
    .filter((id) => RULE_SPECS[id] && !RULE_SPECS[id].test(data))
    .map((id) => RULE_SPECS[id].message);
}

function getClientValidationScript() {
  const messages = {};
  const fields = {};
  const tests = [];
  for (const [id, spec] of Object.entries(RULE_SPECS)) {
    messages[id] = spec.message;
    if (spec.field) fields[id] = spec.field;
    tests.push(`${JSON.stringify(id)}:${spec.test.toString()}`);
  }
  return `'use strict';const M=${JSON.stringify(messages)};const F=${JSON.stringify(fields)};const T={${tests.join(',')}};document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#register-form,#document-form').forEach(f=>{f.addEventListener('submit',e=>{const on=[...f.querySelectorAll('input[name^=rules_]:checked')].map(c=>c.name.slice(6));if(!on.length)return;const d=Object.fromEntries([...new FormData(f)].filter(([k])=>!k.startsWith('rules_')));const err=[];f.querySelectorAll('.field-error').forEach(el=>el.classList.remove('field-error'));on.forEach(id=>{if(T[id]&&!T[id](d)){err.push(M[id]);const n=F[id];if(n)f.querySelector('[name="'+n+'"]')?.classList.add('field-error');}});if(err.length){e.preventDefault();const b=f.querySelector('#client-errors');if(b){b.hidden=false;b.innerHTML='<ul>'+err.map(x=>'<li>'+x+'</li>').join('')+'</ul>';}}});f.querySelectorAll('input[name^=rules_]').forEach(cb=>cb.addEventListener('change',()=>{const b=f.querySelector('#client-errors');if(b)b.hidden=true;}));});});`;
}

module.exports = {
  RULE_LABELS,
  REGISTER_RULES,
  DOCUMENT_RULES,
  parseEnabledRules,
  resolveRules,
  validateWithRules,
  getClientValidationScript,
};
