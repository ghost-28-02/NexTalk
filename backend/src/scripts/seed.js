/**
 * seed.js — Populate MongoDB with development data that mirrors
 * the frontend mock files (mock/users.js, chats.js, messages.js, notifications.js).
 *
 * Safe to re-run: clears all seed collections first, then re-inserts.
 *
 * Usage (from backend/ directory):
 *   node src/scripts/seed.js
 *
 * Default password for every seed user: Password123!
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const { connectDatabase, disconnectDatabase } = require('../config/database.config');
const { User }         = require('../database/models/User.model');
const { Chat, CHAT_TYPES } = require('../database/models/Chat.model');
const { Message, MESSAGE_TYPES } = require('../database/models/Message.model');
const { Notification, NOTIFICATION_TYPES } = require('../database/models/Notification.model');
const { Contact, CONTACT_STATUS } = require('../database/models/Contact.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function minutesAgo(n) {
  return new Date(Date.now() - n * 60 * 1000);
}

// ─── Raw seed data (mirrors frontend mock files) ──────────────────────────────

const SEED_PASSWORD = 'Password123!';

/**
 * users[i].mockId is the mock "user-N" id — used to wire up chats/messages.
 * users[i].username is lowercase, trimmed (User model enforces lowercase).
 */
const RAW_USERS = [
  {
    mockId:      'user-1',
    username:    'alexmorgan',
    email:       'alex@nextalk.app',
    firstName:   'Alex',
    lastName:    'Morgan',
    displayName: 'Alex Morgan',
    bio:         'Product Designer | Coffee Enthusiast',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    status:      'online',
    isEmailVerified: true,
  },
  {
    mockId:      'user-2',
    username:    'sarahchen',
    email:       'sarah@example.com',
    firstName:   'Sarah',
    lastName:    'Chen',
    displayName: 'Sarah Chen',
    bio:         'Full Stack Developer',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    status:      'online',
    isEmailVerified: true,
  },
  {
    mockId:      'user-3',
    username:    'marcusjohnson',
    email:       'marcus@example.com',
    firstName:   'Marcus',
    lastName:    'Johnson',
    displayName: 'Marcus Johnson',
    bio:         'UI/UX Designer',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    status:      'away',
    lastSeenAt:  minutesAgo(5),
    isEmailVerified: true,
  },
  {
    mockId:      'user-4',
    username:    'emilydavis',
    email:       'emily@example.com',
    firstName:   'Emily',
    lastName:    'Davis',
    displayName: 'Emily Davis',
    bio:         'Project Manager',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    status:      'offline',
    lastSeenAt:  hoursAgo(2),
    isEmailVerified: true,
  },
  {
    mockId:      'user-5',
    username:    'jameswilson',
    email:       'james@example.com',
    firstName:   'James',
    lastName:    'Wilson',
    displayName: 'James Wilson',
    bio:         'Backend Engineer',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    status:      'online',
    isEmailVerified: true,
  },
  {
    mockId:      'user-6',
    username:    'lisapark',
    email:       'lisa@example.com',
    firstName:   'Lisa',
    lastName:    'Park',
    displayName: 'Lisa Park',
    bio:         'Marketing Lead',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
    status:      'busy',
    isEmailVerified: true,
  },
  {
    mockId:      'user-7',
    username:    'davidkim',
    email:       'david@example.com',
    firstName:   'David',
    lastName:    'Kim',
    displayName: 'David Kim',
    bio:         'DevOps Engineer',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    status:      'online',
    isEmailVerified: true,
  },
  {
    mockId:      'user-8',
    username:    'rachelgreen',
    email:       'rachel@example.com',
    firstName:   'Rachel',
    lastName:    'Green',
    displayName: 'Rachel Green',
    bio:         'Content Writer',
    avatarUrl:   'https://api.dicebear.com/7.x/avataaars/svg?seed=Rachel',
    status:      'offline',
    lastSeenAt:  daysAgo(1),
    isEmailVerified: true,
  },
];

// ─── Seed logic ───────────────────────────────────────────────────────────────

async function clearCollections() {
  console.log('  🗑  Clearing existing data…');
  await Promise.all([
    User.deleteMany({}),
    Chat.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Contact.deleteMany({}),
  ]);
  console.log('  ✓  Collections cleared');
}

async function seedUsers() {
  console.log('  👤  Seeding users…');

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  const docs = RAW_USERS.map((u) => ({
    username:        u.username,
    email:           u.email,
    password:        hashedPassword,
    firstName:       u.firstName,
    lastName:        u.lastName,
    displayName:     u.displayName,
    bio:             u.bio,
    avatar:          { url: u.avatarUrl, publicId: '' },
    status:          u.status,
    lastSeenAt:      u.lastSeenAt || new Date(),
    isEmailVerified: u.isEmailVerified,
    isActive:        true,
  }));

  // insertMany skips pre-save hooks — password is already hashed above.
  const inserted = await User.insertMany(docs, { ordered: true });

  // Build a mockId → ObjectId lookup table used everywhere below.
  const userMap = {};
  inserted.forEach((doc, i) => {
    userMap[RAW_USERS[i].mockId] = doc._id;
  });

  console.log(`  ✓  ${inserted.length} users created`);
  return userMap; // e.g. { 'user-1': ObjectId, 'user-2': ObjectId, … }
}

async function seedContacts(userMap) {
  console.log('  🤝  Seeding contacts…');

  // Alex is contacts with everyone he chats with
  const alexId = userMap['user-1'];
  const partners = ['user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8'];

  const docs = partners.map((mockId) => ({
    requester:   alexId,
    recipient:   userMap[mockId],
    status:      CONTACT_STATUS.ACCEPTED,
    requestedAt: daysAgo(30),
    respondedAt: daysAgo(29),
  }));

  await Contact.insertMany(docs);
  console.log(`  ✓  ${docs.length} contact relationships created`);
}

async function seedChats(userMap) {
  console.log('  💬  Seeding chats…');

  const alex   = userMap['user-1'];
  const sarah  = userMap['user-2'];
  const marcus = userMap['user-3'];
  const emily  = userMap['user-4'];
  const james  = userMap['user-5'];
  const lisa   = userMap['user-6'];
  const david  = userMap['user-7'];
  const rachel = userMap['user-8'];

  /**
   * member(userId, opts) — builds a members-subdoc.
   * `opts.unread`  — unreadCount (default 0)
   * `opts.pinned`  — isPinned (default false)
   * `opts.muted`   — isMuted (default false)
   * `opts.role`    — 'admin' | 'member' (default 'member')
   */
  function member(userId, opts = {}) {
    return {
      user:        userId,
      role:        opts.role       ?? 'member',
      joinedAt:    opts.joinedAt   ?? daysAgo(60),
      lastReadAt:  opts.lastReadAt ?? null,
      unreadCount: opts.unread     ?? 0,
      isPinned:    opts.pinned     ?? false,
      isMuted:     opts.muted      ?? false,
    };
  }

  const chatDocs = [
    // ── chat-1: Alex ↔ Sarah (pinned by Alex, 2 unread for Alex) ─────────────
    {
      _mockId: 'chat-1',
      type:    CHAT_TYPES.DIRECT,
      members: [
        member(alex,  { role: 'admin', pinned: true, unread: 2 }),
        member(sarah, { role: 'admin' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-15'),
      updatedAt:  new Date('2024-01-15'),
      isActive:   true,
    },

    // ── chat-2: Alex ↔ Marcus (no unread) ────────────────────────────────────
    {
      _mockId: 'chat-2',
      type:    CHAT_TYPES.DIRECT,
      members: [
        member(alex,   { role: 'admin' }),
        member(marcus, { role: 'admin' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-12'),
      updatedAt:  new Date('2024-01-12'),
      isActive:   true,
    },

    // ── chat-3: Alex ↔ Emily (1 unread for Alex) ─────────────────────────────
    {
      _mockId: 'chat-3',
      type:    CHAT_TYPES.DIRECT,
      members: [
        member(alex,  { role: 'admin', unread: 1 }),
        member(emily, { role: 'admin' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-08'),
      updatedAt:  new Date('2024-01-08'),
      isActive:   true,
    },

    // ── chat-4: Alex ↔ James (no unread) ────────────────────────────────────
    {
      _mockId: 'chat-4',
      type:    CHAT_TYPES.DIRECT,
      members: [
        member(alex,  { role: 'admin' }),
        member(james, { role: 'admin' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-05'),
      updatedAt:  new Date('2024-01-05'),
      isActive:   true,
    },

    // ── chat-group-1: Project Alpha Team (Alex, Sarah, Marcus, Lisa, David) ──
    {
      _mockId:     'chat-group-1',
      type:        CHAT_TYPES.GROUP,
      name:        'Project Alpha Team',
      description: 'Syncing on project deliverables and milestones',
      avatar:      { url: 'https://api.dicebear.com/7.x/shapes/svg?seed=alpha', publicId: '' },
      members: [
        member(alex,   { role: 'admin', pinned: true, unread: 5 }),
        member(sarah,  { role: 'member' }),
        member(marcus, { role: 'member' }),
        member(lisa,   { role: 'member' }),
        member(david,  { role: 'member' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-10'),
      updatedAt:  new Date('2024-01-10'),
      isActive:   true,
    },

    // ── chat-group-2: Design System (Alex, Sarah, Marcus, Rachel) — muted ────
    {
      _mockId:     'chat-group-2',
      type:        CHAT_TYPES.GROUP,
      name:        'Design System',
      description: 'Collaborative design system discussions and component reviews',
      avatar:      { url: 'https://api.dicebear.com/7.x/shapes/svg?seed=design', publicId: '' },
      members: [
        member(alex,   { role: 'admin', muted: true }),
        member(sarah,  { role: 'member' }),
        member(marcus, { role: 'member' }),
        member(rachel, { role: 'member' }),
      ],
      createdBy:  alex,
      createdAt:  new Date('2024-01-01'),
      updatedAt:  new Date('2024-01-01'),
      isActive:   true,
    },
  ];

  // Strip the _mockId helper field before inserting
  const cleanDocs = chatDocs.map(({ _mockId, ...rest }) => rest);

  // Use insertMany — but we need the _ids back alongside the mockIds
  const inserted = await Chat.insertMany(cleanDocs, { ordered: true });

  // Build chatMap: mockId → ObjectId
  const chatMap = {};
  inserted.forEach((doc, i) => {
    chatMap[chatDocs[i]._mockId] = doc._id;
  });

  console.log(`  ✓  ${inserted.length} chats created`);
  return chatMap;
}

async function seedMessages(userMap, chatMap) {
  console.log('  📨  Seeding messages…');

  const alex   = userMap['user-1'];
  const sarah  = userMap['user-2'];
  const marcus = userMap['user-3'];
  const emily  = userMap['user-4'];
  const james  = userMap['user-5'];
  const david  = userMap['user-7'];

  /**
   * msg(chatMockId, senderMockId, content, status, createdAt)
   */
  function msg(chatMockId, senderMockId, content, status, createdAt) {
    return {
      chat:      chatMap[chatMockId],
      sender:    userMap[senderMockId],
      type:      MESSAGE_TYPES.TEXT,
      content,
      status,
      createdAt,
      updatedAt: createdAt,
      isDeleted: false,
    };
  }

  const today = new Date();
  const yesterday = daysAgo(1);
  const twoDaysAgo = daysAgo(2);

  function todayAt(h, m) {
    const d = new Date(today);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function yesterdayAt(h, m) {
    const d = new Date(yesterday);
    d.setHours(h, m, 0, 0);
    return d;
  }

  const rawMessages = [
    // ── chat-1: Alex ↔ Sarah ─────────────────────────────────────────────────
    msg('chat-1', 'user-2', "Hey! How's the new project coming along?",              'read',      todayAt(10, 30)),
    msg('chat-1', 'user-1', 'Going great! Just finished the design mockups. Want to review them?', 'read', todayAt(10, 32)),
    msg('chat-1', 'user-2', "Absolutely! Send them over when you're ready.",         'read',      todayAt(10, 33)),
    msg('chat-1', 'user-1', "Perfect. I'll share the Figma link in a bit.",          'delivered', todayAt(10, 35)),
    msg('chat-1', 'user-2', 'Sounds good! Also, are you joining the team standup at 2?', 'read', todayAt(10, 40)),
    msg('chat-1', 'user-1', "Yes, I'll be there. Need to discuss the timeline.",     'sent',      todayAt(10, 42)),

    // ── chat-2: Alex ↔ Marcus ────────────────────────────────────────────────
    msg('chat-2', 'user-3', 'The new landing page looks amazing!',                   'read',      todayAt(9, 15)),
    msg('chat-2', 'user-1', 'Thanks! Took a while to get the animations right.',     'read',      todayAt(9, 20)),

    // ── chat-3: Alex ↔ Emily ─────────────────────────────────────────────────
    msg('chat-3', 'user-4', 'Can you send me the updated requirements doc?',         'read',      yesterdayAt(14, 0)),

    // ── chat-4: Alex ↔ James ─────────────────────────────────────────────────
    msg('chat-4', 'user-5', 'Let me check the deployment status.',                   'read',      new Date(twoDaysAgo.setHours(11, 0, 0, 0))),

    // ── chat-group-1: Project Alpha Team ─────────────────────────────────────
    msg('chat-group-1', 'user-5', 'Team, we need to finalize the API specs today.',  'read',      todayAt(11, 0)),
    msg('chat-group-1', 'user-2', "I've updated the endpoints. Check the wiki.",     'read',      todayAt(11, 5)),
    msg('chat-group-1', 'user-7', 'Will review and merge the PR this afternoon.',    'read',      todayAt(11, 10)),
    msg('chat-group-1', 'user-1', "Great progress everyone! Let's sync up tomorrow.", 'sent',     todayAt(11, 15)),

    // ── chat-group-2: Design System ──────────────────────────────────────────
    msg('chat-group-2', 'user-3', 'New components are ready for review',             'read',      yesterdayAt(16, 30)),
  ];

  const inserted = await Message.insertMany(rawMessages, { ordered: true });

  // Map chatMockId → last inserted message _id (for lastMessage pointer)
  // Build: { 'chat-1': [msg_ids…], … } then pick last
  const chatLastMsg = {};
  rawMessages.forEach((raw, i) => {
    const chatMockId = Object.keys(chatMap).find((k) => chatMap[k].toString() === raw.chat.toString());
    if (chatMockId) {
      chatLastMsg[chatMockId] = inserted[i]._id; // keeps overwriting → ends up as last
    }
  });

  console.log(`  ✓  ${inserted.length} messages created`);
  return { inserted, chatLastMsg };
}

async function updateLastMessages(chatMap, chatLastMsg) {
  console.log('  🔗  Linking lastMessage pointers…');

  const updates = Object.entries(chatLastMsg).map(([mockId, msgId]) =>
    Chat.updateOne({ _id: chatMap[mockId] }, { $set: { lastMessage: msgId } })
  );

  await Promise.all(updates);
  console.log(`  ✓  lastMessage set for ${updates.length} chats`);
}

async function seedNotifications(userMap, chatMap) {
  console.log('  🔔  Seeding notifications…');

  const alex   = userMap['user-1']; // recipient for all notifications
  const sarah  = userMap['user-2'];
  const marcus = userMap['user-3'];
  const james  = userMap['user-5'];

  const now = new Date();

  const docs = [
    // notif-1: Sarah sent Alex a message
    {
      recipient:  alex,
      sender:     sarah,
      type:       NOTIFICATION_TYPES.MESSAGE,
      title:      'Sarah Chen',
      body:       'Sent you a message',
      isRead:     false,
      data:       { chatId: chatMap['chat-1'].toString() },
      createdAt:  minutesAgo(2),
    },
    // notif-2: Missed call from Marcus
    {
      recipient:  alex,
      sender:     marcus,
      type:       NOTIFICATION_TYPES.CALL,
      title:      'Missed call',
      body:       'Marcus Johnson tried to call you',
      isRead:     false,
      data:       {},
      createdAt:  minutesAgo(15),
    },
    // notif-3: James mentioned Alex in Project Alpha Team
    {
      recipient:  alex,
      sender:     james,
      type:       NOTIFICATION_TYPES.MENTION,
      title:      'Project Alpha Team',
      body:       'James mentioned you in a message',
      isRead:     true,
      readAt:     hoursAgo(0.5),
      data:       { chatId: chatMap['chat-group-1'].toString() },
      createdAt:  hoursAgo(1),
    },
    // notif-4: System notification — new feature
    {
      recipient:  alex,
      sender:     null,
      type:       NOTIFICATION_TYPES.SYSTEM,
      title:      'New feature available',
      body:       'Video calls now support screen sharing',
      isRead:     true,
      readAt:     daysAgo(0),
      data:       {},
      createdAt:  daysAgo(1),
    },
    // notif-5: Design System group activity
    {
      recipient:  alex,
      sender:     null,
      type:       NOTIFICATION_TYPES.MESSAGE,
      title:      'Design System',
      body:       'Lisa shared 3 new files',
      isRead:     true,
      readAt:     daysAgo(0),
      data:       { chatId: chatMap['chat-group-2'].toString() },
      createdAt:  daysAgo(1),
    },
  ];

  await Notification.insertMany(docs);
  console.log(`  ✓  ${docs.length} notifications created`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  NexTalk seed script starting…\n');

  await connectDatabase();

  await clearCollections();

  const userMap = await seedUsers();
  await seedContacts(userMap);

  const chatMap = await seedChats(userMap);
  const { chatLastMsg } = await seedMessages(userMap, chatMap);
  await updateLastMessages(chatMap, chatLastMsg);
  await seedNotifications(userMap, chatMap);

  console.log('\n✅  Seed complete!\n');
  console.log('  Login credentials (all users):');
  console.log('  ┌──────────────────────────────────┬──────────────────┬──────────────┐');
  console.log('  │ Name                             │ Email            │ Password     │');
  console.log('  ├──────────────────────────────────┼──────────────────┼──────────────┤');
  const rows = [
    ['Alex Morgan (currentUser)', 'alex@nextalk.app',  SEED_PASSWORD],
    ['Sarah Chen',                'sarah@example.com', SEED_PASSWORD],
    ['Marcus Johnson',            'marcus@example.com',SEED_PASSWORD],
    ['Emily Davis',               'emily@example.com', SEED_PASSWORD],
    ['James Wilson',              'james@example.com', SEED_PASSWORD],
    ['Lisa Park',                 'lisa@example.com',  SEED_PASSWORD],
    ['David Kim',                 'david@example.com', SEED_PASSWORD],
    ['Rachel Green',              'rachel@example.com',SEED_PASSWORD],
  ];
  rows.forEach(([name, email, pass]) => {
    console.log(`  │ ${name.padEnd(32)} │ ${email.padEnd(16)} │ ${pass.padEnd(12)} │`);
  });
  console.log('  └──────────────────────────────────┴──────────────────┴──────────────┘\n');

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
