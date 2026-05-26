const TYPE_LABELS = { incoming: 'Входящий', outgoing: 'Исходящий', internal: 'Внутренний' };
const STATUS_LABELS = {
  draft: 'Черновик',
  pending: 'На согласовании',
  approved: 'Утверждён',
  rejected: 'Отклонён',
};
const STATUS_KEYS = Object.keys(STATUS_LABELS);

module.exports = { TYPE_LABELS, STATUS_LABELS, STATUS_KEYS };
