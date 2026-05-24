const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ROLES } = require('../../shared/constants/roles');
const { USER_STATUS } = require('../../shared/constants/status');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    avatar: {
      url: String,
      publicId: String,
    },
    bio: {
      type: String,
      maxlength: 160,
      default: '',
    },
    /**
     * Social links — each stored as a plain string (URL or handle).
     * Validation of format is done at the service layer, not schema-level,
     * so we can add new platforms without a schema migration.
     */
    socialLinks: {
      website: { type: String, trim: true, maxlength: 200, default: '' },
      github: { type: String, trim: true, maxlength: 100, default: '' },
      twitter: { type: String, trim: true, maxlength: 100, default: '' },
      instagram: { type: String, trim: true, maxlength: 100, default: '' },
      linkedin: { type: String, trim: true, maxlength: 100, default: '' },
    },
    /**
     * Who can see this user's full profile.
     *   public   → anyone (including unauthenticated, future)
     *   contacts → only accepted contacts see full details; others see a stub
     *   private  → returns 404 to all except the owner (account is invisible)
     */
    profileVisibility: {
      type: String,
      enum: ['public', 'contacts', 'private'],
      default: 'public',
    },
    /**
     * Granular user preferences. Stored as a nested doc rather than a separate
     * collection — settings belong exclusively to one user and are always
     * fetched together with the user. Add new keys without a migration.
     */
    settings: {
      notifications: {
        messages: { type: Boolean, default: true },
        contactRequests: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
      },
      privacy: {
        showLastSeen: { type: Boolean, default: true },
        showOnlineStatus: { type: Boolean, default: true },
      },
    },
    /**
     * Tracks the last time the username was changed.
     * Used to enforce a 3-day cooldown between username updates.
     */
    usernameChangedAt: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.OFFLINE,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// email and username indexes are created automatically by `unique: true` on the field definition

const User = mongoose.model('User', userSchema);

module.exports = { User };
