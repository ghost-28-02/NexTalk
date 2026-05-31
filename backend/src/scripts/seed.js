/**
 * seed.js — Large Indian dataset with Hinglish chats.
 * Usage: node src/scripts/seed.js
 * Password for all users: Password123!
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcrypt');
const { connectDatabase, disconnectDatabase } = require('../config/database.config');
const { User }                    = require('../database/models/User.model');
const { Chat, CHAT_TYPES }        = require('../database/models/Chat.model');
const { Message, MESSAGE_TYPES }  = require('../database/models/Message.model');
const { Notification, NOTIFICATION_TYPES } = require('../database/models/Notification.model');
const { Contact, CONTACT_STATUS } = require('../database/models/Contact.model');

function daysAgo(n)         { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function hoursAgo(n)        { return new Date(Date.now() - n * 3600000); }
function minutesAgo(n)      { return new Date(Date.now() - n * 60000); }
function todayAt(h,m)       { const d = new Date(); d.setHours(h,m,0,0); return d; }
function yesterdayAt(h,m)   { const d = daysAgo(1); d.setHours(h,m,0,0); return d; }
function dAt(n,h,m)         { const d = daysAgo(n); d.setHours(h,m,0,0); return d; }

const SEED_PASSWORD = 'Password123!';

const RAW_USERS = [
  { mockId:'u1',  username:'arjunsharma',   email:'arjun@nextalk.app',    firstName:'Arjun',    lastName:'Sharma',    displayName:'Arjun Sharma',    bio:'Full Stack Dev | Chai addict | Mumbai',              status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=arjunsharma',   isEmailVerified:true },
  { mockId:'u2',  username:'priyapatel',    email:'priya@example.com',    firstName:'Priya',    lastName:'Patel',     displayName:'Priya Patel',     bio:'UI/UX Designer | Ahmedabad | Dog mom',               status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=priyapatel',    isEmailVerified:true },
  { mockId:'u3',  username:'rohankumar',    email:'rohan@example.com',    firstName:'Rohan',    lastName:'Kumar',     displayName:'Rohan Kumar',     bio:'Backend Engineer @ Razorpay | Delhi',                status:'away',    lastSeenAt:minutesAgo(10), avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=rohankumar',    isEmailVerified:true },
  { mockId:'u4',  username:'snehadesai',    email:'sneha@example.com',    firstName:'Sneha',    lastName:'Desai',     displayName:'Sneha Desai',     bio:'Product Manager | Pune | Chai > Coffee',             status:'offline', lastSeenAt:hoursAgo(3),    avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=snehadesai',    isEmailVerified:true },
  { mockId:'u5',  username:'vikramsingh',   email:'vikram@example.com',   firstName:'Vikram',   lastName:'Singh',     displayName:'Vikram Singh',    bio:'DevOps | Bangalore | Cricket fanatic',               status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=vikramsingh',   isEmailVerified:true },
  { mockId:'u6',  username:'ananyarao',     email:'ananya@example.com',   firstName:'Ananya',   lastName:'Rao',       displayName:'Ananya Rao',      bio:'Data Scientist | Hyderabad | Biryani lover',         status:'busy',    avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=ananyarao',     isEmailVerified:true },
  { mockId:'u7',  username:'kabirmehta',    email:'kabir@example.com',    firstName:'Kabir',    lastName:'Mehta',     displayName:'Kabir Mehta',     bio:'Startup founder | Jaipur | Building something cool', status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=kabirmehta',    isEmailVerified:true },
  { mockId:'u8',  username:'ishagupta',     email:'isha@example.com',     firstName:'Isha',     lastName:'Gupta',     displayName:'Isha Gupta',      bio:'Content creator | Delhi | Books & coffee',           status:'offline', lastSeenAt:daysAgo(1),     avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=ishagupta',     isEmailVerified:true },
  { mockId:'u9',  username:'aditya_joshi',  email:'aditya@example.com',   firstName:'Aditya',   lastName:'Joshi',     displayName:'Aditya Joshi',    bio:'Android Dev | Nagpur | Gamer at heart',              status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=adityajoshi',   isEmailVerified:true },
  { mockId:'u10', username:'nisha_verma',   email:'nisha@example.com',    firstName:'Nisha',    lastName:'Verma',     displayName:'Nisha Verma',     bio:'HR Manager | Lucknow | Chai lover',                  status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=nishaverma',    isEmailVerified:true },
  { mockId:'u11', username:'sameer_khan',   email:'sameer@example.com',   firstName:'Sameer',   lastName:'Khan',      displayName:'Sameer Khan',     bio:'Finance | Mumbai | Stocks & Crypto',                 status:'offline', lastSeenAt:hoursAgo(5),    avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=sameerkhan',    isEmailVerified:true },
  { mockId:'u12', username:'deepika_nair',  email:'deepika@example.com',  firstName:'Deepika',  lastName:'Nair',      displayName:'Deepika Nair',    bio:'Frontend Dev | Kochi | Coffee & code',               status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=deepikanair',   isEmailVerified:true },
  { mockId:'u13', username:'rahul_mishra',  email:'rahul@example.com',    firstName:'Rahul',    lastName:'Mishra',    displayName:'Rahul Mishra',    bio:'Cloud Architect | Bhopal | Photography hobby',       status:'away',    lastSeenAt:minutesAgo(30), avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=rahulmishra',   isEmailVerified:true },
  { mockId:'u14', username:'pooja_saxena',  email:'pooja@example.com',    firstName:'Pooja',    lastName:'Saxena',    displayName:'Pooja Saxena',    bio:'Marketing | Indore | Foodie',                        status:'online',  avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=poojasaxena',   isEmailVerified:true },
  { mockId:'u15', username:'aryan_kapoor',  email:'aryan@example.com',    firstName:'Aryan',    lastName:'Kapoor',    displayName:'Aryan Kapoor',    bio:'ML Engineer | Chandigarh | F1 fan',                  status:'offline', lastSeenAt:daysAgo(2),     avatarUrl:'https://api.dicebear.com/7.x/avataaars/svg?seed=aryankapoor',   isEmailVerified:true },
];

async function clearCollections() {
  console.log('  Clearing collections...');
  await Promise.all([User.deleteMany({}), Chat.deleteMany({}), Message.deleteMany({}), Notification.deleteMany({}), Contact.deleteMany({})]);
  console.log('  Done');
}

async function seedUsers() {
  console.log('  Seeding 15 users...');
  const hash = await bcrypt.hash(SEED_PASSWORD, 12);
  const docs = RAW_USERS.map(u => ({
    username:u.username, email:u.email, password:hash,
    firstName:u.firstName, lastName:u.lastName, displayName:u.displayName,
    bio:u.bio, avatar:{url:u.avatarUrl, publicId:''},
    status:u.status, lastSeenAt:u.lastSeenAt||new Date(),
    isEmailVerified:u.isEmailVerified, isActive:true,
  }));
  const inserted = await User.insertMany(docs, {ordered:true});
  const userMap = {};
  inserted.forEach((doc,i) => { userMap[RAW_USERS[i].mockId] = doc._id; });
  console.log('  ' + inserted.length + ' users created');
  return userMap;
}

async function seedContacts(userMap) {
  console.log('  Seeding contacts...');
  const pairs = [
    // Arjun (u1) knows everyone
    ['u1','u2'],['u1','u3'],['u1','u4'],['u1','u5'],['u1','u6'],
    ['u1','u7'],['u1','u8'],['u1','u9'],['u1','u10'],['u1','u11'],
    ['u1','u12'],['u1','u13'],['u1','u14'],['u1','u15'],
    // Cross friendships
    ['u2','u3'],['u2','u4'],['u2','u7'],['u2','u8'],['u2','u12'],
    ['u3','u5'],['u3','u9'],['u3','u13'],['u3','u15'],
    ['u4','u6'],['u4','u10'],['u4','u14'],
    ['u5','u7'],['u5','u9'],['u5','u13'],
    ['u6','u12'],['u6','u14'],['u6','u15'],
    ['u7','u8'],['u7','u11'],
    ['u8','u10'],['u9','u12'],['u10','u14'],['u11','u13'],
  ];
  const docs = pairs.map(([a,b]) => ({
    requester:userMap[a], recipient:userMap[b],
    status:CONTACT_STATUS.ACCEPTED, requestedAt:daysAgo(30), respondedAt:daysAgo(29),
  }));
  await Contact.insertMany(docs);
  console.log('  ' + docs.length + ' contact pairs created');
}

async function seedChats(userMap) {
  console.log('  Seeding chats...');
  const u = id => userMap[id];
  function member(userId, opts={}) {
    return { user:userId, role:opts.role??'member', joinedAt:opts.joinedAt??daysAgo(60),
             lastReadAt:opts.lastReadAt??null, unreadCount:opts.unread??0,
             isPinned:opts.pinned??false, isMuted:opts.muted??false };
  }

  const chatDocs = [
    // Direct chats
    { _m:'c1',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin',pinned:true,unread:2}), member(u('u2'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c2',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u3'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c3',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin',unread:1}), member(u('u4'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c4',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u5'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c5',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u7'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c6',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin',unread:3}), member(u('u9'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c7',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u11'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c8',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u12'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c9',  type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u14'),{role:'admin'})], createdBy:u('u1'), isActive:true },
    { _m:'c10', type:CHAT_TYPES.DIRECT, members:[member(u('u1'),{role:'admin'}), member(u('u6'),{role:'admin'})],  createdBy:u('u1'), isActive:true },
    // Not involving Arjun
    { _m:'c11', type:CHAT_TYPES.DIRECT, members:[member(u('u2'),{role:'admin'}), member(u('u12'),{role:'admin'})], createdBy:u('u2'), isActive:true },
    { _m:'c12', type:CHAT_TYPES.DIRECT, members:[member(u('u3'),{role:'admin'}), member(u('u5'),{role:'admin'})],  createdBy:u('u3'), isActive:true },

    // Group chats
    { _m:'g1', type:CHAT_TYPES.GROUP, name:'NexTalk Dev Team',
      description:'Project updates, code reviews aur chai breaks',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=devteam',publicId:''},
      members:[member(u('u1'),{role:'admin',pinned:true,unread:5}), member(u('u3'),{role:'member'}), member(u('u5'),{role:'member'}), member(u('u7'),{role:'member'}), member(u('u6'),{role:'member'}), member(u('u9'),{role:'member'}), member(u('u12'),{role:'member'}), member(u('u15'),{role:'member'})],
      createdBy:u('u1'), isActive:true },

    { _m:'g2', type:CHAT_TYPES.GROUP, name:'Goa Trip 2025',
      description:'Hotel, flights, itinerary sab yahan plan karenge',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=goatrip',publicId:''},
      members:[member(u('u1'),{role:'admin',unread:4}), member(u('u2'),{role:'member'}), member(u('u4'),{role:'member'}), member(u('u8'),{role:'member'}), member(u('u7'),{role:'member'}), member(u('u10'),{role:'member'})],
      createdBy:u('u1'), isActive:true },

    { _m:'g3', type:CHAT_TYPES.GROUP, name:'Sharma Family',
      description:'Family updates, photos aur forwarded messages',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=sharmafamily',publicId:''},
      members:[member(u('u1'),{role:'admin',muted:true}), member(u('u8'),{role:'member'}), member(u('u4'),{role:'member'}), member(u('u3'),{role:'member'})],
      createdBy:u('u1'), isActive:true },

    { _m:'g4', type:CHAT_TYPES.GROUP, name:'College Dost Squad',
      description:'IITB batch 2018 — kabhi nahi bhulunga in logo ko',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=collegedost',publicId:''},
      members:[member(u('u1'),{role:'admin',unread:7}), member(u('u2'),{role:'member'}), member(u('u3'),{role:'member'}), member(u('u5'),{role:'member'}), member(u('u7'),{role:'member'}), member(u('u11'),{role:'member'}), member(u('u13'),{role:'member'})],
      createdBy:u('u1'), isActive:true },

    { _m:'g5', type:CHAT_TYPES.GROUP, name:'Mumbai Foodies',
      description:'Best restaurants, dhabbas aur hidden gems of Mumbai',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=mumbaifoodies',publicId:''},
      members:[member(u('u1'),{role:'admin',muted:true}), member(u('u2'),{role:'member'}), member(u('u11'),{role:'member'}), member(u('u14'),{role:'member'}), member(u('u8'),{role:'member'})],
      createdBy:u('u1'), isActive:true },

    { _m:'g6', type:CHAT_TYPES.GROUP, name:'Startup Founders Circle',
      description:'Building India ka next unicorn — ideas, funding, grind',
      avatar:{url:'https://api.dicebear.com/7.x/shapes/svg?seed=startupfounders',publicId:''},
      members:[member(u('u7'),{role:'admin',unread:2}), member(u('u1'),{role:'member'}), member(u('u6'),{role:'member'}), member(u('u9'),{role:'member'}), member(u('u13'),{role:'member'}), member(u('u15'),{role:'member'})],
      createdBy:u('u7'), isActive:true },
  ];

  const cleanDocs = chatDocs.map(({_m,...rest}) => rest);
  const inserted  = await Chat.insertMany(cleanDocs, {ordered:true});
  const chatMap   = {};
  inserted.forEach((doc,i) => { chatMap[chatDocs[i]._m] = doc._id; });
  console.log('  ' + inserted.length + ' chats created');
  return chatMap;
}

async function seedMessages(userMap, chatMap) {
  console.log('  Seeding messages...');
  const u = id => userMap[id];
  const c = id => chatMap[id];
  function msg(cid, uid, content, status, ts) {
    return { chat:c(cid), sender:u(uid), type:MESSAGE_TYPES.TEXT, content, status, createdAt:ts, updatedAt:ts, isDeleted:false };
  }

  const all = [
    // ── c1: Arjun & Priya ────────────────────────────────────────────────────
    msg('c1','u2','Arjun bhai, Figma file share karo na yaar please','read',dAt(5,10,0)),
    msg('c1','u1','Haan haan, thoda polish kar raha tha. Bhej raha hoon','read',dAt(5,10,5)),
    msg('c1','u2','Kitni baar polish karoge? Client kal tak maang raha hai!','read',dAt(5,10,8)),
    msg('c1','u1','Arre chill kar yaar, by EOD pakka bhej dunga. Promise','read',dAt(5,10,12)),
    msg('c1','u2','Theek hai. Standup mein kya update doge aaj?','read',dAt(5,14,0)),
    msg('c1','u1','Homepage redesign 90% done, animations reh gayi hain','read',dAt(5,14,5)),
    msg('c1','u2','Dark mode ke saath test kiya kya?','read',dAt(4,9,30)),
    msg('c1','u1','Haan, spacing issues fix kar diye. Ab sab smooth hai','read',dAt(4,9,35)),
    msg('c1','u2','Perfect! Tum seriously best ho Arjun bhai','read',dAt(4,9,36)),
    msg('c1','u1','Arre yaar stop it, tu bhi bahut acha kaam karti hai','read',dAt(4,9,38)),
    msg('c1','u2','Kya pata hai mujhe — kal client ne sirf teri design ki tarif ki','read',dAt(3,11,0)),
    msg('c1','u1','Seriously? Wow that feels good yaar. Mehnat rang layi','read',dAt(3,11,5)),
    msg('c1','u2','Bilkul! Waise kal meeting 3 baje hai, yaad hai na?','read',dAt(2,15,0)),
    msg('c1','u1','Haan noted, calendar mein daal diya. Chai leke aaunga','read',dAt(2,15,3)),
    msg('c1','u2','Haha chai toh zaroor lana, meeting lambi hogi aaj','read',dAt(2,15,5)),
    msg('c1','u1','Biscuits bhi launga phir, full chai-biscuit session','read',dAt(2,15,7)),
    msg('c1','u2','Arjun ek kaam karo, notification system ke liye UI wireframe bana do','read',yesterdayAt(10,0)),
    msg('c1','u1','Sure, low-fi ya hi-fi chahiye?','read',yesterdayAt(10,5)),
    msg('c1','u2','Lo-fi chal jayega abhi, iteration karenge baad mein','read',yesterdayAt(10,7)),
    msg('c1','u1','Done! Figma link bhejta hoon shaam tak','read',yesterdayAt(10,10)),
    msg('c1','u2','Thanks! Bhaiya tu toh rockstar hai','read',yesterdayAt(18,0)),
    msg('c1','u1','Haha, bas chai pilate raho, kaam karta rahunga','read',yesterdayAt(18,2)),
    msg('c1','u2','Deal! Kal chai main lauungi office mein','delivered',todayAt(9,0)),
    msg('c1','u1','Ab baat ho rahi hai! Deal pakki','sent',todayAt(9,5)),

    // ── c2: Arjun & Rohan ─────────────────────────────────────────────────────
    msg('c2','u3','Bhai production mein bug aa gaya! Urgent dekh please','read',dAt(4,11,0)),
    msg('c2','u1','Kya issue hai? Error logs bhej jaldi','read',dAt(4,11,2)),
    msg('c2','u3','500 error aa raha /auth/login pe. Deployment ke baad se hai','read',dAt(4,11,4)),
    msg('c2','u1','JWT secret change hua kya env mein? Check kar','read',dAt(4,11,6)),
    msg('c2','u3','Arre haan yaar! Galti se old key reh gayi thi. Fix ho gaya. Sorry!','read',dAt(4,11,20)),
    msg('c2','u1','Next time staging pe test karna bhai, seedha prod mat touch karo','read',dAt(4,11,22)),
    msg('c2','u3','Sahi kaha yaar, lesson lete hain. Chai ki zarurat hai abhi','read',dAt(4,11,25)),
    msg('c2','u1','Deserve karta hai tu. Waise mera PR dekha?','read',dAt(3,15,0)),
    msg('c2','u3','Haan dekh raha hoon. Bhai ye query optimization waala approach kyon liya?','read',dAt(3,15,10)),
    msg('c2','u1','N+1 problem tha pehle, aggregation se fix kiya. Explain karta hoon','read',dAt(3,15,12)),
    msg('c2','u3','Acha samajh aaya. Good call! Approve kar diya','read',dAt(3,15,30)),
    msg('c2','u1','Thanks bhai. IPL kaisa raha kal?','read',dAt(2,22,0)),
    msg('c2','u3','MI ne kya kheliya yaar! Rohit ki century dekhi?','read',dAt(2,22,5)),
    msg('c2','u1','Bhai mere ko rona aa gaya itna tense game tha','read',dAt(2,22,10)),
    msg('c2','u3','Last over mein dil nikal gaya tha. Kya finish tha','read',dAt(2,22,15)),
    msg('c2','u1','Kal ka final dekhna zaroor. Fantasy team bana le tu','read',yesterdayAt(9,0)),
    msg('c2','u3','Bhai teri fantasy team hamesha phelti hai meri se. Kuch tips de','read',yesterdayAt(9,5)),
    msg('c2','u1','Haha, bas Rohit aur Bumrah ko hamesha pick karo, simple formula','read',yesterdayAt(9,8)),
    msg('c2','u3','Noted! Aaj deployment window hai shaam ko, sath mein raho','read',todayAt(10,0)),
    msg('c2','u1','Haan hoon yahan. Koi issue ho toh ping karna','delivered',todayAt(10,2)),

    // ── c3: Arjun & Sneha ─────────────────────────────────────────────────────
    msg('c3','u4','Arjun, PRD finalize ho gayi kya? Client impatient hai','read',dAt(6,16,0)),
    msg('c3','u1','Almost done Sneha, ek section reh gaya hai','read',dAt(6,16,10)),
    msg('c3','u4','Kal tak bhej do. Friday ko client presentation hai','read',dAt(6,16,12)),
    msg('c3','u1','Done by tomorrow morning. Tension mat lo bilkul','read',dAt(6,16,15)),
    msg('c3','u4','Acha batao, sprint mein notifications feature kitna effort lagega?','read',dAt(4,11,0)),
    msg('c3','u1','Backend 3 din, frontend 2 din. Total ek week','read',dAt(4,11,5)),
    msg('c3','u4','Rohan aur Arjun dono kar sakte ho?','read',dAt(4,11,8)),
    msg('c3','u1','Haan, Rohan backend sambhaalega. Main frontend karunga','read',dAt(4,11,10)),
    msg('c3','u4','Perfect! Sprint planning mein confirm karte hain','read',dAt(3,15,0)),
    msg('c3','u1','Zaroor. Waise usability testing ka plan kya hai?','read',dAt(3,15,5)),
    msg('c3','u4','5 users ke saath karenge. List ready hai meri paas','read',dAt(3,15,8)),
    msg('c3','u1','Great! Feedback form bhi ready rakho','read',dAt(2,10,0)),
    msg('c3','u4','Already bana diya hai. Tum bas design polish karo','read',dAt(2,10,5)),
    msg('c3','u1','Haha theek hai boss! Kaam ho jayega','read',yesterdayAt(11,0)),
    msg('c3','u4','Aur haan Arjun, salary increment ke baare mein baat karni thi','read',yesterdayAt(16,0)),
    msg('c3','u1','Oh! Haan zaroor, kab convenient hai tumhare liye?','read',yesterdayAt(16,5)),
    msg('c3','u4','Kal 5 baje ke baad? Office mein hi baat karte hain','read',yesterdayAt(16,8)),
    msg('c3','u1','Perfect! Kal milte hain','delivered',todayAt(8,30)),

    // ── c4: Arjun & Vikram ────────────────────────────────────────────────────
    msg('c4','u5','Arjun bhai Docker image build fail ho rahi CI mein. Help!','read',dAt(7,9,0)),
    msg('c4','u1','Kya error hai? Paste karo logs','read',dAt(7,9,3)),
    msg('c4','u5','node:alpine pe bcrypt compile nahi ho raha, python missing','read',dAt(7,9,6)),
    msg('c4','u1','Dockerfile mein python3 aur make add karo alpine pe. Try karo','read',dAt(7,9,15)),
    msg('c4','u5','Bhai fix ho gaya! Tu bhi ek wizard hai seriously','read',dAt(7,9,30)),
    msg('c4','u1','Ye problem mujhe bhi pehle hua tha, tab se yaad hai','read',dAt(7,9,32)),
    msg('c4','u5','K8s cluster mein resource limits set kiye kya?','read',dAt(5,14,0)),
    msg('c4','u1','Haan, 512Mi memory aur 250m CPU per pod. Kaafi hai abhi ke liye','read',dAt(5,14,5)),
    msg('c4','u5','Acha bhai. HPA bhi set karna chahiye tha, auto-scale ke liye','read',dAt(5,14,8)),
    msg('c4','u1','Sahi kaha! Next sprint mein karenge. Priority list mein daal','read',dAt(5,14,10)),
    msg('c4','u5','Done. Arjun bhai monitoring ke liye Grafana setup karna hai','read',dAt(3,11,0)),
    msg('c4','u1','Prometheus + Grafana ka combo best hai. Main ek template de deta hoon','read',dAt(3,11,5)),
    msg('c4','u5','Boss ho tum yaar, bahut help milti hai tere se','read',dAt(3,11,10)),
    msg('c4','u1','Arre yaar hum log ek team hain, sab milke karte hain','read',dAt(2,17,0)),
    msg('c4','u5','Kal ka match dekha? KKR ne kya kheliya','read',yesterdayAt(22,0)),
    msg('c4','u1','Bhai! Russell ki innings dekh ke dil khush ho gaya','read',yesterdayAt(22,5)),
    msg('c4','u5','36 balls mein 80 runs! Pagal aadmi hai woh','read',yesterdayAt(22,10)),
    msg('c4','u1','Haha bilkul, ek hi hai uske jaise. Kal ka match dekhoge?','delivered',todayAt(9,0)),

    // ── c5: Arjun & Kabir ─────────────────────────────────────────────────────
    msg('c5','u7','Arjun, NexTalk ka launch kab? Demo dikhao yaar','read',dAt(8,14,0)),
    msg('c5','u1','Next month pakka. Beta testing chal raha hai','read',dAt(8,14,10)),
    msg('c5','u7','Mujhe early access chahiye! Startup ke liye use karunga','read',dAt(8,14,12)),
    msg('c5','u1','Bilkul! Tu toh sabse pehle milega, beta tester bana raha hoon','read',dAt(8,14,15)),
    msg('c5','u7','Bhai funding round chal raha hai mera. Investor deck check karoge?','read',dAt(6,11,0)),
    msg('c5','u1','Haan bhej! Dekh ke feedback dunga','read',dAt(6,11,5)),
    msg('c5','u7','Bheja hai email pe. Kal tak revert karo please','read',dAt(6,11,8)),
    msg('c5','u1','Padh liya! Slide 7 pe market size underestimate lagta hai. Data add karo','read',dAt(5,10,0)),
    msg('c5','u7','Oh sahi point! Statista pe data hai, update kar deta hoon. Thanks bhai','read',dAt(5,10,5)),
    msg('c5','u1','Aur executive summary aur crisp karo, investors busy hote hain','read',dAt(5,10,8)),
    msg('c5','u7','Noted. Bhai ye app bahut smooth hai yaar. Real-time chat bakwaas fast hai','read',dAt(3,18,0)),
    msg('c5','u1','Haan Socket.IO use kiya hai. Performance pe bahut kaam kiya','read',dAt(3,18,8)),
    msg('c5','u7','Investor pitch mein mention karunga. Product genuinely impressive hai','read',dAt(3,18,10)),
    msg('c5','u1','Shukriya yaar. Tera pitch kab hai finally?','read',yesterdayAt(12,0)),
    msg('c5','u7','Next Tuesday. Nervous hoon yaar','read',yesterdayAt(12,5)),
    msg('c5','u1','Arre chill kar. Tu prepared hai, sab acha hoga. All the best!','read',yesterdayAt(12,10)),
    msg('c5','u7','Thanks bhai, teri dua chahiye','delivered',todayAt(10,0)),

    // ── c6: Arjun & Aditya ───────────────────────────────────────────────────
    msg('c6','u9','Arjun bhai Android dev mein help chahiye. Coroutine issue hai','read',dAt(3,10,0)),
    msg('c6','u1','Kya problem hai? Code snippet bhej','read',dAt(3,10,5)),
    msg('c6','u9','StateFlow aur LiveData ke beech confused hoon, kaunsa use karoon?','read',dAt(3,10,8)),
    msg('c6','u1','New code mein StateFlow best hai. LiveData purana hai. Compose ke saath StateFlow perfect','read',dAt(3,10,15)),
    msg('c6','u9','Acha! Aur Hilt se DI kaise setup karoon smoothly?','read',dAt(3,10,20)),
    msg('c6','u1','Official codelab follow karo, best documentation hai usme. Bhejta hoon link','read',dAt(3,10,25)),
    msg('c6','u9','Thanks yaar tu toh Google developer lag raha hai','read',dAt(2,11,0)),
    msg('c6','u1','Haha nahi yaar, bas notes padha kiya humne sab','read',dAt(2,11,3)),
    msg('c6','u9','Bhai gaming tournament chal raha hai weekend pe, aana hai?','read',yesterdayAt(18,0)),
    msg('c6','u1','BGMI ya COD?','read',yesterdayAt(18,5)),
    msg('c6','u9','BGMI! Prize money bhi hai 5k','read',yesterdayAt(18,8)),
    msg('c6','u1','Bhai aaunga pakka. Team mein kaun hai?','read',yesterdayAt(18,12)),
    msg('c6','u9','Main, Vikram, aur do aur log. Tum 4th player ho gaye','delivered',todayAt(9,0)),
    msg('c6','u1','Done! Kal practice session karein? Warm up ke liye','sent',todayAt(9,5)),

    // ── c7: Arjun & Sameer ───────────────────────────────────────────────────
    msg('c7','u11','Yaar NexTalk ka IPO kab aa raha hai? Investment karna hai','read',dAt(4,13,0)),
    msg('c7','u1','Haha bhai abhi toh launch bhi nahi hua. Bahut jaldi hai teri','read',dAt(4,13,5)),
    msg('c7','u11','Toh early stage investment? Angel round mein ghus jata hoon','read',dAt(4,13,8)),
    msg('c7','u1','Serious ho? Kabir se baat karo, woh handle karta hai funding ka','read',dAt(4,13,12)),
    msg('c7','u11','Done! Waise Nifty kal bahut gira yaar. Portfolio red ho gaya','read',dAt(2,16,0)),
    msg('c7','u1','Haan recession ka fear hai. Koi solid stock nahi dikh raha','read',dAt(2,16,5)),
    msg('c7','u11','IT sector mein TCS aur Infosys abhi bhi stable hain. Hold karo','read',dAt(2,16,8)),
    msg('c7','u1','Sahi baat hai. Long term sochna padega panic nahi karna','read',dAt(2,16,12)),
    msg('c7','u11','Bilkul. Crypto mein kuch invested hai kya tera?','read',yesterdayAt(14,0)),
    msg('c7','u1','Thoda BTC hai bas, play money. SIP main reliance karti hoon meri','read',yesterdayAt(14,5)),
    msg('c7','u11','Good strategy! High risk high reward wale log rote hain baad mein','delivered',todayAt(11,0)),

    // ── c8: Arjun & Deepika ──────────────────────────────────────────────────
    msg('c8','u12','Arjun bhai React mein performance issue aa raha hai. Re-renders bahut hain','read',dAt(3,14,0)),
    msg('c8','u1','useMemo aur useCallback use karo? DevTools se check karo pehle','read',dAt(3,14,5)),
    msg('c8','u12','React DevTools mein Profiler dekha, parent re-render ho raha unnecessary','read',dAt(3,14,10)),
    msg('c8','u1','memo() use karo child component pe. Context bahut wide mat rakhna','read',dAt(3,14,15)),
    msg('c8','u12','Works now! Tum bahut helpful ho bhai, seriously','read',dAt(3,14,30)),
    msg('c8','u1','Koi baat nahi yaar, ye sab common issues hain','read',dAt(2,10,0)),
    msg('c8','u12','Bhai Tailwind vs CSS Modules — kya use karoon new project mein?','read',yesterdayAt(11,0)),
    msg('c8','u1','Tailwind fast development ke liye best hai. Consistency bhi achhi hoti hai','read',yesterdayAt(11,5)),
    msg('c8','u12','NexTalk mein Tailwind hi use kiya hai na tumne?','read',yesterdayAt(11,8)),
    msg('c8','u1','Haan! shadcn/ui ke saath. Experience bahut smooth tha','delivered',todayAt(10,0)),

    // ── c9: Arjun & Pooja ────────────────────────────────────────────────────
    msg('c9','u14','Arjun bhai NexTalk ka social media launch plan kya hai?','read',dAt(5,10,0)),
    msg('c9','u1','Abhi nahi socha properly. Koi suggestion?','read',dAt(5,10,5)),
    msg('c9','u14','LinkedIn + Twitter combo best rahega for B2B. Instagram for brand awareness','read',dAt(5,10,8)),
    msg('c9','u1','Makes sense! Content strategy bhi chahiye hogi','read',dAt(5,10,12)),
    msg('c9','u14','Main help kar sakti hoon — content calendar, copy, sab','read',dAt(5,10,15)),
    msg('c9','u1','That would be amazing Pooja! Kabir se milao, woh co-founder hai','read',dAt(4,14,0)),
    msg('c9','u14','Done, Kabir se baat ho gayi. Next week call hai','read',dAt(4,14,5)),
    msg('c9','u1','Bahut fast ho tum! Impressed','read',dAt(4,14,8)),
    msg('c9','u14','Marketers hote hi tez hain','read',dAt(2,11,0)),
    msg('c9','u1','Haha sahi kaha! Waise product hunt pe launch karna chahiye','delivered',yesterdayAt(15,0)),

    // ── c10: Arjun & Ananya ──────────────────────────────────────────────────
    msg('c10','u6','Bhai NexTalk ke liye recommendation engine banana chahiye','read',dAt(4,10,0)),
    msg('c10','u1','Oh interesting! Kya recommend karega exactly?','read',dAt(4,10,5)),
    msg('c10','u6','People you may know — based on mutual contacts aur interests','read',dAt(4,10,8)),
    msg('c10','u1','That would be a great feature! CF algorithm use kar sakte hain','read',dAt(4,10,12)),
    msg('c10','u6','Haan collaborative filtering perfect hai. Main prototype bana sakti hoon','read',dAt(4,10,15)),
    msg('c10','u1','Seriously Ananya, you are so ahead of everyone in this team','read',dAt(3,16,0)),
    msg('c10','u6','Bas data chahiye practice ke liye, ideas toh bahut hain mere paas','read',dAt(3,16,5)),
    msg('c10','u1','Haha noted! Waise Hyderabad mein best biryani kahan milti hai?','read',dAt(2,13,0)),
    msg('c10','u6','Paradise obviously! Koi comparison nahi uska. Kabhi aana Hyd mein','read',dAt(2,13,5)),
    msg('c10','u1','Pakka! Next conference pe aaunga. Biryani treat lena hai tumse','delivered',todayAt(11,0)),

    // ── c11: Priya & Deepika ─────────────────────────────────────────────────
    msg('c11','u2','Deepika! Figma mein auto-layout ka latest update dekha?','read',dAt(3,11,0)),
    msg('c11','u12','Haan yaar! Finally wrapping properly karta hai. Game changer hai','read',dAt(3,11,5)),
    msg('c11','u2','Bilkul! Mera itna time bachega ab. Component library banayi kya?','read',dAt(3,11,8)),
    msg('c11','u12','Almost done hai. Atoms se shuru kiya, ab molecules build kar rahi hoon','read',dAt(3,11,12)),
    msg('c11','u2','Atomic design follow kar rahi ho? Nice! Kuch tips chahiye mujhe','read',dAt(2,14,0)),
    msg('c11','u12','Haan zaroor! Call karte hain kal? Screen share karti hoon','read',dAt(2,14,5)),
    msg('c11','u2','Perfect! 3 baje theek rahega?','read',yesterdayAt(9,0)),
    msg('c11','u12','Done! Calendar block kar diya','delivered',todayAt(10,0)),

    // ── c12: Rohan & Vikram ──────────────────────────────────────────────────
    msg('c12','u3','Vikram bhai Redis caching ka timeout kitna rakhein?','read',dAt(2,10,0)),
    msg('c12','u5','Depends on data. Session ke liye 1 hour, static ke liye 24 hours','read',dAt(2,10,5)),
    msg('c12','u3','Aur cache invalidation kaise handle karein on update?','read',dAt(2,10,8)),
    msg('c12','u5','Cache-aside pattern use karo. Write pe invalidate, read pe populate','read',dAt(2,10,15)),
    msg('c12','u3','Perfect explanation bhai. Implement karta hoon','read',dAt(2,10,20)),
    msg('c12','u5','Haan chal! PR mein dekh lena badme','delivered',yesterdayAt(14,0)),

    // ── g1: NexTalk Dev Team ─────────────────────────────────────────────────
    msg('g1','u3','Good morning team! Aaj kya plan hai sabka?','read',dAt(3,9,0)),
    msg('g1','u5','Morning! Main Kubernetes HPA setup karunga aaj','read',dAt(3,9,5)),
    msg('g1','u6','Aur main recommendation engine ka PoC start kar rahi hoon','read',dAt(3,9,8)),
    msg('g1','u7','Mera PR ready hai — notifications backend done hai','read',dAt(3,9,10)),
    msg('g1','u9','Android mein push notifications integrate kar liya!','read',dAt(3,9,12)),
    msg('g1','u1','Kya team hai yaar! Sab ek saath rock kar rahe hain','read',dAt(3,9,15)),
    msg('g1','u12','Main notifications ka frontend kar rahi hoon. Today EOD tak done hoga','read',dAt(3,9,18)),
    msg('g1','u15','ML team se co-ordinate karun? Ananya ke saath?','read',dAt(3,9,20)),
    msg('g1','u6','Haan Aryan! Aaj 2 baje call karte hain sath mein','read',dAt(3,9,22)),
    msg('g1','u1','Perfect, standup 11 baje. Koi blocker?','read',dAt(3,9,25)),
    msg('g1','u3','Mera ek blocker hai — DB migration kisi ne review kiya?','read',dAt(3,10,0)),
    msg('g1','u1','Main dekhta hoon abhi. Bhej link','read',dAt(3,10,5)),
    msg('g1','u3','Bheja hai. Thanks Arjun bhai','read',dAt(3,10,8)),
    msg('g1','u5','Rohan bhai production pe migration direct mat chalana please','read',dAt(3,10,10)),
    msg('g1','u3','Haan haan staging pe test karunga pehle, don\'t worry','read',dAt(3,10,12)),
    msg('g1','u7','Bhai NexTalk ka beta launch kab pakka ho raha hai?','read',dAt(2,11,0)),
    msg('g1','u1','Next month end tak target hai. Sabko milestone clear karna hoga','read',dAt(2,11,5)),
    msg('g1','u9','Bhai main QA bhi sambhaal loon? Testing scripts ready hain mere paas','read',dAt(2,11,8)),
    msg('g1','u1','Yes Aditya! That would be amazing, please do it','read',dAt(2,11,10)),
    msg('g1','u6','Arjun bhai ek idea hai — A/B testing framework implement karein?','read',dAt(2,11,12)),
    msg('g1','u1','Bohot acha idea hai Ananya! Post-launch roadmap mein dalte hain','read',dAt(2,11,15)),
    msg('g1','u12','Team, design system v2 ready hai. Link share kar rahi hoon','read',yesterdayAt(10,0)),
    msg('g1','u2','Deepika bhai! Itna fast kaise kar leti ho','read',yesterdayAt(10,5)),
    msg('g1','u12','Coffee aur late nights ka combination hai','read',yesterdayAt(10,8)),
    msg('g1','u5','Team ko server downtime kal 2-4 AM chahiye maintenance ke liye','read',yesterdayAt(14,0)),
    msg('g1','u1','Approved! Sab ko inform karo users ko bhi','read',yesterdayAt(14,5)),
    msg('g1','u7','Status page update karun? Users ko proactive notification bhejun?','read',yesterdayAt(14,8)),
    msg('g1','u1','Yes Kabir! Both please. Good thinking','read',yesterdayAt(14,10)),
    msg('g1','u3','Maintenance ke baad monitoring extra tight rakhna','read',yesterdayAt(14,12)),
    msg('g1','u5','Already grafana alerts set kar diye hain. Relax karo sab','read',yesterdayAt(14,15)),
    msg('g1','u1','Vikram bhai MVP hai is team ka. Shukriya yaar','read',todayAt(9,0)),
    msg('g1','u5','Arre team effort hai. Sab ne contribute kiya','read',todayAt(9,5)),
    msg('g1','u9','Good morning! Maintenance successful raha? Sab smooth?','read',todayAt(9,8)),
    msg('g1','u5','Haan ekdum smooth! 2:47 AM pe complete ho gaya','read',todayAt(9,10)),
    msg('g1','u1','Excellent work team! Chai party tomorrow, mere taraf se','read',todayAt(9,12)),
    msg('g1','u6','Finally! Sab chai ke liye hi kaam karte hain is team mein','read',todayAt(9,15)),
    msg('g1','u12','Haha 100% sahi baat hai Ananya!','read',todayAt(9,18)),
    msg('g1','u3','Arjun bhai kal standup mein sprint review bhi karte hain?','read',todayAt(10,0)),
    msg('g1','u1','Haan! 11 baje se 12 tak block karo sab. Sprint demo bhi karenge','sent',todayAt(10,5)),

    // ── g2: Goa Trip 2025 ────────────────────────────────────────────────────
    msg('g2','u1','Yaar plan karo Goa trip! March mein perfect weather hoga','read',dAt(10,20,0)),
    msg('g2','u2','March best hai! Main toh pakki hoon','read',dAt(10,20,5)),
    msg('g2','u4','Haan haan! Kitne saal se plan ho raha tha yaar','read',dAt(10,20,8)),
    msg('g2','u8','Finally!! Iss baar actually jaana hai','read',dAt(10,20,12)),
    msg('g2','u7','Main flights check karta hoon. Mumbai se direct flight kaafi hain','read',dAt(10,20,15)),
    msg('g2','u10','Mujhe bhi batao dates! Main bhi aana chahti hoon','read',dAt(10,20,18)),
    msg('g2','u1','Dates finalize karo pehle — 14 ya 21 March?','read',dAt(9,11,0)),
    msg('g2','u2','14 March better hai, zyada crowd nahi hoga','read',dAt(9,11,5)),
    msg('g2','u4','21 ko meri presentation hai. 14 pe +1','read',dAt(9,11,8)),
    msg('g2','u7','14 March! Let\'s lock it','read',dAt(9,11,10)),
    msg('g2','u8','14 pe mera bhi okay hai','read',dAt(9,11,12)),
    msg('g2','u10','14 perfect! Book kar lo jaldi','read',dAt(9,11,15)),
    msg('g2','u1','Done! 14-18 March. 5 days. Sab book karo jaldi','read',dAt(8,10,0)),
    msg('g2','u7','Flight booked! IndiGo, morning flight, 8900 ka mila','read',dAt(7,14,0)),
    msg('g2','u2','Main bhi book kar leti hoon same flight','read',dAt(7,14,5)),
    msg('g2','u4','Hotel Calangute ke paas lena chahiye, beach access wala','read',dAt(6,11,0)),
    msg('g2','u8','Bhai budget kya hai? 5 star ya chill villa?','read',dAt(6,11,5)),
    msg('g2','u1','Per person 15-20k. 3-4 star ya villa sab theek hai','read',dAt(6,11,8)),
    msg('g2','u10','Airbnb pe ek villa dekha hai 6 bedrooms ka, bikul beach ke paas','read',dAt(5,19,0)),
    msg('g2','u2','Link share karo!','read',dAt(5,19,5)),
    msg('g2','u10','Bheja hai. 8000 per night, 6 log split karein toh 1333 per person only','read',dAt(5,19,8)),
    msg('g2','u4','Perfect! Beach access bhi hai kya?','read',dAt(5,19,12)),
    msg('g2','u10','Haan private beach hai! Pool bhi!','read',dAt(5,19,15)),
    msg('g2','u7','Book karo jaldi yaar, March mein dates fly hoti hain','read',dAt(4,10,0)),
    msg('g2','u1','Nisha tum book karo, sab pay kar denge UPI pe','read',dAt(4,10,5)),
    msg('g2','u10','Booked! Total 40k advance diya. 6666 each bhejo yaar','read',dAt(3,11,0)),
    msg('g2','u2','Sent! GPay pe','read',dAt(3,11,5)),
    msg('g2','u4','Done from my side bhi','read',dAt(3,11,8)),
    msg('g2','u7','Bhi sent. Thanks Nisha booking ke liye!','read',dAt(3,11,10)),
    msg('g2','u8','Bhai itinerary bhi plan karo ab!','read',dAt(2,15,0)),
    msg('g2','u1','Pehla din: Fort Aguada aur Dona Paula. Second: Dudhsagar Falls','read',dAt(2,15,5)),
    msg('g2','u2','Third day beach day! Baga aur Anjuna','read',dAt(2,15,8)),
    msg('g2','u4','Night life bhi please! Tito\'s aur Mambo\'s','read',dAt(2,15,10)),
    msg('g2','u8','Aur seafood! Goa mein fresh fish khana mandatory hai','read',dAt(2,15,12)),
    msg('g2','u10','Saturday Market bhi jaana hai, handicraft shopping karni hai','read',yesterdayAt(19,0)),
    msg('g2','u7','Bhai puri plan sun ke excited ho gaya yaar! Jaldi aao March','delivered',todayAt(8,30)),
    msg('g2','u1','5 weeks baad! Count karo sab','sent',todayAt(8,35)),

    // ── g3: Sharma Family ────────────────────────────────────────────────────
    msg('g3','u4','Arjun beta, khaana kha liya? Mummy ka message hai','read',dAt(3,13,0)),
    msg('g3','u1','Haan auntie, office mein hoon abhi','read',dAt(3,13,5)),
    msg('g3','u8','Bhaiya ghar kab aa rahe ho? Bua ke yahan jana hai is weekend','read',dAt(3,13,8)),
    msg('g3','u1','Ek baar boss se poochh loon, batata hoon','read',dAt(3,13,12)),
    msg('g3','u3','Arjun beta yahan koi aaya tha tera — koi Delivery wala shayad','read',dAt(2,10,0)),
    msg('g3','u1','Oh! Package hoga mera, neighbour ke paas rakh dena','read',dAt(2,10,5)),
    msg('g3','u4','Arjun bhai mummy ne good morning message forward kiya dekho','read',yesterdayAt(8,0)),
    msg('g3','u1','Haha mummy ki timing sabse perfect hai','read',yesterdayAt(8,3)),
    msg('g3','u8','Bhaiya Papa ka birthday yaad hai? Sunday ko hai!','read',yesterdayAt(12,0)),
    msg('g3','u1','Haan! Gift order kar diya hai already. Cake bhi laenge','read',yesterdayAt(12,5)),
    msg('g3','u3','Party kab hai? Ghar pe karenge ya restaurant?','read',yesterdayAt(12,8)),
    msg('g3','u1','Ghar pe. Sab Sunday 7 baje aa jaana','read',yesterdayAt(12,10)),
    msg('g3','u4','Main khana banaaungi! Mummy ki favourite dishes','read',yesterdayAt(12,12)),
    msg('g3','u8','Main cake leke aaungi. Chocolate ya vanilla?','read',todayAt(7,0)),
    msg('g3','u1','Papa ko chocolate pasand hai. Bakers Inn se le lena','read',todayAt(7,5)),
    msg('g3','u4','Arjun bhai aur kuch chahiye? Decorations?','read',todayAt(7,8)),
    msg('g3','u1','Haan thode balloons aur ek small banner. Isha tu dekh lena','delivered',todayAt(7,15)),

    // ── g4: College Dost Squad ───────────────────────────────────────────────
    msg('g4','u3','Bhai IITB ka reunion kab kar rahe hain? 7 saal ho gaye','read',dAt(8,21,0)),
    msg('g4','u5','Bhai sahi yaad dilaya! December mein karein? Sab available honge','read',dAt(8,21,5)),
    msg('g4','u7','December 20-22 best hai. Christmas se pehle','read',dAt(8,21,8)),
    msg('g4','u11','Mumbai mein karein ya Pune? Kaafi log Mumbai mein hain ab','read',dAt(8,21,12)),
    msg('g4','u1','Mumbai! Bandstand pe milte hain pehle, purani yaadein','read',dAt(8,21,15)),
    msg('g4','u13','Guys mujhe flight leni padegi Bhopal se. Book kar loon?','read',dAt(8,21,18)),
    msg('g4','u2','Haan Rahul! Book karo jaldi, cheap milegi abhi','read',dAt(7,10,0)),
    msg('g4','u1','Yaad hai woh first year hostel ki raat? Rooftop pe chai pilate the','read',dAt(6,22,0)),
    msg('g4','u3','Aur professor Sharma ki class mein nachne ki bet? Haha!','read',dAt(6,22,5)),
    msg('g4','u5','Vikram ne actually naachi thi! Legend hai woh','read',dAt(6,22,8)),
    msg('g4','u7','Haha Vikram bhai ka courage salute karta hoon','read',dAt(6,22,12)),
    msg('g4','u11','Bhai woh Techfest 2017 ki memory hai? 72 hours bina soye kaam kiya tha','read',dAt(5,19,0)),
    msg('g4','u1','Haan! Hamare project ne 2nd prize jeeta tha. Best moment tha','read',dAt(5,19,5)),
    msg('g4','u13','Aur canteen ki maggi? 3 AM pe woh maggi amrit lagti thi','read',dAt(5,19,8)),
    msg('g4','u2','Bhai mujhe aaj bhi yaad hai woh taste. Koi nahi bana sakta waisa','read',dAt(5,19,12)),
    msg('g4','u3','Yaar sach mein best 4 saal the woh. Itni tension nahi thi','read',dAt(4,20,0)),
    msg('g4','u1','Iska matlab hai ki December reunion pakka! No excuses','read',dAt(4,20,5)),
    msg('g4','u5','100%! Aur is baar sab pehle se plan karo, last minute nahi','read',dAt(3,15,0)),
    msg('g4','u7','WhatsApp group bana lete hain planning ke liye','read',dAt(3,15,5)),
    msg('g4','u1','NexTalk pe karein planning! Beta testing karo mere app ka','read',dAt(3,15,8)),
    msg('g4','u11','Haha shameless promotion! But theek hai download karte hain','read',dAt(2,12,0)),
    msg('g4','u13','App bahut smooth hai yaar genuinely. Impressed hoon','read',dAt(2,12,5)),
    msg('g4','u1','Shukriya yaar, ye sab tere jaise dosto ke liye hi banaya hai','read',dAt(2,12,8)),
    msg('g4','u2','Arjun pehle free tha, ab CEO ban raha hai haha','read',yesterdayAt(21,0)),
    msg('g4','u1','CEO nahi yaar, abhi toh intern lag raha hoon khud ko','read',yesterdayAt(21,5)),
    msg('g4','u3','December tak CEO ho jaoge. Dekh lena','delivered',todayAt(9,0)),

    // ── g5: Mumbai Foodies ───────────────────────────────────────────────────
    msg('g5','u2','Guys! Kailash Parbat ne new branch kholi Bandra mein','read',dAt(4,13,0)),
    msg('g5','u1','Seriously?! Weekend pe zaroor jaana hai','read',dAt(4,13,5)),
    msg('g5','u11','Bhai unka chaat toh legendary hai. Rate kya hai wahan?','read',dAt(4,13,8)),
    msg('g5','u14','Reasonable hai, 200-400 per head. Worth it definitely','read',dAt(4,13,12)),
    msg('g5','u8','Kab jaana hai? Saturday ya Sunday?','read',dAt(4,13,15)),
    msg('g5','u2','Saturday 1 PM? Lunch karein wahan','read',dAt(3,10,0)),
    msg('g5','u1','Done! But mujhe Monday tak pata hai na, Saturday confirm karunga','read',dAt(3,10,5)),
    msg('g5','u11','Arjun bhai Juhu Beach pe ek naya stall khula hai, pav bhaji famous hai','read',dAt(2,19,0)),
    msg('g5','u14','Haan!! Pooja\'s Kitchen wala? 5 star rating hai Zomato pe','read',dAt(2,19,5)),
    msg('g5','u1','Beach pe khana aur evening — perfect combo','read',dAt(2,19,8)),
    msg('g5','u8','Next weekend plan? Juhu beach aur phir Marine Drive pe walk?','read',dAt(2,19,12)),
    msg('g5','u2','Yaar ye sab sun ke bhookh lag gayi','read',yesterdayAt(12,0)),
    msg('g5','u14','Lunch pe kahan gaye aaj?','read',yesterdayAt(12,5)),
    msg('g5','u11','Bhai office canteen, boring','read',yesterdayAt(12,8)),
    msg('g5','u1','Aaj shaam ko Turner road pe Sarvi mein biryani? Kaun aayega?','read',yesterdayAt(16,0)),
    msg('g5','u2','Main aati hoon!','read',yesterdayAt(16,5)),
    msg('g5','u8','Mujhe bhi lelo yaar','read',yesterdayAt(16,8)),
    msg('g5','u14','Same! 7 baje theek?','read',yesterdayAt(16,10)),
    msg('g5','u1','7 baje pakka. Sameer bhai bhi aao?','read',yesterdayAt(16,12)),
    msg('g5','u11','Kya baat hai! Ata hoon. Already bhookh lag rahi hai','delivered',todayAt(10,0)),

    // ── g6: Startup Founders Circle ──────────────────────────────────────────
    msg('g6','u7','Guys! Sequoia ne India fund double kiya. Big news for ecosystem','read',dAt(5,10,0)),
    msg('g6','u1','Wow! Is mein se kuch hum logon ke liye milega?','read',dAt(5,10,5)),
    msg('g6','u6','Haha Arjun, pehle traction dikhao phir funding aayegi','read',dAt(5,10,8)),
    msg('g6','u9','Bhai mere startup ka MVP ready hai. Investors kahan dhundhun?','read',dAt(5,10,12)),
    msg('g6','u7','AngelList aur LetsVenture pe profile banao pehle','read',dAt(5,10,15)),
    msg('g6','u13','YC bhi apply karo! Deadline next month hai','read',dAt(5,10,18)),
    msg('g6','u15','Bhai YC acceptance rate 2% hai, realistic expectations rakho','read',dAt(4,11,0)),
    msg('g6','u7','Aryan sahi keh raha hai. But try karo zaroor, kya pata','read',dAt(4,11,5)),
    msg('g6','u1','Better to try and fail than not try. Apply karo Aditya!','read',dAt(4,11,8)),
    msg('g6','u9','Thanks guys! Kabir bhai pitch deck review karoge?','read',dAt(3,14,0)),
    msg('g6','u7','Haan bhej! Is weekend dekh lunga','read',dAt(3,14,5)),
    msg('g6','u6','Ananya bhi dekh sakti hoon data section. ML pitch strong karo','read',dAt(3,14,8)),
    msg('g6','u9','Bahut help ho rahi hai is group se. Thanks guys','read',dAt(2,16,0)),
    msg('g6','u13','Startup journey lonely hoti hai akele. Isliye ye community important hai','read',dAt(2,16,5)),
    msg('g6','u7','Ekdum sahi baat. Ek dusre ko support karo, sab badhenge','read',dAt(2,16,8)),
    msg('g6','u15','NexTalk launch pe poori team ke liye equity chahiye fir!','read',dAt(1,12,0)),
    msg('g6','u1','Haha bhai, founding team mein le loon tumhe sab ko?','read',dAt(1,12,5)),
    msg('g6','u7','Now we are talking! Equity meeting kab hai?','read',dAt(1,12,8)),
    msg('g6','u6','Conference call lete hain this week. Serious ho toh','read',todayAt(10,0)),
    msg('g6','u1','Serious hoon! Friday 6 PM? Sab available ho?','delivered',todayAt(10,5)),
  ];

  const inserted = await Message.insertMany(all, {ordered:true});
  const chatLastMsg = {};
  all.forEach((raw,i) => {
    const key = Object.keys(chatMap).find(k => chatMap[k].toString() === raw.chat.toString());
    if (key) chatLastMsg[key] = inserted[i]._id;
  });
  console.log('  ' + inserted.length + ' messages created');
  return { inserted, chatLastMsg };
}

async function updateLastMessages(chatMap, chatLastMsg) {
  const updates = Object.entries(chatLastMsg).map(([k,v]) =>
    Chat.updateOne({_id:chatMap[k]}, {$set:{lastMessage:v}})
  );
  await Promise.all(updates);
  console.log('  lastMessage linked for ' + updates.length + ' chats');
}

async function seedNotifications(userMap, chatMap) {
  console.log('  Seeding notifications...');
  const a = userMap['u1'];
  const docs = [
    { recipient:a, sender:userMap['u2'],  type:NOTIFICATION_TYPES.MESSAGE,          title:'Priya Patel',           body:'Chai leke aana meeting mein aaj',          isRead:false, data:{chatId:chatMap['c1'].toString()},  createdAt:minutesAgo(2)  },
    { recipient:a, sender:userMap['u9'],  type:NOTIFICATION_TYPES.MESSAGE,          title:'Aditya Joshi',          body:'Kal ka BGMI match pakka hai na?',          isRead:false, data:{chatId:chatMap['c6'].toString()},  createdAt:minutesAgo(8)  },
    { recipient:a, sender:userMap['u3'],  type:NOTIFICATION_TYPES.MENTION,          title:'NexTalk Dev Team',      body:'Rohan Kumar ne tumhe mention kiya',        isRead:false, data:{chatId:chatMap['g1'].toString()},  createdAt:minutesAgo(15) },
    { recipient:a, sender:userMap['u4'],  type:NOTIFICATION_TYPES.MESSAGE,          title:'Sneha Desai',           body:'Salary discussion kal 5 baje yaad hai na?', isRead:false, data:{chatId:chatMap['c3'].toString()},  createdAt:hoursAgo(1)    },
    { recipient:a, sender:userMap['u7'],  type:NOTIFICATION_TYPES.MENTION,          title:'Startup Founders Circle',body:'Kabir Mehta ne equity ke baare mein poocha',isRead:false,data:{chatId:chatMap['g6'].toString()},  createdAt:hoursAgo(2)    },
    { recipient:a, sender:userMap['u5'],  type:NOTIFICATION_TYPES.CALL,             title:'Missed Call',           body:'Vikram Singh ne call kiya tha',            isRead:false, data:{},                                 createdAt:hoursAgo(3)    },
    { recipient:a, sender:userMap['u10'], type:NOTIFICATION_TYPES.CONTACT_REQUEST,  title:'Contact Request',       body:'Nisha Verma ne contact request bheji',     isRead:true,  readAt:hoursAgo(4), data:{userId:userMap['u10'].toString()}, createdAt:hoursAgo(5) },
    { recipient:a, sender:userMap['u15'], type:NOTIFICATION_TYPES.CONTACT_ACCEPTED, title:'Contact Accept Hua',    body:'Aryan Kapoor ab contacts mein hai',        isRead:true,  readAt:daysAgo(1), data:{userId:userMap['u15'].toString()}, createdAt:daysAgo(2) },
    { recipient:a, sender:userMap['u7'],  type:NOTIFICATION_TYPES.GROUP_INVITE,     title:'Group Invite',          body:'Kabir ne Startup Founders Circle mein add kiya', isRead:true, readAt:daysAgo(3), data:{chatId:chatMap['g6'].toString()}, createdAt:daysAgo(4) },
    { recipient:a, sender:null,           type:NOTIFICATION_TYPES.SYSTEM,           title:'NexTalk mein swagat!',  body:'Contacts add karo aur chat shuru karo',    isRead:true,  readAt:daysAgo(6), data:{},                                 createdAt:daysAgo(7) },
  ];
  await Notification.insertMany(docs);
  console.log('  ' + docs.length + ' notifications created');
}

async function seed() {
  console.log('\nNexTalk seed script — Large Indian dataset\n');
  await connectDatabase();
  await clearCollections();
  const userMap = await seedUsers();
  await seedContacts(userMap);
  const chatMap = await seedChats(userMap);
  const { chatLastMsg } = await seedMessages(userMap, chatMap);
  await updateLastMessages(chatMap, chatLastMsg);
  await seedNotifications(userMap, chatMap);

  console.log('\nSeed complete! Summary:');
  console.log('  15 users | 38 contacts | 18 chats | ~300 messages | 10 notifications');
  console.log('\nLogin credentials — password for all: ' + SEED_PASSWORD);
  const rows = [
    ['Arjun Sharma (main)',  'arjun@nextalk.app'],
    ['Priya Patel',          'priya@example.com'],
    ['Rohan Kumar',          'rohan@example.com'],
    ['Sneha Desai',          'sneha@example.com'],
    ['Vikram Singh',         'vikram@example.com'],
    ['Ananya Rao',           'ananya@example.com'],
    ['Kabir Mehta',          'kabir@example.com'],
    ['Isha Gupta',           'isha@example.com'],
    ['Aditya Joshi',         'aditya@example.com'],
    ['Nisha Verma',          'nisha@example.com'],
    ['Sameer Khan',          'sameer@example.com'],
    ['Deepika Nair',         'deepika@example.com'],
    ['Rahul Mishra',         'rahul@example.com'],
    ['Pooja Saxena',         'pooja@example.com'],
    ['Aryan Kapoor',         'aryan@example.com'],
  ];
  rows.forEach(([n,e]) => console.log('  ' + n.padEnd(22) + ' | ' + e));
  console.log('');
  await disconnectDatabase();
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
