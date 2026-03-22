/* FixIt — Shared Utilities
   segment.js · storage.js · auth.js · toast.js
   All pages include this file */

// ─────────────────────────────────────────
// 1. SEGMENT — Analytics wrapper
// ─────────────────────────────────────────
const Segment = {
  // Mirror all events to localStorage for dashboard use
  _save(event, props) {
    const events = JSON.parse(localStorage.getItem('fixit_events') || '[]');
    events.push({ event, props, ts: Date.now() });
    localStorage.setItem('fixit_events', JSON.stringify(events));
  },

  track(event, props = {}) {
    const user = Auth.current();
    const enriched = {
      ...props,
      userId: user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    };
    // Fire to Twilio Segment (analytics.js)
    if (window.analytics) {
      window.analytics.track(event, enriched);
    }
    // Mirror locally for dashboard
    this._save(event, enriched);
    console.log(`[Segment] ${event}`, enriched);
  },

  page(name, props = {}) {
    const user = Auth.current();
    const enriched = { ...props, userId: user?.id || 'anonymous', timestamp: new Date().toISOString() };
    if (window.analytics) window.analytics.page(name, enriched);
    this._save(`${name} Viewed`, enriched);
    console.log(`[Segment Page] ${name}`, enriched);
  },

  identify(userId, traits = {}) {
    if (window.analytics) window.analytics.identify(userId, traits);
    console.log(`[Segment Identify] ${userId}`, traits);
  }
};

// ─────────────────────────────────────────
// 2. STORAGE — localStorage helpers
// ─────────────────────────────────────────
const Store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(`fixit_${key}`)); }
    catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(`fixit_${key}`, JSON.stringify(val));
  },
  push(key, item) {
    const arr = this.get(key) || [];
    arr.push(item);
    this.set(key, arr);
    return arr;
  },
  update(key, id, updates) {
    const arr = this.get(key) || [];
    const idx = arr.findIndex(i => i.id === id);
    if (idx > -1) { arr[idx] = { ...arr[idx], ...updates }; this.set(key, arr); }
    return arr;
  }
};

// ─────────────────────────────────────────
// 3. AUTH — User session management
// ─────────────────────────────────────────
const Auth = {
  current() { return Store.get('currentUser'); },

  login(email, password) {
    const users = Store.get('users') || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      Store.set('currentUser', user);
      Segment.identify(user.id, { name: user.name, email: user.email });
      return { success: true, user };
    }
    return { success: false, error: 'Invalid email or password' };
  },

  register(name, email, password, phone = '') {
    const users = Store.get('users') || [];
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Email already registered' };
    }
    const user = {
      id: 'user_' + Date.now(),
      name, email, password, phone,
      address: '', city: '',
      createdAt: new Date().toISOString()
    };
    Store.push('users', user);
    Store.set('currentUser', user);
    Segment.identify(user.id, { name, email, phone, createdAt: user.createdAt });
    return { success: true, user };
  },

  logout() {
    localStorage.removeItem('fixit_currentUser');
  },

  require() {
    const user = this.current();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
  }
};

// ─────────────────────────────────────────
// 4. TOAST — Notification helper
// ─────────────────────────────────────────
const Toast = {
  show(msg, type = 'success', duration = 3000) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
  }
};

// ─────────────────────────────────────────
// 5. NAVBAR — Render + active state + auth
// ─────────────────────────────────────────
function renderNavbar(activePage = '') {
  const user = Auth.current();
  const pages = [
    { href: 'index.html', label: 'Home' },
    { href: 'services.html', label: 'Services' },
    { href: 'orders.html', label: 'My Orders' },
    { href: 'profile.html', label: 'Profile' },
  ];

  const links = pages.map(p =>
    `<li><a href="${p.href}" class="${activePage === p.label ? 'active' : ''}">${p.label}</a></li>`
  ).join('');

  const authHTML = user
    ? `<span style="font-size:0.85rem;color:var(--gray-mid);font-weight:500">Hi, ${user.name.split(' ')[0]}</span>
       <button class="btn btn-outline btn-sm" onclick="Auth.logout();location.href='index.html'">Logout</button>`
    : `<button class="btn btn-outline btn-sm" onclick="openAuthModal('login')">Login</button>
       <button class="btn btn-primary btn-sm" onclick="openAuthModal('register')">Sign Up</button>`;

  return `
    <nav class="navbar">
      <a href="index.html" class="nav-logo">Fix<span>It</span></a>
      <ul class="nav-links">${links}</ul>
      <div class="nav-actions">${authHTML}</div>
    </nav>`;
}

// ─────────────────────────────────────────
// 6. AUTH MODAL — Shared across pages
// ─────────────────────────────────────────
function renderAuthModal() {
  return `
  <div class="modal-overlay" id="authModal">
    <div class="modal">
      <div class="modal-tabs">
        <div class="modal-tab active" id="tabLogin" onclick="switchAuthTab('login')">Login</div>
        <div class="modal-tab" id="tabRegister" onclick="switchAuthTab('register')">Sign Up</div>
      </div>

      <!-- Login Form -->
      <div id="loginForm">
        <p class="modal-sub">Welcome back! Login to book services.</p>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="loginEmail" type="email" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="loginPassword" type="password" placeholder="••••••••">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px" onclick="handleLogin()">Login</button>
      </div>

      <!-- Register Form -->
      <div id="registerForm" style="display:none">
        <p class="modal-sub">Create an account to get started.</p>
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-input" id="regName" type="text" placeholder="Ravi Kumar">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="regEmail" type="email" placeholder="you@example.com">
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-input" id="regPhone" type="tel" placeholder="+91 98765 43210">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="regPassword" type="password" placeholder="Min 6 characters">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px" onclick="handleRegister()">Create Account</button>
      </div>

      <button onclick="closeAuthModal()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--gray-mid)">✕</button>
    </div>
  </div>`;
}

function openAuthModal(tab = 'login') {
  document.getElementById('authModal').classList.add('open');
  switchAuthTab(tab);
}
function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
}
function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLogin').className = 'modal-tab' + (tab === 'login' ? ' active' : '');
  document.getElementById('tabRegister').className = 'modal-tab' + (tab === 'register' ? ' active' : '');
}

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const result = Auth.login(email, password);
  if (result.success) {
    closeAuthModal();
    Toast.show(`Welcome back, ${result.user.name.split(' ')[0]}!`);
    setTimeout(() => location.reload(), 800);
  } else {
    Toast.show(result.error, 'error');
  }
}

function handleRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) return Toast.show('Please fill all fields', 'error');
  if (password.length < 6) return Toast.show('Password must be at least 6 characters', 'error');
  const result = Auth.register(name, email, password, phone);
  if (result.success) {
    closeAuthModal();
    Toast.show(`Account created! Welcome, ${name.split(' ')[0]}! 🎉`);
    setTimeout(() => location.reload(), 800);
  } else {
    Toast.show(result.error, 'error');
  }
}

// ─────────────────────────────────────────
// 7. SERVICE DATA — Single source of truth
// ─────────────────────────────────────────
const SERVICES = {
  plumbing: {
    id: 'plumbing',
    name: 'Plumbing',
    icon: '🔧',
    color: '#3B82F6',
    desc: 'Leaks, pipe repairs, installation & more',
    rating: 4.8,
    reviewCount: 2340,
    items: [
      { id: 'pl_01', name: 'Pipe Leak Repair', price: 349, duration: '1–2 hrs', icon: '💧' },
      { id: 'pl_02', name: 'Tap / Faucet Installation', price: 249, duration: '45 min', icon: '🚿' },
      { id: 'pl_03', name: 'Drain Cleaning', price: 449, duration: '1–3 hrs', icon: '🪣' },
      { id: 'pl_04', name: 'Water Heater Repair', price: 599, duration: '2 hrs', icon: '🔥' },
      { id: 'pl_05', name: 'Toilet Repair', price: 299, duration: '1 hr', icon: '🚽' },
    ]
  },
  electrical: {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    color: '#F59E0B',
    desc: 'Wiring, switches, fans & appliances',
    rating: 4.7,
    reviewCount: 1890,
    items: [
      { id: 'el_01', name: 'Fan Installation', price: 299, duration: '1 hr', icon: '🌀' },
      { id: 'el_02', name: 'Switch / Socket Repair', price: 199, duration: '30 min', icon: '🔌' },
      { id: 'el_03', name: 'MCB / Fuse Fix', price: 349, duration: '1 hr', icon: '⚡' },
      { id: 'el_04', name: 'Light Fixture Install', price: 249, duration: '45 min', icon: '💡' },
      { id: 'el_05', name: 'Geyser Installation', price: 549, duration: '2 hrs', icon: '🔋' },
    ]
  },
  cleaning: {
    id: 'cleaning',
    name: 'Cleaning',
    icon: '🧹',
    color: '#22C55E',
    desc: 'Deep clean, sofa, kitchen & bathroom',
    rating: 4.9,
    reviewCount: 3120,
    items: [
      { id: 'cl_01', name: 'Full Home Deep Clean', price: 1199, duration: '4–6 hrs', icon: '🏠' },
      { id: 'cl_02', name: 'Kitchen Deep Clean', price: 699, duration: '2–3 hrs', icon: '🍳' },
      { id: 'cl_03', name: 'Bathroom Cleaning', price: 399, duration: '1–2 hrs', icon: '🚿' },
      { id: 'cl_04', name: 'Sofa / Carpet Clean', price: 499, duration: '2 hrs', icon: '🛋️' },
      { id: 'cl_05', name: 'Post-Renovation Clean', price: 1499, duration: '6–8 hrs', icon: '🧽' },
    ]
  },
  carpentry: {
    id: 'carpentry',
    name: 'Carpentry',
    icon: '🪚',
    color: '#8B5CF6',
    desc: 'Furniture assembly, repair & custom work',
    rating: 4.6,
    reviewCount: 1240,
    items: [
      { id: 'ca_01', name: 'Furniture Assembly', price: 449, duration: '2 hrs', icon: '🪑' },
      { id: 'ca_02', name: 'Door / Lock Repair', price: 349, duration: '1 hr', icon: '🚪' },
      { id: 'ca_03', name: 'Wall Shelf Install', price: 299, duration: '1 hr', icon: '📚' },
      { id: 'ca_04', name: 'Bed Frame Repair', price: 499, duration: '2 hrs', icon: '🛏️' },
      { id: 'ca_05', name: 'Cabinet Repair', price: 399, duration: '1–2 hrs', icon: '🗄️' },
    ]
  }
};

// Seed demo users if empty
(function seedDemoData() {
  const users = Store.get('users');
  if (users && users.length > 0) return;

  const demoUsers = [
    { id: 'user_demo1', name: 'Priya Sharma', email: 'priya@demo.com', password: 'demo123', phone: '9876543210', city: 'Chennai', createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString() },
    { id: 'user_demo2', name: 'Arjun Mehta', email: 'arjun@demo.com', password: 'demo123', phone: '9123456789', city: 'Chennai', createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString() },
    { id: 'user_demo3', name: 'Sneha Rao', email: 'sneha@demo.com', password: 'demo123', phone: '9988776655', city: 'Chennai', createdAt: new Date(Date.now() - 7*24*60*60*1000).toISOString() },
  ];
  Store.set('users', demoUsers);

  // Seed bookings
  const demoBookings = [
    { id: 'bk_001', userId: 'user_demo1', category: 'plumbing', serviceName: 'Pipe Leak Repair', serviceId: 'pl_01', price: 349, date: '2025-03-10', time: '10:00 AM', status: 'completed', createdAt: new Date(Date.now() - 25*24*60*60*1000).toISOString() },
    { id: 'bk_002', userId: 'user_demo1', category: 'plumbing', serviceName: 'Drain Cleaning', serviceId: 'pl_03', price: 449, date: '2025-03-18', time: '2:00 PM', status: 'completed', createdAt: new Date(Date.now() - 17*24*60*60*1000).toISOString() },
    { id: 'bk_003', userId: 'user_demo1', category: 'electrical', serviceName: 'Fan Installation', serviceId: 'el_01', price: 299, date: '2025-03-22', time: '11:00 AM', status: 'completed', createdAt: new Date(Date.now() - 13*24*60*60*1000).toISOString() },
    { id: 'bk_004', userId: 'user_demo1', category: 'plumbing', serviceName: 'Tap / Faucet Installation', serviceId: 'pl_02', price: 249, date: '2025-04-01', time: '9:00 AM', status: 'completed', createdAt: new Date(Date.now() - 5*24*60*60*1000).toISOString() },
    { id: 'bk_005', userId: 'user_demo2', category: 'cleaning', serviceName: 'Full Home Deep Clean', serviceId: 'cl_01', price: 1199, date: '2025-03-20', time: '8:00 AM', status: 'completed', createdAt: new Date(Date.now() - 15*24*60*60*1000).toISOString() },
    { id: 'bk_006', userId: 'user_demo2', category: 'cleaning', serviceName: 'Kitchen Deep Clean', serviceId: 'cl_02', price: 699, date: '2025-04-02', time: '10:00 AM', status: 'completed', createdAt: new Date(Date.now() - 4*24*60*60*1000).toISOString() },
    { id: 'bk_007', userId: 'user_demo2', category: 'cleaning', serviceName: 'Bathroom Cleaning', serviceId: 'cl_03', price: 399, date: '2025-04-05', time: '3:00 PM', status: 'upcoming', createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() },
    { id: 'bk_008', userId: 'user_demo3', category: 'carpentry', serviceName: 'Furniture Assembly', serviceId: 'ca_01', price: 449, date: '2025-04-03', time: '11:00 AM', status: 'upcoming', createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString() },
  ];
  Store.set('bookings', demoBookings);

  // Seed some events for dashboard
  const now = Date.now();
  const demoEvents = [
    { event: 'Plumbing Service Viewed', props: { userId: 'user_demo1', serviceName: 'Pipe Leak Repair', category: 'plumbing', price: 349 }, ts: now - 26*24*60*60*1000 },
    { event: 'Plumbing Booking Started', props: { userId: 'user_demo1', serviceName: 'Pipe Leak Repair', category: 'plumbing', price: 349 }, ts: now - 26*24*60*60*1000 },
    { event: 'Plumbing Booking Confirmed', props: { userId: 'user_demo1', serviceName: 'Pipe Leak Repair', category: 'plumbing', price: 349, bookingId: 'bk_001' }, ts: now - 25*24*60*60*1000 },
    { event: 'Plumbing Service Viewed', props: { userId: 'user_demo1', serviceName: 'Drain Cleaning', category: 'plumbing', price: 449 }, ts: now - 18*24*60*60*1000 },
    { event: 'Plumbing Booking Confirmed', props: { userId: 'user_demo1', serviceName: 'Drain Cleaning', category: 'plumbing', price: 449, bookingId: 'bk_002' }, ts: now - 17*24*60*60*1000 },
    { event: 'Electrical Service Viewed', props: { userId: 'user_demo1', serviceName: 'Fan Installation', category: 'electrical', price: 299 }, ts: now - 14*24*60*60*1000 },
    { event: 'Electrical Booking Confirmed', props: { userId: 'user_demo1', serviceName: 'Fan Installation', category: 'electrical', price: 299, bookingId: 'bk_003' }, ts: now - 13*24*60*60*1000 },
    { event: 'Plumbing Service Viewed', props: { userId: 'user_demo1', serviceName: 'Tap / Faucet Installation', category: 'plumbing', price: 249 }, ts: now - 6*24*60*60*1000 },
    { event: 'Plumbing Booking Confirmed', props: { userId: 'user_demo1', serviceName: 'Tap / Faucet Installation', category: 'plumbing', price: 249, bookingId: 'bk_004' }, ts: now - 5*24*60*60*1000 },
    { event: 'Cleaning Service Viewed', props: { userId: 'user_demo2', serviceName: 'Full Home Deep Clean', category: 'cleaning', price: 1199 }, ts: now - 16*24*60*60*1000 },
    { event: 'Cleaning Booking Confirmed', props: { userId: 'user_demo2', serviceName: 'Full Home Deep Clean', category: 'cleaning', price: 1199, bookingId: 'bk_005' }, ts: now - 15*24*60*60*1000 },
    { event: 'Plumbing Service Viewed', props: { userId: 'user_demo2', serviceName: 'Pipe Leak Repair', category: 'plumbing', price: 349 }, ts: now - 10*24*60*60*1000 },
    { event: 'Cleaning Booking Confirmed', props: { userId: 'user_demo2', serviceName: 'Kitchen Deep Clean', category: 'cleaning', price: 699, bookingId: 'bk_006' }, ts: now - 4*24*60*60*1000 },
    { event: 'Cleaning Booking Started', props: { userId: 'user_demo2', serviceName: 'Bathroom Cleaning', category: 'cleaning', price: 399 }, ts: now - 3*24*60*60*1000 },
    { event: 'Cleaning Booking Confirmed', props: { userId: 'user_demo2', serviceName: 'Bathroom Cleaning', category: 'cleaning', price: 399, bookingId: 'bk_007' }, ts: now - 1*24*60*60*1000 },
    { event: 'Carpentry Service Viewed', props: { userId: 'user_demo3', serviceName: 'Furniture Assembly', category: 'carpentry', price: 449 }, ts: now - 3*24*60*60*1000 },
    { event: 'Electrical Service Viewed', props: { userId: 'user_demo3', serviceName: 'Switch / Socket Repair', category: 'electrical', price: 199 }, ts: now - 3*24*60*60*1000 },
    { event: 'Carpentry Booking Started', props: { userId: 'user_demo3', serviceName: 'Furniture Assembly', category: 'carpentry', price: 449 }, ts: now - 2*24*60*60*1000 },
    { event: 'Carpentry Booking Confirmed', props: { userId: 'user_demo3', serviceName: 'Furniture Assembly', category: 'carpentry', price: 449, bookingId: 'bk_008' }, ts: now - 2*24*60*60*1000 },
    // Abandoned booking example
    { event: 'Electrical Booking Started', props: { userId: 'user_demo3', serviceName: 'Fan Installation', category: 'electrical', price: 299, lastStepReached: 'date_selection' }, ts: now - 1*24*60*60*1000 },
  ];
  localStorage.setItem('fixit_events', JSON.stringify(demoEvents));
})();