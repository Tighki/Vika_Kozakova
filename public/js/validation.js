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

const FIELD_MAP = {
  no_phone_in_email: 'email',
  no_digits_in_name: 'full_name',
  strong_password: 'password',
  passwords_match: 'password_confirm',
  doc_number_format: 'doc_number',
  no_phone_in_content: 'content',
  title_min_length: 'title',
};

function getEnabledRules(form) {
  const enabled = [];
  form.querySelectorAll('input[type="checkbox"][name^="rules_"]:checked').forEach((cb) => {
    const id = cb.name.replace('rules_', '');
    enabled.push(id);
  });
  return enabled;
}

function getFormData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (!key.startsWith('rules_')) {
      data[key] = value;
    }
  });
  return data;
}

function validateForm(form) {
  const enabled = getEnabledRules(form);
  if (!enabled.length) return [];

  const data = getFormData(form);
  const errors = [];
  const errorFields = new Set();

  form.querySelectorAll('.field-error').forEach((el) => el.classList.remove('field-error'));

  for (const ruleId of enabled) {
    const rule = RULES[ruleId];
    if (rule && !rule(data)) {
      errors.push(RULE_MESSAGES[ruleId] || `Нарушено правило: ${ruleId}`);
      const fieldName = FIELD_MAP[ruleId];
      if (fieldName) {
        errorFields.add(fieldName);
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field) field.classList.add('field-error');
      }
    }
  }

  return errors;
}

function setupValidation() {
  const registerForm = document.getElementById('register-form');
  const documentForm = document.getElementById('document-form');

  [registerForm, documentForm].filter(Boolean).forEach((form) => {
    form.addEventListener('submit', (e) => {
      const errors = validateForm(form);
      const errorBox = form.querySelector('#client-errors');

      if (errors.length) {
        e.preventDefault();
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = '<ul>' + errors.map((err) => `<li>${err}</li>`).join('') + '</ul>';
        }
      } else if (errorBox) {
        errorBox.style.display = 'none';
      }
    });

    form.querySelectorAll('input[type="checkbox"][name^="rules_"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const errorBox = form.querySelector('#client-errors');
        if (errorBox) errorBox.style.display = 'none';
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', setupValidation);
