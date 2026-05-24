const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
});

const ROLE_HIERARCHY = Object.freeze({
  [ROLES.USER]: 0,
  [ROLES.MODERATOR]: 1,
  [ROLES.ADMIN]: 2,
});

module.exports = { ROLES, ROLE_HIERARCHY };
