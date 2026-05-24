/**
 * Validation schemas for user endpoints.
 * Used with the shared validate() middleware in core/middleware/validate.middleware.js.
 *
 * Schema shape: { fieldName: { required, type, minLength, maxLength, pattern, custom } }
 */

const USERNAME_REGEX = /^[a-z0-9_]+$/;

const updateProfileSchema = {
  displayName: {
    maxLength: 60,
  },
  bio: {
    maxLength: 160,
  },
  profileVisibility: {
    custom: (value) => {
      if (value !== undefined && !['public', 'contacts', 'private'].includes(value)) {
        return 'profileVisibility must be one of: public, contacts, private';
      }
    },
  },
  socialLinks: {
    custom: (value) => {
      if (value === undefined) return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        return 'socialLinks must be an object';
      }
      const allowed = ['website', 'github', 'twitter', 'instagram', 'linkedin'];
      const keys = Object.keys(value);
      const invalid = keys.filter((k) => !allowed.includes(k));
      if (invalid.length > 0) {
        return `socialLinks contains unknown keys: ${invalid.join(', ')}`;
      }
      for (const [, val] of Object.entries(value)) {
        if (val !== undefined && val !== null && typeof val !== 'string') {
          return 'All socialLinks values must be strings';
        }
      }
    },
  },
};

const updateUsernameSchema = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: USERNAME_REGEX,
    patternMessage: 'Username can only contain lowercase letters, numbers, and underscores',
  },
};

const updateSettingsSchema = {
  notifications: {
    custom: (value) => {
      if (value === undefined) return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        return 'notifications must be an object';
      }
    },
  },
  privacy: {
    custom: (value) => {
      if (value === undefined) return;
      if (typeof value !== 'object' || Array.isArray(value)) {
        return 'privacy must be an object';
      }
    },
  },
};

// ─── Contact schemas ─────────────────────────────────────────────────────────

const contactRequestSchema = {
  userId: {
    required: true,
    minLength: 1,
  },
};

// accept / reject / remove / block / unblock all take the same shape
const contactActionSchema = {
  userId: {
    required: true,
    minLength: 1,
  },
};

module.exports = {
  updateProfileSchema,
  updateUsernameSchema,
  updateSettingsSchema,
  contactRequestSchema,
  contactActionSchema,
};
