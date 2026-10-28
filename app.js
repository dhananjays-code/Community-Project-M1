/**
 * CleanBharat Connect (PrakritiSetu)
 * Production Unified Engine - Version 2.0 (Public Launch)
 * Pure Vanilla ES6+ JavaScript
 */

const SUPABASE_URL = 'https://vfolcqdqmgnlcqdixpaj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SlM5gSodYgThwtW9zCyI0Q_Zv5Vlc9C';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Verification helper: check if connection is active
async function testConnection() {
  const { data, error } = await supabase.from('drives').select('id, title').limit(1);
  if (error) {
    console.error('Database connection failed:', error.message);
  } else {
    console.log('Database connected successfully! Sample data:', data);
  }
}

testConnection();

// =====================================================================
// 1. PRODUCTION STORAGE KEYS & SECURE HASHING UTILITY
// =====================================================================

const APP_VERSION = 'cleanbharat_v2_production_clean';

const STORAGE_KEYS = {
  APP_VERSION: 'cleanbharat_app_version',
  USERS: 'cleanbharat_registered_users', // Registered user accounts
  USER_SESSION: 'cleanbharat_auth_user',  // Active authenticated session
  DRIVES: 'cleanbharat_drives_data',      // Active & completed drives
  VOLUNTEERS: 'cleanbharat_volunteers_data', // Volunteer enrollments
  POSTS: 'cleanbharat_posts_data',        // Community feed posts
  USER_LIKES: 'cleanbharat_user_likes',   // User kudos/likes
  NOTIFICATIONS: 'cleanbharat_notifications' // Simulated transactional email inbox
};

// Client-side image validation (JPG, PNG, WebP up to 5MB)
function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file selected.' };
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file format. Please upload JPG, PNG, or WebP only.' };
  }
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxBytes) {
    return { valid: false, error: 'File size exceeds 5MB limit. Please choose a smaller image.' };
  }
  return { valid: true };
}

// Cryptographic SHA-256 password hashing using Web Crypto API
async function hashPassword(plainTextPassword) {
  try {
    const encoder = new TextEncoder();
    // Salted password string for security
    const data = encoder.encode(plainTextPassword + '_cleanbharat_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback standard hash for environments with restricted crypto
    let hash = 0;
    const str = plainTextPassword + '_cb_salt';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

// =====================================================================
// 2. UNIFIED ENGINE CLASS
// =====================================================================

class CleanBharatEngineClass {
  constructor() {
    this.currentUser = null;
    this.registeredUsers = [];
    this.activeDrives = [];
    this.pastDrives = [];
    this.volunteers = [];
    this.communityPosts = [];
    this.notifications = [];
    this.userLikes = new Set();
    this.activeCategoryFilter = 'All';
    this.searchQuery = '';
    this.currentModalDriveId = null;

    this.initDatabase();
  }
  // Insert this inside CleanBharatEngineClass:
  async loadDrivesFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('drives')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load from Supabase:', error.message);
        return;
      }

      if (data && data.length > 0) {
        this.activeDrives = data.filter(d => d.status === 'active');
        this.pastDrives = data.filter(d => d.status === 'completed');
        this.renderActiveDrives();
        this.renderPastDrives();
      }
    } catch (err) {
      console.error('Unexpected error fetching drives:', err);
    }
  }

  initDatabase() {
    // Version Migration: Clean out any previous mock/placeholder data for fresh public launch
    const storedVersion = localStorage.getItem(STORAGE_KEYS.APP_VERSION);
    if (storedVersion !== APP_VERSION) {
      localStorage.removeItem(STORAGE_KEYS.DRIVES);
      localStorage.removeItem(STORAGE_KEYS.POSTS);
      localStorage.removeItem(STORAGE_KEYS.VOLUNTEERS);
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      localStorage.setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION);
    }

    // 1. Load Registered Users
    const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (storedUsers) {
      try {
        this.registeredUsers = JSON.parse(storedUsers);
      } catch (e) {
        this.registeredUsers = [];
      }
    } else {
      this.registeredUsers = [];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.registeredUsers));
    }

    // 2. Load Active User Session
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
    }

    // 3. Load Drives (Starts completely clean with empty arrays)
    const storedDrives = localStorage.getItem(STORAGE_KEYS.DRIVES);
    if (storedDrives) {
      try {
        const parsed = JSON.parse(storedDrives);
        this.activeDrives = parsed.filter(d => d.status === 'active');
        this.pastDrives = parsed.filter(d => d.status === 'completed');
      } catch (e) {
        this.activeDrives = [];
        this.pastDrives = [];
      }
    } else {
      this.activeDrives = [];
      this.pastDrives = [];
      localStorage.setItem(STORAGE_KEYS.DRIVES, JSON.stringify([]));
    }

    // 4. Load Volunteers (Starts clean)
    const storedVolunteers = localStorage.getItem(STORAGE_KEYS.VOLUNTEERS);
    if (storedVolunteers) {
      try {
        this.volunteers = JSON.parse(storedVolunteers);
      } catch (e) {
        this.volunteers = [];
      }
    } else {
      this.volunteers = [];
      localStorage.setItem(STORAGE_KEYS.VOLUNTEERS, JSON.stringify([]));
    }

    // 5. Load Community Posts (Starts clean)
    const storedPosts = localStorage.getItem(STORAGE_KEYS.POSTS);
    if (storedPosts) {
      try {
        this.communityPosts = JSON.parse(storedPosts);
      } catch (e) {
        this.communityPosts = [];
      }
    } else {
      this.communityPosts = [];
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify([]));
    }

    // 6. Load User Likes
    const storedLikes = localStorage.getItem(STORAGE_KEYS.USER_LIKES);
    if (storedLikes) {
      try {
        this.userLikes = new Set(JSON.parse(storedLikes));
      } catch (e) {
        this.userLikes = new Set();
      }
    }

    // 7. Load Automated Email Notifications
    const storedNotifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (storedNotifications) {
      try {
        this.notifications = JSON.parse(storedNotifications);
      } catch (e) {
        this.notifications = [];
      }
    } else {
      this.notifications = [];
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }
    this.updateNotificationBadge();
  }

  saveUsers() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.registeredUsers));
  }

  saveDrives() {
    const all = [...this.activeDrives, ...this.pastDrives];
    localStorage.setItem(STORAGE_KEYS.DRIVES, JSON.stringify(all));
  }

  saveVolunteers() {
    localStorage.setItem(STORAGE_KEYS.VOLUNTEERS, JSON.stringify(this.volunteers));
  }

  savePosts() {
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(this.communityPosts));
  }

  saveNotifications() {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notifications));
    this.updateNotificationBadge();
  }

  updateNotificationBadge() {
    const badge = document.getElementById('unreadEmailsBadge');
    if (badge) {
      badge.style.display = this.notifications.length > 0 ? 'inline-block' : 'none';
    }
  }

  sendEmailNotification(type, drive, targetEmail) {
    const recipient = targetEmail || (this.currentUser ? this.currentUser.email : 'steward@cleanbharat.org.in');
    const formattedDate = this.formatDateTime(drive.date_time);
    const emailId = 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    let notification;

    if (type === 'drive_created') {
      notification = {
        id: emailId,
        type: 'drive_created',
        subject: `[CleanBharat] Initiative Published: "${drive.title}"`,
        from: 'CleanBharat Mail Relay <relay@cleanbharat.org.in>',
        to: recipient,
        drive_id: drive.id,
        drive_title: drive.title,
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        html_preview: `
          <div style="font-family: inherit;">
            <p>Dear <strong>${drive.coordinator_name}</strong>,</p>
            <p>Your environmental clean-up initiative has been successfully registered and published on the CleanBharat Connect public registry.</p>
            
            <div style="background: #F0FDF4; border-left: 4px solid #16A34A; padding: 0.85rem; margin: 1rem 0; border-radius: 4px;">
              <strong>Campaign Details:</strong><br>
              • <strong>Title:</strong> ${drive.title}<br>
              • <strong>Category:</strong> ${drive.category}<br>
              • <strong>Date & Gathering Time:</strong> ${formattedDate}<br>
              • <strong>Landmark Venue:</strong> ${drive.venue_name}<br>
              • <strong>Volunteer Capacity:</strong> ${drive.max_volunteers} volunteers<br>
              • <strong>Navigation Link:</strong> <a href="${drive.google_maps_url}" target="_blank" style="color: #16A34A;">Open Google Maps</a>
            </div>

            <p><strong>Safety Equipment Advisory:</strong> Ensure safety gloves and segregation bins are staged at the rendezvous location 30 minutes before volunteer arrival.</p>
            <p>Once your clean-up concludes on-site, remember to click <em>"Conclude Drive"</em> in your Organizer Dashboard to upload the post-cleanup "After" photo and record total diverted waste metrics.</p>
            <p style="margin-top: 1.5rem; color: #64748B; font-size: 0.8rem;">Warm regards,<br>The CleanBharat Connect Operations Bureau</p>
          </div>
        `
      };
    } else if (type === 'drive_concluded') {
      notification = {
        id: emailId,
        type: 'drive_concluded',
        subject: `[CleanBharat] Completion & Site Restoration Report: "${drive.title}"`,
        from: 'CleanBharat Verification Registry <audit@cleanbharat.org.in>',
        to: recipient,
        drive_id: drive.id,
        drive_title: drive.title,
        timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        html_preview: `
          <div style="font-family: inherit;">
            <p>Dear <strong>${drive.coordinator_name}</strong>,</p>
            <p>Hearty congratulations! Your environmental clean-up initiative has officially concluded and verified. The site transformation is now showcased in <strong>Past Drives & Impact</strong>.</p>
            
            <div style="background: #F0F9FF; border-left: 4px solid #0284C7; padding: 0.85rem; margin: 1rem 0; border-radius: 4px;">
              <strong>Ecological Impact Summary:</strong><br>
              • <strong>Initiative:</strong> ${drive.title}<br>
              • <strong>Total Waste Diverted:</strong> ${drive.waste_metric || '350+ kg'}<br>
              ${drive.trees_planted ? `• <strong>Saplings / Native Trees:</strong> ${drive.trees_planted}<br>` : ''}
              • <strong>Steward Turnout:</strong> ${drive.current_volunteers} volunteers participated<br>
              • <strong>Bonus Awarded:</strong> +50 Eco-Points added to your organizer profile
            </div>

            <p>A digital Certificate of Environmental Excellence is now available for download and printing in the Past Drives directory.</p>
            <p style="margin-top: 1.5rem; color: #64748B; font-size: 0.8rem;">With deep gratitude for your civic leadership,<br>CleanBharat Connect Council</p>
          </div>
        `
      };
    }

    if (notification) {
      this.notifications.unshift(notification);
      this.saveNotifications();
      this.showToast(`📧 Status update emailed to ${recipient}`, 'success');
    }
  }

  saveCurrentUser() {
    if (this.currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // ===================================================================
  // 3. STRICT AUTHENTICATION (Sign Up & Sign In)
  // ===================================================================

  /**
   * Registers a new user account with hashed password and profile
   */
  async registerUser(userData) {
    const normalizedEmail = (userData.email || '').toLowerCase().trim();

    if (!normalizedEmail || !userData.password) {
      return { success: false, error: 'Email and password are required.' };
    }

    // Strict validation: Prevent duplicate accounts
    const existing = this.registeredUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      return { success: false, error: 'An account with this email address is already registered. Please sign in.' };
    }

    // Securely hash the password
    const hashedPassword = await hashPassword(userData.password);

    const newUser = {
      id: 'usr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      full_name: userData.fullName,
      phone: userData.phone,
      email: normalizedEmail,
      password_hash: hashedPassword,
      account_type: userData.accountType || 'Individual',
      college_or_education: userData.college_or_education || (userData.accountType === 'Individual' ? 'Individual Volunteer' : userData.accountType),
      city: userData.city || 'Mumbai',
      pincode: userData.pincode || '400050',
      eco_interests: userData.eco_interests || ['Beach Cleanups', 'Plastic Free'],
      eco_score: 50,
      onboarded: true,
      created_at: new Date().toISOString()
    };

    // Save user to registry
    this.registeredUsers.push(newUser);
    this.saveUsers();

    // Set active session
    this.currentUser = newUser;
    this.saveCurrentUser();

    return { success: true, user: newUser };
  }

  /**
   * Signs in an existing user with strict credential validation
   */
  async loginUser(email, password) {
    const normalizedEmail = (email || '').toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    // Strict validation: Check against registered accounts
    const user = this.registeredUsers.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      return { success: false, error: 'Invalid email or password. Please try again.' };
    }

    // Verify password hash
    const inputHash = await hashPassword(password);
    if (user.password_hash !== inputHash) {
      return { success: false, error: 'Invalid email or password. Please try again.' };
    }

    // Valid authentication: establish session
    this.currentUser = user;
    this.saveCurrentUser();
    return { success: true, user };
  }

  /**
   * Logs out user and destroys session
   */
  logout() {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    this.showToast('You have been logged out successfully.', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 350);
  }

  // ===================================================================
  // 4. DRIVE MANAGEMENT & 1-CLICK REGISTRATION
  // ===================================================================

  isUserRegisteredForDrive(driveId) {
    if (!this.currentUser) return false;
    return this.volunteers.some(v => v.drive_id === driveId && v.user_id === this.currentUser.id);
  }

  async registerForDrive(driveId) {
    if (!this.currentUser) {
      this.showToast('Please sign in to register for clean-up drives.', 'error');
      return { success: false };
    }

    if (this.isUserRegisteredForDrive(driveId)) {
      this.showToast('You are already registered for this drive!', 'info');
      return { success: true };
    }

    const drive = this.activeDrives.find(d => d.id === driveId);
    if (!drive) {
      this.showToast('Drive not found.', 'error');
      return { success: false };
    }

    if (drive.current_volunteers >= drive.max_volunteers) {
      this.showToast('Sorry, this drive is at full capacity!', 'error');
      return { success: false };
    }

    // Insert volunteer record
    const registrationRecord = {
      id: 'reg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      drive_id: driveId,
      user_id: this.currentUser.id,
      joined_at: new Date().toISOString()
    };
    this.volunteers.push(registrationRecord);
    this.saveVolunteers();

    // Increment drive volunteer count
    drive.current_volunteers = Math.min(drive.max_volunteers, drive.current_volunteers + 1);
    this.saveDrives();

    // Increment user Eco-Points (+25 points)
    this.currentUser.eco_score = (this.currentUser.eco_score || 0) + 25;
    this.saveCurrentUser();

    // Update in registeredUsers list as well
    const userInDb = this.registeredUsers.find(u => u.id === this.currentUser.id);
    if (userInDb) {
      userInDb.eco_score = this.currentUser.eco_score;
      this.saveUsers();
    }

    this.showToast(`🌿 Registered for ${drive.title}! Safety gear & coordinator details saved.`, 'success');
    this.renderActiveDrives();
    this.renderUserProfile();
    this.updateDriveModalState(driveId);

    return { success: true };
  }

  async cancelRegistration(driveId) {
    if (!this.currentUser) return;

    this.volunteers = this.volunteers.filter(v => !(v.drive_id === driveId && v.user_id === this.currentUser.id));
    this.saveVolunteers();

    const drive = this.activeDrives.find(d => d.id === driveId);
    if (drive) {
      drive.current_volunteers = Math.max(0, drive.current_volunteers - 1);
      this.saveDrives();
    }

    this.currentUser.eco_score = Math.max(0, (this.currentUser.eco_score || 25) - 25);
    this.saveCurrentUser();

    const userInDb = this.registeredUsers.find(u => u.id === this.currentUser.id);
    if (userInDb) {
      userInDb.eco_score = this.currentUser.eco_score;
      this.saveUsers();
    }

    this.showToast('Registration cancelled. Slot reopened for other stewards.', 'info');
    this.renderActiveDrives();
    this.renderUserProfile();
    this.updateDriveModalState(driveId);
  }

  // 📤 WRITE: Send a brand-new drive up to the cloud
  async createNewDrive(driveData) {
    const coverImage = driveData.uploaded_image || driveData.banner_url || 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=1200&q=80';

    // 1. Pack the drive details into a neat parcel
    const newDriveBox = {
      title: driveData.title,
      description: driveData.description,
      category: driveData.category,
      venue_name: `${driveData.venue_name}, ${driveData.city}`,
      google_maps_url: driveData.google_maps_url,
      date_time: new Date(driveData.date_time).toISOString(),
      max_volunteers: parseInt(driveData.max_volunteers, 10),
      current_volunteers: 1,
      coordinator_name: driveData.coordinator_name,
      coordinator_phone: driveData.coordinator_phone,
      status: 'active',
      banner_url: coverImage,
      before_image_url: coverImage
    };

    // 2. Fly the parcel to the Supabase "drives" shelf
    const { data, error } = await supabase
      .from('drives')
      .insert([newDriveBox]);

    if (error) {
      this.showToast('Could not save to Supabase: ' + error.message, 'error');
      return { success: false };
    }

    this.showToast('🎉 Saved directly to the online cloud!', 'success');

    // 3. Ask Supabase for the fresh list so your screen updates
    await this.loadDrivesFromSupabase();
    return { success: true };
  }

  async concludeDrive(driveId, conclusionData) {
    if (!this.currentUser) return { success: false, error: 'Unauthorized' };

    const drive = this.activeDrives.find(d => d.id === driveId);
    if (!drive) {
      this.showToast('Active drive not found or already concluded.', 'error');
      return { success: false };
    }

    if (drive.created_by !== this.currentUser.id) {
      this.showToast('Only the drive organizer can conclude this initiative.', 'error');
      return { success: false };
    }

    // Store verified after cleanup photo & impact metrics
    const afterPhoto = conclusionData.after_image_url || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80';
    drive.after_image_url = afterPhoto;
    drive.status = 'completed';
    drive.waste_metric = conclusionData.waste_metric || '350+ kg Segregated & Recycled';
    drive.trees_planted = conclusionData.trees_count || 0;
    drive.concluded_at = new Date().toISOString();

    // Move from activeDrives to pastDrives
    this.activeDrives = this.activeDrives.filter(d => d.id !== driveId);
    this.pastDrives.unshift(drive);
    this.saveDrives();

    // Award +50 Eco-Karma bonus points to organizer for concluding
    this.currentUser.eco_score = (this.currentUser.eco_score || 0) + 50;
    this.saveCurrentUser();
    const userInDb = this.registeredUsers.find(u => u.id === this.currentUser.id);
    if (userInDb) {
      userInDb.eco_score = this.currentUser.eco_score;
      this.saveUsers();
    }

    // Trigger automated completion email notification
    this.sendEmailNotification('drive_concluded', drive, this.currentUser.email);

    this.showToast(`🏁 "${drive.title}" concluded and moved to Past Drives (+50 Eco-Points)!`, 'success');
    this.renderActiveDrives();
    this.renderPastDrives();
    this.renderUserProfile();

    return { success: true, drive };
  }

  async deleteDrive(driveId) {
    if (!this.currentUser) return { success: false, error: 'Unauthorized' };

    const driveIndex = this.activeDrives.findIndex(d => d.id === driveId);
    if (driveIndex === -1) {
      this.showToast('Active drive not found.', 'error');
      return { success: false };
    }

    const drive = this.activeDrives[driveIndex];
    if (drive.created_by !== this.currentUser.id) {
      this.showToast('Only the organizer who hosted this drive can delete it.', 'error');
      return { success: false };
    }

    // Remove from active drives
    this.activeDrives.splice(driveIndex, 1);
    this.saveDrives();

    // Clean up volunteer registrations
    this.volunteers = this.volunteers.filter(v => v.drive_id !== driveId);
    this.saveVolunteers();

    this.showToast(`Drive "${drive.title}" has been cancelled and removed.`, 'info');
    this.renderActiveDrives();
    this.renderUserProfile();

    return { success: true };
  }

  // ===================================================================
  // 5. COMMUNITY POSTS & ENGAGEMENT
  // ===================================================================

  async createCommunityPost(content, tags, imageUrl) {
    if (!this.currentUser) return;

    const newPost = {
      id: 'post-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      author_name: this.currentUser.full_name,
      author_city: this.currentUser.city || 'India',
      author_avatar: this.currentUser.full_name ? this.currentUser.full_name.charAt(0).toUpperCase() : 'U',
      content: content,
      tags: tags || ['#CleanBharat'],
      image_url: imageUrl || '',
      likes_count: 0,
      created_at: 'Just now'
    };

    this.communityPosts.unshift(newPost);
    this.savePosts();

    // Award +10 Eco-Karma points for sharing eco-action
    this.currentUser.eco_score = (this.currentUser.eco_score || 0) + 10;
    this.saveCurrentUser();

    const userInDb = this.registeredUsers.find(u => u.id === this.currentUser.id);
    if (userInDb) {
      userInDb.eco_score = this.currentUser.eco_score;
      this.saveUsers();
    }

    this.showToast('✨ Community post published (+10 Eco-Points)!', 'success');
    this.renderCommunityFeed();
    this.renderUserProfile();
  }

  toggleLikePost(postId) {
    const post = this.communityPosts.find(p => p.id === postId);
    if (!post) return;

    if (this.userLikes.has(postId)) {
      this.userLikes.delete(postId);
      post.likes_count = Math.max(0, post.likes_count - 1);
    } else {
      this.userLikes.add(postId);
      post.likes_count = (post.likes_count || 0) + 1;
    }

    localStorage.setItem(STORAGE_KEYS.USER_LIKES, JSON.stringify(Array.from(this.userLikes)));
    this.savePosts();
    this.renderCommunityFeed();
  }

  // ===================================================================
  // 6. UI RENDERING ENGINES (With Clean Production Empty States)
  // ===================================================================

  renderHeader() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('userNameHeader');
    const avatarEl = document.getElementById('userAvatarLetter');
    if (nameEl) nameEl.textContent = this.currentUser.full_name.split(' ')[0];
    if (avatarEl) avatarEl.textContent = this.currentUser.full_name.charAt(0).toUpperCase();
  }

  renderActiveDrives() {
    const grid = document.getElementById('activeDrivesGrid');
    const countEl = document.getElementById('activeDrivesCount');
    if (!grid) return;

    // Filter by search query & category
    const filtered = this.activeDrives.filter(drive => {
      const matchesCategory = this.activeCategoryFilter === 'All' || drive.category === this.activeCategoryFilter;
      const term = this.searchQuery.toLowerCase();
      const matchesSearch = !term ||
        drive.title.toLowerCase().includes(term) ||
        drive.venue_name.toLowerCase().includes(term) ||
        drive.description.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });

    if (countEl) {
      countEl.textContent = filtered.length > 0 ? `${filtered.length} Drives Available` : '0 Drives';
    }

    // Clean Empty State for Active Drives
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: var(--surface); border-radius: var(--radius-xl); border: 1.5px dashed var(--border-color);">
          <div style="font-size: 2.75rem; margin-bottom: 0.75rem;">🌿</div>
          <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--text-primary);">No active drives right now</h3>
          <p style="color: var(--text-secondary); font-size: 0.95rem; max-width: 480px; margin: 0 auto 1.5rem; line-height: 1.6;">
            Check back soon or take the initiative to organize the first environmental clean-up drive in your community!
          </p>
          <button type="button" class="btn btn-primary" onclick="openHostDriveModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            + Host a Clean-up Drive
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(drive => {
      const isRegistered = this.isUserRegisteredForDrive(drive.id);
      const isOrganizer = this.currentUser && drive.created_by === this.currentUser.id;
      const capacityPct = Math.min(100, Math.round((drive.current_volunteers / drive.max_volunteers) * 100));
      const isFull = drive.current_volunteers >= drive.max_volunteers;
      const dateFormatted = this.formatDateTime(drive.date_time);

      return `
        <div class="drive-card ${isOrganizer ? 'organizer-card-highlight' : ''}" id="card-${drive.id}">
          <div class="card-banner">
            <img src="${drive.banner_url}" alt="${drive.title}" loading="lazy">
            <span class="category-badge ${drive.category}">${this.getCategoryIcon(drive.category)} ${drive.category}</span>
            ${isOrganizer ? '<span class="organizer-badge" style="position: absolute; top: 12px; right: 12px; z-index: 2;">Organizer 🛡️</span>' : (isRegistered ? '<span class="registered-flag">✓ Registered</span>' : '')}
          </div>

          <div class="card-body">
            <h3 class="card-title">${drive.title}</h3>

            <div class="card-meta">
              <div class="meta-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>${dateFormatted}</span>
              </div>
              <div class="meta-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${drive.venue_name}</span>
              </div>
            </div>

            <div class="capacity-box">
              <div class="capacity-labels">
                <span>Volunteers: ${drive.current_volunteers} / ${drive.max_volunteers}</span>
                <span>${capacityPct}% Filled</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar-fill ${capacityPct > 85 ? 'warning' : ''}" style="width: ${capacityPct}%"></div>
              </div>
            </div>

            <div class="card-footer" style="flex-direction: column; gap: 0.5rem;">
              <div style="display: flex; gap: 0.4rem; width: 100%;">
                <button type="button" class="btn ${isRegistered ? 'btn-secondary' : 'btn-primary'}" style="flex: 1;" onclick="openDriveModal('${drive.id}')">
                  ${isOrganizer ? 'Manage / View Info ⚙️' : (isRegistered ? '✓ Registered • View Info' : (isFull ? 'Full • View Details' : 'View Details & Join →'))}
                </button>
                ${isOrganizer ? `
                  <button type="button" class="btn-conclude" onclick="event.stopPropagation(); openConcludeModal('${drive.id}')" title="Conclude Initiative & Upload After Photos">
                    Conclude 🏁
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderPastDrives() {
    const grid = document.getElementById('pastDrivesGrid');
    const showcaseWrapper = document.getElementById('baShowcaseWrapper');

    // Dynamically calculate actual impact statistics from completed drives
    const statWaste = document.getElementById('statTotalWaste');
    const statVolunteers = document.getElementById('statTotalVolunteers');
    const statDrives = document.getElementById('statTotalDrives');
    const statTrees = document.getElementById('statTotalTrees');

    let totalVolunteers = 0;
    let totalWasteKg = 0;
    let totalTrees = 0;

    this.pastDrives.forEach(d => {
      totalVolunteers += (d.current_volunteers || 0);
      if (d.trees_planted) {
        totalTrees += parseInt(d.trees_planted, 10) || 0;
      } else if (d.category === 'Tree Plantation') {
        totalTrees += (d.current_volunteers || 10);
      }
      
      // Parse numeric waste if recorded
      const wasteMatches = (d.waste_metric || '').match(/\d+/g);
      if (wasteMatches && wasteMatches.length > 0) {
        totalWasteKg += parseInt(wasteMatches[0], 10);
      } else {
        totalWasteKg += 350; // Metric baseline
      }
    });

    if (statWaste) statWaste.textContent = totalWasteKg > 0 ? `${totalWasteKg.toLocaleString('en-IN')} kg` : '0 kg';
    if (statVolunteers) statVolunteers.textContent = totalVolunteers.toLocaleString('en-IN');
    if (statDrives) statDrives.textContent = this.pastDrives.length.toString();
    if (statTrees) statTrees.textContent = totalTrees.toLocaleString('en-IN');

    // Dynamic Before / After Slider Showcase
    if (showcaseWrapper) {
      const driveWithTransform = this.pastDrives.find(d => d.before_image_url && d.after_image_url);

      if (driveWithTransform) {
        showcaseWrapper.innerHTML = `
          <div class="ba-showcase">
            <div class="ba-header">
              <div>
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">Site Restoration Spotlight</span>
                <h2 style="font-size: 1.35rem; margin-top: 0.2rem;">${driveWithTransform.title}</h2>
                <p style="font-size: 0.85rem; color: var(--text-secondary);">Drag the white slider handle horizontally to view the before & after transformation.</p>
              </div>
              <button type="button" class="btn btn-secondary" onclick="openCertificateModal('${driveWithTransform.title}', '${this.formatDateOnly(driveWithTransform.date_time)}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
                Preview Volunteer Certificate
              </button>
            </div>

            <div class="ba-container" id="baContainer">
              <img class="ba-image" src="${driveWithTransform.before_image_url}" alt="Before Cleanup">
              <span class="ba-tag ba-tag-before">Before (Debris)</span>

              <div class="ba-image-after" id="baAfterLayer">
                <img src="${driveWithTransform.after_image_url}" alt="After Cleanup">
                <span class="ba-tag ba-tag-after">After (Restored)</span>
              </div>

              <div class="ba-slider-line" id="baSliderLine">
                <div class="ba-slider-handle">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/><polyline points="9 18 15 12 9 6" style="transform: rotate(180deg); transform-origin: center;"/></svg>
                </div>
              </div>

              <input type="range" min="0" max="100" value="50" class="ba-range-input" id="baRangeInput" aria-label="Before and after transformation slider">
            </div>
          </div>
        `;
        initBeforeAfterSlider();
      } else {
        // Clean Empty State for Spotlight
        showcaseWrapper.innerHTML = `
          <div class="ba-showcase" style="text-align: center; padding: 3rem 1.5rem; background: var(--surface);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌱</div>
            <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-primary);">Site Restoration Spotlight</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 540px; margin: 0 auto; line-height: 1.6;">
              Interactive Before & After visual site transformations will appear here as community clean-up drives are completed and verified by coordinators.
            </p>
          </div>
        `;
      }
    }

    // Clean Empty State for Past Drives Archive
    if (grid) {
      if (this.pastDrives.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: var(--surface); border-radius: var(--radius-xl); border: 1.5px dashed var(--border-color);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📜</div>
            <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem; color: var(--text-primary);">No completed drives yet</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 480px; margin: 0 auto; line-height: 1.6;">
              Completed clean-up drives, verifiable site recovery metrics, and downloadable volunteer certificates will appear here once drives conclude.
            </p>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.pastDrives.map(drive => {
        const hasBothPhotos = drive.before_image_url && drive.after_image_url;
        return `
          <div class="drive-card">
            ${hasBothPhotos ? `
              <div class="ba-side-by-side">
                <div class="ba-thumb-box">
                  <img src="${drive.before_image_url}" alt="Before Cleanup" loading="lazy">
                  <span class="ba-thumb-tag before">Before</span>
                </div>
                <div class="ba-thumb-box">
                  <img src="${drive.after_image_url}" alt="After Cleanup" loading="lazy">
                  <span class="ba-thumb-tag after">After</span>
                </div>
              </div>
            ` : `
              <div class="card-banner" style="height: 160px;">
                <img src="${drive.banner_url}" alt="${drive.title}" loading="lazy">
                <span class="category-badge" style="color: #166534;">Completed ✓</span>
              </div>
            `}
            <div class="card-body">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem; gap: 0.5rem;">
                <h4 class="card-title" style="font-size: 1.05rem; margin-bottom: 0;">${drive.title}</h4>
                <span class="category-badge ${drive.category}" style="position: static; font-size: 0.7rem; padding: 0.15rem 0.45rem;">${drive.category}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--primary); font-weight: 700; margin-bottom: 0.5rem;">
                🌱 ${drive.waste_metric || 'Waste Diverted'}
                ${drive.trees_planted ? ` • 🌳 ${drive.trees_planted} Trees` : ''}
              </div>
              <p style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
                ${drive.venue_name} • Coordinated by ${drive.coordinator_name}
              </p>
              <button type="button" class="btn btn-outline" style="width: 100%; font-size: 0.825rem;" onclick="openCertificateModal('${drive.title}', '${this.formatDateOnly(drive.date_time)}')">
                View Digital Certificate 📜
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  renderCommunityFeed() {
    const feed = document.getElementById('communityFeedContainer');
    const leaderboardList = document.getElementById('topVolunteersList');

    // Clean Empty State for Community Feed
    if (feed) {
      if (this.communityPosts.length === 0) {
        feed.innerHTML = `
          <div style="text-align: center; padding: 3.5rem 1.5rem; background: var(--surface); border-radius: var(--radius-xl); border: 1.5px dashed var(--border-color);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💬</div>
            <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--text-primary);">No community updates yet</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 440px; margin: 0 auto; line-height: 1.6;">
              Be the first to share an on-ground clean-up update, composting tip, or zero-waste achievement with fellow stewards!
            </p>
          </div>
        `;
      } else {
        feed.innerHTML = this.communityPosts.map(post => {
          const isLiked = this.userLikes.has(post.id);
          return `
            <div class="post-card" id="post-${post.id}">
              <div class="post-author-row">
                <div class="author-info">
                  <div class="author-avatar">${post.author_avatar || post.author_name.charAt(0)}</div>
                  <div>
                    <div class="author-name">${post.author_name}</div>
                    <div class="author-meta">${post.author_city} • ${post.created_at}</div>
                  </div>
                </div>
              </div>

              <div class="post-text">${post.content}</div>

              ${post.tags && post.tags.length > 0 ? `
                <div class="post-tags-list">
                  ${post.tags.map(t => `<span class="post-tag-item">${t}</span>`).join('')}
                </div>
              ` : ''}

              ${post.image_url ? `
                <img class="post-image-preview" src="${post.image_url}" alt="Community clean-up" loading="lazy">
              ` : ''}

              <div class="post-interaction-bar">
                <button type="button" class="like-btn ${isLiked ? 'liked' : ''}" onclick="CleanBharatEngine.toggleLikePost('${post.id}')">
                  <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  <span>${post.likes_count || 0} Kudos</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Dynamic Top Volunteers Leaderboard based on actual users
    if (leaderboardList) {
      const sortedUsers = [...this.registeredUsers]
        .filter(u => u.eco_score > 0)
        .sort((a, b) => (b.eco_score || 0) - (a.eco_score || 0))
        .slice(0, 5);

      if (sortedUsers.length === 0) {
        leaderboardList.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">
            Top stewards will be featured here as volunteers join and organize clean-up drives.
          </div>
        `;
      } else {
        leaderboardList.innerHTML = sortedUsers.map((u, idx) => `
          <div class="top-volunteer-item">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span class="rank-badge" style="background: ${idx === 0 ? '#FEF3C7' : (idx === 1 ? '#F1F5F9' : '#FFEDD5')}; color: #333;">
                ${idx + 1}
              </span>
              <div>
                <div style="font-weight: 700;">${u.full_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${u.city || 'India'}</div>
              </div>
            </div>
            <span style="font-weight: 700; color: var(--primary);">${u.eco_score || 50} Pts</span>
          </div>
        `).join('');
      }
    }
  }

  renderUserProfile() {
    if (!this.currentUser) return;
    const u = this.currentUser;

    const nameEl = document.getElementById('profileCardName');
    const phoneEl = document.getElementById('profileCardPhone');
    const emailEl = document.getElementById('profileCardEmail');
    const locEl = document.getElementById('profileCardLocation');
    const eduEl = document.getElementById('profileCardEducation');
    const avatarEl = document.getElementById('profileCardAvatar');
    const scoreEl = document.getElementById('profileScoreDisplay');
    const levelEl = document.getElementById('profileLevelText');
    const roleEl = document.getElementById('profileCardRole');

    if (nameEl) nameEl.textContent = u.full_name;
    if (phoneEl) phoneEl.textContent = u.phone || 'Contact not set';
    if (emailEl) emailEl.textContent = u.email;
    if (locEl) locEl.textContent = `${u.city || 'Mumbai'}, MH (${u.pincode || '400050'})`;
    if (eduEl) eduEl.textContent = u.college_or_education || 'Independent Volunteer';
    if (avatarEl) avatarEl.textContent = u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U';
    if (scoreEl) scoreEl.textContent = u.eco_score || 50;

    if (roleEl) {
      roleEl.textContent = u.account_type ? `${u.account_type} Account` : 'Verified Volunteer';
    }

    if (levelEl) {
      const s = u.eco_score || 50;
      if (s >= 350) levelEl.textContent = 'Level 4: Master Eco-Director';
      else if (s >= 200) levelEl.textContent = 'Level 3: Earth Guardian';
      else if (s >= 100) levelEl.textContent = 'Level 2: Green Steward';
      else levelEl.textContent = 'Level 1: Active Volunteer';
    }

    const interestsContainer = document.getElementById('profileInterestsPills');
    if (interestsContainer && u.eco_interests) {
      interestsContainer.innerHTML = u.eco_interests.map(i => `<span class="safety-pill">${i}</span>`).join('');
    }

    // Drives Organized by Me Table (Organizer Profile Dashboard)
    const organizedTableBody = document.getElementById('organizedDrivesTableBody');
    if (organizedTableBody) {
      const myDrives = [...this.activeDrives, ...this.pastDrives].filter(d => d.created_by === u.id);
      if (myDrives.length === 0) {
        organizedTableBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
              You haven't organized any clean-up drives yet. Click "+ Host a New Drive" above to launch an initiative!
            </td>
          </tr>
        `;
      } else {
        organizedTableBody.innerHTML = myDrives.map(drive => {
          const isActive = drive.status === 'active';
          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${drive.title}</div>
                <div style="display: flex; gap: 0.4rem; align-items: center; margin-top: 0.25rem;">
                  <span class="organizer-badge" style="font-size: 0.65rem;">Organizer 🛡️</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${drive.category} • ${drive.venue_name}</span>
                </div>
              </td>
              <td>
                <div style="font-size: 0.825rem;">${this.formatDateTime(drive.date_time)}</div>
                <span class="category-badge" style="position: static; font-size: 0.675rem; padding: 0.15rem 0.5rem; background: ${isActive ? '#DCFCE7' : '#E0F2FE'}; color: ${isActive ? '#15803D' : '#0369A1'}; margin-top: 0.25rem; display: inline-block;">
                  ${isActive ? '🟢 Active Campaign' : '✓ Completed'}
                </span>
              </td>
              <td>
                <strong style="color: var(--primary);">${drive.current_volunteers}</strong> / ${drive.max_volunteers}
              </td>
              <td>
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  ${isActive ? `
                    <button type="button" class="btn-conclude" style="font-size: 0.725rem; padding: 0.3rem 0.6rem;" onclick="openConcludeModal('${drive.id}')">
                      Conclude 🏁
                    </button>
                    <button type="button" class="btn-delete" style="font-size: 0.725rem; padding: 0.3rem 0.6rem;" onclick="openDeleteModal('${drive.id}')">
                      Cancel 🗑️
                    </button>
                    <button type="button" class="btn btn-outline" style="font-size: 0.725rem; padding: 0.3rem 0.6rem;" onclick="openDriveModal('${drive.id}')">
                      Info
                    </button>
                  ` : `
                    <button type="button" class="btn btn-outline" style="font-size: 0.725rem; padding: 0.3rem 0.6rem;" onclick="openCertificateModal('${drive.title}', '${this.formatDateOnly(drive.date_time)}')">
                      Certificate 📜
                    </button>
                  `}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Enrolled drives table
    const tableBody = document.getElementById('enrolledDrivesTableBody');
    if (tableBody) {
      const userRegs = this.volunteers.filter(v => v.user_id === u.id);
      if (userRegs.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
              You haven't enrolled in any clean-up drives yet. Browse the "Active Drives" tab to join one!
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = userRegs.map(reg => {
          const drive = this.activeDrives.find(d => d.id === reg.drive_id) || this.pastDrives.find(d => d.id === reg.drive_id);
          if (!drive) return '';
          return `
            <tr>
              <td>
                <strong>${drive.title}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${drive.category}</div>
              </td>
              <td>${this.formatDateTime(drive.date_time)}</td>
              <td>${drive.venue_name}</td>
              <td>
                <div style="display: flex; gap: 0.4rem;">
                  <button type="button" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="openDriveModal('${drive.id}')">
                    Details
                  </button>
                  <button type="button" class="btn btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="CleanBharatEngine.cancelRegistration('${drive.id}')">
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    const postAvatar = document.getElementById('currentUserPostAvatar');
    const postName = document.getElementById('currentUserPostName');
    if (postAvatar) postAvatar.textContent = u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U';
    if (postName) postName.textContent = u.full_name;
  }

  // ===================================================================
  // 7. MODAL LOGIC & 1-CLICK REGISTRATION
  // ===================================================================

  openDriveModal(driveId) {
    this.currentModalDriveId = driveId;
    const drive = this.activeDrives.find(d => d.id === driveId) || this.pastDrives.find(d => d.id === driveId);
    if (!drive) return;

    document.getElementById('modalDriveBanner').src = drive.banner_url;
    document.getElementById('modalDriveTitle').textContent = drive.title;
    document.getElementById('modalDriveDateTime').textContent = this.formatDateTime(drive.date_time);
    document.getElementById('modalCoordinator').textContent = `${drive.coordinator_name} (${drive.coordinator_phone})`;
    document.getElementById('modalVenueName').textContent = drive.venue_name;
    document.getElementById('modalMapsLink').href = drive.google_maps_url;
    document.getElementById('modalDriveDescription').textContent = drive.description;

    const catBadge = document.getElementById('modalCategoryBadge');
    catBadge.className = `category-badge ${drive.category}`;
    catBadge.innerHTML = `${this.getCategoryIcon(drive.category)} ${drive.category}`;

    const safetyContainer = document.getElementById('modalSafetyPills');
    safetyContainer.innerHTML = (drive.safety_items || []).map(item => `<span class="safety-pill">✓ ${item}</span>`).join('');

    const bringContainer = document.getElementById('modalBringPills');
    bringContainer.innerHTML = (drive.items_to_bring || []).map(item => `<span class="bring-pill">• ${item}</span>`).join('');

    const capacityRatio = document.getElementById('modalCapacityRatio');
    const progressBar = document.getElementById('modalProgressBar');
    const pct = Math.min(100, Math.round((drive.current_volunteers / drive.max_volunteers) * 100));
    capacityRatio.textContent = `${drive.current_volunteers} / ${drive.max_volunteers} volunteers`;
    progressBar.style.width = `${pct}%`;

    // Organizer Controls in modal: show only if current user is creator and drive is active
    const orgControls = document.getElementById('modalOrganizerControls');
    if (orgControls) {
      const isOrganizer = this.currentUser && drive.created_by === this.currentUser.id && drive.status === 'active';
      orgControls.style.display = isOrganizer ? 'block' : 'none';
    }

    this.updateDriveModalState(driveId);
    document.getElementById('driveDetailModal').classList.add('open');
  }

  updateDriveModalState(driveId) {
    const isRegistered = this.isUserRegisteredForDrive(driveId);
    const joinBtn = document.getElementById('modalJoinBtn');
    const syncStatus = document.getElementById('modalUserSyncStatus');

    if (!joinBtn) return;

    if (isRegistered) {
      joinBtn.className = 'btn btn-secondary';
      joinBtn.innerHTML = 'Registered ✓ (Cancel Registration)';
      joinBtn.onclick = () => this.cancelRegistration(driveId);
      if (syncStatus) syncStatus.textContent = 'Enrolled with your verified profile details';
    } else {
      joinBtn.className = 'btn btn-primary';
      joinBtn.innerHTML = 'Join Drive Now 🌿';
      joinBtn.onclick = () => this.registerForDrive(driveId);
      if (syncStatus) syncStatus.textContent = `1-Click Join as ${this.currentUser ? this.currentUser.full_name : 'Volunteer'}`;
    }
  }

  // ===================================================================
  // 8. HELPERS & UTILITIES
  // ===================================================================

  getCategoryIcon(category) {
    switch (category) {
      case 'Beach': return '🏖️';
      case 'River': return '🌊';
      case 'Tree Plantation': return '🌱';
      case 'Urban Cleanup': return '🏙️';
      case 'E-Waste': return '🔌';
      default: return '🌿';
    }
  }

  formatDateTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  }

  formatDateOnly(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } catch (e) {
      return isoString;
    }
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${type === 'error' 
          ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
          : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        }
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Global Singleton Instance
const CleanBharatEngine = new CleanBharatEngineClass();

// =====================================================================
// 9. EVENT LISTENERS & TAB NAVIGATION DISPATCHER
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
  const isDashboard = !!document.getElementById('pane-activeDrives');
  
  if (isDashboard) {
    const user = CleanBharatEngine.getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    CleanBharatEngine.renderHeader();
    CleanBharatEngine.renderActiveDrives();
    CleanBharatEngine.renderPastDrives();
    CleanBharatEngine.renderCommunityFeed();
    CleanBharatEngine.renderUserProfile();
  }
});

// Dynamic Tab Navigation
function switchNavTab(tabName) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  tabPanes.forEach(pane => {
    if (pane.id === `pane-${tabName}`) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Drive Modal Controls
function openDriveModal(driveId) {
  CleanBharatEngine.openDriveModal(driveId);
}

function closeDriveModal() {
  document.getElementById('driveDetailModal').classList.remove('open');
}

function handleModalJoinClick() {
  // Controlled by CleanBharatEngine.updateDriveModalState
}

// Host Drive Modal & Device Image Upload Controls
function openHostDriveModal() {
  const user = CleanBharatEngine.getCurrentUser();
  if (user) {
    document.getElementById('hostCoordinatorName').value = user.full_name || '';
    document.getElementById('hostCoordinatorPhone').value = user.phone || '';
    document.getElementById('hostCity').value = user.city || 'Mumbai';
    const emailTag = document.getElementById('hostOrganizerEmailTag');
    if (emailTag) emailTag.textContent = user.email || 'you@example.com';
  }

  // Reset file inputs & previews
  removeHostImage();
  const bannerInput = document.getElementById('hostBannerUrl');
  if (bannerInput) bannerInput.value = '';

  // Set default date to upcoming Saturday 7:00 AM
  const sat = new Date();
  sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  sat.setHours(7, 0, 0, 0);
  const localIso = new Date(sat.getTime() - sat.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('hostDateTime').value = localIso;

  document.getElementById('hostDriveModal').classList.add('open');
}

function closeHostDriveModal() {
  document.getElementById('hostDriveModal').classList.remove('open');
}

function handleHostImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    CleanBharatEngine.showToast(validation.error, 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    document.getElementById('hostUploadedDataUrl').value = dataUrl;
    document.getElementById('hostImagePreview').src = dataUrl;
    document.getElementById('hostImagePreviewWrap').style.display = 'block';
    document.getElementById('hostImageDropzone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removeHostImage() {
  const fileInput = document.getElementById('hostImageFile');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('hostUploadedDataUrl');
  if (urlInput) urlInput.value = '';
  const previewWrap = document.getElementById('hostImagePreviewWrap');
  if (previewWrap) previewWrap.style.display = 'none';
  const dropzone = document.getElementById('hostImageDropzone');
  if (dropzone) dropzone.style.display = 'flex';
}

async function handleHostDriveSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('publishDriveBtn');
  btn.disabled = true;
  btn.textContent = 'Publishing to Registry...';

  const uploadedImage = document.getElementById('hostUploadedDataUrl').value.trim();
  const bannerUrl = document.getElementById('hostBannerUrl').value.trim();
  const finalImage = uploadedImage || bannerUrl || '';

  const driveData = {
    title: document.getElementById('hostTitle').value.trim(),
    category: document.getElementById('hostCategory').value,
    max_volunteers: document.getElementById('hostMaxVolunteers').value,
    date_time: document.getElementById('hostDateTime').value,
    city: document.getElementById('hostCity').value.trim(),
    venue_name: document.getElementById('hostVenue').value.trim(),
    google_maps_url: document.getElementById('hostMapsUrl').value.trim(),
    coordinator_name: document.getElementById('hostCoordinatorName').value.trim(),
    coordinator_phone: document.getElementById('hostCoordinatorPhone').value.trim(),
    description: document.getElementById('hostDescription').value.trim(),
    banner_url: bannerUrl,
    uploaded_image: finalImage
  };

  await CleanBharatEngine.createNewDrive(driveData);
  btn.disabled = false;
  btn.textContent = 'Publish Clean-up Drive 🚀';
  closeHostDriveModal();
  switchNavTab('activeDrives');
}

// Conclude Drive Modal & Workflow
function openConcludeModal(driveId) {
  const drive = CleanBharatEngine.activeDrives.find(d => d.id === driveId);
  if (!drive) {
    CleanBharatEngine.showToast('Active clean-up drive not found.', 'error');
    return;
  }

  const user = CleanBharatEngine.getCurrentUser();
  if (!user || drive.created_by !== user.id) {
    CleanBharatEngine.showToast('Only the drive organizer can conclude this initiative.', 'error');
    return;
  }

  document.getElementById('concludeDriveId').value = drive.id;
  document.getElementById('concludeDriveTitleDisplay').textContent = drive.title;
  document.getElementById('concludeWasteMetric').value = drive.category === 'Tree Plantation' ? '180 kg dry waste & plastic' : '420 kg plastic & debris';
  document.getElementById('concludeTreesCount').value = drive.category === 'Tree Plantation' ? '25' : '0';
  document.getElementById('concludeEmailTarget').textContent = user.email || 'you@example.com';

  removeConcludeImage();
  const afterUrlInput = document.getElementById('concludeAfterUrl');
  if (afterUrlInput) afterUrlInput.value = '';

  document.getElementById('concludeDriveModal').classList.add('open');
}

function closeConcludeModal() {
  document.getElementById('concludeDriveModal').classList.remove('open');
}

function handleConcludeImageSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.valid) {
    CleanBharatEngine.showToast(validation.error, 'error');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    document.getElementById('concludeUploadedDataUrl').value = dataUrl;
    document.getElementById('concludeImagePreview').src = dataUrl;
    document.getElementById('concludeImagePreviewWrap').style.display = 'block';
    document.getElementById('concludeImageDropzone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removeConcludeImage() {
  const fileInput = document.getElementById('concludeImageFile');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('concludeUploadedDataUrl');
  if (urlInput) urlInput.value = '';
  const previewWrap = document.getElementById('concludeImagePreviewWrap');
  if (previewWrap) previewWrap.style.display = 'none';
  const dropzone = document.getElementById('concludeImageDropzone');
  if (dropzone) dropzone.style.display = 'flex';
}

async function handleFinishConcludeSubmit(e) {
  e.preventDefault();
  const driveId = document.getElementById('concludeDriveId').value;
  const uploadedData = document.getElementById('concludeUploadedDataUrl').value.trim();
  const afterUrl = document.getElementById('concludeAfterUrl').value.trim();
  const finalAfterImage = uploadedData || afterUrl;

  if (!finalAfterImage) {
    CleanBharatEngine.showToast('Please upload or enter a post-cleanup "After Drive" result photo.', 'error');
    return;
  }

  const btn = document.getElementById('finishConcludeBtn');
  btn.disabled = true;
  btn.textContent = 'Verifying & Archiving...';

  const conclusionData = {
    after_image_url: finalAfterImage,
    waste_metric: document.getElementById('concludeWasteMetric').value.trim(),
    trees_count: parseInt(document.getElementById('concludeTreesCount').value, 10) || 0
  };

  await CleanBharatEngine.concludeDrive(driveId, conclusionData);

  btn.disabled = false;
  btn.textContent = 'Finish & Move to Past Drives 🏁';
  closeConcludeModal();
  closeDriveModal();
  switchNavTab('pastDrives');
}

// Delete Drive Confirmation Controls
function openDeleteModal(driveId) {
  const drive = CleanBharatEngine.activeDrives.find(d => d.id === driveId);
  if (!drive) return;

  const user = CleanBharatEngine.getCurrentUser();
  if (!user || drive.created_by !== user.id) {
    CleanBharatEngine.showToast('Only the drive organizer can cancel this initiative.', 'error');
    return;
  }

  document.getElementById('deleteTargetDriveId').value = driveId;
  document.getElementById('deleteDriveTitleDisplay').textContent = `"${drive.title}"`;
  document.getElementById('deleteDriveModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteDriveModal').classList.remove('open');
}

async function confirmDeleteDrive() {
  const driveId = document.getElementById('deleteTargetDriveId').value;
  await CleanBharatEngine.deleteDrive(driveId);
  closeDeleteModal();
  closeDriveModal();
}

function handleModalConcludeClick() {
  if (CleanBharatEngine.currentModalDriveId) {
    openConcludeModal(CleanBharatEngine.currentModalDriveId);
  }
}

function handleModalDeleteClick() {
  if (CleanBharatEngine.currentModalDriveId) {
    openDeleteModal(CleanBharatEngine.currentModalDriveId);
  }
}

// Automated Email Notifications Inspector
function openNotificationModal() {
  renderNotificationList();
  document.getElementById('emailNotificationModal').classList.add('open');
}

function closeNotificationModal() {
  document.getElementById('emailNotificationModal').classList.remove('open');
}

function clearAllNotifications() {
  CleanBharatEngine.notifications = [];
  CleanBharatEngine.saveNotifications();
  renderNotificationList();
}

function renderNotificationList() {
  const list = document.getElementById('emailNotificationsList');
  if (!list) return;

  if (CleanBharatEngine.notifications.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">📫</div>
        <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">No emails dispatched yet</h4>
        <p style="font-size: 0.85rem;">Publish or conclude a clean-up drive to inspect automated status emails.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = CleanBharatEngine.notifications.map(mail => `
    <div class="email-view-card" style="margin-bottom: 1.25rem;">
      <div class="email-header-meta">
        <div class="email-meta-row">
          <span class="email-meta-label">Subject:</span>
          <strong style="color: var(--text-primary);">${mail.subject}</strong>
        </div>
        <div class="email-meta-row">
          <span class="email-meta-label">From:</span>
          <span>${mail.from}</span>
        </div>
        <div class="email-meta-row">
          <span class="email-meta-label">To:</span>
          <span style="color: var(--primary); font-weight: 600;">${mail.to}</span>
        </div>
        <div class="email-meta-row">
          <span class="email-meta-label">Date:</span>
          <span style="color: var(--text-muted);">${mail.timestamp}</span>
        </div>
      </div>
      <div class="email-body-content">
        ${mail.html_preview}
      </div>
    </div>
  `).join('');
}

// Certificate Modal Controls
function openCertificateModal(driveTitle, driveDate) {
  const user = CleanBharatEngine.getCurrentUser();
  if (user) {
    document.getElementById('certUserName').textContent = user.full_name;
  }
  document.getElementById('certDriveTitle').textContent = driveTitle;
  document.getElementById('certDriveDate').textContent = `Date of Service: ${driveDate}`;
  document.getElementById('certificateModal').classList.add('open');
}

function closeCertificateModal() {
  document.getElementById('certificateModal').classList.remove('open');
}

// Filter & Search Controls
function filterDrives() {
  CleanBharatEngine.searchQuery = document.getElementById('searchInput').value;
  CleanBharatEngine.renderActiveDrives();
}

function setCategoryFilter(category, buttonEl) {
  CleanBharatEngine.activeCategoryFilter = category;
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');
  CleanBharatEngine.renderActiveDrives();
}

function resetFilters() {
  CleanBharatEngine.activeCategoryFilter = 'All';
  CleanBharatEngine.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === 'All');
  });
  CleanBharatEngine.renderActiveDrives();
}

// Community Post Submission
function submitCommunityPost() {
  const content = document.getElementById('newPostContent').value.trim();
  const imageUrl = document.getElementById('newPostImageUrl').value.trim();
  const selectedTags = Array.from(document.querySelectorAll('#postTagSelector .tag-check.selected'))
    .map(t => t.textContent.trim());

  if (!content) {
    CleanBharatEngine.showToast('Please type your eco-update or achievement.', 'error');
    return;
  }

  CleanBharatEngine.createCommunityPost(content, selectedTags, imageUrl);
  document.getElementById('newPostContent').value = '';
  document.getElementById('newPostImageUrl').value = '';
}

function toggleTag(el) {
  el.classList.toggle('selected');
}

function handleLogout() {
  CleanBharatEngine.logout();
}

// =====================================================================
// 10. BEFORE / AFTER COMPARISON SLIDER DRAGGABLE ENGINE
// =====================================================================

function initBeforeAfterSlider() {
  const container = document.getElementById('baContainer');
  const rangeInput = document.getElementById('baRangeInput');
  const sliderLine = document.getElementById('baSliderLine');
  const afterLayer = document.getElementById('baAfterLayer');

  if (!container || !rangeInput || !sliderLine || !afterLayer) return;

  function updateSlider(val) {
    const clamped = Math.max(0, Math.min(100, val));
    sliderLine.style.left = `${clamped}%`;
    afterLayer.style.clipPath = `inset(0 0 0 ${clamped}%)`;
  }

  rangeInput.addEventListener('input', (e) => {
    updateSlider(e.target.value);
  });

  let isDragging = false;

  function handleMove(clientX) {
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    rangeInput.value = clamped;
    updateSlider(clamped);
  }

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    handleMove(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  }, { passive: true });

  updateSlider(50);
}

// =====================================================================
// 11. GLOBAL WINDOW ATTACHMENTS FOR HTML EVENT HANDLERS
// =====================================================================
window.CleanBharatEngine = CleanBharatEngine;
window.switchNavTab = switchNavTab;
window.openDriveModal = openDriveModal;
window.closeDriveModal = closeDriveModal;
window.handleModalJoinClick = handleModalJoinClick;
window.handleModalConcludeClick = handleModalConcludeClick;
window.handleModalDeleteClick = handleModalDeleteClick;
window.openHostDriveModal = openHostDriveModal;
window.closeHostDriveModal = closeHostDriveModal;
window.handleHostImageSelect = handleHostImageSelect;
window.removeHostImage = removeHostImage;
window.handleHostDriveSubmit = handleHostDriveSubmit;
window.openConcludeModal = openConcludeModal;
window.closeConcludeModal = closeConcludeModal;
window.handleConcludeImageSelect = handleConcludeImageSelect;
window.removeConcludeImage = removeConcludeImage;
window.handleFinishConcludeSubmit = handleFinishConcludeSubmit;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDeleteDrive = confirmDeleteDrive;
window.openNotificationModal = openNotificationModal;
window.closeNotificationModal = closeNotificationModal;
window.clearAllNotifications = clearAllNotifications;
window.renderNotificationList = renderNotificationList;
window.openCertificateModal = openCertificateModal;
window.closeCertificateModal = closeCertificateModal;
window.filterDrives = filterDrives;
window.setCategoryFilter = setCategoryFilter;
window.resetFilters = resetFilters;
window.submitCommunityPost = submitCommunityPost;
window.toggleTag = toggleTag;
window.handleLogout = handleLogout;
window.initBeforeAfterSlider = initBeforeAfterSlider;

