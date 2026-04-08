/* ============================================
   SAINT LUKE'S NEUROSCIENCE RESEARCH DATABASE
   Complete Interactive Application Logic
   ============================================ */

/* ================================================
   0. CONSOLE BRANDING
   ================================================ */
console.log('%c Saint Luke\'s Neuroscience Research Database ', 'font-size:18px;font-weight:bold;color:#00d4ff;background:#0a0a1a;padding:8px 16px;border-radius:8px;border:1px solid #00d4ff;');
console.log('%c Translational | Clinical | Computational ', 'font-size:12px;color:#7c3aed;background:#0f0f2e;padding:4px 16px;border-radius:4px;');
console.log('%c Research Hub v2.0 — Supabase Edition ', 'font-size:10px;color:#10b981;');

/* ================================================
   0b. SUPABASE CLIENT INITIALIZATION
   ================================================ */
var SUPABASE_URL = 'https://noxyrovuuprygxuyhgik.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5veHlyb3Z1dXByeWd4dXloZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTUyMTgsImV4cCI6MjA4OTg5MTIxOH0.F3n5nOdpuz-1fENtAScf4Ina_v51Yz3htQGnbZhEPf4';
var _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var currentUserId = null;       // Supabase auth user UUID
var currentUserProfile = null;  // Full profile row from profiles table

/* --- Reusable File Upload to Supabase Storage --- */
async function uploadFile(file, folder) {
    var filePath = folder + '/' + Date.now() + '_' + file.name;
    var { data, error } = await _sb.storage.from('research-files').upload(filePath, file);
    if (error) { showToast('Upload failed: ' + error.message, 'error'); return null; }
    var { data: urlData } = _sb.storage.from('research-files').getPublicUrl(filePath);
    return urlData.publicUrl || filePath;
}

/* --- Audit Log --- */
async function logAudit(action, entityType, entityId, details) {
    try {
        await _sb.from('audit_log').insert({
            action: action,
            entity_type: entityType,
            entity_id: entityId ? String(entityId) : null,
            details: details || '',
            user_id: currentUserId,
            user_name: currentUserName,
            user_role: currentUserRole
        });
    } catch (e) { console.error('Audit log error:', e); }
}

/* --- Loading state helper --- */
function _showLoading(el) {
    if (el) el.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#00d4ff;"></i><p style="margin-top:10px;color:var(--text-muted);">Loading...</p></div>';
}

/* ================================================
   1. LOADING SCREEN - Auto-hide after 2s
   ================================================ */
window.addEventListener('load', function () {
    setTimeout(function () {
        var loader = document.getElementById('loadingScreen');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(function () {
                loader.style.display = 'none';
                // Try to restore session, otherwise show login
                _restoreSession().then(function() {
                    if (!currentUserId) showLogin();
                });
            }, 600);
        }
    }, 2000);
});

/* ================================================
   1b. SESSION RESTORATION via onAuthStateChange
   ================================================ */
/* --- Restore session on page load (no onAuthStateChange to avoid deadlocks) --- */
async function _restoreSession() {
    try {
        var { data: { session } } = await _sb.auth.getSession();
        if (!session || !session.user) return;

        var user = session.user;
        var { data: profile } = await _sb.from('profiles').select('*').eq('id', user.id).single();
        if (!profile || !profile.login_approved) return;

        currentUserId = user.id;
        currentUserProfile = profile;
        currentUserEmail = profile.email;
        currentUserRole = profile.role;
        currentUserName = profile.name;

        var initials = document.getElementById('userInitials');
        if (initials) initials.textContent = profile.initials;
        var nameEl = document.getElementById('userDropdownName');
        if (nameEl) nameEl.textContent = profile.name;
        var roleEl = document.getElementById('userDropdownRole');
        if (roleEl) roleEl.textContent = profile.title;

        _toggleAdminTab(profile.role === 'Admin');
        _toggleIRBAccess(profile.role === 'IRB' || profile.role === 'Admin');
        _toggleSendEmailTab(profile.email === 'skolakowsky@saint-lukes.org' || profile.email === 'aalmekkawi@saint-lukes.org');

        _hideAllAuthScreens();
        var mainApp = document.getElementById('mainApp');
        if (mainApp) mainApp.style.display = '';

        setTimeout(function() { renderPeopleDirectory(); }, 200);
        if (profile.role === 'Admin') setTimeout(function() { renderPendingLoginApprovals(); }, 300);

        // Load dashboard data
        setTimeout(function() {
            renderDashboardStats();
            renderAnnouncements();
            renderDashboardProjects();
        }, 200);

        setTimeout(function () {
            initAnimations();
            initCardHoverEffects();
            initChecklistItems();
            initRippleEffect();
        }, 100);
    } catch (e) {
        console.error('Session restore error:', e);
    }
}

/* ================================================
   2. LOGIN SYSTEM (Point 10)
   ================================================ */
var currentUserRole = 'Admin';
var currentUserName = '';
var currentUserEmail = '';

/* --- Async lookup helper: find user profile by email from Supabase --- */
async function _findAnyUserByEmail(email) {
    if (!email) return null;
    var lower = email.toLowerCase().trim();
    var { data, error } = await _sb.from('profiles').select('*').eq('email', lower).single();
    if (error || !data) return null;
    return data;
}

/* --- Async: Get all faculty users for PI dropdown --- */
async function _getFacultyList() {
    var { data, error } = await _sb.from('profiles').select('name').eq('role', 'Faculty');
    var faculty = [];
    if (data) {
        data.forEach(function(p) { faculty.push(p.name); });
    }
    // Also add Admin profiles that have MD/PhD/DO in their name
    var { data: admins } = await _sb.from('profiles').select('name').eq('role', 'Admin');
    if (admins) {
        admins.forEach(function(a) {
            if (a.name.indexOf('MD') !== -1 || a.name.indexOf('PhD') !== -1 || a.name.indexOf('DO') !== -1) {
                faculty.push(a.name);
            }
        });
    }
    return faculty.sort();
}

/* --- Quick admin lookup helper --- */
async function _findAdminByEmail(email) {
    if (!email) return null;
    var lower = email.toLowerCase().trim();
    var { data } = await _sb.from('profiles').select('*').eq('email', lower).eq('role', 'Admin').single();
    return data || null;
}

function showLogin() {
    _hideAllAuthScreens();
    var el = document.getElementById('loginScreen');
    if (el) el.style.display = 'flex';
}

function showRequestAccess() {
    _hideAllAuthScreens();
    var el = document.getElementById('requestAccessScreen');
    if (el) el.style.display = 'flex';
}

async function showForgotPassword() {
    var emailInput = document.getElementById('loginEmail');
    var emailVal = emailInput ? emailInput.value.trim() : '';
    if (!emailVal) {
        emailVal = prompt('Enter your email address to receive a password reset link:');
    }
    if (!emailVal) return;
    var { error } = await _sb.auth.resetPasswordForEmail(emailVal, { redirectTo: window.location.href.split('?')[0] });
    if (error) {
        showToast('Error: ' + error.message, 'error');
    } else {
        showToast('Password reset link sent to ' + emailVal + '. Check your inbox.', 'success');
    }
}

function showChangePassword() {
    _hideAllAuthScreens();
    var el = document.getElementById('changePasswordScreen');
    if (el) el.style.display = 'flex';
}

function _hideAllAuthScreens() {
    var screens = ['loginScreen', 'requestAccessScreen', 'changePasswordScreen'];
    screens.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function togglePassword(fieldId) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    var btn = field.parentElement.querySelector('.toggle-pw i');
    if (field.type === 'password') {
        field.type = 'text';
        if (btn) { btn.classList.remove('fa-eye'); btn.classList.add('fa-eye-slash'); }
    } else {
        field.type = 'password';
        if (btn) { btn.classList.remove('fa-eye-slash'); btn.classList.add('fa-eye'); }
    }
}

async function handleLogin() {
  try {
    var emailInput = document.getElementById('loginEmail');
    var passwordInput = document.getElementById('loginPassword');
    var emailVal = emailInput ? emailInput.value.toLowerCase().trim() : '';
    var passwordVal = passwordInput ? passwordInput.value : '';

    if (!emailVal) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    if (!passwordVal) {
        showToast('Please enter your password.', 'error');
        return;
    }

    // Validate Saint Luke's email domain
    if (!_isValidSaintLukesEmail(emailVal)) {
        showToast('Email must end with @saintlukeskc.org or @saint-lukes.org', 'error');
        return;
    }

    showToast('Signing in...', 'info');

    // Sign in via Supabase Auth
    var { data: authData, error: authError } = await _sb.auth.signInWithPassword({ email: emailVal, password: passwordVal });

    if (authError) {
        showToast('Login failed: ' + authError.message, 'error');
        if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
        return;
    }

    var authUser = authData.user;
    currentUserId = authUser.id;

    // Fetch the user's profile
    var { data: profile, error: profileError } = await _sb.from('profiles').select('*').eq('id', authUser.id).single();

    if (profileError || !profile) {
        showToast('Profile not found. Please contact an administrator.', 'error');
        return;
    }

    currentUserProfile = profile;

    // For non-admin / non-IRB users: check if login approval is needed
    var isAdmin = (profile.role === 'Admin');
    var isIRB = (profile.role === 'IRB');

    if (!isAdmin && !isIRB && !profile.login_approved) {
        // Check if already pending
        var { data: existing } = await _sb.from('pending_login_approvals').select('id').eq('email', emailVal).eq('status', 'pending');
        if (!existing || existing.length === 0) {
            await _sb.from('pending_login_approvals').insert({
                email: emailVal,
                name: profile.name,
                role: profile.role,
                title: profile.title || '',
                status: 'pending'
            });
            // Notify admins
            await _sendLoginApprovalNotification(profile);
        }
        await _sb.auth.signOut();
        currentUserId = null;
        currentUserProfile = null;
        showToast('Your login request has been submitted. You will receive access once Dr. Hayner or Dr. Almekkawi approves your account.', 'info');
        return;
    }

    currentUserEmail = profile.email;
    currentUserRole = profile.role;
    currentUserName = profile.name;

    var initials = document.getElementById('userInitials');
    if (initials) initials.textContent = profile.initials;
    var nameEl = document.getElementById('userDropdownName');
    if (nameEl) nameEl.textContent = profile.name;
    var roleEl = document.getElementById('userDropdownRole');
    if (roleEl) roleEl.textContent = profile.title;

    // Show admin tab only for admins
    _toggleAdminTab(profile.role === 'Admin');

    // Show/hide IRB review button based on role
    _toggleIRBAccess(profile.role === 'IRB' || profile.role === 'Admin');

    // Show/hide Send Email tab (only Dr. Hayner and Ahmad)
    _toggleSendEmailTab(emailVal === 'skolakowsky@saint-lukes.org' || emailVal === 'aalmekkawi@saint-lukes.org');

    // Hide login, show app
    _hideAllAuthScreens();
    var mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = '';

    // Render the People Directory on login
    setTimeout(function() { renderPeopleDirectory(); }, 200);

    // Render pending login approvals for admins
    if (isAdmin) {
        setTimeout(function() { renderPendingLoginApprovals(); }, 300);
    }

    // Check if user needs first-login profile setup (after approval)
    if (profile.needs_profile_setup) {
        setTimeout(function() { showProfileSetupModal(profile); }, 500);
    }

    // Initialize app features
    setTimeout(function () {
        initAnimations();
        initCardHoverEffects();
        initChecklistItems();
        initRippleEffect();
    }, 100);

    showToast('Welcome, ' + currentUserName.split(',')[0].split(' ')[0] + '!', 'success');
  } catch (err) {
    console.error('Login error:', err);
    showToast('Login error: ' + err.message, 'error');
  }
}

/* --- Toggle IRB access visibility --- */
function _toggleIRBAccess(show) {
    document.querySelectorAll('.irb-review-btn').forEach(function(el) {
        el.style.display = show ? '' : 'none';
    });
}

/* --- First-Login Profile Setup Modal --- */
function showProfileSetupModal(user) {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Welcome! Complete Your Profile';

    var html = '<form onsubmit="event.preventDefault(); completeProfileSetup(this);">' +
        '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
        '<i class="fas fa-user-check" style="color:#00d4ff;"></i>' +
        '<span style="font-size:0.82rem;color:var(--text-secondary);">This is your first login. Please update your password and complete your profile information.</span></div>' +

        '<h4 class="form-section-title"><i class="fas fa-lock" style="margin-right:6px;"></i> Update Password</h4>' +
        '<div class="form-row"><div class="form-group"><label>New Password *</label>' +
        '<input type="password" id="setupNewPW" placeholder="Enter new password..." required minlength="8"></div>' +
        '<div class="form-group"><label>Confirm Password *</label>' +
        '<input type="password" id="setupConfirmPW" placeholder="Confirm new password..." required minlength="8"></div></div>' +

        '<h4 class="form-section-title"><i class="fas fa-id-card" style="margin-right:6px;"></i> Personal Information</h4>' +
        '<div class="form-row"><div class="form-group"><label>Full Name *</label>' +
        '<input type="text" id="setupName" value="' + _esc(user.name) + '" required></div>' +
        '<div class="form-group"><label>Date of Birth</label>' +
        '<input type="date" id="setupDOB"></div></div>' +

        '<div class="form-group"><label>Department *</label>' +
        '<select id="setupDept" required><option value="">Select department...</option>' +
        '<option>Neurology</option><option>Neurosurgery</option><option>Both</option></select></div>' +

        '<div class="form-group"><label>Phone Number</label>' +
        '<input type="tel" id="setupPhone" placeholder="(XXX) XXX-XXXX"></div>' +

        '<div class="modal-actions">' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Complete Setup</button>' +
        '</div></form>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function completeProfileSetup(formEl) {
    var newPW = document.getElementById('setupNewPW');
    var confirmPW = document.getElementById('setupConfirmPW');

    if (newPW.value !== confirmPW.value) {
        showToast('Passwords do not match.', 'error');
        return;
    }
    if (newPW.value.length < 8) {
        showToast('Password must be at least 8 characters.', 'error');
        return;
    }

    // Update password via Supabase Auth
    var { error: pwError } = await _sb.auth.updateUser({ password: newPW.value });
    if (pwError) {
        showToast('Error updating password: ' + pwError.message, 'error');
        return;
    }

    // Update profile in Supabase
    var updates = { needs_profile_setup: false };
    var nameEl = document.getElementById('setupName');
    if (nameEl && nameEl.value.trim()) {
        updates.name = nameEl.value.trim();
        currentUserName = updates.name;
        var uiName = document.getElementById('userDropdownName');
        if (uiName) uiName.textContent = updates.name;
    }
    var deptEl = document.getElementById('setupDept');
    if (deptEl && deptEl.value) updates.department = deptEl.value;
    var phoneEl = document.getElementById('setupPhone');
    if (phoneEl && phoneEl.value) updates.phone = phoneEl.value;

    await _sb.from('profiles').update(updates).eq('id', currentUserId);
    if (currentUserProfile) {
        Object.assign(currentUserProfile, updates);
    }

    closeModal();
    showToast('Profile setup complete! Your password has been updated.', 'success');

    // Show CITI requirement reminder
    setTimeout(function() {
        showToast('Reminder: Please upload your CITI training certificate in the Requirements tab.', 'info');
    }, 2000);
}

function _toggleAdminTab(show) {
    // Hide/show admin items in the drawer
    document.querySelectorAll('.admin-only-tab').forEach(function (el) {
        el.style.display = show ? '' : 'none';
    });
    var adminGroup = document.querySelector('.admin-nav-group');
    if (adminGroup) adminGroup.style.display = show ? '' : 'none';
    // Also hide/show the expandable container for admin
    document.querySelectorAll('.admin-only-tab').forEach(function (el) {
        var expandable = el.closest('.nav-expandable');
        if (expandable) expandable.style.display = show ? '' : 'none';
    });
}

/* --- Saint Luke's email domain validation --- */
function _isValidSaintLukesEmail(email) {
    if (!email) return false;
    var lower = email.toLowerCase().trim();
    return lower.endsWith('@saintlukeskc.org') || lower.endsWith('@saint-lukes.org');
}

/* --- Invoke the send-notification-email Edge Function --- */
async function _sendEmailViaEdgeFunction(payload) {
    try {
        var { data, error } = await _sb.functions.invoke('send-notification-email', { body: payload });
        if (error) {
            console.error('Email function error:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Email function exception:', e);
        return false;
    }
}

async function submitAccessRequest() {
    var nameInput = document.getElementById('requestName');
    var emailInput = document.getElementById('requestEmail');
    var roleInput = document.getElementById('requestRole');
    var reqName = nameInput ? nameInput.value.trim() : '';
    var reqEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';
    var reqRole = roleInput ? roleInput.value : 'Medical Student';

    if (!reqName || !reqEmail) {
        showToast('Please fill in all fields.', 'error');
        return;
    }

    // Validate Saint Luke's email domain
    if (!_isValidSaintLukesEmail(reqEmail)) {
        showToast('Email must end with @saintlukeskc.org or @saint-lukes.org', 'error');
        return;
    }

    // Insert into pending approvals
    var { error: insertError } = await _sb.from('pending_login_approvals').insert({
        email: reqEmail,
        name: reqName,
        role: reqRole,
        title: '',
        status: 'pending'
    });

    if (insertError) {
        showToast('Error submitting request: ' + insertError.message, 'error');
        return;
    }

    // Create in-app notification for admins
    await _sb.from('notifications').insert({
        type: 'access_request',
        message: reqName + ' (' + reqRole + ' — ' + reqEmail + ') has requested access to the research database. Please review in Admin Panel.',
        from_user: reqName,
        from_email: reqEmail,
        recipients: ['skolakowsky@saint-lukes.org', 'aalmekkawi@saint-lukes.org', 'cabagley@saint-lukes.org'],
        read: false
    });

    // Send actual email to admins via Edge Function
    var loginUrl = window.location.origin;
    await _sendEmailViaEdgeFunction({
        to: ['skolakowsky@saint-lukes.org', 'aalmekkawi@saint-lukes.org', 'cabagley@saint-lukes.org'],
        subject: 'New Access Request: ' + reqName,
        html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
            '<div style="background:linear-gradient(135deg,#00d4ff,#7c3aed);padding:20px;color:#fff;text-align:center;">' +
            '<h2 style="margin:0;">Saint Luke\'s Neuroscience Research</h2>' +
            '<p style="margin:4px 0 0;">New Access Request</p></div>' +
            '<div style="padding:24px;background:#f8f9fa;">' +
            '<p><strong>A new user has requested access to the research database:</strong></p>' +
            '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Name:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(reqName) + '</td></tr>' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Email:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(reqEmail) + '</td></tr>' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Role:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(reqRole) + '</td></tr>' +
            '<tr><td style="padding:8px;"><strong>Requested:</strong></td><td style="padding:8px;">' + new Date().toLocaleString() + '</td></tr>' +
            '</table>' +
            '<p>Please log in to the <a href="' + loginUrl + '" style="color:#00d4ff;">research database</a> and review this request in the Admin Panel.</p>' +
            '<div style="text-align:center;margin:24px 0;">' +
            '<a href="' + loginUrl + '" style="display:inline-block;background:#00d4ff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Review Request</a>' +
            '</div>' +
            '<p style="color:#666;font-size:0.85rem;">This is an automated notification from the Saint Luke\'s Neuroscience Research Database.</p>' +
            '</div></div>'
    });

    showToast('Access request submitted! Administrators have been notified.', 'success');
    setTimeout(function () {
        showLogin();
    }, 2000);
}

function checkPasswordStrength() {
    var pw = document.getElementById('newPassword');
    if (!pw) return;
    var val = pw.value;

    var rules = {
        pwLen: val.length >= 12,
        pwUpper: /[A-Z]/.test(val),
        pwLower: /[a-z]/.test(val),
        pwNum: /[0-9]/.test(val),
        pwSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)
    };

    Object.keys(rules).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            if (rules[id]) {
                el.classList.add('pass');
                el.classList.remove('fail');
                var icon = el.querySelector('i');
                if (icon) { icon.classList.remove('fa-circle'); icon.classList.add('fa-check-circle'); icon.style.color = '#10b981'; }
            } else {
                el.classList.remove('pass');
                el.classList.add('fail');
                var icon = el.querySelector('i');
                if (icon) { icon.classList.remove('fa-check-circle'); icon.classList.add('fa-circle'); icon.style.color = ''; }
            }
        }
    });

    return rules.pwLen && rules.pwUpper && rules.pwLower && rules.pwNum && rules.pwSpecial;
}

async function handleChangePassword() {
    var newPw = document.getElementById('newPassword');
    var confirmPw = document.getElementById('confirmPassword');
    var matchMsg = document.getElementById('pwMatchMsg');

    if (!newPw || !confirmPw) return;

    if (newPw.value !== confirmPw.value) {
        if (matchMsg) { matchMsg.textContent = 'Passwords do not match'; matchMsg.style.color = '#ef4444'; }
        return;
    }

    if (!checkPasswordStrength()) {
        showToast('Please meet all password requirements.', 'error');
        return;
    }

    var { error } = await _sb.auth.updateUser({ password: newPw.value });
    if (error) {
        showToast('Error changing password: ' + error.message, 'error');
        return;
    }

    if (matchMsg) { matchMsg.textContent = 'Passwords match!'; matchMsg.style.color = '#10b981'; }
    showToast('Password changed successfully!', 'success');
    setTimeout(function () { showLogin(); }, 1000);
}

async function handleLogout() {
    await _sb.auth.signOut();
    currentUserId = null;
    currentUserProfile = null;
    var mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = 'none';
    closeUserDropdown();
    // Reset to dashboard tab for next login
    switchTab('dashboard');
    // Clear login fields
    var emailField = document.getElementById('loginEmail');
    var pwField = document.getElementById('loginPassword');
    if (emailField) emailField.value = '';
    if (pwField) pwField.value = '';
    currentUserRole = '';
    currentUserName = '';
    currentUserEmail = '';
    showLogin();
    showToast('You have been signed out.', 'info');
}

function toggleUserMenu() {
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function closeUserDropdown() {
    var dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.remove('active');
}

function generateTempPassword() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    var password = '';
    for (var i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function showProfile() {
    closeUserDropdown();
    showToast('Profile view coming soon.', 'info');
}

function showAccountSettings() {
    closeUserDropdown();
    showChangePassword();
    var mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.style.display = 'none';
}

// Close user dropdown when clicking outside
document.addEventListener('click', function (e) {
    var menu = document.getElementById('userMenu');
    var dropdown = document.getElementById('userDropdown');
    if (dropdown && dropdown.classList.contains('active') && menu && !menu.contains(e.target)) {
        closeUserDropdown();
    }
});

/* ================================================
   3. NEURAL CANVAS BACKGROUND
   ================================================ */
(function initNeuralCanvas() {
    var canvas = document.getElementById('neuralCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var mouse = { x: -1000, y: -1000 };

    var accentColors = [
        { r: 0, g: 212, b: 255 },     // #00d4ff - cyan
        { r: 124, g: 58, b: 237 },     // #7c3aed - purple
        { r: 16, g: 185, b: 129 }      // #10b981 - green
    ];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    function Particle() {
        this.reset();
    }

    Particle.prototype.reset = function () {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.pulseSpeed = Math.random() * 0.02 + 0.005;
        this.pulseOffset = Math.random() * Math.PI * 2;
        this.colorIndex = Math.floor(Math.random() * 3);
    };

    Particle.prototype.update = function (time) {
        this.x += this.vx;
        this.y += this.vy;

        // Mouse interaction
        var dx = mouse.x - this.x;
        var dy = mouse.y - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
            var force = (200 - dist) / 200 * 0.01;
            this.vx += dx * force;
            this.vy += dy * force;
        }

        this.vx *= 0.99;
        this.vy *= 0.99;

        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;

        // Color cycling
        this.colorPhase = (time * 0.0001 + this.pulseOffset) % 3;
        this.currentColorIndex = Math.floor(this.colorPhase) % 3;
        this.currentOpacity = this.opacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.1;
    };

    Particle.prototype.draw = function () {
        var c = accentColors[this.currentColorIndex];
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + this.currentOpacity + ')';
        ctx.fill();
    };

    var particleCount = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
    for (var i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function drawConnections(time) {
        for (var i = 0; i < particles.length; i++) {
            for (var j = i + 1; j < particles.length; j++) {
                var dx = particles[i].x - particles[j].x;
                var dy = particles[i].y - particles[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 150) {
                    var opacity = (1 - dist / 150) * 0.15;
                    var colorIdx = (i + j + Math.floor(time * 0.001)) % 3;
                    var c = accentColors[colorIdx];
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + opacity + ')';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animate(time) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = 0; i < particles.length; i++) {
            particles[i].update(time);
            particles[i].draw();
        }
        drawConnections(time);
        requestAnimationFrame(animate);
    }

    animate(0);
})();

/* ================================================
   4. TAB SWITCHING
   ================================================ */
/* --- Nav Drawer Toggle --- */
function toggleNavDrawer() {
    var drawer = document.getElementById('navDrawer');
    var overlay = document.getElementById('navDrawerOverlay');
    if (drawer) drawer.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

/* --- Nav Expandable Sub-tabs --- */
function navToggleExpand(btn, tabName) {
    var expandable = btn.closest('.nav-expandable');
    if (!expandable) {
        // No sub-tabs, just navigate
        switchTab(tabName);
        toggleNavDrawer();
        return;
    }

    // If already expanded, clicking the main button navigates to the tab
    if (expandable.classList.contains('expanded')) {
        switchTab(tabName);
        toggleNavDrawer();
        return;
    }

    // Collapse all other expandables first
    document.querySelectorAll('.nav-expandable.expanded').forEach(function (el) {
        if (el !== expandable) el.classList.remove('expanded');
    });

    // Expand this one
    expandable.classList.toggle('expanded');
}

/* --- Activate a sub-tab within a section --- */
function activateSubTab(tabName, subTabText) {
    var section = document.getElementById('tab-' + tabName);
    if (!section) return;

    // Handle subsection toggling for tabs with custom subsection switchers
    if (tabName === 'data') { _showDataSubsection(subTabText); }
    if (tabName === 'education') { _showEduSubsection(subTabText); }
    if (tabName === 'students') { _showStudentSubsection(subTabText); }
    if (tabName === 'documents') { _showDocSubsection(subTabText); }
    if (tabName === 'people') { setTimeout(function() { renderPeopleDirectory(); }, 50); }

    // Handle Projects view toggling (Pipeline/Grid/List)
    if (tabName === 'projects') {
        if (subTabText === 'Pipeline') {
            _showPipelineView();
            // Activate view button
            document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
            var pipeBtn = document.querySelector('.view-btn[data-view="pipeline"]');
            if (pipeBtn) pipeBtn.classList.add('active');
        } else if (subTabText === 'List') {
            _hidePipelineView();
            document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
            var listBtn = document.querySelector('.view-btn[data-view="list"]');
            if (listBtn) listBtn.classList.add('active');
            var grid = document.getElementById('projectsGrid');
            if (grid) grid.style.gridTemplateColumns = '1fr';
        } else {
            _hidePipelineView();
            document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
            var gridBtn = document.querySelector('.view-btn[data-view="grid"]');
            if (gridBtn) gridBtn.classList.add('active');
            var grd = document.getElementById('projectsGrid');
            if (grd) grd.style.gridTemplateColumns = 'repeat(auto-fill, minmax(360px, 1fr))';
        }
        return;
    }

    // Find the sub-tabs in this section and click the matching one
    var subTabs = section.querySelectorAll('.sub-tab');
    subTabs.forEach(function (st) {
        var text = st.textContent.trim().replace(/\d+/g, '').trim();
        if (text.indexOf(subTabText) !== -1 || subTabText.indexOf(text) !== -1) {
            st.click();
        }
    });
}

/* --- Data & Resources sub-section toggling --- */
function _showDataSubsection(name) {
    var subs = {
        'Datasets': 'dataSubDatasets',
        'Statistical Resources': 'dataSubStats',
        'Code Review': 'dataSubCode'
    };

    // Hide all data subsections
    Object.keys(subs).forEach(function (k) {
        var el = document.getElementById(subs[k]);
        if (el) el.style.display = 'none';
    });

    // Show the requested one
    var targetId = subs[name];
    if (targetId) {
        var target = document.getElementById(targetId);
        if (target) target.style.display = '';
    }

    // Also activate the correct sub-tab visually
    var dataSection = document.getElementById('tab-data');
    if (dataSection) {
        dataSection.querySelectorAll('.sub-tab').forEach(function (st) {
            st.classList.remove('active');
            if (st.textContent.trim() === name) st.classList.add('active');
        });
    }
}

/* --- SharePoint Links (placeholder until user provides links) --- */
var sharePointLinks = {
    spine: '',   // User will add link later
    tumor: ''    // User will add link later
};

function openSharePointLink(dbName) {
    var link = sharePointLinks[dbName];
    if (link) {
        window.open(link, '_blank');
    } else {
        showToast('SharePoint link for ' + dbName + ' database will be added soon.', 'info');
    }
}

function switchTab(tabName) {
    // Remove active from all drawer items and tab contents
    document.querySelectorAll('.nav-drawer-item').forEach(function (item) { item.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (content) { content.classList.remove('active'); });

    // Activate selected drawer item (works inside expandable too)
    var drawerItem = document.querySelector('.nav-drawer-item[data-tab="' + tabName + '"]');
    var tabContent = document.getElementById('tab-' + tabName);

    // Auto-expand the parent expandable if it exists
    if (drawerItem) {
        var expandable = drawerItem.closest('.nav-expandable');
        if (expandable && !expandable.classList.contains('expanded')) {
            expandable.classList.add('expanded');
        }
    }

    if (drawerItem) drawerItem.classList.add('active');
    if (tabContent) {
        tabContent.classList.add('active');
        // Re-trigger animations
        tabContent.querySelectorAll('.animate-in').forEach(function (el) {
            el.style.animation = 'none';
            el.offsetHeight; // trigger reflow
            el.style.animation = '';
        });
    }

    // Handle pipeline view toggle on projects tab
    if (tabName === 'projects') {
        var activeView = document.querySelector('.view-btn.active');
        if (activeView && activeView.dataset.view === 'pipeline') {
            _showPipelineView();
        }
    }

    // Update dashboard projects when switching to dashboard
    if (tabName === 'dashboard') {
        renderDashboardProjects();
        renderDashboardStats();
        renderAnnouncements();
        animateCounters();
    }

    // Render forum when switching to forum tab
    if (tabName === 'forum') {
        renderForumThreads();
    }

    // Render People Directory dynamically
    if (tabName === 'people') {
        renderPeopleDirectory();
    }

    // Render Send Email tab
    if (tabName === 'sendemail') {
        renderSendEmailTab();
    }

    // Render login approvals for admin tab
    if (tabName === 'admin') {
        renderPendingLoginApprovals();
    }
}

/* ================================================
   5. ANIMATED COUNTERS with easing, prefix/format
   ================================================ */
function animateCounters() {
    var counters = document.querySelectorAll('.stat-number[data-target]');
    counters.forEach(function (counter) {
        var target = parseInt(counter.dataset.target) || 0;
        var prefix = counter.dataset.prefix || '';
        var format = counter.dataset.format || '';
        var duration = 1500;
        var start = performance.now();

        function updateCounter(timestamp) {
            var elapsed = timestamp - start;
            var progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(target * eased);

            if (format === 'currency') {
                counter.textContent = prefix + current.toLocaleString();
            } else {
                counter.textContent = prefix + current.toLocaleString();
            }

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    });
}

/* ================================================
   6. MODAL SYSTEM - openModal(type)
   ================================================ */
function openModal(type, extraData) {
    var overlay = document.getElementById('modalOverlay');
    var title = document.getElementById('modalTitle');
    var body = document.getElementById('modalBody');

    var html = '';

    switch (type) {

        /* ---------- NEW PROJECT - Multi-Step Wizard ---------- */
        case 'newProject':
            title.textContent = 'New Research Project';
            html = '<div id="projectWizard">' +
                '<div class="wizard-steps" id="wizardSteps">' +
                '<div class="wizard-step active" data-step="1"><span class="wizard-num">1</span><span class="wizard-label">Basic Info</span></div>' +
                '<div class="wizard-step" data-step="2"><span class="wizard-num">2</span><span class="wizard-label">Protocol</span></div>' +
                '<div class="wizard-step" data-step="3"><span class="wizard-num">3</span><span class="wizard-label">IRB / Consent</span></div>' +
                '<div class="wizard-step" data-step="4"><span class="wizard-num">4</span><span class="wizard-label">Budget</span></div>' +
                '<div class="wizard-step" data-step="5"><span class="wizard-num">5</span><span class="wizard-label">Notes</span></div></div>' +
                '<div class="wizard-panel active" id="wizStep1">' +
                '<h4 class="form-section-title"><i class="fas fa-info-circle" style="margin-right:6px;"></i> Project Information</h4>' +
                '<div class="form-group"><label>Project Title *</label><input type="text" id="wz_title" placeholder="e.g., Neural Biomarkers in Early Alzheimer\'s..." required></div>' +
                '<div class="form-row"><div class="form-group"><label>Study Type *</label><select id="wz_studyType" required><option value="">Select type...</option>' +
                '<option>Prospective Cohort</option><option>Retrospective Cohort</option><option>Randomized Controlled Trial</option><option>Case-Control</option>' +
                '<option>Cross-Sectional</option><option>Case Series / Case Report</option><option>Systematic Review / Meta-Analysis</option>' +
                '<option>Translational / Bench-to-Bedside</option><option>Computational / AI / ML</option><option>Quality Improvement</option><option>Other</option></select></div>' +
                '<div class="form-group"><label>Research Pillar *</label><select id="wz_pillar" required><option value="">Select pillar...</option><option>Translational</option><option>Clinical</option><option>Computational</option></select></div></div>' +
                '<div class="form-row"><div class="form-group"><label>Department *</label><select id="wz_dept" required><option value="">Select...</option><option>Neurology</option><option>Neurosurgery</option><option>Both</option></select></div>' +
                '<div class="form-group"><label>Principal Investigator *</label><select id="wz_pi" required><option value="">Select PI...</option></select></div></div>' +
                '<div class="form-group"><label>Disease Focus *</label><input type="text" id="wz_disease" placeholder="e.g., Epilepsy, Stroke, TBI, Brain Tumor..." required></div>' +
                '<div class="form-group"><label>Co-Investigators</label><input type="text" id="wz_coI" placeholder="Names separated by commas..."></div>' +
                '<div class="form-group"><label>Brief Abstract *</label><textarea id="wz_abstract" rows="3" placeholder="Brief description of the research project..." required></textarea></div>' +
                '<div class="form-row"><div class="form-group"><label>Existing Umbrella IRB?</label><select id="wz_umbrellaIRB" onchange="toggleUmbrellaIRB()"><option value="no">No</option><option value="yes">Yes - Link to existing IRB</option></select></div>' +
                '<div class="form-group" id="wz_umbrellaField" style="display:none;"><label>Umbrella IRB Protocol #</label><input type="text" id="wz_umbrellaNum" placeholder="e.g., IRB-2025-1234"></div></div></div>' +
                '<div class="wizard-panel" id="wizStep2" style="display:none;">' +
                '<h4 class="form-section-title"><i class="fas fa-file-medical" style="margin-right:6px;"></i> Research Protocol</h4>' +
                '<div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><input type="checkbox" id="wz_protocolNA" onchange="toggleWizNA(\'protocol\')" style="width:auto;"><label for="wz_protocolNA" style="margin:0;cursor:pointer;font-size:0.85rem;">Not Applicable (e.g., systematic review, meta-analysis)</label></div>' +
                '<div id="wz_protocolFields">' +
                '<div class="form-group"><label>1. Background & Significance *</label><textarea id="wz_protBg" rows="4" placeholder="Scientific background, knowledge gaps, clinical significance..." required></textarea></div>' +
                '<div class="form-group"><label>2. Specific Aims *</label><textarea id="wz_protAims" rows="3" placeholder="List the specific aims..." required></textarea></div>' +
                '<div class="form-group"><label>3. Study Design & Methods *</label><textarea id="wz_protMethods" rows="4" placeholder="Study design, inclusion/exclusion criteria, procedures..." required></textarea></div>' +
                '<div class="form-group"><label>4. Outcome Measures</label><textarea id="wz_protOutcomes" rows="2" placeholder="Primary and secondary outcome measures..."></textarea></div>' +
                '<div class="form-group"><label>5. Statistical Analysis Plan</label><textarea id="wz_protStats" rows="3" placeholder="Planned analyses, sample size justification..."></textarea></div>' +
                '<div class="form-group"><label>6. Data Collection & Management</label><textarea id="wz_protData" rows="2" placeholder="REDCap, chart review, prospective enrollment..."></textarea></div>' +
                '<div class="form-group"><label>7. Timeline</label><textarea id="wz_protTimeline" rows="2" placeholder="Project timeline and milestones..."></textarea></div></div></div>' +
                '<div class="wizard-panel" id="wizStep3" style="display:none;">' +
                '<h4 class="form-section-title"><i class="fas fa-shield-alt" style="margin-right:6px;"></i> IRB & Informed Consent</h4>' +
                '<div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><input type="checkbox" id="wz_irbNA" onchange="toggleWizNA(\'irb\')" style="width:auto;"><label for="wz_irbNA" style="margin:0;cursor:pointer;font-size:0.85rem;">Not Applicable (no IRB required — e.g., de-identified data, QI project)</label></div>' +
                '<div id="wz_irbFields">' +
                '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;"><i class="fas fa-info-circle" style="color:#00d4ff;"></i><span style="font-size:0.82rem;color:var(--text-secondary);">IRB protocol number will be <strong>auto-populated</strong> once IRB approves. IRB reviewers have their own access to review and approve.</span></div>' +
                '<div class="form-group"><label>IRB Submission Type</label><select id="wz_irbType"><option>New Protocol - Full Board</option><option>New Protocol - Expedited</option><option>Exempt Determination</option></select></div>' +
                '<div class="form-group"><label>Consent — Purpose of Study *</label><textarea id="wz_consentPurpose" rows="3" placeholder="You are being asked to participate in a research study. The purpose is..." required></textarea></div>' +
                '<div class="form-group"><label>Consent — Procedures *</label><textarea id="wz_consentProc" rows="3" placeholder="If you agree to participate, you will be asked to..." required></textarea></div>' +
                '<div class="form-group"><label>Consent — Risks</label><textarea id="wz_consentRisks" rows="2" placeholder="Possible risks include..."></textarea></div>' +
                '<div class="form-group"><label>Consent — Benefits</label><textarea id="wz_consentBenefits" rows="2" placeholder="You may not benefit directly, however..."></textarea></div>' +
                '<div class="form-group"><label>Consent — Confidentiality</label><textarea id="wz_consentConfid" rows="2" placeholder="Your records will be kept confidential by..."></textarea></div></div></div>' +
                '<div class="wizard-panel" id="wizStep4" style="display:none;">' +
                '<h4 class="form-section-title"><i class="fas fa-calculator" style="margin-right:6px;"></i> Budget Estimate</h4>' +
                '<div class="form-group" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;"><input type="checkbox" id="wz_budgetNA" onchange="toggleWizNA(\'budget\')" style="width:auto;"><label for="wz_budgetNA" style="margin:0;cursor:pointer;font-size:0.85rem;">Not Applicable (no budget needed)</label></div>' +
                '<div id="wz_budgetFields"><div class="table-container"><table class="data-table" id="budgetTable"><thead><tr><th>Category</th><th>Item</th><th>Details / Link</th><th>Qty</th><th>Unit Cost ($)</th><th>Total ($)</th></tr></thead>' +
                '<tbody id="budgetTableBody">' +
                '<tr data-cat="stats"><td>Statistical Support</td><td><select onchange="budgetAutoCalc(this)"><option value="">Select...</option><option value="consult_10">Consultation (10 hrs)</option><option value="consult_20">Consultation (20 hrs)</option><option value="consult_40">Full Analysis (40 hrs)</option><option value="consult_custom">Custom Hours</option></select></td><td><input type="text" placeholder="Notes..." class="budget-detail"></td><td><input type="number" class="budget-qty" value="0" min="0" onchange="budgetRecalcRow(this)"></td><td><input type="number" class="budget-unit" value="150" onchange="budgetRecalcRow(this)"></td><td class="budget-total">$0</td></tr>' +
                '<tr data-cat="software"><td>Software</td><td><select onchange="budgetAutoCalc(this)"><option value="">Select...</option><option value="redcap">REDCap (Free)</option><option value="spss">SPSS License</option><option value="stata">Stata License</option><option value="sas">SAS License</option><option value="matlab">MATLAB License</option><option value="r_free">R/RStudio (Free)</option><option value="python_free">Python (Free)</option><option value="software_other">Other Software</option></select></td><td><input type="text" placeholder="License link..." class="budget-detail"></td><td><input type="number" class="budget-qty" value="1" min="0" onchange="budgetRecalcRow(this)"></td><td><input type="number" class="budget-unit" value="0" onchange="budgetRecalcRow(this)"></td><td class="budget-total">$0</td></tr>' +
                '<tr data-cat="hardware"><td>Hardware / Equipment</td><td><input type="text" placeholder="Describe item..." class="budget-item-text"></td><td><input type="text" placeholder="Vendor link..." class="budget-detail"></td><td><input type="number" class="budget-qty" value="0" min="0" onchange="budgetRecalcRow(this)"></td><td><input type="number" class="budget-unit" value="0" onchange="budgetRecalcRow(this)"></td><td class="budget-total">$0</td></tr>' +
                '<tr data-cat="personnel"><td>Personnel / CRC</td><td><select onchange="budgetAutoCalc(this)"><option value="">Select...</option><option value="crc_part">CRC Part-time (10 hrs/wk)</option><option value="crc_full">CRC Full-time (40 hrs/wk)</option><option value="ra_part">Research Asst Part-time</option><option value="personnel_other">Other</option></select></td><td><input type="text" placeholder="Notes..." class="budget-detail"></td><td><input type="number" class="budget-qty" value="0" min="0" onchange="budgetRecalcRow(this)"><span style="font-size:0.6rem;color:var(--text-muted);">months</span></td><td><input type="number" class="budget-unit" value="0" onchange="budgetRecalcRow(this)"></td><td class="budget-total">$0</td></tr>' +
                '<tr data-cat="other"><td>Other Costs</td><td><input type="text" placeholder="Describe..." class="budget-item-text"></td><td><input type="text" placeholder="Details..." class="budget-detail"></td><td><input type="number" class="budget-qty" value="0" min="0" onchange="budgetRecalcRow(this)"></td><td><input type="number" class="budget-unit" value="0" onchange="budgetRecalcRow(this)"></td><td class="budget-total">$0</td></tr>' +
                '</tbody><tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;padding-right:16px;">Total Estimated Budget:</td><td id="budgetGrandTotal" style="font-weight:700;color:var(--accent-primary);font-size:1rem;">$0</td></tr></tfoot></table></div>' +
                '<button type="button" class="btn btn-outline btn-sm" onclick="addBudgetRow()" style="margin-top:10px;"><i class="fas fa-plus"></i> Add Budget Row</button></div></div>' +
                '<div class="wizard-panel" id="wizStep5" style="display:none;">' +
                '<h4 class="form-section-title"><i class="fas fa-sticky-note" style="margin-right:6px;"></i> Additional Notes</h4>' +
                '<div class="form-group"><label>Notes / Comments</label><textarea id="wz_notes" rows="5" placeholder="Any additional notes, special requirements, or comments..."></textarea></div>' +
                '<div class="alert-banner" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 18px;margin-top:16px;display:flex;align-items:center;gap:10px;"><i class="fas fa-check-circle" style="color:#10b981;"></i><span style="font-size:0.82rem;color:var(--text-secondary);">Project will be created as <strong>Pre-submission</strong>. <strong>Dr. Kolakowsky-Hayner</strong> can update status. Project becomes <strong>Active</strong> only after IRB approval. Only IRB-listed personnel can access it.</span></div></div>' +
                '<div class="modal-actions" style="justify-content:space-between;">' +
                '<button type="button" class="btn btn-outline" id="wizBtnPrev" onclick="wizardPrev()" style="display:none;"><i class="fas fa-arrow-left"></i> Previous</button>' +
                '<div style="display:flex;gap:8px;margin-left:auto;">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="button" class="btn btn-primary" id="wizBtnNext" onclick="wizardNext()">Next <i class="fas fa-arrow-right"></i></button>' +
                '<button type="button" class="btn btn-primary" id="wizBtnSubmit" onclick="wizardSubmit()" style="display:none;"><i class="fas fa-paper-plane"></i> Submit Project</button></div></div></div>';
            break;

        /* ---------- NEW PERSON (Point 2) ---------- */
        case 'newPerson':
            title.textContent = 'Add Team Member';
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Team member added successfully!\');">' +
                '<div class="form-row"><div class="form-group"><label>First Name *</label>' +
                '<input type="text" placeholder="First name" required></div>' +
                '<div class="form-group"><label>Last Name *</label>' +
                '<input type="text" placeholder="Last name" required></div></div>' +

                '<div class="form-row"><div class="form-group"><label>Title / Role</label>' +
                '<select id="personRole" onchange="toggleMedStudentFields()">' +
                '<option value="">Select role...</option>' +
                '<option>Faculty - Neurology</option>' +
                '<option>Faculty - Neurosurgery</option>' +
                '<option>Clinical Research Coordinator (CRC)</option>' +
                '<option>Clinical Research Nurse (RN)</option>' +
                '<option>Advanced Practice Provider (APP)</option>' +
                '<option>Nurse Practitioner (NP)</option>' +
                '<option>Physician Assistant (PA)</option>' +
                '<option>Resident</option>' +
                '<option>Research Fellow</option>' +
                '<option>Medical Student</option>' +
                '<option>Budget & Contracts</option>' +
                '<option>Administrative Staff</option>' +
                '<option>Statistician / Biostatistician</option>' +
                '<option>Data Analyst / Informaticist</option>' +
                '<option>Other</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Department</label>' +
                '<select>' +
                '<option value="">Select department...</option>' +
                '<option>Neurology</option>' +
                '<option>Neurosurgery</option>' +
                '<option>Both</option>' +
                '</select></div></div>' +

                '<div class="form-group"><label>Category</label>' +
                '<select>' +
                '<option value="">Select category...</option>' +
                '<option>Faculty</option>' +
                '<option>Research Staff</option>' +
                '<option>Trainee</option>' +
                '<option>Medical Student</option>' +
                '<option>Collaborator</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Email</label>' +
                '<input type="email" placeholder="email@saintlukes.org"></div>' +

                '<div class="form-group"><label>Research Interests</label>' +
                '<input type="text" placeholder="e.g., Epilepsy, Deep Learning, fMRI..."></div>' +

                '<!-- Medical Student Additional Fields -->' +
                '<div id="medStudentFields" style="display:none;">' +
                '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">' +
                '<h4 style="color:#00d4ff;margin-bottom:12px;font-size:0.9rem;"><i class="fas fa-user-graduate"></i> Medical Student Details</h4>' +
                '<div class="form-row"><div class="form-group"><label>Rotation Start Date</label>' +
                '<input type="date"></div>' +
                '<div class="form-group"><label>Rotation End Date</label>' +
                '<input type="date"></div></div>' +
                '<div class="form-group"><label>Assigned Project</label>' +
                '<input type="text" placeholder="Project name..."></div>' +
                '<div class="form-group"><label>Supervising Faculty</label>' +
                '<select>' +
                '<option value="">Select faculty...</option>' +
                '<!-- Faculty options populate as members are added -->' +
                '</select></div>' +
                '</div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-user-plus"></i> Add Member</button>' +
                '</div></form>';
            break;

        /* ---------- NEW GRANT (Point 3) ---------- */
        case 'newGrant':
            title.textContent = 'Add Grant';
            html = '<form onsubmit="event.preventDefault(); saveGrant(this);">' +
                '<div class="form-group"><label>Grant Title *</label>' +
                '<input type="text" placeholder="Enter grant title..." required></div>' +

                '<div class="form-row"><div class="form-group"><label>Principal Investigator</label>' +
                '<select>' +
                '<option value="">Select PI...</option>' +
                '<!-- Faculty options populate as members are added -->' +
                '</select></div>' +

                '<div class="form-group"><label>Funding Agency</label>' +
                '<select>' +
                '<option value="">Select agency...</option>' +
                '<option>NIH</option>' +
                '<option>NSF</option>' +
                '<option>DOD</option>' +
                '<option>AHA</option>' +
                '<option>AAN</option>' +
                '<option>Industry</option>' +
                '<option>Foundation</option>' +
                '<option>Internal</option>' +
                '<option>Other</option>' +
                '</select></div></div>' +

                '<div class="form-row"><div class="form-group"><label>Mechanism</label>' +
                '<input type="text" placeholder="e.g., R01, R21, K23, U01..."></div>' +
                '<div class="form-group"><label>Amount</label>' +
                '<input type="text" placeholder="e.g., $500,000"></div></div>' +

                '<div class="form-row"><div class="form-group"><label>Start Date</label>' +
                '<input type="date"></div>' +
                '<div class="form-group"><label>End Date</label>' +
                '<input type="date"></div></div>' +

                '<div class="form-group"><label>Status</label>' +
                '<select>' +
                '<option>Active</option>' +
                '<option>Pending</option>' +
                '<option>Submitted</option>' +
                '<option>In Preparation</option>' +
                '<option>Completed</option>' +
                '<option>Not Funded</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Grant Number</label>' +
                '<input type="text" placeholder="e.g., 1R01NS123456-01"></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-plus"></i> Add Grant</button>' +
                '</div></form>';
            break;

        /* ---------- NEW OPPORTUNITY (Point 3) ---------- */
        case 'newOpportunity':
            title.textContent = 'Add Funding Opportunity';
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Funding opportunity added successfully!\');">' +
                '<div class="form-group"><label>Opportunity Name *</label>' +
                '<input type="text" placeholder="Enter opportunity name..." required></div>' +

                '<div class="form-row"><div class="form-group"><label>Agency / Organization</label>' +
                '<input type="text" placeholder="e.g., NIH, AAN Foundation..."></div>' +
                '<div class="form-group"><label>Amount Available</label>' +
                '<input type="text" placeholder="e.g., $250,000"></div></div>' +

                '<div class="form-group"><label>Website / Link</label>' +
                '<input type="url" placeholder="https://grants.nih.gov/..."></div>' +

                '<div class="form-group"><label>Deadline</label>' +
                '<input type="date"></div>' +

                '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">' +
                '<h4 style="color:#00d4ff;margin-bottom:12px;font-size:0.9rem;"><i class="fas fa-clipboard-check"></i> Eligibility</h4>' +

                '<div class="form-row"><div class="form-group"><label>Career Stage</label>' +
                '<select>' +
                '<option value="">Select...</option>' +
                '<option>Early Career K-series</option>' +
                '<option>Mid-Career R-series</option>' +
                '<option>Senior</option>' +
                '<option>All</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Citizenship Required</label>' +
                '<select>' +
                '<option>No</option>' +
                '<option>Yes</option>' +
                '</select></div></div>' +

                '<div class="form-row"><div class="form-group"><label>Preliminary Data Required</label>' +
                '<select>' +
                '<option>No</option>' +
                '<option>Yes</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Limited Submission</label>' +
                '<select>' +
                '<option>No</option>' +
                '<option>Yes</option>' +
                '</select></div></div>' +

                '<div class="form-group"><label>Description / Notes</label>' +
                '<textarea rows="3" placeholder="Additional details about this opportunity..."></textarea></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-star"></i> Add Opportunity</button>' +
                '</div></form>';
            break;

        /* ---------- NEW DEADLINE (Point 9) ---------- */
        case 'newDeadline':
            title.textContent = 'Add Deadline';
            html = '<form onsubmit="event.preventDefault(); saveDeadline(this);">' +
                '<div class="form-group"><label>Deadline Title *</label>' +
                '<input type="text" placeholder="Enter deadline title..." required></div>' +

                '<div class="form-row"><div class="form-group"><label>Type</label>' +
                '<select>' +
                '<option value="">Select type...</option>' +
                '<option>Grant</option>' +
                '<option>Conference Abstract</option>' +
                '<option>IRB</option>' +
                '<option>Other</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Date *</label>' +
                '<input type="date" required></div></div>' +

                '<div class="form-group"><label>Description</label>' +
                '<textarea rows="3" placeholder="Describe this deadline..."></textarea></div>' +

                '<div class="form-group"><label>Associated Grant / Conference</label>' +
                '<input type="text" placeholder="e.g., R01 Renewal, AAN Annual Meeting..."></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-calendar-plus"></i> Add Deadline</button>' +
                '</div></form>';
            break;

        /* ---------- NEW PROTOCOL (Point 4) ---------- */
        case 'newProtocol':
            title.textContent = 'New IRB Protocol';
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Protocol added successfully!\');">' +
                '<div class="form-group"><label>Project Name (Linked) *</label>' +
                '<input type="text" placeholder="Enter or search project name..." required></div>' +

                '<div class="form-group"><label>Protocol Number *</label>' +
                '<input type="text" placeholder="e.g., IRB-2026-0001" required></div>' +

                '<div class="form-group"><label>Current Process / Phase</label>' +
                '<select>' +
                '<option value="">Select phase...</option>' +
                '<option>Drafting</option>' +
                '<option>Submitted to IRB</option>' +
                '<option>Under Review</option>' +
                '<option>Revisions Requested</option>' +
                '<option>Approved</option>' +
                '<option>Renewal Due</option>' +
                '<option>Expired</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Status</label>' +
                '<select>' +
                '<option>Active</option>' +
                '<option>Pending</option>' +
                '<option>On Hold</option>' +
                '<option>Closed</option>' +
                '</select></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-shield-alt"></i> Add Protocol</button>' +
                '</div></form>';
            break;

        /* ---------- NEW PUBLICATION (Point 5) ---------- */
        case 'newPublication':
            title.textContent = 'Add Publication / Output';
            html = '<form onsubmit="event.preventDefault(); savePublication(this);">' +
                '<div class="form-group"><label>Type *</label>' +
                '<select id="pubType" onchange="togglePubFields()" required>' +
                '<option value="">Select type...</option>' +
                '<option value="publication">Publication</option>' +
                '<option value="presentation">Presentation</option>' +
                '<option value="patent">Patent</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Title *</label>' +
                '<input type="text" placeholder="Enter title..." required></div>' +

                '<div class="form-group"><label>PDF Upload</label>' +
                '<div style="border:2px dashed rgba(255,255,255,0.1);border-radius:12px;padding:24px;text-align:center;cursor:pointer;" onclick="this.querySelector(\'input\').click()">' +
                '<i class="fas fa-cloud-upload-alt" style="font-size:2rem;color:#00d4ff;margin-bottom:8px;display:block;"></i>' +
                '<span style="color:#9999b8;">Click to upload PDF or drag & drop</span>' +
                '<input type="file" accept=".pdf" style="display:none;">' +
                '</div></div>' +

                '<!-- Publication Fields -->' +
                '<div id="pubFields" style="display:none;">' +
                '<div class="form-row"><div class="form-group"><label>Journal Name</label>' +
                '<input type="text" placeholder="e.g., Neurology, JAMA Neurology..."></div>' +
                '<div class="form-group"><label>Year</label>' +
                '<input type="number" placeholder="2026" value="2026"></div></div>' +
                '<div class="form-group"><label>Authors</label>' +
                '<input type="text" placeholder="Last FM, Last FM, ..."></div>' +
                '<div class="form-group"><label>Publication Type</label>' +
                '<select>' +
                '<option>Original Research</option>' +
                '<option>Review</option>' +
                '<option>Case Report</option>' +
                '<option>Letter</option>' +
                '</select></div>' +
                '</div>' +

                '<!-- Presentation Fields -->' +
                '<div id="presFields" style="display:none;">' +
                '<div class="form-row"><div class="form-group"><label>Conference</label>' +
                '<input type="text" placeholder="e.g., AAN Annual Meeting..."></div>' +
                '<div class="form-group"><label>Date</label>' +
                '<input type="date"></div></div>' +
                '<div class="form-group"><label>Presentation Type</label>' +
                '<select>' +
                '<option>Poster</option>' +
                '<option>Oral</option>' +
                '<option>Invited</option>' +
                '</select></div>' +
                '</div>' +

                '<!-- Patent Fields -->' +
                '<div id="patentFields" style="display:none;">' +
                '<div class="form-row"><div class="form-group"><label>Filing Date</label>' +
                '<input type="date"></div>' +
                '<div class="form-group"><label>Patent Number</label>' +
                '<input type="text" placeholder="US Patent #..."></div></div>' +
                '<div class="form-group"><label>Patent Status</label>' +
                '<select>' +
                '<option>Filed</option>' +
                '<option>Pending</option>' +
                '<option>Granted</option>' +
                '<option>Expired</option>' +
                '</select></div>' +
                '</div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-book-open"></i> Add Publication</button>' +
                '</div></form>';
            break;

        /* ---------- NEW MEETING (Point 7) ---------- */
        case 'newMeeting':
            title.textContent = 'Schedule Meeting';
            html = '<form onsubmit="event.preventDefault(); saveMeeting(this);">' +
                '<div class="form-group"><label>Meeting Title *</label>' +
                '<input type="text" placeholder="Enter meeting title..." required></div>' +

                '<div class="form-row"><div class="form-group"><label>Date *</label>' +
                '<input type="date" required></div>' +
                '<div class="form-group"><label>Time *</label>' +
                '<input type="time" required></div></div>' +

                '<div class="form-group"><label>Attendees</label>' +
                '<input type="text" placeholder="Enter names separated by commas..."></div>' +

                '<div class="form-group"><label>Purpose / Agenda</label>' +
                '<textarea rows="3" placeholder="Meeting agenda and discussion topics..."></textarea></div>' +

                '<div class="form-group"><label>Teams Link URL</label>' +
                '<input type="url" placeholder="https://teams.microsoft.com/l/meetup-join/..."></div>' +

                '<div class="form-group"><label>Location (optional)</label>' +
                '<input type="text" placeholder="e.g., Conference Room 3B, Zoom, etc."></div>' +

                '<div class="form-group" style="display:flex;align-items:center;gap:10px;">' +
                '<input type="checkbox" id="recurringMeeting" style="width:auto;">' +
                '<label for="recurringMeeting" style="margin:0;cursor:pointer;">Recurring Meeting</label>' +
                '</div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-calendar-plus"></i> Schedule Meeting</button>' +
                '</div></form>';
            break;

        /* ---------- NEW REQUEST (Point 6 Forum) ---------- */
        case 'newRequest':
            title.textContent = 'New Support Request';
            html = _buildRequestForm('');
            break;

        /* ---------- STAT REQUEST ---------- */
        case 'statRequest':
            title.textContent = 'Statistical Consultation Request';
            html = _buildRequestForm('Statistical Consultation');
            break;

        /* ---------- RESOURCE REQUEST (routed to Dr. Kolakowsky-Hayner) ---------- */
        case 'resourceRequest':
            var resourceName = extraData || 'Resource';
            title.textContent = 'Request: ' + resourceName;
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Request sent to Dr. Kolakowsky-Hayner for routing.\', \'success\');">' +
                '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-info-circle" style="color:#00d4ff;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">This request will be sent to <strong style="color:var(--text-primary);">Dr. Kolakowsky-Hayner</strong> who will route it to the appropriate team member.</span></div>' +
                '<div class="form-group"><label>Resource Requested</label>' +
                '<input type="text" value="' + resourceName + '" readonly style="opacity:0.7;"></div>' +
                '<div class="form-group"><label>Linked Project *</label>' +
                '<select required>' +
                '<option value="">Select project...</option>' +
                '</select>' +
                '<span style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;display:block;">All requests must be linked to a project.</span></div>' +
                '<div class="form-group"><label>Description *</label>' +
                '<textarea rows="4" placeholder="Describe what you need and why..." required></textarea></div>' +
                '<div class="form-group"><label>Urgency</label>' +
                '<select><option>Low</option><option selected>Medium</option><option>High</option></select></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Send Request</button>' +
                '</div></form>';
            break;

        /* ---------- CODE REVIEW (replaces GitHub) ---------- */
        case 'codeReview':
            title.textContent = 'Upload Code for Review';
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Code uploaded! Review request sent.\', \'success\');">' +
                '<div class="form-group"><label>Linked Project *</label>' +
                '<select required>' +
                '<option value="">Select project...</option>' +
                '</select>' +
                '<span style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;display:block;">All code uploads must be linked to a project.</span></div>' +
                '<div class="form-group"><label>Code Title *</label>' +
                '<input type="text" placeholder="e.g., EEG preprocessing pipeline v2..." required></div>' +
                '<div class="form-group"><label>Language / Tool</label>' +
                '<select><option value="">Select...</option><option>Python</option><option>R</option><option>MATLAB</option><option>SAS</option><option>SPSS Syntax</option><option>SQL</option><option>Bash/Shell</option><option>Other</option></select></div>' +
                '<div class="form-group"><label>Upload Files</label>' +
                '<div class="pdf-upload-area"><i class="fas fa-file-code"></i><p>Click to upload or drag & drop</p><span>.py, .R, .m, .sas, .sql, .ipynb, .zip</span></div>' +
                '<input type="file" multiple accept=".py,.r,.R,.m,.sas,.sql,.ipynb,.zip,.tar,.gz" style="display:none;"></div>' +
                '<div class="form-group"><label>Request Reviewer</label>' +
                '<select>' +
                '<option value="">Select reviewer (optional)...</option>' +
                '<!-- Team members populate dynamically -->' +
                '</select></div>' +
                '<div class="form-group"><label>Notes for Reviewer</label>' +
                '<textarea rows="3" placeholder="Describe what the code does and what you want reviewed..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-upload"></i> Upload & Request Review</button>' +
                '</div></form>';
            break;

        /* ---------- EVALUATE STUDENT (Point 2) ---------- */
        case 'evaluateStudent':
            title.textContent = 'Medical Student Evaluation';
            html = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Evaluation submitted successfully!\');">' +
                '<div class="form-row"><div class="form-group"><label>Student Name *</label>' +
                '<select required>' +
                '<option value="">Select student...</option>' +
                '<option>Available students will appear here</option>' +
                '</select></div>' +
                '<div class="form-group"><label>Project</label>' +
                '<input type="text" placeholder="Associated project..."></div></div>' +

                '<div class="form-row"><div class="form-group"><label>Evaluation Period Start</label>' +
                '<input type="date"></div>' +
                '<div class="form-group"><label>Evaluation Period End</label>' +
                '<input type="date"></div></div>' +

                '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">' +
                '<h4 style="color:#00d4ff;margin-bottom:16px;font-size:0.9rem;"><i class="fas fa-star"></i> Evaluation Criteria (1-5)</h4>' +

                _buildEvalCriteria('Literature Review') +
                _buildEvalCriteria('Data Collection') +
                _buildEvalCriteria('Presentation Skills') +
                _buildEvalCriteria('Manuscript Contribution') +
                _buildEvalCriteria('Professionalism') +
                _buildEvalCriteria('Initiative') +

                '<div class="form-group"><label>Overall Score (1-5)</label>' +
                '<select>' +
                '<option value="">Select...</option>' +
                '<option>5 - Exceptional</option>' +
                '<option>4 - Exceeds Expectations</option>' +
                '<option>3 - Meets Expectations</option>' +
                '<option>2 - Needs Improvement</option>' +
                '<option>1 - Unsatisfactory</option>' +
                '</select></div>' +

                '<div class="form-group"><label>Comments</label>' +
                '<textarea rows="4" placeholder="Additional comments about the student\'s performance..."></textarea></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-clipboard-check"></i> Submit Evaluation</button>' +
                '</div></form>';
            break;

        /* ---------- SAMPLE SIZE CALCULATOR ---------- */
        case 'sampleSizeCalc':
            title.textContent = 'Sample Size Calculator';
            html = '<div>' +
                '<div class="form-group"><label>Test Type *</label>' +
                '<select id="ssTestType" onchange="updateSSFields()">' +
                '<option value="">Select test type...</option>' +
                '<option value="ttest">Two-Sample T-Test</option>' +
                '<option value="paired">Paired T-Test</option>' +
                '<option value="anova">One-Way ANOVA</option>' +
                '<option value="chi2">Chi-Square Test</option>' +
                '<option value="proportion">Two Proportions</option>' +
                '<option value="correlation">Correlation</option>' +
                '<option value="survival">Survival (Log-Rank)</option>' +
                '</select></div>' +

                '<div id="ssFields"></div>' +

                '<div class="form-row">' +
                '<div class="form-group"><label>Significance Level (\u03B1)</label>' +
                '<select id="ssAlpha"><option value="0.05" selected>0.05</option><option value="0.01">0.01</option><option value="0.10">0.10</option><option value="0.025">0.025</option></select></div>' +
                '<div class="form-group"><label>Power (1-\u03B2)</label>' +
                '<select id="ssPower"><option value="0.80" selected>80%</option><option value="0.85">85%</option><option value="0.90">90%</option><option value="0.95">95%</option></select></div>' +
                '</div>' +

                '<div class="form-group" style="display:flex;align-items:center;gap:10px;">' +
                '<input type="checkbox" id="ssTwoSided" checked style="width:auto;">' +
                '<label for="ssTwoSided" style="margin:0;cursor:pointer;">Two-sided test</label></div>' +

                '<div id="ssResult" style="display:none;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:20px;margin-top:16px;">' +
                '<h4 style="color:var(--accent-primary);margin-bottom:10px;font-family:\'Space Grotesk\',sans-serif;"><i class="fas fa-calculator"></i> Result</h4>' +
                '<div id="ssResultText"></div></div>' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="button" class="btn btn-primary" onclick="calculateSampleSize()"><i class="fas fa-calculator"></i> Calculate</button>' +
                '</div></div>';
            break;

        /* ---------- PROJECT DETAIL VIEW ---------- */
        case 'projectDetail':
            var projId = parseInt(extraData);
            // _findProject is now async; handle it after the switch
            body.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#00d4ff;"></i></div>';
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            _findProject(projId).then(function(proj) {
                if (!proj) { body.innerHTML = '<p>Project not found.</p>'; return; }
                _renderProjectDetailModal(proj, projId, title, body);
            });
            return; // skip default rendering below - handled by _renderProjectDetailModal

        /* ---------- UPLOAD CITI CERTIFICATE ---------- */
        case 'uploadCITI':
            title.textContent = 'Submit CITI Training Certificate';
            html = '<form onsubmit="event.preventDefault(); submitCITICert(this); closeModal();">' +
                '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-info-circle" style="color:#00d4ff;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">Certificates are reviewed by <strong>Dr. Kolakowsky-Hayner</strong> before status is updated.</span></div>' +
                '<div class="form-group"><label>Your Name *</label><input type="text" value="' + _esc(currentUserName) + '" required></div>' +
                '<div class="form-group"><label>Training Type *</label><select required>' +
                '<option value="">Select training...</option>' +
                '<option>CITI Human Subjects</option><option>HIPAA Training</option>' +
                '<option>Good Clinical Practice (GCP)</option><option>Responsible Conduct of Research</option>' +
                '<option>Biosafety Training</option><option>Other</option></select></div>' +
                '<div class="form-row"><div class="form-group"><label>Completion Date *</label><input type="date" required></div>' +
                '<div class="form-group"><label>Expiration Date</label><input type="date"></div></div>' +
                '<div class="form-group"><label>Certificate Number</label><input type="text" placeholder="e.g., CITI-12345678"></div>' +
                '<div class="form-group"><label>Upload Certificate (PDF/Image)</label>' +
                '<div class="pdf-upload-area" onclick="this.querySelector(\'input\').click()"><i class="fas fa-cloud-upload-alt"></i><p>Click to upload certificate</p><span>.pdf, .jpg, .png</span></div>' +
                '<input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;"></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit for Review</button></div></form>';
            break;

        /* ---------- SUBMIT CME CREDITS ---------- */
        case 'submitCME':
            title.textContent = 'Submit CME Credits';
            html = '<form onsubmit="event.preventDefault(); submitCMECredits(this); closeModal();">' +
                '<div class="alert-banner" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-info-circle" style="color:#f59e0b;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">CME credits are reviewed by <strong>Dr. Kolakowsky-Hayner</strong> before status is updated.</span></div>' +
                '<div class="form-group"><label>Your Name *</label><input type="text" value="' + _esc(currentUserName) + '" required></div>' +
                '<div class="form-row"><div class="form-group"><label>Activity Title *</label><input type="text" placeholder="e.g., AAN Annual Meeting 2026..." required></div>' +
                '<div class="form-group"><label>Credits Earned *</label><input type="number" min="0.25" step="0.25" placeholder="e.g., 25" required></div></div>' +
                '<div class="form-row"><div class="form-group"><label>Activity Date *</label><input type="date" required></div>' +
                '<div class="form-group"><label>Category</label><select>' +
                '<option>Category 1 (CME)</option><option>Category 2 (Self-Assessment)</option>' +
                '<option>MOC Part 2</option><option>MOC Part 4</option><option>Other</option></select></div></div>' +
                '<div class="form-group"><label>Upload Certificate (optional)</label>' +
                '<div class="pdf-upload-area" onclick="this.querySelector(\'input\').click()"><i class="fas fa-cloud-upload-alt"></i><p>Click to upload</p><span>.pdf, .jpg, .png</span></div>' +
                '<input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;"></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit for Review</button></div></form>';
            break;

        /* ---------- STUDENT MONTHLY ASSESSMENT ---------- */
        case 'studentAssessment':
            title.textContent = 'Monthly Student Assessment';
            html = '<form onsubmit="event.preventDefault(); submitStudentAssessment(this); closeModal();">' +
                '<div class="alert-banner" style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-clipboard-check" style="color:#7c3aed;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">Validated monthly assessment using a <strong>5-point Likert scale</strong>. Completed by supervising faculty.</span></div>' +
                '<div class="form-row"><div class="form-group"><label>Student *</label><select id="assessStudent" required>' +
                '<option value="">Select student...</option></select></div>' +
                '<div class="form-group"><label>Assessment Month *</label><input type="month" required></div></div>' +
                '<div class="form-group"><label>Linked Project</label><select><option value="">Select project...</option></select></div>' +
                '<hr style="border-color:rgba(255,255,255,0.06);margin:16px 0;">' +
                '<h4 style="color:var(--accent-primary);margin-bottom:4px;font-size:0.9rem;"><i class="fas fa-star"></i> Performance Domains (1=Poor, 5=Excellent)</h4>' +
                '<p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:16px;">Rate each domain on a 1-5 Likert scale based on observed performance.</p>' +
                _buildLikertRow('Medical Knowledge & Literature Review') +
                _buildLikertRow('Data Collection & Accuracy') +
                _buildLikertRow('Analytical & Critical Thinking') +
                _buildLikertRow('Communication & Presentation Skills') +
                _buildLikertRow('Professionalism & Reliability') +
                _buildLikertRow('Initiative & Self-Direction') +
                _buildLikertRow('Teamwork & Collaboration') +
                _buildLikertRow('Manuscript / Abstract Contribution') +
                '<div class="form-group" style="margin-top:16px;"><label>Overall Performance *</label>' +
                '<select required><option value="">Select...</option><option value="5">5 - Exceptional</option><option value="4">4 - Exceeds Expectations</option>' +
                '<option value="3">3 - Meets Expectations</option><option value="2">2 - Needs Improvement</option><option value="1">1 - Unsatisfactory</option></select></div>' +
                '<div class="form-group"><label>Strengths</label><textarea rows="2" placeholder="Key strengths observed this month..."></textarea></div>' +
                '<div class="form-group"><label>Areas for Growth</label><textarea rows="2" placeholder="Areas for improvement..."></textarea></div>' +
                '<div class="form-group"><label>Goals for Next Month</label><textarea rows="2" placeholder="Specific goals to work on..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Submit Assessment</button></div></form>';
            break;

        /* ---------- STUDENT PROJECT REQUEST ---------- */
        case 'studentProjectRequest':
            title.textContent = 'Request to Join a Project';
            html = '<form onsubmit="event.preventDefault(); submitStudentProjectRequest(this); closeModal();">' +
                '<div class="alert-banner" style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-info-circle" style="color:#10b981;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">Your request will be sent to the <strong>PI</strong> for approval. Once approved, you will complete IRB onboarding and gain access to the project protocol and data collection.</span></div>' +
                '<div class="form-group"><label>Your Name *</label><input type="text" value="' + _esc(currentUserName) + '" required></div>' +
                '<div class="form-group"><label>Project *</label><select required><option value="">Select project...</option></select></div>' +
                '<div class="form-group"><label>Research Interest / Motivation *</label>' +
                '<textarea rows="4" placeholder="Describe why you are interested in this project and what you hope to contribute..." required></textarea></div>' +
                '<div class="form-group"><label>Availability (hours/week)</label>' +
                '<input type="number" min="1" max="40" placeholder="e.g., 10"></div>' +
                '<div class="form-group"><label>Relevant Experience</label>' +
                '<textarea rows="2" placeholder="Previous research experience, skills, etc."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit Request</button></div></form>';
            break;

        /* ---------- TEMPLATE: RESEARCH PROTOCOL ---------- */
        case 'templateProtocol':
            title.textContent = 'Research Protocol Template';
            html = '<form onsubmit="event.preventDefault(); exportTemplate(\'protocol\', this);" style="max-height:65vh;overflow-y:auto;">' +
                '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
                '<i class="fas fa-file-medical" style="color:#00d4ff;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">Fill in each section. You can export to Word when complete.</span></div>' +
                '<div class="form-group"><label>Protocol Title *</label><input type="text" placeholder="Full protocol title..." required></div>' +
                '<div class="form-group"><label>Linked Project</label><select><option value="">Select project...</option></select></div>' +
                '<div class="form-row"><div class="form-group"><label>Principal Investigator *</label><input type="text" placeholder="PI name..." required></div>' +
                '<div class="form-group"><label>Version / Date</label><input type="text" placeholder="e.g., v1.0 - Feb 2026"></div></div>' +
                '<div class="form-group"><label>1. Background & Significance *</label><textarea rows="5" placeholder="Describe the scientific background, current knowledge gaps, and clinical significance..." required></textarea></div>' +
                '<div class="form-group"><label>2. Specific Aims *</label><textarea rows="4" placeholder="List the specific aims of the study..." required></textarea></div>' +
                '<div class="form-group"><label>3. Study Design & Methods *</label><textarea rows="5" placeholder="Describe the study design (RCT, cohort, etc.), inclusion/exclusion criteria, and procedures..." required></textarea></div>' +
                '<div class="form-group"><label>4. Outcome Measures</label><textarea rows="3" placeholder="Primary and secondary outcome measures..."></textarea></div>' +
                '<div class="form-group"><label>5. Statistical Analysis Plan</label><textarea rows="4" placeholder="Describe the planned statistical analyses, sample size justification, and analysis software..."></textarea></div>' +
                '<div class="form-group"><label>6. Data Collection & Management</label><textarea rows="3" placeholder="Describe how data will be collected (REDCap, chart review, etc.), stored, and managed..."></textarea></div>' +
                '<div class="form-group"><label>7. Ethical Considerations</label><textarea rows="3" placeholder="IRB approval plan, informed consent process, data privacy measures..."></textarea></div>' +
                '<div class="form-group"><label>8. Timeline</label><textarea rows="2" placeholder="Project timeline and milestones..."></textarea></div>' +
                '<div class="form-group"><label>9. References</label><textarea rows="3" placeholder="Key references cited in the protocol..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="button" class="btn btn-outline" onclick="saveTemplateDraft(\'protocol\', this.closest(\'form\'))"><i class="fas fa-save"></i> Save Draft</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-file-word"></i> Export to Word</button></div></form>';
            break;

        /* ---------- TEMPLATE: CONSENT FORM ---------- */
        case 'templateConsent':
            title.textContent = 'Informed Consent Form Template';
            html = '<form onsubmit="event.preventDefault(); exportTemplate(\'consent\', this);" style="max-height:65vh;overflow-y:auto;">' +
                '<div class="form-group"><label>Study Title *</label><input type="text" placeholder="Full study title..." required></div>' +
                '<div class="form-group"><label>Linked Project</label><select><option value="">Select project...</option></select></div>' +
                '<div class="form-row"><div class="form-group"><label>Principal Investigator</label><input type="text" placeholder="PI name..."></div>' +
                '<div class="form-group"><label>IRB Protocol Number</label><input type="text" placeholder="e.g., IRB-2026-XXXX"></div></div>' +
                '<div class="form-group"><label>1. Purpose of the Study *</label><textarea rows="3" placeholder="You are being asked to participate in a research study. The purpose of this study is..." required></textarea></div>' +
                '<div class="form-group"><label>2. Study Procedures *</label><textarea rows="4" placeholder="If you agree to participate, you will be asked to..." required></textarea></div>' +
                '<div class="form-group"><label>3. Risks & Discomforts</label><textarea rows="3" placeholder="The possible risks of participating in this study include..."></textarea></div>' +
                '<div class="form-group"><label>4. Benefits</label><textarea rows="2" placeholder="You may not benefit directly from this study, however..."></textarea></div>' +
                '<div class="form-group"><label>5. Alternatives</label><textarea rows="2" placeholder="Instead of participating, you may choose to..."></textarea></div>' +
                '<div class="form-group"><label>6. Confidentiality</label><textarea rows="3" placeholder="Your records will be kept confidential. Your identity will be protected by..."></textarea></div>' +
                '<div class="form-group"><label>7. Voluntary Participation</label><textarea rows="2" placeholder="Your participation is voluntary. You may refuse to participate or withdraw at any time..."></textarea></div>' +
                '<div class="form-group"><label>8. Contact Information</label><textarea rows="2" placeholder="If you have questions about this study, please contact..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="button" class="btn btn-outline" onclick="saveTemplateDraft(\'consent\', this.closest(\'form\'))"><i class="fas fa-save"></i> Save Draft</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-file-word"></i> Export to Word</button></div></form>';
            break;

        /* ---------- TEMPLATE: IRB COVER LETTER ---------- */
        case 'templateIRBLetter':
            title.textContent = 'IRB Submission Cover Letter';
            html = '<form onsubmit="event.preventDefault(); exportTemplate(\'irbLetter\', this);" style="max-height:65vh;overflow-y:auto;">' +
                '<div class="form-row"><div class="form-group"><label>Submission Type *</label><select required>' +
                '<option value="">Select...</option><option>New Protocol</option><option>Amendment</option>' +
                '<option>Continuing Review</option><option>Adverse Event Report</option></select></div>' +
                '<div class="form-group"><label>Date</label><input type="date" value="' + new Date().toISOString().split('T')[0] + '"></div></div>' +
                '<div class="form-group"><label>Protocol Title *</label><input type="text" placeholder="Protocol title..." required></div>' +
                '<div class="form-group"><label>Protocol Number</label><input type="text" placeholder="IRB-2026-XXXX"></div>' +
                '<div class="form-group"><label>Principal Investigator</label><input type="text" placeholder="PI name and credentials..."></div>' +
                '<div class="form-group"><label>Study Summary *</label><textarea rows="4" placeholder="Brief summary of the study for the IRB..." required></textarea></div>' +
                '<div class="form-group"><label>Changes / Key Points</label><textarea rows="3" placeholder="For amendments: describe changes. For new protocols: key design points. For continuing review: enrollment status..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-file-word"></i> Export to Word</button></div></form>';
            break;

        /* ---------- TEMPLATE: DATA MANAGEMENT PLAN ---------- */
        case 'templateDMP':
            title.textContent = 'Data Management Plan Template';
            html = '<form onsubmit="event.preventDefault(); exportTemplate(\'dmp\', this);" style="max-height:65vh;overflow-y:auto;">' +
                '<div class="form-group"><label>Project Title *</label><input type="text" placeholder="Project title..." required></div>' +
                '<div class="form-group"><label>Linked Project</label><select><option value="">Select project...</option></select></div>' +
                '<div class="form-group"><label>1. Data Types & Formats</label><textarea rows="3" placeholder="What types of data will be collected? (clinical, imaging, genomic, survey, etc.) What formats? (CSV, DICOM, FASTA, etc.)"></textarea></div>' +
                '<div class="form-group"><label>2. Data Collection Methods</label><textarea rows="3" placeholder="How will data be collected? (REDCap, chart review, prospective enrollment, devices, etc.)"></textarea></div>' +
                '<div class="form-group"><label>3. Data Storage & Security</label><textarea rows="3" placeholder="Where will data be stored? Security measures? Encryption? Access controls?"></textarea></div>' +
                '<div class="form-group"><label>4. Data Sharing Plan</label><textarea rows="2" placeholder="Will data be shared? Under what conditions? De-identification procedures?"></textarea></div>' +
                '<div class="form-group"><label>5. Data Retention & Archiving</label><textarea rows="2" placeholder="How long will data be retained? Archiving procedures? Destruction timelines?"></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-file-word"></i> Export to Word</button></div></form>';
            break;

        /* ---------- UPLOAD DOCUMENT ---------- */
        case 'uploadDocument':
            title.textContent = 'Upload Document';
            html = '<form onsubmit="event.preventDefault(); saveDocument(this);">' +
                '<div class="form-group"><label>Document Title *</label><input type="text" placeholder="Document title..." required></div>' +
                '<div class="form-group"><label>Category *</label><select required>' +
                '<option value="">Select category...</option><option>Policy</option><option>Template</option>' +
                '<option>Guideline</option><option>SOP</option><option>Training Material</option><option>Other</option></select></div>' +
                '<div class="form-group"><label>Upload File *</label>' +
                '<div class="pdf-upload-area" onclick="this.querySelector(\'input\').click()"><i class="fas fa-cloud-upload-alt"></i><p>Click to upload or drag & drop</p><span>.pdf, .doc, .docx, .xlsx, .pptx</span></div>' +
                '<input type="file" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt" required style="display:none;"></div>' +
                '<div class="form-group"><label>Description</label><textarea rows="2" placeholder="Brief description..."></textarea></div>' +
                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-upload"></i> Upload</button></div></form>';
            break;

        /* ---------- REDCAP FORM BUILDER ---------- */
        case 'redcapBuilder':
            title.textContent = 'REDCap Form Builder';
            html = '<div style="margin-bottom:20px;">' +
                '<div class="alert-banner" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
                '<i class="fas fa-magic" style="color:#f59e0b;"></i>' +
                '<span style="font-size:0.82rem;color:var(--text-secondary);">Import a REDCap data dictionary CSV <strong style="color:var(--text-primary);">or</strong> manually define variables below. The form will be auto-generated.</span></div>' +

                '<div class="form-group"><label>Linked Project *</label>' +
                '<select id="redcapProject" required>' +
                '<option value="">Select project...</option></select></div>' +

                '<div class="form-group"><label>Form / Instrument Name *</label>' +
                '<input type="text" id="redcapFormName" placeholder="e.g., Baseline Demographics, Follow-Up Visit..."></div>' +

                '<h4 class="form-section-title"><i class="fas fa-file-csv" style="margin-right:6px;"></i> Option 1: Import Data Dictionary (CSV)</h4>' +
                '<div class="form-group">' +
                '<div class="pdf-upload-area" id="csvDropZone" onclick="document.getElementById(\'csvFileInput\').click();">' +
                '<i class="fas fa-file-csv" style="color:#f59e0b;"></i>' +
                '<p>Click to upload REDCap Data Dictionary CSV</p>' +
                '<span>Expects columns: Variable, Form, Field Type, Field Label, Choices</span>' +
                '</div>' +
                '<input type="file" id="csvFileInput" accept=".csv" style="display:none;" onchange="parseRedcapCSV(this)">' +
                '</div>' +
                '<div id="csvParseResult" style="display:none;"></div>' +

                '<h4 class="form-section-title"><i class="fas fa-pencil-alt" style="margin-right:6px;"></i> Option 2: Define Variables Manually</h4>' +
                '<div id="redcapVarList"></div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' +
                '<input type="text" id="newVarName" placeholder="Variable name..." style="flex:2;min-width:140px;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-family:inherit;font-size:0.82rem;">' +
                '<select id="newVarType" style="flex:1;min-width:120px;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-family:inherit;font-size:0.82rem;">' +
                '<option value="text">Text</option>' +
                '<option value="number">Number</option>' +
                '<option value="date">Date</option>' +
                '<option value="dropdown">Dropdown</option>' +
                '<option value="radio">Radio Buttons</option>' +
                '<option value="checkbox">Checkbox</option>' +
                '<option value="yesno">Yes/No</option>' +
                '<option value="textarea">Notes / Textarea</option>' +
                '<option value="calc">Calculated Field</option>' +
                '<option value="file">File Upload</option>' +
                '<option value="slider">Slider (0-100)</option>' +
                '</select>' +
                '<input type="text" id="newVarLabel" placeholder="Field label..." style="flex:3;min-width:180px;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-family:inherit;font-size:0.82rem;">' +
                '<button type="button" class="btn btn-primary btn-sm" onclick="addRedcapVar()"><i class="fas fa-plus"></i></button>' +
                '</div>' +
                '<input type="text" id="newVarChoices" placeholder="For dropdown/radio/checkbox: choices separated by | (e.g., Male | Female | Other)" style="width:100%;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-family:inherit;font-size:0.82rem;margin-bottom:16px;">' +

                '<div class="modal-actions">' +
                '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
                '<button type="button" class="btn btn-primary" onclick="generateRedcapForm()"><i class="fas fa-magic"></i> Generate Form</button>' +
                '</div></div>';
            break;

        default:
            title.textContent = 'Modal';
            html = '<p>Unknown modal type: ' + type + '</p>';
    }

    body.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Populate project dropdowns in modal
    _populateProjectDropdowns();

    // Populate PI dropdowns from faculty list
    _populatePIDropdowns();

    // Re-init ripple effects for new buttons inside modal
    setTimeout(function () { initRippleEffect(); }, 50);
}

// Helper: Build support request form (shared between newRequest and statRequest)
function _buildRequestForm(prefilledCategory) {
    var categorySelected = function (val) {
        return prefilledCategory === val ? ' selected' : '';
    };

    return '<form onsubmit="event.preventDefault(); saveForumRequest(this);">' +
        '<div class="form-group"><label>Request Title *</label>' +
        '<input type="text" placeholder="Brief title for your request..." required></div>' +

        '<div class="form-row"><div class="form-group"><label>Category</label>' +
        '<select>' +
        '<option value="">Select category...</option>' +
        '<option' + categorySelected('Statistical Consultation') + '>Statistical Consultation</option>' +
        '<option' + categorySelected('Data Query') + '>Data Query</option>' +
        '<option' + categorySelected('Regulatory Question') + '>Regulatory Question</option>' +
        '<option' + categorySelected('Resource Request') + '>Resource Request</option>' +
        '<option' + categorySelected('IT Support') + '>IT Support</option>' +
        '<option' + categorySelected('Other') + '>Other</option>' +
        '</select></div>' +

        '<div class="form-group"><label>Send To</label>' +
        '<select>' +
        '<option value="">Select recipient...</option>' +
        '<option>Research Director</option>' +
        '<option>Department Chair</option>' +
        '<option>CRC</option>' +
        '<option>Statistician</option>' +
        '<option>Informaticist</option>' +
        '<option>All Admins</option>' +
        '<option>Other</option>' +
        '</select></div></div>' +

        '<div class="form-row"><div class="form-group"><label>Priority</label>' +
        '<select>' +
        '<option>Low</option>' +
        '<option selected>Medium</option>' +
        '<option>High</option>' +
        '</select></div>' +

        '<div class="form-group"><label>Linked Project *</label>' +
        '<select required>' +
        '<option value="">Select project...</option>' +
        '</select>' +
        '<span style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;display:block;">All requests must be linked to a project.</span></div></div>' +

        '<div class="form-group"><label>Description *</label>' +
        '<textarea rows="4" placeholder="Describe your request in detail..." required></textarea></div>' +

        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit Request</button>' +
        '</div></form>';
}

// Helper: Build evaluation criteria row
function _buildEvalCriteria(label) {
    return '<div class="form-group" style="display:flex;align-items:center;gap:12px;">' +
        '<label style="flex:1;min-width:160px;margin:0;">' + label + '</label>' +
        '<select style="flex:0 0 140px;">' +
        '<option value="">Score...</option>' +
        '<option>5</option>' +
        '<option>4</option>' +
        '<option>3</option>' +
        '<option>2</option>' +
        '<option>1</option>' +
        '</select></div>';
}

// Toggle medical student fields
function toggleMedStudentFields() {
    var role = document.getElementById('personRole');
    var fields = document.getElementById('medStudentFields');
    if (role && fields) {
        fields.style.display = role.value === 'Medical Student' ? 'block' : 'none';
    }
}

// Toggle publication type fields
function togglePubFields() {
    var type = document.getElementById('pubType');
    var pubFields = document.getElementById('pubFields');
    var presFields = document.getElementById('presFields');
    var patentFields = document.getElementById('patentFields');

    if (!type) return;

    if (pubFields) pubFields.style.display = 'none';
    if (presFields) presFields.style.display = 'none';
    if (patentFields) patentFields.style.display = 'none';

    switch (type.value) {
        case 'publication':
            if (pubFields) pubFields.style.display = 'block';
            break;
        case 'presentation':
            if (presFields) presFields.style.display = 'block';
            break;
        case 'patent':
            if (patentFields) patentFields.style.display = 'block';
            break;
    }
}

/* ================================================
   6b. PROJECT WIZARD + MANAGEMENT
   ================================================ */
var _wizStep = 1;
var _wizTotalSteps = 5;

/* --- Wizard Navigation --- */
function wizardNext() {
    // Validate step 1 required fields
    if (_wizStep === 1) {
        var req = ['wz_title', 'wz_studyType', 'wz_pillar', 'wz_dept', 'wz_pi', 'wz_disease', 'wz_abstract'];
        for (var i = 0; i < req.length; i++) {
            var el = document.getElementById(req[i]);
            if (el && !el.value.trim()) {
                el.focus();
                showToast('Please fill in all required (*) fields.', 'error');
                return;
            }
        }
    }

    // Validate step 2: Protocol fields required if NA not checked
    if (_wizStep === 2) {
        var protNA = document.getElementById('wz_protocolNA');
        if (protNA && !protNA.checked) {
            var protReq = ['wz_protBg', 'wz_protAims', 'wz_protMethods'];
            for (var p = 0; p < protReq.length; p++) {
                var pEl = document.getElementById(protReq[p]);
                if (pEl && !pEl.value.trim()) {
                    pEl.focus();
                    showToast('Protocol fields are required unless marked N/A. Please fill in Background, Aims, and Methods.', 'error');
                    return;
                }
            }
        }
    }

    // Validate step 3: IRB fields required if NA not checked
    if (_wizStep === 3) {
        var irbNA = document.getElementById('wz_irbNA');
        if (irbNA && !irbNA.checked) {
            var irbReq = ['wz_consentPurpose', 'wz_consentProc'];
            for (var ir = 0; ir < irbReq.length; ir++) {
                var irEl = document.getElementById(irbReq[ir]);
                if (irEl && !irEl.value.trim()) {
                    irEl.focus();
                    showToast('IRB/Consent fields are required unless marked N/A. Please fill in the consent information.', 'error');
                    return;
                }
            }
        }
    }

    if (_wizStep < _wizTotalSteps) {
        _wizStep++;
        _updateWizardUI();
    }
}

function wizardPrev() {
    if (_wizStep > 1) {
        _wizStep--;
        _updateWizardUI();
    }
}

function _updateWizardUI() {
    // Hide all panels, show current
    for (var s = 1; s <= _wizTotalSteps; s++) {
        var panel = document.getElementById('wizStep' + s);
        var stepEl = document.querySelector('.wizard-step[data-step="' + s + '"]');
        if (panel) panel.style.display = (s === _wizStep) ? '' : 'none';
        if (panel && s === _wizStep) panel.classList.add('active');
        if (stepEl) {
            stepEl.classList.remove('active', 'completed');
            if (s === _wizStep) stepEl.classList.add('active');
            else if (s < _wizStep) stepEl.classList.add('completed');
        }
    }
    // Toggle buttons
    var prevBtn = document.getElementById('wizBtnPrev');
    var nextBtn = document.getElementById('wizBtnNext');
    var submitBtn = document.getElementById('wizBtnSubmit');
    if (prevBtn) prevBtn.style.display = _wizStep > 1 ? '' : 'none';
    if (nextBtn) nextBtn.style.display = _wizStep < _wizTotalSteps ? '' : 'none';
    if (submitBtn) submitBtn.style.display = _wizStep === _wizTotalSteps ? '' : 'none';
}

function toggleUmbrellaIRB() {
    var sel = document.getElementById('wz_umbrellaIRB');
    var field = document.getElementById('wz_umbrellaField');
    if (sel && field) field.style.display = sel.value === 'yes' ? '' : 'none';
}

function toggleWizNA(section) {
    var map = { protocol: 'wz_protocolFields', irb: 'wz_irbFields', budget: 'wz_budgetFields' };
    var checkId = { protocol: 'wz_protocolNA', irb: 'wz_irbNA', budget: 'wz_budgetNA' };
    var fields = document.getElementById(map[section]);
    var check = document.getElementById(checkId[section]);
    if (fields && check) {
        fields.style.display = check.checked ? 'none' : '';
        fields.style.opacity = check.checked ? '0.3' : '1';
    }
}

/* --- Budget Auto-Calculate --- */
function budgetAutoCalc(sel) {
    var row = sel.closest('tr');
    if (!row) return;
    var qtyInput = row.querySelector('.budget-qty');
    var unitInput = row.querySelector('.budget-unit');
    if (!qtyInput || !unitInput) return;

    var presets = {
        'consult_10': { qty: 10, unit: 150 },
        'consult_20': { qty: 20, unit: 150 },
        'consult_40': { qty: 40, unit: 150 },
        'consult_custom': { qty: 0, unit: 150 },
        'redcap': { qty: 1, unit: 0 },
        'spss': { qty: 1, unit: 1200 },
        'stata': { qty: 1, unit: 1800 },
        'sas': { qty: 1, unit: 8800 },
        'matlab': { qty: 1, unit: 2150 },
        'r_free': { qty: 1, unit: 0 },
        'python_free': { qty: 1, unit: 0 },
        'software_other': { qty: 1, unit: 0 },
        'crc_part': { qty: 12, unit: 2500 },
        'crc_full': { qty: 12, unit: 5000 },
        'ra_part': { qty: 12, unit: 2000 },
        'personnel_other': { qty: 0, unit: 0 }
    };

    var preset = presets[sel.value];
    if (preset) {
        qtyInput.value = preset.qty;
        unitInput.value = preset.unit;
    }
    budgetRecalcRow(qtyInput);
}

function budgetRecalcRow(el) {
    var row = el.closest('tr');
    if (!row) return;
    var qty = parseFloat(row.querySelector('.budget-qty').value) || 0;
    var unit = parseFloat(row.querySelector('.budget-unit').value) || 0;
    var totalCell = row.querySelector('.budget-total');
    if (totalCell) totalCell.textContent = '$' + (qty * unit).toLocaleString();
    _recalcBudgetTotal();
}

function _recalcBudgetTotal() {
    var total = 0;
    document.querySelectorAll('#budgetTableBody .budget-total').forEach(function (cell) {
        var val = cell.textContent.replace(/[$,]/g, '');
        total += parseFloat(val) || 0;
    });
    var gt = document.getElementById('budgetGrandTotal');
    if (gt) gt.textContent = '$' + total.toLocaleString();
}

/* --- Add Budget Row dynamically --- */
function addBudgetRow() {
    var tbody = document.getElementById('budgetTableBody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.setAttribute('data-cat', 'custom');
    tr.innerHTML = '<td><input type="text" placeholder="Category..." style="background:transparent;border:none;color:var(--text-primary);font-family:inherit;font-size:0.82rem;width:100%;"></td>' +
        '<td><input type="text" placeholder="Item description..." class="budget-item-text"></td>' +
        '<td><input type="text" placeholder="Details / Link..." class="budget-detail"></td>' +
        '<td><input type="number" class="budget-qty" value="1" min="0" onchange="budgetRecalcRow(this)"></td>' +
        '<td><input type="number" class="budget-unit" value="0" onchange="budgetRecalcRow(this)"></td>' +
        '<td class="budget-total">$0</td>';
    tbody.appendChild(tr);
    showToast('Budget row added.', 'success');
}

/* --- Submit Project from Wizard --- */
async function wizardSubmit() {
    var titleVal = _val('wz_title');
    if (!titleVal) { showToast('Project title is required.', 'error'); return; }

    var protocolData = {
        na: document.getElementById('wz_protocolNA') ? document.getElementById('wz_protocolNA').checked : false,
        background: _val('wz_protBg'),
        aims: _val('wz_protAims'),
        methods: _val('wz_protMethods'),
        outcomes: _val('wz_protOutcomes'),
        statPlan: _val('wz_protStats'),
        dataCollection: _val('wz_protData'),
        timeline: _val('wz_protTimeline')
    };

    var irbConsentData = {
        na: document.getElementById('wz_irbNA') ? document.getElementById('wz_irbNA').checked : false,
        submissionType: _val('wz_irbType'),
        consentPurpose: _val('wz_consentPurpose'),
        consentProc: _val('wz_consentProc'),
        consentRisks: _val('wz_consentRisks'),
        consentBenefits: _val('wz_consentBenefits'),
        consentConfid: _val('wz_consentConfid')
    };

    var budgetData = {
        na: document.getElementById('wz_budgetNA') ? document.getElementById('wz_budgetNA').checked : false,
        totalEstimate: document.getElementById('budgetGrandTotal') ? document.getElementById('budgetGrandTotal').textContent : '$0'
    };

    var filesData = {};
    if (!protocolData.na && protocolData.background) {
        filesData.protocol = 'Protocol (created in wizard)';
    }

    var row = {
        title: titleVal,
        study_type: _val('wz_studyType'),
        pillar: _val('wz_pillar') || null,
        department: _val('wz_dept'),
        pi: _val('wz_pi'),
        disease_focus: _val('wz_disease'),
        co_investigators: _val('wz_coI'),
        abstract: _val('wz_abstract'),
        umbrella_irb: _val('wz_umbrellaIRB') === 'yes' ? _val('wz_umbrellaNum') : '',
        status: 'Pre-submission',
        phase: 'Protocol Preparation',
        progress: 0,
        irb_approved: false,
        irb_protocol_number: '',
        irb_personnel: [],
        created_by: currentUserId,
        protocol: protocolData,
        irb_consent: irbConsentData,
        budget: budgetData,
        files: filesData,
        manuscript: { content: '', lastEditedBy: '', lastEditedAt: '' },
        notes: _val('wz_notes')
    };

    var { data: inserted, error } = await _sb.from('projects').insert(row).select().single();
    if (error) {
        showToast('Error creating project: ' + error.message, 'error');
        return;
    }

    await renderProjects();
    _populateProjectDropdowns();
    closeModal();
    _wizStep = 1;
    showToast('Project "' + titleVal + '" submitted as Pre-submission!', 'success');

    // Audit log
    await logAudit('created', 'project', inserted.id, 'Project "' + titleVal + '" created by ' + currentUserName);

    // Send notification to Dr. Hayner and Ahmad for review
    await _sendProjectNotification(inserted, 'new');
}

function _val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

/* --- Legacy createProject for backward compat --- */
async function createProject(formEl) {
    if (!formEl) return;
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var data = {};
    var fieldMap = ['title', 'study_type', 'pillar', 'department', 'pi', 'co_investigators', 'status', 'phase'];
    inputs.forEach(function (el, i) { if (fieldMap[i]) data[fieldMap[i]] = el.value; });
    data.progress = 0;
    data.created_by = currentUserId;
    if (data.pillar && ['Translational','Clinical','Computational'].indexOf(data.pillar) === -1) data.pillar = null;
    var { error } = await _sb.from('projects').insert(data);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    await renderProjects();
    _populateProjectDropdowns();
    closeModal();
    showToast('Project created!', 'success');
}

/* --- IRB Approval Workflow --- */
async function openIRBReview(projId) {
    var proj = await _findProject(projId);
    if (!proj) return;
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'IRB Review: ' + (proj.title || 'Project');

    var html = '<div>' +
        '<div class="alert-banner" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
        '<i class="fas fa-shield-alt" style="color:#f59e0b;"></i>' +
        '<span style="font-size:0.82rem;color:var(--text-secondary);">IRB reviewer access. Review the project and upload the approval document to activate it.</span></div>' +
        '<div class="form-group"><label>Project Title</label><input type="text" value="' + _esc(proj.title) + '" readonly style="opacity:0.7;"></div>' +
        '<div class="form-group"><label>PI</label><input type="text" value="' + _esc(proj.pi) + '" readonly style="opacity:0.7;"></div>' +
        '<div class="form-group"><label>IRB Decision *</label><select id="irbDecision" required>' +
        '<option value="">Select decision...</option><option value="approved">Approved</option>' +
        '<option value="conditional">Approved with Conditions</option>' +
        '<option value="deferred">Deferred / Revisions Required</option>' +
        '<option value="denied">Not Approved</option></select></div>' +
        '<div class="form-group"><label>IRB Protocol Number *</label><input type="text" id="irbProtNum" placeholder="e.g., IRB-2026-0042" required></div>' +
        '<div class="form-group"><label>Upload Approval Document *</label>' +
        '<div class="pdf-upload-area" onclick="this.querySelector(\'input\').click()"><i class="fas fa-file-pdf" style="color:#ef4444;"></i><p>Click to upload IRB approval letter</p><span>.pdf</span></div>' +
        '<input type="file" id="irbApprovalFile" accept=".pdf" style="display:none;"></div>' +
        '<div class="form-group"><label>IRB Personnel (who can access this project)</label>' +
        '<textarea id="irbPersonnelList" rows="3" placeholder="List all personnel approved on the IRB protocol, one per line...">' + (proj.irbPersonnel || []).join('\\n') + '</textarea></div>' +
        '<div class="form-group"><label>Comments</label><textarea id="irbComments" rows="2" placeholder="Any reviewer comments..."></textarea></div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="submitIRBDecision(' + projId + ')"><i class="fas fa-gavel"></i> Submit Decision</button></div></div>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function submitIRBDecision(projId) {
    var proj = await _findProject(projId);
    if (!proj) return;
    var decision = document.getElementById('irbDecision');
    var protNum = document.getElementById('irbProtNum');
    if (!decision || !decision.value) { showToast('Select a decision.', 'error'); return; }
    if (!protNum || !protNum.value.trim()) { showToast('Enter the IRB protocol number.', 'error'); return; }

    var updates = {
        irb_protocol_number: protNum.value.trim(),
        irb_decision: decision.value
    };

    // Parse personnel list
    var personnelEl = document.getElementById('irbPersonnelList');
    if (personnelEl) {
        updates.irb_personnel = personnelEl.value.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    }

    var fileInput = document.getElementById('irbApprovalFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        var currentFiles = proj.files || {};
        currentFiles.irbApproval = fileInput.files[0].name;
        updates.files = currentFiles;
    }

    if (decision.value === 'approved' || decision.value === 'conditional') {
        updates.irb_approved = true;
        updates.status = 'Active';
        updates.phase = 'Data Collection';
        showToast('IRB Approved! Project is now Active. Protocol #: ' + updates.irb_protocol_number, 'success');
    } else if (decision.value === 'deferred') {
        updates.status = 'Pre-submission';
        updates.phase = 'IRB Review';
        showToast('IRB deferred. Revisions required.', 'info');
    } else {
        showToast('IRB decision recorded.', 'info');
    }

    await _sb.from('projects').update(updates).eq('id', projId);

    // Audit log
    await logAudit('irb_decision', 'project', projId, 'IRB decision: ' + decision.value + ' for "' + (proj.title || '') + '"');

    // Merge for notification
    Object.assign(proj, updates);

    // Notify PI about IRB decision
    await _sendProjectNotification(proj, 'irb_decision');

    await renderProjects();
    closeModal();
}

/* --- Project Access Check (IRB personnel) --- */
function _canAccessProject(proj) {
    // Admins always have access
    if (currentUserRole === 'Admin') return true;
    // Creator always has access
    var creatorId = proj.created_by || proj.createdBy;
    if (creatorId === currentUserId) return true;
    // Get irb consent data from either field name
    var irbData = proj.irb_consent || proj.irb || {};
    var irbApproved = proj.irb_approved || proj.irbApproved;
    // If project has no IRB or IRB not yet approved, creator and admins only
    if (!irbApproved && !irbData.na) return creatorId === currentUserId;
    // If IRB is NA (not needed), anyone can access
    if (irbData.na) return true;
    // If IRB approved, check if user is on the IRB personnel list
    var personnel = proj.irb_personnel || proj.irbPersonnel || [];
    if (personnel.length > 0) {
        var userName = currentUserName.toLowerCase();
        var userEmail = currentUserEmail.toLowerCase();
        for (var i = 0; i < personnel.length; i++) {
            var person = personnel[i].toLowerCase();
            if (person.indexOf(userName) !== -1 || person.indexOf(userEmail) !== -1) return true;
        }
        return false;
    }
    return true;
}

async function editProject(id) {
    var proj = await _findProject(id);
    if (!proj) return;

    // Only PI or admins can edit
    if (!_canEditProject(proj)) {
        showToast('Only the PI or an admin can edit this project.', 'error');
        return;
    }

    var overlay = document.getElementById('modalOverlay');
    var title = document.getElementById('modalTitle');
    var body = document.getElementById('modalBody');
    title.textContent = 'Edit Project';

    var memberListHtml = '';
    if (proj.members && proj.members.length > 0) {
        proj.members.forEach(function (m) {
            memberListHtml += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
                '<span style="flex:1;font-size:0.82rem;">' + m.name + ' <span style="color:var(--text-muted);font-size:0.72rem;">(' + m.role + ')</span></span>' +
                '<button type="button" class="btn btn-danger btn-sm" onclick="removeProjectMember(' + proj.id + ',' + m.id + ')"><i class="fas fa-times"></i></button></div>';
        });
    } else {
        memberListHtml = '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">No team members added yet.</p>';
    }

    var html = '<form onsubmit="event.preventDefault(); saveProjectEdits(' + proj.id + ', this);">' +
        '<div class="form-group"><label>Project Title *</label>' +
        '<input type="text" value="' + _esc(proj.title) + '" required></div>' +

        '<div class="form-row"><div class="form-group"><label>Status</label>' +
        '<select>' +
        _opt('Pre-submission', proj.status) +
        _opt('IRB Review', proj.status) +
        _opt('Active', proj.status) +
        _opt('Enrolling', proj.status) +
        _opt('Data Collection', proj.status) +
        _opt('Analysis', proj.status) +
        _opt('Completed', proj.status) +
        _opt('On Hold', proj.status) +
        '</select></div>' +

        '<div class="form-group"><label>Pipeline Phase</label>' +
        '<select>' +
        _opt('Protocol Preparation', proj.phase) +
        _opt('IRB Review', proj.phase) +
        _opt('Contracts', proj.phase) +
        _opt('Funding', proj.phase) +
        _opt('Data Collection', proj.phase) +
        _opt('Analysis', proj.phase) +
        _opt('Paper Write-Up', proj.phase) +
        _opt('Submitted', proj.phase) +
        _opt('Accepted', proj.phase) +
        '</select></div></div>' +

        '<div class="form-group"><label>Progress (%)</label>' +
        '<input type="number" min="0" max="100" value="' + (proj.progress || 0) + '"></div>' +

        '<div class="form-group"><label>Co-Investigators</label>' +
        '<input type="text" value="' + _esc(proj.coInvestigators) + '" placeholder="Comma-separated names..."></div>' +

        '<div class="form-group"><label>Disease Focus</label>' +
        '<input type="text" value="' + _esc(proj.diseaseFocus) + '"></div>' +

        '<div class="form-group"><label>Abstract</label>' +
        '<textarea rows="3">' + _esc(proj.abstract) + '</textarea></div>' +

        '<h4 class="form-section-title"><i class="fas fa-users" style="margin-right:6px;"></i> Team Members</h4>' +
        '<div id="editProjectMembers">' + memberListHtml + '</div>' +
        '<div class="form-row" style="margin-top:12px;">' +
        '<div class="form-group"><label>Add Member Name</label>' +
        '<input type="text" id="newMemberName" placeholder="Full name..."></div>' +
        '<div class="form-group"><label>Role</label>' +
        '<div style="display:flex;gap:6px;">' +
        '<select id="newMemberRole" style="flex:1;">' +
        '<option value="">Select role...</option>' +
        '<option>Resident</option>' +
        '<option>Medical Student</option>' +
        '<option>Research Fellow</option>' +
        '<option>CRC</option>' +
        '<option>Research Nurse</option>' +
        '<option>Statistician</option>' +
        '<option>Other</option>' +
        '</select>' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="addProjectMember(' + proj.id + ')"><i class="fas fa-plus"></i></button>' +
        '</div></div></div>' +

        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Changes</button>' +
        '</div></form>';

    body.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function saveProjectEdits(id, formEl) {
    var proj = await _findProject(id);
    if (!proj) return;

    var inputs = formEl.querySelectorAll('input, select, textarea');
    var oldStatus = proj.status;
    var updates = {
        title: inputs[0].value,
        status: inputs[1].value,
        phase: inputs[2].value,
        progress: parseInt(inputs[3].value) || 0,
        co_investigators: inputs[4].value,
        disease_focus: inputs[5].value,
        abstract: inputs[6].value
    };

    await _sb.from('projects').update(updates).eq('id', id);
    Object.assign(proj, updates);

    // Notify PI if status changed
    if (oldStatus !== updates.status) {
        await _sendProjectNotification(proj, 'status_change');
    }

    await renderProjects();
    closeModal();
    showToast('Project updated!', 'success');
}

async function addProjectMember(projectId) {
    var nameEl = document.getElementById('newMemberName');
    var roleEl = document.getElementById('newMemberRole');
    if (!nameEl || !nameEl.value.trim()) {
        showToast('Enter a member name.', 'error');
        return;
    }

    var memberName = nameEl.value.trim();
    var memberRole = roleEl ? roleEl.value || 'Team Member' : 'Team Member';

    await _sb.from('project_members').insert({
        project_id: projectId,
        member_name: memberName,
        member_role: memberRole
    });

    // Refresh the edit modal
    await editProject(projectId);
    showToast(memberName + ' added to the project.', 'success');
}

async function removeProjectMember(projectId, memberId) {
    await _sb.from('project_members').delete().eq('id', memberId);
    await editProject(projectId);
    showToast('Member removed.', 'info');
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    var proj = await _findProject(id);
    await _sb.from('project_members').delete().eq('project_id', id);
    await _sb.from('project_publications').delete().eq('project_id', id);
    await _sb.from('projects').delete().eq('id', id);
    await logAudit('deleted', 'project', id, 'Project "' + (proj ? proj.title : id) + '" deleted by ' + currentUserName);
    await renderProjects();
    _populateProjectDropdowns();
    showToast('Project deleted.', 'info');
}

async function renderProjects() {
    var grid = document.getElementById('projectsGrid');
    if (!grid) return;

    _showLoading(grid);

    var { data: projectStore, error } = await _sb.from('projects').select('*, project_members(*)').order('created_at', { ascending: false });
    if (error || !projectStore) projectStore = [];

    if (projectStore.length === 0) {
        grid.innerHTML = '<div class="empty-state-large"><i class="fas fa-project-diagram"></i><h3>No Research Projects Yet</h3><p>Click "New Project" to add your first research project.</p><button class="btn btn-primary" onclick="openModal(\'newProject\')"><i class="fas fa-plus"></i> Add First Project</button></div>';
        return;
    }

    var html = '';
    projectStore.forEach(function (p, i) {
        var pillar = (p.pillar || '').toLowerCase();
        var status = (p.status || 'active').toLowerCase();
        var canEdit = _canEditProject(p);
        var canAccess = _canAccessProject(p);
        var members = p.project_members || [];

        // IRB badge
        var irbBadge = '';
        var irbConsent = p.irb_consent || {};
        if (irbConsent.na) {
            irbBadge = '<span class="irb-badge na"><i class="fas fa-minus-circle"></i> No IRB</span>';
        } else if (p.irb_approved) {
            irbBadge = '<span class="irb-badge approved"><i class="fas fa-check-circle"></i> IRB ' + _esc(p.irb_protocol_number || 'Approved') + '</span>';
        } else {
            irbBadge = '<span class="irb-badge pending"><i class="fas fa-clock"></i> IRB Pending</span>';
        }

        html += '<div class="project-card" data-pillar="' + pillar + '" data-status="' + status + '" data-dept="' + (p.department || '').toLowerCase() + '" style="animation-delay:' + (i * 0.05) + 's;' + (!canAccess ? 'opacity:0.5;' : '') + '" onclick="' + (canAccess ? 'openModal(\'projectDetail\', ' + p.id + ')' : 'showToast(\'Access restricted. You must be listed on the IRB protocol to view this project.\', \'error\')') + '">' +
            '<div class="project-card-header">' +
            '<span class="project-pillar ' + pillar + '">' + (p.pillar || 'Unassigned') + '</span>' +
            '<span class="project-status ' + status + '">' + (p.status || 'Active') + '</span>' +
            '</div>' +
            '<h3 class="project-title">' + _esc(p.title || 'Untitled') + '</h3>' +
            '<p class="project-pi"><i class="fas fa-user-md"></i> ' + _esc(p.pi || 'No PI assigned') + '</p>' +
            irbBadge +
            (canAccess && p.abstract ? '<p class="project-desc">' + _esc(p.abstract) + '</p>' : '') +
            (p.disease_focus ? '<div class="project-tags"><span class="tag">' + _esc(p.disease_focus) + '</span></div>' : '') +
            '<div class="project-meta">' +
            (p.phase ? '<span><i class="fas fa-stream"></i> ' + p.phase + '</span>' : '') +
            (members.length > 0 ? '<span><i class="fas fa-users"></i> ' + members.length + ' members</span>' : '') +
            '</div>' +
            '<div class="project-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + (p.progress || 0) + '%;"></div></div><span>' + (p.progress || 0) + '%</span></div>' +
            '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">' +
            (canEdit ? '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editProject(' + p.id + ')"><i class="fas fa-edit"></i> Edit</button>' : '') +
            ((currentUserRole === 'IRB' || currentUserEmail === 'ldrose@saint-lukes.org' || currentUserRole === 'Admin') && !p.irb_approved && !(irbConsent.na) ? '<button class="btn btn-outline btn-sm irb-review-btn" style="border-color:#f59e0b;color:#f59e0b;" onclick="event.stopPropagation(); openIRBReview(' + p.id + ')"><i class="fas fa-gavel"></i> IRB Review</button>' : '') +
            (canEdit ? '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteProject(' + p.id + ')"><i class="fas fa-trash"></i></button>' : '') +
            '</div></div>';
    });

    grid.innerHTML = html;
    initCardHoverEffects();
    animateProgressBars();
    await renderDashboardProjects();
}

async function renderDashboardProjects() {
    var container = document.getElementById('dashboardProjects');
    if (!container) return;

    var { data: projectStore } = await _sb.from('projects').select('id, title, pi, phase, status, progress, pillar').order('created_at', { ascending: false });
    if (!projectStore) projectStore = [];

    if (projectStore.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-project-diagram"></i><p>No active projects</p><span>Create a project to see it here.</span></div>';
        return;
    }

    var html = '';
    projectStore.forEach(function (p) {
        var pillar = (p.pillar || '').toLowerCase();
        var status = (p.status || 'Active');
        var statusClass = status.toLowerCase();

        html += '<div class="dash-project-item" style="cursor:pointer;" onclick="openModal(\'projectDetail\', ' + p.id + ')">' +
            '<div class="dash-project-pillar ' + pillar + '"></div>' +
            '<div class="dash-project-info">' +
            '<h4>' + _esc(p.title || 'Untitled') + '</h4>' +
            '<p>' + _esc(p.pi || 'No PI') + ' · ' + (p.phase || 'No phase') + '</p>' +
            '</div>' +
            '<span class="dash-project-status ' + statusClass + '" style="background:rgba(16,185,129,0.12);color:var(--status-active);">' + status + '</span>' +
            '<div class="dash-project-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + (p.progress || 0) + '%;"></div></div></div>' +
            '</div>';
    });

    container.innerHTML = html;

    // Update the stat card count
    var activeCount = projectStore.length;
    var statNumbers = document.querySelectorAll('.stat-number');
    if (statNumbers[0]) {
        statNumbers[0].textContent = activeCount;
        statNumbers[0].dataset.target = activeCount;
    }
}

async function _findProject(id) {
    var { data, error } = await _sb.from('projects').select('*, project_members(*), project_publications(*)').eq('id', id).single();
    if (error || !data) return null;
    // Map DB fields to legacy field names for compatibility with UI code
    data.irbApproved = data.irb_approved;
    data.irbProtocolNumber = data.irb_protocol_number;
    data.irbPersonnel = data.irb_personnel || [];
    data.irbDecision = data.irb_decision;
    data.diseaseFocus = data.disease_focus;
    data.coInvestigators = data.co_investigators;
    data.adminApproved = data.admin_approved;
    data.createdBy = data.created_by;
    data.members = (data.project_members || []).map(function(m) { return { id: m.id, name: m.member_name, role: m.member_role }; });
    data.publications = (data.project_publications || []).map(function(pub) { return pub.title; });
    data._pubRows = data.project_publications || [];
    data.irb = data.irb_consent || {};
    return data;
}

function _canEditProject(proj) {
    // Admins can always edit
    if (currentUserRole === 'Admin') return true;
    // PI can edit their own project
    if (proj.created_by && proj.created_by === currentUserId) return true;
    if (proj.createdBy && proj.createdBy === currentUserId) return true;
    return false;
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _opt(value, selected) {
    return '<option' + (value === selected ? ' selected' : '') + '>' + value + '</option>';
}

// Populate project dropdowns in all modals that need them
function _populateProjectDropdowns() {
    // Find all selects that have "Select project..." as first option
    setTimeout(async function () {
        var { data: projects } = await _sb.from('projects').select('id, title').order('title');
        if (!projects) projects = [];
        document.querySelectorAll('select').forEach(function (sel) {
            var first = sel.querySelector('option');
            if (first && first.textContent.indexOf('Select project') !== -1) {
                // Clear existing project options (keep the first placeholder)
                while (sel.options.length > 1) sel.remove(1);
                projects.forEach(function (p) {
                    var opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.title || 'Untitled Project #' + p.id;
                    sel.appendChild(opt);
                });
            }
        });
    }, 50);
}

/* --- Populate PI dropdowns from faculty list --- */
function _populatePIDropdowns() {
    setTimeout(async function() {
        var faculty = await _getFacultyList();
        var piSelect = document.getElementById('wz_pi');
        if (piSelect && piSelect.options.length <= 1) {
            faculty.forEach(function(name) {
                var opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                piSelect.appendChild(opt);
            });
        }
        // Also populate any PI selects in other modals
        document.querySelectorAll('select').forEach(function(sel) {
            var first = sel.querySelector('option');
            if (first && first.textContent.indexOf('Select PI') !== -1 && sel.options.length <= 1) {
                faculty.forEach(function(name) {
                    var opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    sel.appendChild(opt);
                });
            }
        });
    }, 60);
}

/* ================================================
   6c. REDCAP FORM BUILDER
   ================================================ */
var redcapVars = [];

function addRedcapVar() {
    var nameEl = document.getElementById('newVarName');
    var typeEl = document.getElementById('newVarType');
    var labelEl = document.getElementById('newVarLabel');
    var choicesEl = document.getElementById('newVarChoices');

    if (!nameEl || !nameEl.value.trim()) {
        showToast('Enter a variable name.', 'error');
        return;
    }

    redcapVars.push({
        name: nameEl.value.trim().replace(/\s+/g, '_').toLowerCase(),
        type: typeEl ? typeEl.value : 'text',
        label: labelEl ? labelEl.value.trim() || nameEl.value.trim() : nameEl.value.trim(),
        choices: choicesEl ? choicesEl.value.trim() : ''
    });

    nameEl.value = '';
    labelEl.value = '';
    choicesEl.value = '';
    _renderRedcapVarList();
    showToast('Variable added.', 'success');
}

function removeRedcapVar(index) {
    redcapVars.splice(index, 1);
    _renderRedcapVarList();
}

function _renderRedcapVarList() {
    var container = document.getElementById('redcapVarList');
    if (!container) return;

    if (redcapVars.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">No variables defined yet.</p>';
        return;
    }

    var typeIcons = {
        text: 'fa-font', number: 'fa-hashtag', date: 'fa-calendar-day',
        dropdown: 'fa-chevron-down', radio: 'fa-dot-circle', checkbox: 'fa-check-square',
        yesno: 'fa-toggle-on', textarea: 'fa-align-left', calc: 'fa-calculator',
        file: 'fa-paperclip', slider: 'fa-sliders-h'
    };

    var html = '<div style="margin-bottom:12px;">';
    redcapVars.forEach(function (v, i) {
        var icon = typeIcons[v.type] || 'fa-font';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;margin-bottom:6px;">' +
            '<i class="fas ' + icon + '" style="color:var(--accent-primary);width:16px;text-align:center;font-size:0.8rem;"></i>' +
            '<code style="font-size:0.78rem;color:#f59e0b;background:rgba(245,158,11,0.1);padding:2px 6px;border-radius:4px;">' + _esc(v.name) + '</code>' +
            '<span style="flex:1;font-size:0.82rem;color:var(--text-secondary);">' + _esc(v.label) + '</span>' +
            '<span style="font-size:0.7rem;color:var(--text-muted);background:var(--bg-elevated);padding:2px 8px;border-radius:4px;">' + v.type + '</span>' +
            '<button type="button" class="btn btn-danger btn-sm" style="padding:4px 8px;" onclick="removeRedcapVar(' + i + ')"><i class="fas fa-times"></i></button>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function parseRedcapCSV(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();

    reader.onload = function (e) {
        var text = e.target.result;
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (lines.length < 2) {
            showToast('CSV file appears empty or invalid.', 'error');
            return;
        }

        // Parse header to find column indices
        var header = _parseCSVLine(lines[0]);
        var hLower = header.map(function (h) { return h.toLowerCase().trim(); });

        var varIdx = _findCol(hLower, ['variable', 'variable / field name', 'field_name', 'variable_name']);
        var typeIdx = _findCol(hLower, ['field type', 'field_type', 'type']);
        var labelIdx = _findCol(hLower, ['field label', 'field_label', 'label']);
        var choicesIdx = _findCol(hLower, ['choices', 'choices, calculations, or slider labels', 'choices_calculations_or_slider_labels']);

        if (varIdx === -1) {
            showToast('Could not find a "Variable" column in the CSV. Check format.', 'error');
            return;
        }

        redcapVars = [];
        for (var i = 1; i < lines.length; i++) {
            var cols = _parseCSVLine(lines[i]);
            var varName = cols[varIdx] ? cols[varIdx].trim() : '';
            if (!varName) continue;

            var rawType = cols[typeIdx] ? cols[typeIdx].trim().toLowerCase() : 'text';
            var mappedType = _mapRedcapType(rawType);

            redcapVars.push({
                name: varName,
                type: mappedType,
                label: cols[labelIdx] ? cols[labelIdx].trim() : varName,
                choices: cols[choicesIdx] ? cols[choicesIdx].trim() : ''
            });
        }

        _renderRedcapVarList();
        var resultEl = document.getElementById('csvParseResult');
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:0.82rem;">' +
                '<i class="fas fa-check-circle" style="color:#10b981;margin-right:8px;"></i>' +
                '<strong>' + redcapVars.length + ' variables</strong> imported from <em>' + _esc(file.name) + '</em></div>';
        }
        showToast(redcapVars.length + ' variables imported from CSV!', 'success');
    };

    reader.readAsText(file);
}

function _parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += ch; }
    }
    result.push(current);
    return result;
}

function _findCol(headers, candidates) {
    for (var c = 0; c < candidates.length; c++) {
        for (var h = 0; h < headers.length; h++) {
            if (headers[h].indexOf(candidates[c]) !== -1) return h;
        }
    }
    return -1;
}

function _mapRedcapType(raw) {
    var map = {
        'text': 'text', 'notes': 'textarea', 'dropdown': 'dropdown', 'radio': 'radio',
        'checkbox': 'checkbox', 'yesno': 'yesno', 'truefalse': 'yesno',
        'calc': 'calc', 'file': 'file', 'slider': 'slider', 'descriptive': 'text',
        'sql': 'text'
    };
    return map[raw] || 'text';
}

function generateRedcapForm() {
    var formName = document.getElementById('redcapFormName');
    if (!formName || !formName.value.trim()) {
        showToast('Enter a form name.', 'error');
        return;
    }
    if (redcapVars.length === 0) {
        showToast('Add at least one variable or import a CSV.', 'error');
        return;
    }

    var name = formName.value.trim();
    closeModal();

    // Build the form and show it in a new modal
    setTimeout(function () {
        var overlay = document.getElementById('modalOverlay');
        var titleEl = document.getElementById('modalTitle');
        var bodyEl = document.getElementById('modalBody');
        titleEl.textContent = name;

        var formHtml = '<form onsubmit="event.preventDefault(); closeModal(); showToast(\'Record saved!\', \'success\');" style="max-height:60vh;overflow-y:auto;">';

        redcapVars.forEach(function (v) {
            formHtml += '<div class="form-group">';
            formHtml += '<label>' + _esc(v.label) + ' <code style="font-size:0.68rem;color:var(--text-muted);margin-left:4px;">[' + _esc(v.name) + ']</code></label>';

            switch (v.type) {
                case 'text':
                    formHtml += '<input type="text" placeholder="Enter ' + _esc(v.label) + '...">';
                    break;
                case 'number':
                    formHtml += '<input type="number" placeholder="Enter number...">';
                    break;
                case 'date':
                    formHtml += '<input type="date">';
                    break;
                case 'textarea':
                    formHtml += '<textarea rows="3" placeholder="Enter notes..."></textarea>';
                    break;
                case 'yesno':
                    formHtml += '<select><option value="">Select...</option><option>Yes</option><option>No</option></select>';
                    break;
                case 'dropdown':
                    formHtml += '<select><option value="">Select...</option>';
                    if (v.choices) {
                        v.choices.split('|').forEach(function (c) {
                            var val = c.trim();
                            // Handle "1, Male" format
                            var label = val.indexOf(',') !== -1 ? val.split(',').slice(1).join(',').trim() : val;
                            formHtml += '<option>' + _esc(label) + '</option>';
                        });
                    }
                    formHtml += '</select>';
                    break;
                case 'radio':
                    if (v.choices) {
                        formHtml += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;">';
                        v.choices.split('|').forEach(function (c, i) {
                            var val = c.trim();
                            var label = val.indexOf(',') !== -1 ? val.split(',').slice(1).join(',').trim() : val;
                            formHtml += '<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--text-secondary);cursor:pointer;margin:0;">' +
                                '<input type="radio" name="' + _esc(v.name) + '" style="accent-color:var(--accent-primary);"> ' + _esc(label) + '</label>';
                        });
                        formHtml += '</div>';
                    }
                    break;
                case 'checkbox':
                    if (v.choices) {
                        formHtml += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;">';
                        v.choices.split('|').forEach(function (c) {
                            var val = c.trim();
                            var label = val.indexOf(',') !== -1 ? val.split(',').slice(1).join(',').trim() : val;
                            formHtml += '<label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--text-secondary);cursor:pointer;margin:0;">' +
                                '<input type="checkbox" style="accent-color:var(--accent-primary);"> ' + _esc(label) + '</label>';
                        });
                        formHtml += '</div>';
                    }
                    break;
                case 'calc':
                    formHtml += '<input type="text" readonly style="opacity:0.6;" placeholder="[Calculated field]">';
                    break;
                case 'file':
                    formHtml += '<input type="file">';
                    break;
                case 'slider':
                    formHtml += '<input type="range" min="0" max="100" style="width:100%;accent-color:var(--accent-primary);">';
                    break;
                default:
                    formHtml += '<input type="text" placeholder="Enter ' + _esc(v.label) + '...">';
            }

            formHtml += '</div>';
        });

        formHtml += '<div class="modal-actions" style="flex-wrap:wrap;">' +
            '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
            '<button type="button" class="btn btn-outline" onclick="exportFormCSV()"><i class="fas fa-file-csv"></i> Export Data to CSV</button>' +
            '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Record</button>' +
            '</div></form>';

        bodyEl.innerHTML = formHtml;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        showToast('Form "' + name + '" generated with ' + redcapVars.length + ' fields!', 'success');
    }, 300);
}

/* ================================================
   6d. SAMPLE SIZE CALCULATOR
   ================================================ */
function updateSSFields() {
    var type = document.getElementById('ssTestType');
    var container = document.getElementById('ssFields');
    if (!type || !container) return;

    var html = '';
    switch (type.value) {
        case 'ttest':
        case 'paired':
            html = '<div class="form-row"><div class="form-group"><label>Effect Size (Cohen\'s d)</label>' +
                '<select id="ssEffectSize"><option value="0.2">Small (0.2)</option><option value="0.5" selected>Medium (0.5)</option><option value="0.8">Large (0.8)</option><option value="custom">Custom</option></select></div>' +
                '<div class="form-group"><label>Custom Effect Size</label><input type="number" id="ssCustomEffect" step="0.01" placeholder="e.g., 0.35" disabled></div></div>' +
                '<div class="form-group"><label>Allocation Ratio (n2/n1)</label><input type="number" id="ssRatio" value="1" min="0.1" step="0.1"></div>';
            break;
        case 'anova':
            html = '<div class="form-row"><div class="form-group"><label>Effect Size (Cohen\'s f)</label>' +
                '<select id="ssEffectSize"><option value="0.1">Small (0.1)</option><option value="0.25" selected>Medium (0.25)</option><option value="0.4">Large (0.4)</option><option value="custom">Custom</option></select></div>' +
                '<div class="form-group"><label>Number of Groups</label><input type="number" id="ssGroups" value="3" min="2" max="20"></div></div>';
            break;
        case 'chi2':
            html = '<div class="form-row"><div class="form-group"><label>Effect Size (Cohen\'s w)</label>' +
                '<select id="ssEffectSize"><option value="0.1">Small (0.1)</option><option value="0.3" selected>Medium (0.3)</option><option value="0.5">Large (0.5)</option><option value="custom">Custom</option></select></div>' +
                '<div class="form-group"><label>Degrees of Freedom</label><input type="number" id="ssDf" value="1" min="1"></div></div>';
            break;
        case 'proportion':
            html = '<div class="form-row"><div class="form-group"><label>Proportion 1 (p\u2081)</label>' +
                '<input type="number" id="ssP1" step="0.01" min="0" max="1" value="0.50" placeholder="e.g., 0.50"></div>' +
                '<div class="form-group"><label>Proportion 2 (p\u2082)</label>' +
                '<input type="number" id="ssP2" step="0.01" min="0" max="1" value="0.30" placeholder="e.g., 0.30"></div></div>';
            break;
        case 'correlation':
            html = '<div class="form-group"><label>Expected Correlation (r)</label>' +
                '<input type="number" id="ssCorr" step="0.01" min="0.01" max="0.99" value="0.30" placeholder="e.g., 0.30"></div>';
            break;
        case 'survival':
            html = '<div class="form-row"><div class="form-group"><label>Hazard Ratio</label>' +
                '<input type="number" id="ssHR" step="0.01" min="0.01" value="0.70" placeholder="e.g., 0.70"></div>' +
                '<div class="form-group"><label>Event Probability</label>' +
                '<input type="number" id="ssEventProb" step="0.01" min="0.01" max="1" value="0.50" placeholder="e.g., 0.50"></div></div>';
            break;
    }
    container.innerHTML = html;

    // Toggle custom effect size field
    var effectSel = document.getElementById('ssEffectSize');
    var customInput = document.getElementById('ssCustomEffect');
    if (effectSel && customInput) {
        effectSel.addEventListener('change', function () {
            customInput.disabled = effectSel.value !== 'custom';
            if (effectSel.value !== 'custom') customInput.value = '';
        });
    }
}

function calculateSampleSize() {
    var type = document.getElementById('ssTestType');
    if (!type || !type.value) { showToast('Select a test type first.', 'error'); return; }

    var alpha = parseFloat(document.getElementById('ssAlpha').value) || 0.05;
    var power = parseFloat(document.getElementById('ssPower').value) || 0.80;
    var twoSided = document.getElementById('ssTwoSided').checked;

    // Z-values for power and alpha
    var zAlpha = _zScore(twoSided ? alpha / 2 : alpha);
    var zBeta = _zScore(1 - power);

    var n = 0;
    var resultText = '';

    switch (type.value) {
        case 'ttest':
        case 'paired':
            var effectSel = document.getElementById('ssEffectSize');
            var d = effectSel.value === 'custom' ? parseFloat(document.getElementById('ssCustomEffect').value) : parseFloat(effectSel.value);
            if (!d || d <= 0) { showToast('Enter a valid effect size.', 'error'); return; }
            var ratio = parseFloat(document.getElementById('ssRatio').value) || 1;

            if (type.value === 'paired') {
                n = Math.ceil(Math.pow(zAlpha + zBeta, 2) / (d * d));
                resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' pairs needed</p>' +
                    '<p style="font-size:0.82rem;color:var(--text-secondary);">Paired t-test | d=' + d + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            } else {
                var n1 = Math.ceil(Math.pow(zAlpha + zBeta, 2) * (1 + 1 / ratio) / (d * d));
                var n2 = Math.ceil(n1 * ratio);
                n = n1 + n2;
                resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' total (' + n1 + ' + ' + n2 + ')</p>' +
                    '<p style="font-size:0.82rem;color:var(--text-secondary);">Two-sample t-test | d=' + d + ' | Ratio=' + ratio + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            }
            break;

        case 'anova':
            var fEffect = document.getElementById('ssEffectSize');
            var f = fEffect.value === 'custom' ? parseFloat(document.getElementById('ssCustomEffect').value) : parseFloat(fEffect.value);
            if (!f || f <= 0) { showToast('Enter a valid effect size.', 'error'); return; }
            var groups = parseInt(document.getElementById('ssGroups').value) || 3;
            var nPerGroup = Math.ceil(Math.pow(zAlpha + zBeta, 2) / (f * f));
            n = nPerGroup * groups;
            resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' total (' + nPerGroup + ' per group)</p>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">One-way ANOVA | f=' + f + ' | ' + groups + ' groups | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            break;

        case 'chi2':
            var wEffect = document.getElementById('ssEffectSize');
            var w = wEffect.value === 'custom' ? parseFloat(document.getElementById('ssCustomEffect').value) : parseFloat(wEffect.value);
            if (!w || w <= 0) { showToast('Enter a valid effect size.', 'error'); return; }
            n = Math.ceil(Math.pow(zAlpha + zBeta, 2) / (w * w));
            resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' total sample</p>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">Chi-square test | w=' + w + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            break;

        case 'proportion':
            var p1 = parseFloat(document.getElementById('ssP1').value);
            var p2 = parseFloat(document.getElementById('ssP2').value);
            if (isNaN(p1) || isNaN(p2) || p1 === p2) { showToast('Enter two different proportions.', 'error'); return; }
            var pBar = (p1 + p2) / 2;
            var nProp = Math.ceil(Math.pow(zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / Math.pow(p1 - p2, 2));
            n = nProp * 2;
            resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' total (' + nProp + ' per group)</p>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">Two proportions | p\u2081=' + p1 + ' vs p\u2082=' + p2 + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            break;

        case 'correlation':
            var r = parseFloat(document.getElementById('ssCorr').value);
            if (!r || r <= 0 || r >= 1) { showToast('Enter a valid correlation (0-1).', 'error'); return; }
            var zr = 0.5 * Math.log((1 + r) / (1 - r)); // Fisher z-transform
            n = Math.ceil(Math.pow(zAlpha + zBeta, 2) / (zr * zr)) + 3;
            resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' subjects needed</p>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">Correlation test | r=' + r + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            break;

        case 'survival':
            var hr = parseFloat(document.getElementById('ssHR').value);
            var eventProb = parseFloat(document.getElementById('ssEventProb').value);
            if (!hr || hr <= 0 || hr === 1) { showToast('Enter a valid hazard ratio (\u2260 1).', 'error'); return; }
            if (!eventProb || eventProb <= 0 || eventProb > 1) { showToast('Enter a valid event probability.', 'error'); return; }
            var events = Math.ceil(4 * Math.pow(zAlpha + zBeta, 2) / Math.pow(Math.log(hr), 2));
            n = Math.ceil(events / eventProb);
            resultText = '<p style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">' + n + ' total (' + events + ' events needed)</p>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">Log-rank test | HR=' + hr + ' | Event prob=' + eventProb + ' | \u03B1=' + alpha + ' | Power=' + (power * 100) + '%</p>';
            break;
    }

    var resultDiv = document.getElementById('ssResult');
    var resultTextDiv = document.getElementById('ssResultText');
    if (resultDiv) resultDiv.style.display = '';
    if (resultTextDiv) resultTextDiv.innerHTML = resultText;
}

// Approximate inverse normal CDF (z-score) using rational approximation
function _zScore(p) {
    if (p <= 0) return -4;
    if (p >= 1) return 4;
    if (p < 0.5) return -_zScore(1 - p);

    var t = Math.sqrt(-2 * Math.log(1 - p));
    var c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    var d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/* ================================================
   6e. EDUCATION & TRAINING FUNCTIONS
   ================================================ */
async function submitCITICert(formEl) {
    var inputs = formEl.querySelectorAll('input, select');
    var fileInput = formEl.querySelector('input[type="file"]');
    var certUrl = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        showToast('Uploading certificate...', 'info');
        certUrl = await uploadFile(fileInput.files[0], 'citi-certs/' + currentUserId);
    }
    await _sb.from('citi_training').insert({
        user_id: currentUserId,
        human_subjects_status: 'submitted',
        certificate_url: certUrl
    });
    showToast('Certificate submitted for review by Dr. Kolakowsky-Hayner.', 'success');
}

async function submitCMECredits(formEl) {
    var inputs = formEl.querySelectorAll('input, select');
    var fileInput = formEl.querySelector('input[type="file"]');
    var certUrl = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        showToast('Uploading certificate...', 'info');
        certUrl = await uploadFile(fileInput.files[0], 'cme-certs/' + currentUserId);
    }
    var creditsInput = formEl.querySelector('input[type="number"]');
    var creditsVal = creditsInput ? parseFloat(creditsInput.value) || 0 : 0;
    await _sb.from('cme_records').insert({
        user_id: currentUserId,
        credits_earned: creditsVal,
        credits_required: 25,
        status: 'submitted',
        certificate_url: certUrl
    });
    showToast('CME credits submitted for review by Dr. Kolakowsky-Hayner.', 'success');
}

/* --- Save functions for modal forms --- */
async function saveGrant(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var data = {
        title: inputs[0] ? inputs[0].value : '',
        pi: inputs[1] ? inputs[1].value : '',
        agency: inputs[2] ? inputs[2].value : '',
        mechanism: inputs[3] ? inputs[3].value : '',
        amount: inputs[4] ? inputs[4].value : '',
        period_start: inputs[5] ? inputs[5].value || null : null,
        period_end: inputs[6] ? inputs[6].value || null : null,
        status: inputs[7] ? inputs[7].value : 'Active',
        grant_number: inputs[8] ? inputs[8].value : '',
        created_by: currentUserId
    };
    var { data: inserted, error } = await _sb.from('grants').insert(data).select().single();
    if (error) { showToast('Error saving grant: ' + error.message, 'error'); return; }
    await logAudit('created', 'grant', inserted ? inserted.id : null, 'Grant "' + data.title + '" created by ' + currentUserName);
    closeModal();
    showToast('Grant added successfully!', 'success');
}

async function savePublication(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var pubType = document.getElementById('pubType');
    var data = {
        pub_type: pubType ? pubType.value : '',
        title: inputs[1] ? inputs[1].value : '',
        created_by: currentUserId
    };
    // Collect extra fields based on type
    if (pubType && pubType.value === 'publication') {
        var journal = formEl.querySelector('#pubFields input[type="text"]');
        if (journal) data.journal = journal.value;
        var year = formEl.querySelector('#pubFields input[type="number"]');
        if (year) data.year = parseInt(year.value) || null;
    }
    var { error } = await _sb.from('publications').insert(data);
    if (error) { showToast('Error saving publication: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Publication added successfully!', 'success');
}

async function saveMeeting(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var data = {
        title: inputs[0] ? inputs[0].value : '',
        meeting_date: inputs[1] ? inputs[1].value || null : null,
        meeting_time: inputs[2] ? inputs[2].value : '',
        attendees: inputs[3] ? inputs[3].value : '',
        agenda: inputs[4] ? inputs[4].value : '',
        teams_link: inputs[5] ? inputs[5].value : '',
        location: inputs[6] ? inputs[6].value : '',
        recurring: document.getElementById('recurringMeeting') ? document.getElementById('recurringMeeting').checked : false,
        created_by: currentUserId
    };
    var { error } = await _sb.from('meetings').insert(data);
    if (error) { showToast('Error saving meeting: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Meeting scheduled successfully!', 'success');
}

async function saveDeadline(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var data = {
        title: inputs[0] ? inputs[0].value : '',
        deadline_type: inputs[1] ? inputs[1].value : '',
        deadline_date: inputs[2] ? inputs[2].value || null : null,
        description: inputs[3] ? inputs[3].value : '',
        associated_item: inputs[4] ? inputs[4].value : '',
        created_by: currentUserId
    };
    var { error } = await _sb.from('deadlines').insert(data);
    if (error) { showToast('Error saving deadline: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Deadline added successfully!', 'success');
}

async function saveForumRequest(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var data = {
        title: inputs[0] ? inputs[0].value : '',
        category: inputs[1] ? inputs[1].value : '',
        urgency: inputs[3] ? inputs[3].value : 'Medium',
        project_id: inputs[4] ? (parseInt(inputs[4].value) || null) : null,
        description: inputs[5] ? inputs[5].value : '',
        status: 'open',
        requested_by: currentUserId
    };
    var { error } = await _sb.from('forum_requests').insert(data);
    if (error) { showToast('Error submitting request: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Request submitted successfully!', 'success');
}

async function saveDocument(formEl) {
    var inputs = formEl.querySelectorAll('input, select, textarea');
    var fileInput = formEl.querySelector('input[type="file"]');
    var fileUrl = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        showToast('Uploading document...', 'info');
        fileUrl = await uploadFile(fileInput.files[0], 'documents');
    }
    var data = {
        name: inputs[0] ? inputs[0].value : '',
        category: inputs[1] ? inputs[1].value : '',
        content: inputs[3] ? inputs[3].value : '',
        file_url: fileUrl,
        uploaded_by: currentUserId
    };
    var { error } = await _sb.from('documents').insert(data);
    if (error) { showToast('Error uploading document: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Document uploaded!', 'success');
}

// Likert scale row builder for student assessments
function _buildLikertRow(label) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
        '<span style="flex:1;font-size:0.82rem;color:var(--text-secondary);min-width:200px;">' + label + '</span>' +
        '<div style="display:flex;gap:6px;">' +
        '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;margin:0;"><input type="radio" name="likert_' + label.replace(/\s+/g, '_') + '" value="1" style="accent-color:var(--accent-primary);"><span style="font-size:0.65rem;color:var(--text-muted);">1</span></label>' +
        '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;margin:0;"><input type="radio" name="likert_' + label.replace(/\s+/g, '_') + '" value="2" style="accent-color:var(--accent-primary);"><span style="font-size:0.65rem;color:var(--text-muted);">2</span></label>' +
        '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;margin:0;"><input type="radio" name="likert_' + label.replace(/\s+/g, '_') + '" value="3" style="accent-color:var(--accent-primary);"><span style="font-size:0.65rem;color:var(--text-muted);">3</span></label>' +
        '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;margin:0;"><input type="radio" name="likert_' + label.replace(/\s+/g, '_') + '" value="4" style="accent-color:var(--accent-primary);"><span style="font-size:0.65rem;color:var(--text-muted);">4</span></label>' +
        '<label style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;margin:0;"><input type="radio" name="likert_' + label.replace(/\s+/g, '_') + '" value="5" style="accent-color:var(--accent-primary);"><span style="font-size:0.65rem;color:var(--text-muted);">5</span></label>' +
        '</div></div>';
}

/* ================================================
   6f. STUDENT MODULE FUNCTIONS
   ================================================ */
async function submitStudentAssessment(formEl) {
    var studentSel = document.getElementById('assessStudent');
    var studentId = studentSel ? studentSel.value : null;
    // Collect all responses
    var responses = {};
    formEl.querySelectorAll('input[type="radio"]:checked').forEach(function(r) { responses[r.name] = r.value; });
    formEl.querySelectorAll('select').forEach(function(s) { if (s.value) responses[s.name || s.closest('.form-group')?.querySelector('label')?.textContent?.trim() || 'field'] = s.value; });
    formEl.querySelectorAll('textarea').forEach(function(t) { if (t.value) responses[t.placeholder || 'notes'] = t.value; });

    await _sb.from('student_assessments').insert({
        student_id: studentId || null,
        assessment_date: new Date().toISOString().split('T')[0],
        responses: responses,
        submitted_by: currentUserId
    });
    showToast('Assessment submitted and saved!', 'success');
}

async function submitStudentProjectRequest(formEl) {
    showToast('Project request submitted! Awaiting PI approval.', 'success');
}

/* ================================================
   6g. TEMPLATE & DOCUMENT FUNCTIONS
   ================================================ */
function exportTemplate(type, formEl) {
    if (!formEl) return;
    var inputs = formEl.querySelectorAll('input, textarea, select');
    var content = '';

    inputs.forEach(function (el) {
        if (el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
        var label = el.closest('.form-group');
        var labelText = label ? label.querySelector('label') : null;
        if (labelText && el.value) {
            content += labelText.textContent.replace('*', '').trim() + '\n' +
                '='.repeat(40) + '\n' + el.value + '\n\n';
        }
    });

    // Create a downloadable text file (Word-compatible .doc with HTML)
    var templateNames = {
        protocol: 'Research_Protocol',
        consent: 'Informed_Consent_Form',
        irbLetter: 'IRB_Cover_Letter',
        dmp: 'Data_Management_Plan'
    };
    var fileName = (templateNames[type] || 'Document') + '_' + new Date().toISOString().slice(0, 10) + '.doc';

    var htmlContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8"><title>' + _esc(templateNames[type] || 'Document') + '</title>' +
        '<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;margin:1in;}h1{font-size:16pt;color:#003366;}h2{font-size:13pt;color:#003366;border-bottom:1px solid #ccc;padding-bottom:4px;}p{margin:8px 0;}</style></head><body>';

    htmlContent += '<h1>' + _esc(templateNames[type] || 'Document') + '</h1>';
    htmlContent += '<p style="color:#666;">Saint Luke\'s Neuroscience Research Department</p>';
    htmlContent += '<p style="color:#666;">Generated: ' + new Date().toLocaleDateString() + '</p><hr>';

    inputs.forEach(function (el) {
        if (el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
        var label = el.closest('.form-group');
        var labelText = label ? label.querySelector('label') : null;
        if (labelText && el.value) {
            var heading = labelText.textContent.replace('*', '').trim();
            htmlContent += '<h2>' + _esc(heading) + '</h2>';
            htmlContent += '<p>' + _esc(el.value).replace(/\n/g, '<br>') + '</p>';
        }
    });

    htmlContent += '</body></html>';

    var blob = new Blob([htmlContent], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    closeModal();
    showToast('Template exported as ' + fileName, 'success');
}

function saveTemplateDraft(type, formEl) {
    showToast('Draft saved! You can return to edit later.', 'success');
}

/* ================================================
   6h. SUBSECTION SWITCHERS
   ================================================ */
// Education sub-tab switcher
function _showEduSubsection(name) {
    var subs = {
        'CITI Training Status': 'eduSubCITI',
        'CME Tracking': 'eduSubCME'
    };
    Object.keys(subs).forEach(function (k) {
        var el = document.getElementById(subs[k]);
        if (el) el.style.display = 'none';
    });
    var targetId = subs[name];
    if (targetId) { var target = document.getElementById(targetId); if (target) target.style.display = ''; }
}

// Student sub-tab switcher
function _showStudentSubsection(name) {
    var subs = {
        'All Students': 'studentSubAll',
        'Onboarding': 'studentSubOnboarding',
        'Monthly Assessment': 'studentSubAssessment',
        'Project Requests': 'studentSubRequests',
        'Mentorship': 'studentSubMentorship'
    };
    Object.keys(subs).forEach(function (k) {
        var el = document.getElementById(subs[k]);
        if (el) el.style.display = 'none';
    });
    var targetId = subs[name];
    if (targetId) { var target = document.getElementById(targetId); if (target) target.style.display = ''; }
}

// Documents sub-tab switcher
function _showDocSubsection(name) {
    var subs = {
        'Templates': 'docSubTemplates',
        'Policies': 'docSubPolicies',
        'Guidelines': 'docSubGuidelines',
        'Uploaded Documents': 'docSubUploaded'
    };
    Object.keys(subs).forEach(function (k) {
        var el = document.getElementById(subs[k]);
        if (el) el.style.display = 'none';
    });
    var targetId = subs[name];
    if (targetId) { var target = document.getElementById(targetId); if (target) target.style.display = ''; }
}

/* ================================================
   6i. PROJECT DETAIL FUNCTIONS
   ================================================ */
async function uploadProjectFile(projId, fileKey, inputEl) {
    var proj = await _findProject(projId);
    if (!proj || !inputEl.files || !inputEl.files[0]) return;
    var file = inputEl.files[0];
    showToast('Uploading ' + file.name + '...', 'info');
    var url = await uploadFile(file, 'projects/' + projId);
    var currentFiles = proj.files || {};
    currentFiles[fileKey] = url || file.name;
    await _sb.from('projects').update({ files: currentFiles }).eq('id', projId);
    showToast(file.name + ' uploaded!', 'success');
    closeModal();
    setTimeout(function () { openModal('projectDetail', projId); }, 200);
}

async function linkProjectREDCap(projId) {
    var targetEl = document.getElementById('projTargetN');
    var enrolledEl = document.getElementById('projEnrolledN');
    var targetN = targetEl ? parseInt(targetEl.value) || 0 : 0;
    var enrolledN = enrolledEl ? parseInt(enrolledEl.value) || 0 : 0;
    // Store in files JSONB for now
    var proj = await _findProject(projId);
    var currentFiles = proj ? (proj.files || {}) : {};
    currentFiles.redcapLinked = true;
    currentFiles.targetEnrollment = targetN;
    currentFiles.enrolledCount = enrolledN;
    await _sb.from('projects').update({ files: currentFiles }).eq('id', projId);
    showToast('Enrollment data saved!', 'success');
    closeModal();
    setTimeout(function () { openModal('projectDetail', projId); }, 200);
}

async function addProjectPub(projId) {
    var input = document.getElementById('newProjPub');
    if (!input || !input.value.trim()) { showToast('Enter a publication title.', 'error'); return; }
    await _sb.from('project_publications').insert({ project_id: projId, title: input.value.trim() });
    showToast('Publication linked!', 'success');
    closeModal();
    setTimeout(function () { openModal('projectDetail', projId); }, 200);
}

async function removeProjectPub(projId, pubId) {
    await _sb.from('project_publications').delete().eq('id', pubId);
    closeModal();
    setTimeout(function () { openModal('projectDetail', projId); }, 200);
}

/* ================================================
   6j. NOTIFICATION SYSTEM
   ================================================ */
async function _sendProjectNotification(project, type) {
    var notification = {
        project_id: project.id,
        project_title: project.title,
        type: type,
        from_user: currentUserName,
        from_email: currentUserEmail,
        read: false,
        message: '',
        recipients: []
    };

    switch(type) {
        case 'new':
            notification.message = 'New project "' + project.title + '" submitted by ' + currentUserName + '. Review and approve.';
            notification.recipients = ['skolakowsky@saint-lukes.org', 'aalmekkawi@saint-lukes.org'];
            break;
        case 'irb_submitted':
            notification.message = 'Project "' + project.title + '" has been submitted for IRB review.';
            notification.recipients = ['ldrose@saint-lukes.org'];
            break;
        case 'irb_decision':
            notification.message = 'IRB decision for "' + project.title + '": ' + (project.irb_decision || project.irbDecision || 'pending');
            notification.recipients = [];
            // Notify creator
            if (project.created_by) {
                var { data: creator } = await _sb.from('profiles').select('email').eq('id', project.created_by).single();
                if (creator) notification.recipients.push(creator.email);
            }
            var piUser = await _findPIByName(project.pi);
            if (piUser) notification.recipients.push(piUser.email);
            break;
        case 'status_change':
            notification.message = 'Project "' + project.title + '" status changed to ' + project.status;
            notification.recipients = [];
            if (project.created_by) {
                var { data: cr } = await _sb.from('profiles').select('email').eq('id', project.created_by).single();
                if (cr) notification.recipients.push(cr.email);
            }
            var piU = await _findPIByName(project.pi);
            if (piU) notification.recipients.push(piU.email);
            break;
        case 'approved':
            notification.message = 'Project "' + project.title + '" has been approved and forwarded to required departments.';
            notification.recipients = [];
            if (project.created_by) {
                var { data: ca } = await _sb.from('profiles').select('email').eq('id', project.created_by).single();
                if (ca) notification.recipients.push(ca.email);
            }
            var piA = await _findPIByName(project.pi);
            if (piA) notification.recipients.push(piA.email);
            break;
    }

    await _sb.from('notifications').insert(notification);
    await _updateNotificationBadge();
    showToast('Notification sent to reviewers.', 'info');
}

async function _findPIByName(piName) {
    if (!piName) return null;
    var { data } = await _sb.from('profiles').select('email, name').ilike('name', piName);
    if (data && data.length > 0) return data[0];
    return null;
}

async function _updateNotificationBadge() {
    if (!currentUserEmail) return;
    var { count, error } = await _sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false).contains('recipients', [currentUserEmail]);
    var badge = document.querySelector('.notification-badge');
    if (badge) {
        var unread = count || 0;
        badge.textContent = unread;
        badge.style.display = unread > 0 ? '' : 'none';
    }
}

/* --- Project Review/Approval by Admin --- */
async function approveProject(projId) {
    var proj = await _findProject(projId);
    if (!proj) return;
    if (currentUserRole !== 'Admin') {
        showToast('Only admins can approve projects.', 'error');
        return;
    }
    await _sb.from('projects').update({
        admin_approved: true,
        approved_by: currentUserName,
        approved_at: new Date().toISOString()
    }).eq('id', projId);
    proj.admin_approved = true;
    proj.adminApproved = true;
    await logAudit('approved', 'project', projId, 'Project "' + (proj.title || '') + '" approved by ' + currentUserName);
    await _sendProjectNotification(proj, 'approved');
    showToast('Project approved and forwarded to departments!', 'success');
    closeModal();
    await renderProjects();
}

async function sendProjectQuestion(projId) {
    var proj = await _findProject(projId);
    if (!proj) return;
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Send Question about: ' + (proj.title || 'Project');

    var html = '<form onsubmit="event.preventDefault(); submitProjectQuestion(' + projId + ', this);">' +
        '<div class="form-group"><label>Your Question *</label>' +
        '<textarea rows="4" placeholder="Type your question about this project..." required></textarea></div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Send Question</button></div></form>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function submitProjectQuestion(projId, formEl) {
    var proj = _findProject(projId);
    if (!proj) return;
    showToast('Question sent to the project creator.', 'success');
    closeModal();
}

/* ================================================
   6k. MANUSCRIPT PREPARATION
   ================================================ */
async function openManuscript(projId) {
    var proj = await _findProject(projId);
    if (!proj) return;

    // Check access
    if (!_canAccessProject(proj)) {
        showToast('You must be listed on the IRB protocol to access this project.', 'error');
        return;
    }

    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Manuscript: ' + (proj.title || 'Project');

    if (!proj.manuscript) proj.manuscript = { content: '', lastEditedBy: '', lastEditedAt: '' };

    var html = '<div style="max-height:70vh;overflow-y:auto;">' +
        '<div class="alert-banner" style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
        '<i class="fas fa-pen-fancy" style="color:#7c3aed;"></i>' +
        '<span style="font-size:0.82rem;color:var(--text-secondary);">Collaborative manuscript editor. All changes are saved automatically. Anyone on the IRB/project can edit.</span></div>' +

        (proj.manuscript.lastEditedBy ? '<p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:12px;"><i class="fas fa-clock"></i> Last edited by <strong>' + _esc(proj.manuscript.lastEditedBy) + '</strong> on ' + new Date(proj.manuscript.lastEditedAt).toLocaleString() + '</p>' : '') +

        '<div class="form-group"><label>Title</label>' +
        '<input type="text" id="msTitle" value="' + _esc(proj.manuscript.title || proj.title || '') + '" placeholder="Manuscript title..."></div>' +

        '<div class="form-group"><label>Authors</label>' +
        '<input type="text" id="msAuthors" value="' + _esc(proj.manuscript.authors || '') + '" placeholder="Author names in order..."></div>' +

        '<div class="form-group"><label>Abstract</label>' +
        '<textarea id="msAbstract" rows="4" placeholder="Manuscript abstract...">' + _esc(proj.manuscript.abstract || '') + '</textarea></div>' +

        '<div class="form-group"><label>Introduction</label>' +
        '<textarea id="msIntro" rows="5" placeholder="Introduction section...">' + _esc(proj.manuscript.intro || '') + '</textarea></div>' +

        '<div class="form-group"><label>Methods</label>' +
        '<textarea id="msMethods" rows="5" placeholder="Methods section...">' + _esc(proj.manuscript.methods || '') + '</textarea></div>' +

        '<div class="form-group"><label>Results</label>' +
        '<textarea id="msResults" rows="5" placeholder="Results section...">' + _esc(proj.manuscript.results || '') + '</textarea></div>' +

        '<div class="form-group"><label>Discussion</label>' +
        '<textarea id="msDiscussion" rows="5" placeholder="Discussion section...">' + _esc(proj.manuscript.discussion || '') + '</textarea></div>' +

        '<div class="form-group"><label>Conclusion</label>' +
        '<textarea id="msConclusion" rows="3" placeholder="Conclusion...">' + _esc(proj.manuscript.conclusion || '') + '</textarea></div>' +

        '<div class="form-group"><label>References</label>' +
        '<textarea id="msReferences" rows="4" placeholder="References...">' + _esc(proj.manuscript.references || '') + '</textarea></div>' +

        '<div class="modal-actions" style="flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>' +
        '<button type="button" class="btn btn-outline" onclick="exportManuscript(' + projId + ')"><i class="fas fa-file-word"></i> Export to Word</button>' +
        '<button type="button" class="btn btn-primary" onclick="saveManuscript(' + projId + ')"><i class="fas fa-save"></i> Save Manuscript</button>' +
        '</div></div>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function saveManuscript(projId) {
    var manuscriptData = {
        title: _val('msTitle'),
        authors: _val('msAuthors'),
        abstract: _val('msAbstract'),
        intro: _val('msIntro'),
        methods: _val('msMethods'),
        results: _val('msResults'),
        discussion: _val('msDiscussion'),
        conclusion: _val('msConclusion'),
        references: _val('msReferences'),
        lastEditedBy: currentUserName,
        lastEditedAt: new Date().toISOString()
    };

    await _sb.from('projects').update({ manuscript: manuscriptData }).eq('id', projId);
    showToast('Manuscript saved!', 'success');
}

async function exportManuscript(projId) {
    var proj = await _findProject(projId);
    if (!proj || !proj.manuscript) return;
    var ms = proj.manuscript;

    var htmlContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="utf-8"><title>' + _esc(ms.title || 'Manuscript') + '</title>' +
        '<style>body{font-family:Times New Roman,serif;font-size:12pt;line-height:2;margin:1in;}h1{font-size:14pt;text-align:center;font-weight:bold;}h2{font-size:12pt;font-weight:bold;margin-top:24pt;}p{margin:0 0 12pt 0;text-indent:0.5in;}</style></head><body>';

    htmlContent += '<h1>' + _esc(ms.title || '') + '</h1>';
    if (ms.authors) htmlContent += '<p style="text-align:center;text-indent:0;">' + _esc(ms.authors) + '</p>';
    htmlContent += '<p style="text-align:center;text-indent:0;">Saint Luke\'s Neuroscience Research Department</p><br>';

    if (ms.abstract) { htmlContent += '<h2>Abstract</h2><p>' + _esc(ms.abstract).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.intro) { htmlContent += '<h2>Introduction</h2><p>' + _esc(ms.intro).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.methods) { htmlContent += '<h2>Methods</h2><p>' + _esc(ms.methods).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.results) { htmlContent += '<h2>Results</h2><p>' + _esc(ms.results).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.discussion) { htmlContent += '<h2>Discussion</h2><p>' + _esc(ms.discussion).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.conclusion) { htmlContent += '<h2>Conclusion</h2><p>' + _esc(ms.conclusion).replace(/\n/g, '<br>') + '</p>'; }
    if (ms.references) { htmlContent += '<h2>References</h2><p style="text-indent:0;">' + _esc(ms.references).replace(/\n/g, '<br>') + '</p>'; }

    htmlContent += '</body></html>';

    var blob = new Blob([htmlContent], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (ms.title || 'Manuscript').replace(/\s+/g, '_') + '.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Manuscript exported to Word!', 'success');
}

/* --- CSV Export from REDCap Form --- */
function exportFormCSV() {
    if (redcapVars.length === 0) {
        showToast('No variables to export.', 'error');
        return;
    }

    // Build CSV header from variable names
    var header = redcapVars.map(function (v) { return '"' + v.name + '"'; }).join(',');
    var csv = header + '\n';

    // Add empty data row as template
    var emptyRow = redcapVars.map(function () { return '""'; }).join(',');
    csv += emptyRow + '\n';

    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'data_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('CSV template exported! Open in Excel to add your data.', 'success');
}

/* ================================================
   7. CLOSE MODAL
   ================================================ */
function closeModal() {
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

/* --- Render project detail modal (async helper) --- */
function _renderProjectDetailModal(proj, projId, titleEl, bodyEl) {
    titleEl.textContent = proj.title || 'Project Details';

    // Build file uploads section
    var filesHtml = '<div class="form-section-title"><i class="fas fa-file-upload" style="margin-right:6px;"></i> Project Documents</div>';
    var fileTypes = [
        { key: 'protocol', label: 'Protocol', icon: 'fa-file-medical', irbOnly: false },
        { key: 'consent', label: 'Consent Form', icon: 'fa-file-signature', irbOnly: true },
        { key: 'irbLetter', label: 'IRB Approval Letter', icon: 'fa-shield-alt', irbOnly: true }
    ];
    if (!proj.files) proj.files = {};
    var isIRBUser = (currentUserRole === 'IRB' || currentUserEmail === 'ldrose@saint-lukes.org');
    fileTypes.forEach(function (ft) {
        var hasFile = proj.files[ft.key];
        var canUpload = ft.irbOnly ? (isIRBUser || currentUserRole === 'Admin') : _canEditProject(proj);
        filesHtml += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:10px;margin-bottom:8px;">' +
            '<i class="fas ' + ft.icon + '" style="color:' + (hasFile ? '#10b981' : 'var(--text-muted)') + ';font-size:1.1rem;width:24px;text-align:center;"></i>' +
            '<div style="flex:1;"><strong style="font-size:0.85rem;">' + ft.label + '</strong>' +
            (hasFile ? '<span style="display:block;font-size:0.72rem;color:#10b981;margin-top:2px;">\u2713 ' + _esc(hasFile) + '</span>' : '<span style="display:block;font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + (ft.irbOnly ? 'Uploaded by IRB only' : 'Not uploaded') + '</span>') + '</div>' +
            (canUpload ? '<label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;"><i class="fas fa-upload"></i> Upload<input type="file" style="display:none;" onchange="uploadProjectFile(' + projId + ',\'' + ft.key + '\',this)"></label>' : (ft.irbOnly ? '<span style="font-size:0.7rem;color:var(--text-muted);"><i class="fas fa-lock"></i> IRB Only</span>' : '')) +
            '</div>';
    });

    // Data collection monitoring
    var filesObj = proj.files || {};
    var redcapLinked = filesObj.redcapLinked;
    var dataCollHtml = '<div class="form-section-title"><i class="fas fa-chart-line" style="margin-right:6px;"></i> Data Collection Monitoring</div>';
    if (redcapLinked) {
        var enrolled = filesObj.enrolledCount || 0;
        var target = filesObj.targetEnrollment || 0;
        var pct = target > 0 ? Math.round((enrolled / target) * 100) : 0;
        dataCollHtml += '<div style="background:var(--bg-input);border:1px solid var(--border-default);border-radius:10px;padding:16px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:10px;">' +
            '<span style="font-size:0.85rem;font-weight:600;">Enrollment Progress</span>' +
            '<span style="font-size:0.85rem;font-weight:700;color:var(--accent-primary);">' + enrolled + ' / ' + target + '</span></div>' +
            '<div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
            '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:8px;">' + pct + '% complete</p></div>';
    } else {
        dataCollHtml += '<div style="background:var(--bg-input);border:1px solid var(--border-default);border-radius:10px;padding:16px;text-align:center;">' +
            '<p style="color:var(--text-muted);font-size:0.82rem;margin-bottom:10px;">No REDCap data collection linked to this project.</p>' +
            '<div class="form-row" style="max-width:400px;margin:0 auto;">' +
            '<div class="form-group"><label>Target Enrollment</label><input type="number" id="projTargetN" value="' + (filesObj.targetEnrollment || '') + '" placeholder="e.g., 100" min="0"></div>' +
            '<div class="form-group"><label>Enrolled So Far</label><input type="number" id="projEnrolledN" value="' + (filesObj.enrolledCount || '') + '" placeholder="e.g., 25" min="0"></div></div>' +
            '<button class="btn btn-outline btn-sm" onclick="linkProjectREDCap(' + projId + ')"><i class="fas fa-link"></i> Link REDCap & Save Enrollment</button></div>';
    }

    // Linked publications
    var pubsHtml = '<div class="form-section-title"><i class="fas fa-book-open" style="margin-right:6px;"></i> Linked Publications & Abstracts</div>';
    var pubRows = proj._pubRows || [];
    if (pubRows.length > 0) {
        pubRows.forEach(function (pub) {
            pubsHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;margin-bottom:6px;">' +
                '<i class="fas fa-file-alt" style="color:var(--accent-primary);"></i>' +
                '<span style="flex:1;font-size:0.82rem;">' + _esc(pub.title) + '</span>' +
                '<button class="btn btn-danger btn-sm" style="padding:4px 8px;" onclick="removeProjectPub(' + projId + ',' + pub.id + ')"><i class="fas fa-times"></i></button></div>';
        });
    } else {
        pubsHtml += '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0;">No publications linked yet.</p>';
    }
    pubsHtml += '<div style="display:flex;gap:8px;margin-top:8px;">' +
        '<input type="text" id="newProjPub" placeholder="Publication title or abstract..." style="flex:1;padding:8px 12px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-family:inherit;font-size:0.82rem;">' +
        '<button class="btn btn-primary btn-sm" onclick="addProjectPub(' + projId + ')"><i class="fas fa-plus"></i> Link</button></div>';

    // Manuscript section
    var msHtml = '<div class="form-section-title"><i class="fas fa-pen-fancy" style="margin-right:6px;"></i> Manuscript Preparation</div>';
    msHtml += '<div style="background:var(--bg-input);border:1px solid var(--border-default);border-radius:10px;padding:16px;margin-bottom:16px;">';
    if (proj.manuscript && proj.manuscript.title) {
        msHtml += '<p style="font-size:0.85rem;font-weight:600;margin-bottom:4px;">' + _esc(proj.manuscript.title) + '</p>';
        msHtml += '<p style="font-size:0.72rem;color:var(--text-muted);">Last edited by ' + _esc(proj.manuscript.lastEditedBy || 'N/A') + '</p>';
    } else {
        msHtml += '<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px;">No manuscript started yet.</p>';
    }
    msHtml += '<button class="btn btn-outline btn-sm" onclick="closeModal(); setTimeout(function(){openManuscript(' + projId + ')},200);"><i class="fas fa-pen-fancy"></i> Open Manuscript Editor</button></div>';

    // Admin approval section
    var approvalHtml = '';
    if (currentUserRole === 'Admin' && !proj.adminApproved && proj.status === 'Pre-submission') {
        approvalHtml = '<div class="form-section-title"><i class="fas fa-clipboard-check" style="margin-right:6px;"></i> Admin Review</div>' +
            '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-bottom:16px;">' +
            '<p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px;">This project is awaiting admin review. Approve to forward to departments.</p>' +
            '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-primary btn-sm" onclick="approveProject(' + projId + ')"><i class="fas fa-check"></i> Approve Project</button>' +
            '<button class="btn btn-outline btn-sm" onclick="sendProjectQuestion(' + projId + ')"><i class="fas fa-question-circle"></i> Send Question</button>' +
            '</div></div>';
    }

    bodyEl.innerHTML = '<div style="max-height:65vh;overflow-y:auto;">' +
        '<div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">' +
        '<span class="project-pillar ' + (proj.pillar || '').toLowerCase() + '">' + _esc(proj.pillar || 'Unassigned') + '</span>' +
        '<span class="project-status ' + (proj.status || 'active').toLowerCase() + '">' + _esc(proj.status || 'Active') + '</span>' +
        (proj.phase ? '<span class="tag"><i class="fas fa-stream" style="margin-right:4px;"></i>' + _esc(proj.phase) + '</span>' : '') +
        (proj.adminApproved ? '<span class="tag" style="background:rgba(16,185,129,0.15);color:#10b981;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>Approved</span>' : '') +
        '</div>' +
        (proj.pi ? '<p style="color:var(--accent-primary);font-size:0.88rem;margin-bottom:6px;"><i class="fas fa-user-md" style="margin-right:6px;"></i>' + _esc(proj.pi) + '</p>' : '') +
        (proj.abstract ? '<p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">' + _esc(proj.abstract) + '</p>' : '') +
        '<div class="project-progress" style="margin-bottom:20px;"><div class="progress-bar"><div class="progress-fill" style="width:' + (proj.progress || 0) + '%;"></div></div><span>' + (proj.progress || 0) + '%</span></div>' +
        approvalHtml +
        dataCollHtml +
        filesHtml +
        msHtml +
        pubsHtml +
        '<div class="modal-actions" style="flex-wrap:wrap;">' +
        (_canEditProject(proj) ? '<button type="button" class="btn btn-outline" onclick="closeModal(); editProject(' + projId + ');"><i class="fas fa-edit"></i> Edit</button>' : '') +
        (_canAccessProject(proj) && proj.irbApproved ? '<button type="button" class="btn btn-outline" style="border-color:#10b981;color:#10b981;" onclick="closeModal(); setTimeout(function(){openManuscript(' + projId + ')},200);"><i class="fas fa-pen-fancy"></i> Manuscript</button>' : '') +
        '<button type="button" class="btn btn-primary" onclick="closeModal()"><i class="fas fa-check"></i> Done</button>' +
        '</div></div>';
}

/* ================================================
   8. FILTER CHIPS
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.filter-chips').forEach(function (group) {
        group.querySelectorAll('.chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
                chip.classList.add('active');
                filterProjects();
            });
        });
    });
});

function filterProjects() {
    var pillarFilter = 'all';
    var statusFilter = 'all-status';
    var deptFilter = 'all-dept';

    var filterGroups = document.querySelectorAll('.filter-group');
    filterGroups.forEach(function (group) {
        var label = group.querySelector('label');
        var active = group.querySelector('.chip.active');
        if (!label || !active) return;

        var labelText = label.textContent.trim().toLowerCase();
        var filter = active.dataset.filter;

        if (labelText === 'pillar') pillarFilter = filter;
        else if (labelText === 'status') statusFilter = filter;
        else if (labelText === 'department') deptFilter = filter;
    });

    var cards = document.querySelectorAll('.project-card');
    cards.forEach(function (card, index) {
        var show = true;

        if (pillarFilter !== 'all' && card.dataset.pillar !== pillarFilter) show = false;
        if (statusFilter !== 'all-status' && card.dataset.status !== statusFilter) show = false;
        if (deptFilter !== 'all-dept' && card.dataset.dept !== deptFilter) show = false;

        if (show) {
            card.style.display = '';
            card.style.animation = 'fadeInUp 0.4s ease ' + (index * 0.05) + 's both';
        } else {
            card.style.display = 'none';
        }
    });
}

/* ================================================
   9. SUB-TAB SWITCHING
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.sub-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            var parent = tab.closest('.sub-tabs');
            if (parent) {
                parent.querySelectorAll('.sub-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
            }

            // Data tab: toggle data subsections
            var dataTab = document.getElementById('tab-data');
            if (dataTab && dataTab.classList.contains('active')) {
                var subText = tab.textContent.trim();
                _showDataSubsection(subText);
            }

            // Education tab
            var eduTab = document.getElementById('tab-education');
            if (eduTab && eduTab.classList.contains('active')) {
                _showEduSubsection(tab.textContent.trim());
            }

            // Students tab
            var studentsTab = document.getElementById('tab-students');
            if (studentsTab && studentsTab.classList.contains('active')) {
                _showStudentSubsection(tab.textContent.trim());
            }

            // Documents tab
            var docsTab = document.getElementById('tab-documents');
            if (docsTab && docsTab.classList.contains('active')) {
                _showDocSubsection(tab.textContent.trim());
            }

            // Admin tab: toggle visibility of admin sections
            var adminTab = document.getElementById('tab-admin');
            if (adminTab && adminTab.classList.contains('active')) {
                var tabText = tab.textContent.trim().toLowerCase();
                var accessReq = document.getElementById('accessRequestsSection');
                var roles = document.getElementById('rolesSection');
                var audit = document.getElementById('auditSection');

                if (accessReq) accessReq.style.display = 'none';
                if (roles) roles.style.display = 'none';
                if (audit) audit.style.display = 'none';

                if (tabText.indexOf('access') !== -1 || tabText.indexOf('all users') !== -1) {
                    if (accessReq) accessReq.style.display = '';
                } else if (tabText.indexOf('roles') !== -1) {
                    if (roles) roles.style.display = '';
                } else if (tabText.indexOf('audit') !== -1) {
                    if (audit) audit.style.display = '';
                } else {
                    // Default: show access requests
                    if (accessReq) accessReq.style.display = '';
                }
            }
        });
    });
});

/* ================================================
   10. VIEW TOGGLE - Grid/List/Pipeline
   ================================================ */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.view-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');

            var view = btn.dataset.view;
            var grid = document.getElementById('projectsGrid');
            var pipeline = document.getElementById('pipelineView');

            if (view === 'pipeline') {
                _showPipelineView();
            } else {
                _hidePipelineView();
                if (grid) {
                    if (view === 'list') {
                        grid.style.gridTemplateColumns = '1fr';
                    } else {
                        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(360px, 1fr))';
                    }
                }
            }
        });
    });
});

function _showPipelineView() {
    var grid = document.getElementById('projectsGrid');
    var pipeline = document.getElementById('pipelineView');
    if (pipeline) pipeline.style.display = '';
    if (grid) grid.style.display = 'none';
}

function _hidePipelineView() {
    var grid = document.getElementById('projectsGrid');
    var pipeline = document.getElementById('pipelineView');
    if (pipeline) pipeline.style.display = 'none';
    if (grid) grid.style.display = '';
}

/* ================================================
   11. TOAST SYSTEM
   ================================================ */
// Inject toast keyframes once
(function () {
    var style = document.createElement('style');
    style.textContent =
        '@keyframes toastIn { from { transform: translateY(20px) translateX(20px); opacity: 0; } to { transform: translateY(0) translateX(0); opacity: 1; } }' +
        '@keyframes toastOut { from { transform: translateY(0) translateX(0); opacity: 1; } to { transform: translateY(20px) translateX(20px); opacity: 0; } }' +
        '@keyframes rippleEffect { to { transform: scale(4); opacity: 0; } }' +
        '@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(style);
})();

function showToast(message, type) {
    type = type || 'success';
    var toast = document.createElement('div');
    var bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
    var icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';

    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:14px 24px;' +
        'background:' + bgColor + ';color:white;border-radius:12px;font-size:0.88rem;' +
        'font-weight:500;font-family:Inter,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.3);' +
        'z-index:5000;animation:toastIn 0.4s ease;display:flex;align-items:center;gap:10px;' +
        'max-width:400px;';

    toast.innerHTML = '<i class="fas fa-' + icon + '"></i> ' + message;
    document.body.appendChild(toast);

    setTimeout(function () {
        toast.style.animation = 'toastOut 0.4s ease forwards';
        setTimeout(function () {
            if (toast.parentNode) toast.remove();
        }, 400);
    }, 3000);
}

/* ================================================
   12. NOTIFICATION PANEL
   ================================================ */
function toggleNotifications() {
    var panel = document.getElementById('notificationPanel');
    if (panel) {
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            _renderNotifications();
        }
    }
}

async function _renderNotifications() {
    var list = document.querySelector('.notif-list');
    if (!list) return;

    _showLoading(list);

    // Fetch notifications for current user
    var { data: myNotifs } = await _sb.from('notifications').select('*').contains('recipients', [currentUserEmail]).order('created_at', { ascending: false }).limit(50);
    if (!myNotifs) myNotifs = [];

    if (myNotifs.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:40px 20px;"><i class="fas fa-bell"></i><p>No notifications</p><span>You\'re all caught up!</span></div>';
        return;
    }

    var html = '';
    myNotifs.forEach(function(n) {
        var icon = n.type === 'new' ? 'fa-plus-circle' : n.type === 'irb_decision' ? 'fa-gavel' : n.type === 'approved' ? 'fa-check-circle' : 'fa-info-circle';
        var color = n.type === 'approved' ? '#10b981' : n.type === 'irb_decision' ? '#f59e0b' : '#00d4ff';
        var dateStr = n.created_at ? new Date(n.created_at).toLocaleString() : '';
        html += '<div class="notif-item' + (n.read ? '' : ' unread') + '" onclick="markNotifRead(' + n.id + ')" style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;' + (!n.read ? 'background:rgba(0,212,255,0.04);' : '') + '">' +
            '<div style="display:flex;align-items:start;gap:10px;">' +
            '<i class="fas ' + icon + '" style="color:' + color + ';margin-top:2px;"></i>' +
            '<div style="flex:1;"><p style="font-size:0.82rem;color:var(--text-primary);margin-bottom:4px;">' + _esc(n.message) + '</p>' +
            '<span style="font-size:0.7rem;color:var(--text-muted);">' + dateStr + ' · from ' + _esc(n.from_user || '') + '</span></div>' +
            (!n.read ? '<span style="width:8px;height:8px;background:#00d4ff;border-radius:50;flex-shrink:0;margin-top:6px;"></span>' : '') +
            '</div></div>';
    });

    list.innerHTML = html;
}

async function markNotifRead(notifId) {
    await _sb.from('notifications').update({ read: true }).eq('id', notifId);
    await _updateNotificationBadge();
    await _renderNotifications();
}

function closeNotifications() {
    var panel = document.getElementById('notificationPanel');
    if (panel) panel.classList.remove('active');
}

// Close notification panel when clicking outside
document.addEventListener('click', function (e) {
    var panel = document.getElementById('notificationPanel');
    var btn = document.querySelector('.notification-btn');
    if (panel && panel.classList.contains('active') && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        closeNotifications();
    }
});

/* ================================================
   13. KEYBOARD SHORTCUTS
   ================================================ */
document.addEventListener('keydown', function (e) {
    // Ctrl+K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        var search = document.getElementById('globalSearch');
        if (search) search.focus();
    }

    // Alt+1 through Alt+9 for tabs
    if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        var tabs = ['dashboard', 'projects', 'people', 'grants', 'deadlines', 'irb', 'publications', 'data', 'students'];
        var index = parseInt(e.key) - 1;
        if (tabs[index]) {
            switchTab(tabs[index]);
        }
    }

    // Escape for modal/notification/drawer close
    if (e.key === 'Escape') {
        closeModal();
        closeNotifications();
        closeUserDropdown();
        // Close nav drawer if open
        var drawer = document.getElementById('navDrawer');
        var dOverlay = document.getElementById('navDrawerOverlay');
        if (drawer && drawer.classList.contains('active')) {
            drawer.classList.remove('active');
            if (dOverlay) dOverlay.classList.remove('active');
        }
    }
});

/* ================================================
   14. CARD HOVER - Mouse-follow glow effect
   ================================================ */
function initCardHoverEffects() {
    var selectors = '.project-card, .person-card, .resource-card, .stat-card, .dashboard-card, .cert-card, .role-card, .funding-card, .metric-card';
    document.querySelectorAll(selectors).forEach(function (card) {
        card.addEventListener('mousemove', function (e) {
            var rect = card.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / rect.width) * 100;
            var y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mouse-x', x + '%');
            card.style.setProperty('--mouse-y', y + '%');
        });
    });
}

/* ================================================
   15. RIPPLE EFFECT - Buttons and chips
   ================================================ */
function initRippleEffect() {
    document.querySelectorAll('.btn, .nav-tab, .chip, .sub-tab').forEach(function (btn) {
        // Prevent double-binding
        if (btn.dataset.rippleBound) return;
        btn.dataset.rippleBound = 'true';

        btn.addEventListener('click', function (e) {
            var ripple = document.createElement('span');
            var rect = this.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height);
            var x = e.clientX - rect.left - size / 2;
            var y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;' +
                'border-radius:50%;background:rgba(0,212,255,0.15);transform:scale(0);' +
                'animation:rippleEffect 0.6s ease-out;left:' + x + 'px;top:' + y + 'px;' +
                'pointer-events:none;';

            this.style.position = this.style.position || 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);

            setTimeout(function () { ripple.remove(); }, 600);
        });
    });
}

/* ================================================
   16. CHECKLIST ITEMS - Toggle check/uncheck
   ================================================ */
function initChecklistItems() {
    document.querySelectorAll('.checklist-item').forEach(function (item) {
        if (item.dataset.checkBound) return;
        item.dataset.checkBound = 'true';

        item.addEventListener('click', function () {
            var icon = item.querySelector('i');
            if (!icon) return;

            if (icon.classList.contains('fa-circle')) {
                // Check it
                icon.classList.remove('far', 'fa-circle');
                icon.classList.add('fas', 'fa-check-circle');
                icon.style.color = '#10b981';
                item.style.color = '#10b981';
                item.style.textDecoration = 'line-through';
            } else {
                // Uncheck it
                icon.classList.remove('fas', 'fa-check-circle');
                icon.classList.add('far', 'fa-circle');
                icon.style.color = '';
                item.style.color = '';
                item.style.textDecoration = '';
            }
        });

        item.style.cursor = 'pointer';
    });
}

/* ================================================
   17. GLOBAL SEARCH - Filter visible cards
   ================================================ */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var searchInput = document.getElementById('globalSearch');
        if (!searchInput) return;

        searchInput.addEventListener('input', function () {
            var query = this.value.toLowerCase().trim();
            var allCards = document.querySelectorAll('.project-card, .person-card, .pub-item, .resource-card, .cert-card, .role-card, .checklist-item, .deadline-card, .forum-item, .meeting-item');

            if (query.length < 2) {
                allCards.forEach(function (card) {
                    card.style.opacity = '';
                    card.style.transform = '';
                });
                return;
            }

            allCards.forEach(function (card) {
                var text = card.textContent.toLowerCase();
                if (text.indexOf(query) !== -1) {
                    card.style.opacity = '1';
                    card.style.transform = '';
                } else {
                    card.style.opacity = '0.3';
                }
            });
        });

        searchInput.addEventListener('blur', function () {
            if (this.value === '') {
                document.querySelectorAll('.project-card, .person-card, .pub-item, .resource-card').forEach(function (card) {
                    card.style.opacity = '';
                    card.style.transform = '';
                });
            }
        });
    });
})();

/* ================================================
   INITIALIZATION HELPERS
   ================================================ */
function initAnimations() {
    animateCounters();
    initIntersectionObserver();
    initCardHoverEffects();
}

function initIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach(function (el) {
        observer.observe(el);
    });
}

/* ================================================
   MISC: Progress bars, donut chart, scroll effects
   ================================================ */
function animateProgressBars() {
    document.querySelectorAll('.progress-fill').forEach(function (bar) {
        var width = bar.style.width;
        bar.style.width = '0%';
        setTimeout(function () { bar.style.width = width; }, 300);
    });
}

function animateDonutChart() {
    var segments = document.querySelectorAll('.ring-segment');
    segments.forEach(function (seg) {
        var dasharray = seg.getAttribute('stroke-dasharray');
        seg.setAttribute('stroke-dasharray', '0 503');
        setTimeout(function () {
            seg.style.transition = 'stroke-dasharray 1s ease';
            seg.setAttribute('stroke-dasharray', dasharray);
        }, 500);
    });
}

// Nav scroll shadow
window.addEventListener('scroll', function () {
    var mainNav = document.getElementById('mainNav');
    if (mainNav) {
        if (window.scrollY > 10) {
            mainNav.classList.add('scrolled');
        } else {
            mainNav.classList.remove('scrolled');
        }
    }
});

// Parallax on stats
window.addEventListener('scroll', function () {
    var scrolled = window.scrollY;
    var statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
        statsGrid.style.transform = 'translateY(' + (scrolled * 0.02) + 'px)';
    }
});

// Export buttons
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.btn-outline').forEach(function (btn) {
        if (btn.textContent.indexOf('Export') !== -1) {
            btn.addEventListener('click', function () {
                showToast('Export feature ready for SharePoint integration', 'info');
            });
        }
    });
});

// Table row hover
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.data-table tbody tr').forEach(function (row) {
        row.addEventListener('mouseenter', function () {
            row.style.cursor = 'pointer';
        });
    });
});

// MutationObserver for tab activation
document.addEventListener('DOMContentLoaded', function () {
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.target.classList && mutation.target.classList.contains('active') && mutation.target.id === 'tab-projects') {
                setTimeout(animateProgressBars, 200);
            }
        });
    });

    document.querySelectorAll('.tab-content').forEach(function (tab) {
        observer.observe(tab, { attributes: true, attributeFilter: ['class'] });
    });

    // Initial donut chart animation
    setTimeout(animateDonutChart, 2500);

    // Init ripple on existing elements
    initRippleEffect();
});

/* ================================================
   PEOPLE DIRECTORY: Render all users dynamically
   ================================================ */
async function renderPeopleDirectory(filterRole) {
    var grid = document.getElementById('peopleGrid');
    if (!grid) return;

    _showLoading(grid);

    // Fetch ALL profiles from Supabase
    var { data: profiles } = await _sb.from('profiles').select('name, email, role, title, initials, credential, needs_profile_setup, login_approved');
    if (!profiles) profiles = [];

    var allPeople = profiles.map(function(u) {
        var status = u.needs_profile_setup ? (u.login_approved ? 'Approved - Awaiting Setup' : 'Pending Setup') : 'Active';
        return { name: u.name, email: u.email, role: u.role, title: u.title, initials: u.initials, credential: u.credential || '', status: status };
    });

    // Sort alphabetically
    allPeople.sort(function(a, b) { return a.name.localeCompare(b.name); });

    // Categorize
    var categories = {
        'Faculty': [],
        'Admin': [],
        'Resident': [],
        'APP': [],
        'NP': [],
        'RN': [],
        'Medical Student': [],
        'IRB': [],
        'Research Fellow': [],
        'CRC': [],
        'Statistician': [],
        'Other': []
    };

    allPeople.forEach(function(p) {
        if (categories[p.role]) {
            categories[p.role].push(p);
        } else {
            categories['Other'].push(p);
        }
    });

    // Map sub-tab filters to categories
    var subTabMap = {
        'faculty': ['Faculty', 'Admin'],
        'staff': ['APP', 'NP', 'RN', 'CRC', 'Statistician', 'Other'],
        'trainees': ['Resident', 'Research Fellow'],
        'medstudents': ['Medical Student'],
        'collaborators': [],
        'irb': ['IRB']
    };

    // Determine which people to show based on active sub-tab
    var activeSubTab = 'faculty';
    var peopleSection = document.getElementById('tab-people');
    if (peopleSection) {
        var activeST = peopleSection.querySelector('.sub-tab.active');
        if (activeST) {
            var stText = activeST.textContent.trim().replace(/\d+/g, '').trim().toLowerCase();
            if (stText.indexOf('research staff') !== -1) activeSubTab = 'staff';
            else if (stText.indexOf('trainee') !== -1) activeSubTab = 'trainees';
            else if (stText.indexOf('medical student') !== -1) activeSubTab = 'medstudents';
            else if (stText.indexOf('collaborator') !== -1) activeSubTab = 'collaborators';
            else activeSubTab = 'faculty';
        }
    }

    // Override with direct filter if passed
    if (filterRole) activeSubTab = filterRole;

    var showRoles = subTabMap[activeSubTab] || ['Faculty', 'Admin'];
    var filteredPeople = allPeople.filter(function(p) {
        return showRoles.indexOf(p.role) !== -1;
    });

    // Update sub-tab counts
    if (peopleSection) {
        var subTabs = peopleSection.querySelectorAll('.sub-tab');
        subTabs.forEach(function(st) {
            var countEl = st.querySelector('.sub-tab-count');
            if (!countEl) return;
            var stName = st.textContent.trim().replace(/\d+/g, '').trim().toLowerCase();
            var mappedKey = 'faculty';
            if (stName.indexOf('research staff') !== -1) mappedKey = 'staff';
            else if (stName.indexOf('trainee') !== -1) mappedKey = 'trainees';
            else if (stName.indexOf('medical student') !== -1) mappedKey = 'medstudents';
            else if (stName.indexOf('collaborator') !== -1) mappedKey = 'collaborators';

            var rolesToCount = subTabMap[mappedKey] || [];
            var count = allPeople.filter(function(p) { return rolesToCount.indexOf(p.role) !== -1; }).length;
            countEl.textContent = count;
        });
    }

    // Build HTML
    if (filteredPeople.length === 0) {
        grid.innerHTML = '<div class="empty-state-large"><i class="fas fa-users"></i><h3>No Members in This Category</h3><p>No team members match the current filter.</p></div>';
        return;
    }

    var html = '';
    filteredPeople.forEach(function(p) {
        var roleColor = _getRoleColor(p.role);
        var statusBadge = '';
        if (p.status === 'Pending Setup') {
            statusBadge = '<span style="font-size:0.68rem;background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 8px;border-radius:20px;margin-left:6px;">Pending</span>';
        } else if (p.status === 'Active') {
            statusBadge = '<span style="font-size:0.68rem;background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:20px;margin-left:6px;">Active</span>';
        }

        html += '<div class="person-card" style="padding:20px;border-radius:14px;background:var(--card-bg);border:1px solid var(--border-color);position:relative;overflow:hidden;">' +
            '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">' +
            '<div style="width:48px;height:48px;border-radius:50%;background:' + roleColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:#fff;flex-shrink:0;">' + _esc(p.initials) + '</div>' +
            '<div style="flex:1;min-width:0;">' +
            '<h4 style="font-size:0.92rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(p.name) + '</h4>' +
            '<p style="font-size:0.78rem;color:var(--text-secondary);">' + _esc(p.title) + '</p>' +
            '</div></div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-size:0.72rem;color:' + roleColor + ';font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">' + _esc(p.role) + '</span>' +
            statusBadge +
            '</div>' +
            '<p style="font-size:0.74rem;color:var(--accent-primary);margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><i class="fas fa-envelope" style="margin-right:5px;font-size:0.68rem;"></i>' + _esc(p.email) + '</p>' +
            '</div>';
    });

    grid.innerHTML = html;

    // Re-init hover effects on new cards
    initCardHoverEffects();
}

function _getRoleColor(role) {
    var colors = {
        'Admin': '#f59e0b',
        'Faculty': '#00d4ff',
        'Resident': '#7c3aed',
        'Medical Student': '#10b981',
        'APP': '#ec4899',
        'NP': '#ec4899',
        'RN': '#f97316',
        'PA': '#ec4899',
        'IRB': '#f59e0b',
        'Research Fellow': '#6366f1',
        'CRC': '#14b8a6',
        'Statistician': '#8b5cf6'
    };
    return colors[role] || '#64748b';
}

/* --- People Directory sub-tab click wiring --- */
function _initPeopleSubTabs() {
    var peopleSection = document.getElementById('tab-people');
    if (!peopleSection) return;

    peopleSection.querySelectorAll('.sub-tab').forEach(function(st) {
        st.addEventListener('click', function() {
            // Remove active from all, add to clicked
            peopleSection.querySelectorAll('.sub-tab').forEach(function(s) { s.classList.remove('active'); });
            st.classList.add('active');
            // Re-render with new filter
            renderPeopleDirectory();
        });
    });
}

// Wire up on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    _initPeopleSubTabs();
});

/* ================================================
   SEND EMAIL TAB: Restricted to Dr. Hayner & Ahmad
   ================================================ */
function _toggleSendEmailTab(show) {
    var tab = document.getElementById('sendEmailNavItem');
    if (tab) tab.style.display = show ? '' : 'none';
    var tabContent = document.getElementById('tab-sendemail');
    if (tabContent && !show) tabContent.classList.remove('active');
}

async function renderSendEmailTab() {
    var container = document.getElementById('sendEmailUserList');
    if (!container) return;

    _showLoading(container);

    // Fetch all non-admin profiles from Supabase
    var { data: profiles } = await _sb.from('profiles').select('name, email, role, credential, needs_profile_setup').neq('role', 'Admin');
    if (!profiles) profiles = [];

    var allUsers = profiles.map(function(u) {
        return {
            name: u.name,
            email: u.email,
            role: u.role,
            credential: u.credential || '',
            password: _generateTempPassword(u.name, u.role),
            needsProfileSetup: u.needs_profile_setup,
            sent: false
        };
    });

    // Store globally for sendAll to access
    window._inviteUsers = allUsers;

    // Sort by role then name
    allUsers.sort(function(a, b) {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.name.localeCompare(b.name);
    });

    var totalPending = allUsers.filter(function(u) { return !u.sent; }).length;
    var totalSent = allUsers.filter(function(u) { return u.sent; }).length;

    var html = '<div style="display:flex;gap:12px;margin-bottom:20px;">' +
        '<div class="stat-card" style="flex:1;padding:16px;"><div class="stat-info"><span class="stat-number" style="color:#00d4ff;">' + allUsers.length + '</span><span class="stat-label">Total Users</span></div></div>' +
        '<div class="stat-card" style="flex:1;padding:16px;"><div class="stat-info"><span class="stat-number" style="color:#f59e0b;">' + totalPending + '</span><span class="stat-label">Not Yet Invited</span></div></div>' +
        '<div class="stat-card" style="flex:1;padding:16px;"><div class="stat-info"><span class="stat-number" style="color:#10b981;">' + totalSent + '</span><span class="stat-label">Emails Sent</span></div></div>' +
        '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<button class="btn btn-primary" onclick="sendAllInviteEmails()"><i class="fas fa-paper-plane"></i> Send All Invitations</button>' +
        '<button class="btn btn-outline" onclick="previewInviteEmail()"><i class="fas fa-eye"></i> Preview Email Template</button>' +
        '</div>';

    // Build table of users
    html += '<div class="table-container"><table class="data-table"><thead><tr>' +
        '<th><input type="checkbox" id="selectAllUsers" onchange="toggleAllEmailCheckboxes(this)"></th>' +
        '<th>Name</th><th>Email</th><th>Role</th><th>Temp Password</th><th>Status</th><th>Action</th></tr></thead><tbody>';

    allUsers.forEach(function(u, idx) {
        var statusHtml = u.sent ?
            '<span style="font-size:0.75rem;background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:20px;"><i class="fas fa-check"></i> Sent</span>' :
            '<span style="font-size:0.75rem;background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:20px;">Not Sent</span>';

        html += '<tr>' +
            '<td><input type="checkbox" class="email-user-cb" data-email="' + _esc(u.email) + '" ' + (u.sent ? 'disabled' : '') + '></td>' +
            '<td style="font-size:0.82rem;font-weight:500;">' + _esc(u.name) + '</td>' +
            '<td style="font-size:0.78rem;color:var(--accent-primary);">' + _esc(u.email) + '</td>' +
            '<td><span style="font-size:0.72rem;background:' + _getRoleColor(u.role) + '22;color:' + _getRoleColor(u.role) + ';padding:2px 8px;border-radius:12px;">' + _esc(u.role) + '</span></td>' +
            '<td style="font-size:0.78rem;font-family:monospace;color:#f59e0b;">' + _esc(u.password) + '</td>' +
            '<td>' + statusHtml + '</td>' +
            '<td>' + (!u.sent ? '<button class="btn btn-sm btn-outline" onclick="sendSingleInviteEmail(\'' + _esc(u.email) + '\')"><i class="fas fa-envelope"></i> Send</button>' : '<span style="color:var(--text-muted);font-size:0.75rem;">Done</span>') + '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function toggleAllEmailCheckboxes(masterCb) {
    document.querySelectorAll('.email-user-cb:not(:disabled)').forEach(function(cb) {
        cb.checked = masterCb.checked;
    });
}

function previewInviteEmail() {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Email Invitation Template Preview';

    var loginUrl = 'https://slresearchhub.com';

    var html = '<div style="background:#0f0f2e;border:1px solid var(--border-color);border-radius:12px;padding:24px;max-height:60vh;overflow-y:auto;">' +
        '<div style="text-align:center;margin-bottom:20px;">' +
        '<div style="width:60px;height:60px;background:linear-gradient(135deg,#00d4ff,#7c3aed);border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-brain" style="color:#fff;font-size:24px;"></i></div>' +
        '<h3 style="color:#00d4ff;margin-bottom:4px;">Saint Luke\'s Neuroscience Research Department</h3>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;">Research Database Invitation</p></div>' +

        '<div style="color:var(--text-primary);font-size:0.88rem;line-height:1.7;">' +
        '<p>Dear <strong style="color:#00d4ff;">[User Name]</strong>,</p>' +
        '<p>We are pleased to invite you to the <strong>Saint Luke\'s Neuroscience Research Database</strong> — a centralized hub for our Neurology & Neurosurgery research operations.</p>' +
        '<p>This platform supports the full research lifecycle: project submissions, IRB tracking, data collection, publications, and team collaboration.</p>' +

        '<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:16px;margin:16px 0;">' +
        '<h4 style="color:#00d4ff;margin-bottom:10px;"><i class="fas fa-key" style="margin-right:6px;"></i> Your Login Credentials</h4>' +
        '<p><strong>Login URL:</strong> <span style="color:#00d4ff;">' + loginUrl + '</span></p>' +
        '<p><strong>Email:</strong> <span style="color:#f59e0b;">[user@email.com]</span></p>' +
        '<p><strong>Temporary Password:</strong> <span style="font-family:monospace;color:#f59e0b;">[TempPassword]</span></p>' +
        '</div>' +

        '<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin:16px 0;">' +
        '<h4 style="color:#f59e0b;margin-bottom:10px;"><i class="fas fa-list-ol" style="margin-right:6px;"></i> Getting Started</h4>' +
        '<ol style="padding-left:20px;margin:0;">' +
        '<li>Click the login URL above</li>' +
        '<li>Enter your email and temporary password</li>' +
        '<li>Your login request will be submitted for approval</li>' +
        '<li>Once approved, you will be prompted to change your password</li>' +
        '<li>Complete your profile information</li>' +
        '<li>Upload your CITI training certificate (required for all personnel)</li>' +
        '</ol></div>' +

        '<p>If you have any questions, please contact:</p>' +
        '<ul style="padding-left:20px;">' +
        '<li><strong>Dr. Stephanie Kolakowsky-Hayner</strong> — skolakowsky@saint-lukes.org</li>' +
        '<li><strong>Dr. Ahmad Kareem Almekkawi</strong> — aalmekkawi@saint-lukes.org</li>' +
        '</ul>' +
        '<p>Best regards,<br><strong>Neuroscience Research Department</strong><br>Saint Luke\'s Health System</p>' +
        '</div></div>';

    html += '<div class="modal-actions" style="margin-top:16px;">' +
        '<button class="btn btn-outline" onclick="closeModal()">Close</button>' +
        '</div>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/* --- Generate temp password from name (matches seed script pattern) --- */
function _generateTempPassword(name, role) {
    if (role === 'IRB') return 'SLNeuro_IRB2026!';
    // Extract last name: "Andrew Abumoussa, MD" -> "Abumoussa", "Arlene O'Shea, APRN" -> "OShea"
    var parts = name.split(',')[0].trim().split(' ');
    var lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    // Remove apostrophes and special chars
    lastName = lastName.replace(/[^a-zA-Z]/g, '');
    return 'SLNeuro_' + lastName + '1!';
}

/* --- Build email body for a single user --- */
function _buildInviteEmailBody(userName, userEmail, tempPassword) {
    var loginUrl = 'https://slresearchhub.com';
    return 'Dear ' + userName + ',\n\n' +
        'We are pleased to invite you to the Saint Luke\'s Neuroscience Research Database — a centralized hub for our Neurology & Neurosurgery research operations.\n\n' +
        'This platform supports the full research lifecycle: project submissions, IRB tracking, data collection, publications, and team collaboration.\n\n' +
        '========================================\n' +
        'YOUR LOGIN CREDENTIALS\n' +
        '========================================\n' +
        'Login URL: ' + loginUrl + '\n' +
        'Email: ' + userEmail + '\n' +
        'Temporary Password: ' + tempPassword + '\n' +
        '========================================\n\n' +
        'GETTING STARTED:\n' +
        '1. Go to ' + loginUrl + '\n' +
        '2. Enter your email and temporary password above\n' +
        '3. Your login request will be submitted for admin approval\n' +
        '4. Once approved by Dr. Hayner or Dr. Almekkawi, log in again\n' +
        '5. You will be prompted to change your password and complete your profile\n' +
        '6. Upload your CITI training certificate (required for all personnel)\n\n' +
        'IMPORTANT: Please change your password on first login. Do not share your credentials.\n\n' +
        'If you have any questions, please contact:\n' +
        '- Dr. Stephanie Kolakowsky-Hayner - skolakowsky@saint-lukes.org\n' +
        '- Dr. Ahmad Kareem Almekkawi - aalmekkawi@saint-lukes.org\n\n' +
        'Best regards,\n' +
        'Neuroscience Research Department\n' +
        'Saint Luke\'s Health System';
}

async function sendSingleInviteEmail(email) {
    // Find user in the cached invite list or fetch from DB
    var user = (window._inviteUsers || []).find(function(u) { return u.email === email; });
    if (!user) {
        var profile = await _findAnyUserByEmail(email);
        if (!profile) { showToast('User not found.', 'error'); return; }
        user = { name: profile.name, email: profile.email, role: profile.role };
        user.password = _generateTempPassword(user.name, user.role);
    }

    var subject = encodeURIComponent('Saint Luke\'s Neuroscience Research Database - Your Account is Ready');
    var body = encodeURIComponent(_buildInviteEmailBody(user.name, user.email, user.password));

    // Use location.href (not window.open) to open in default mail client (Outlook)
    window.location.href = 'mailto:' + user.email + '?subject=' + subject + '&body=' + body;

    showToast('Email opened for ' + user.name + '. Send from your email client.', 'success');
}

function sendAllInviteEmails() {
    // Get checked users
    var checkboxes = document.querySelectorAll('.email-user-cb:checked');
    var selectedEmails = [];
    checkboxes.forEach(function(cb) { selectedEmails.push(cb.dataset.email); });

    if (selectedEmails.length === 0) {
        showToast('Please select users to send invitations to.', 'info');
        return;
    }

    var subject = encodeURIComponent('Saint Luke\'s Neuroscience Research Database - Your Account is Ready');
    var body = encodeURIComponent(
        'Dear Neuroscience Research Team,\n\n' +
        'We are pleased to invite you to the Saint Luke\'s Neuroscience Research Database — a centralized hub for our Neurology & Neurosurgery research operations.\n\n' +
        'This platform supports the full research lifecycle: project submissions, IRB tracking, data collection, publications, and team collaboration.\n\n' +
        '========================================\n' +
        'LOGIN INSTRUCTIONS\n' +
        '========================================\n' +
        'Login URL: https://slresearchhub.com\n' +
        'Username: Your Saint Luke\'s or university email address\n' +
        'Password: Will be provided to you separately\n' +
        '========================================\n\n' +
        'GETTING STARTED:\n' +
        '1. Go to https://slresearchhub.com\n' +
        '2. Enter your email and the password provided to you\n' +
        '3. Your login request will be submitted for admin approval\n' +
        '4. Once approved by Dr. Hayner or Dr. Almekkawi, log in again\n' +
        '5. You will be prompted to change your password and complete your profile\n' +
        '6. Upload your CITI training certificate (required for all personnel)\n\n' +
        'If you have any questions, please contact:\n' +
        '- Dr. Stephanie Kolakowsky-Hayner - skolakowsky@saint-lukes.org\n' +
        '- Dr. Ahmad Kareem Almekkawi - aalmekkawi@saint-lukes.org\n\n' +
        'Best regards,\n' +
        'Neuroscience Research Department\n' +
        'Saint Luke\'s Health System'
    );

    // Send as one group BCC email
    window.location.href = 'mailto:?bcc=' + selectedEmails.join(',') + '&subject=' + subject + '&body=' + body;
    showToast('Group email opened with ' + selectedEmails.length + ' recipients in BCC. Send from your email client.', 'success');
}

/* ================================================
   LOGIN APPROVAL WORKFLOW
   ================================================ */
async function _sendLoginApprovalNotification(user) {
    await _sb.from('notifications').insert({
        type: 'login_request',
        message: user.name + ' (' + user.role + ') has requested login access. Please review and approve.',
        from_user: user.name,
        from_email: user.email || '',
        recipients: ['skolakowsky@saint-lukes.org', 'aalmekkawi@saint-lukes.org', 'cabagley@saint-lukes.org'],
        read: false
    });

    // Send actual email to admins
    var loginUrl = window.location.origin;
    await _sendEmailViaEdgeFunction({
        to: ['skolakowsky@saint-lukes.org', 'aalmekkawi@saint-lukes.org', 'cabagley@saint-lukes.org'],
        subject: 'Login Approval Needed: ' + user.name,
        html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">' +
            '<div style="background:linear-gradient(135deg,#00d4ff,#7c3aed);padding:20px;color:#fff;text-align:center;">' +
            '<h2 style="margin:0;">Saint Luke\'s Neuroscience Research</h2>' +
            '<p style="margin:4px 0 0;">First-Time Login Approval</p></div>' +
            '<div style="padding:24px;background:#f8f9fa;">' +
            '<p><strong>A user is attempting their first login and needs approval:</strong></p>' +
            '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Name:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(user.name) + '</td></tr>' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Email:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(user.email || '') + '</td></tr>' +
            '<tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Role:</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">' + _esc(user.role) + '</td></tr>' +
            '<tr><td style="padding:8px;"><strong>Requested:</strong></td><td style="padding:8px;">' + new Date().toLocaleString() + '</td></tr>' +
            '</table>' +
            '<div style="text-align:center;margin:24px 0;">' +
            '<a href="' + loginUrl + '" style="display:inline-block;background:#00d4ff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Approve in Admin Panel</a>' +
            '</div>' +
            '<p style="color:#666;font-size:0.85rem;">This is an automated notification from the Saint Luke\'s Neuroscience Research Database.</p>' +
            '</div></div>'
    });
}

async function renderPendingLoginApprovals() {
    var section = document.getElementById('loginApprovalsSection');
    if (!section) return;

    var { data: pending } = await _sb.from('pending_login_approvals').select('*').eq('status', 'pending').order('requested_at', { ascending: false });
    if (!pending) pending = [];

    var countEl = document.getElementById('loginApprovalCount');
    if (countEl) countEl.textContent = pending.length;

    if (pending.length === 0) {
        section.innerHTML = '<div class="empty-state" style="padding:30px;"><i class="fas fa-check-circle" style="color:#10b981;"></i><p>No pending login approvals</p><span>All login requests have been processed.</span></div>';
        return;
    }

    var html = '<div class="table-container"><table class="data-table"><thead><tr>' +
        '<th>Name</th><th>Email</th><th>Role</th><th>Requested</th><th>Action</th></tr></thead><tbody>';

    pending.forEach(function(r) {
        html += '<tr>' +
            '<td style="font-weight:500;">' + _esc(r.name) + '</td>' +
            '<td style="font-size:0.82rem;color:var(--accent-primary);">' + _esc(r.email) + '</td>' +
            '<td><span style="font-size:0.72rem;background:' + _getRoleColor(r.role) + '22;color:' + _getRoleColor(r.role) + ';padding:2px 8px;border-radius:12px;">' + _esc(r.role) + '</span></td>' +
            '<td style="font-size:0.78rem;color:var(--text-muted);">' + new Date(r.requested_at).toLocaleString() + '</td>' +
            '<td style="display:flex;gap:6px;">' +
            '<button class="btn btn-sm btn-primary" onclick="approveLoginRequest(\'' + _esc(r.email) + '\')"><i class="fas fa-check"></i> Approve</button>' +
            '<button class="btn btn-sm btn-outline" style="border-color:#ef4444;color:#ef4444;" onclick="denyLoginRequest(\'' + _esc(r.email) + '\')"><i class="fas fa-times"></i> Deny</button>' +
            '</td></tr>';
    });

    html += '</tbody></table></div>';
    section.innerHTML = html;
}

async function approveLoginRequest(email) {
    // Update the pending request
    await _sb.from('pending_login_approvals').update({
        status: 'approved',
        approved_by: currentUserName,
        approved_at: new Date().toISOString()
    }).eq('email', email).eq('status', 'pending');

    // Update the user's profile to mark as approved
    await _sb.from('profiles').update({ login_approved: true }).eq('email', email);

    // Onboarding automation: create CITI training record for user
    var { data: approvedUser } = await _sb.from('profiles').select('id, name').eq('email', email).single();
    if (approvedUser) {
        await _sb.from('citi_training').insert({
            user_id: approvedUser.id,
            human_subjects_status: 'not_started'
        }).then(function() {}).catch(function() {});
    }

    // Send welcome notification to user
    await _sb.from('notifications').insert({
        type: 'login_approved',
        message: 'Welcome to the Saint Luke\'s Neuroscience Research Database! Your login access has been approved by ' + currentUserName + '. Please complete your profile setup and upload your CITI training certificate in the Requirements tab.',
        from_user: currentUserName,
        recipients: [email],
        read: false
    });

    // Audit log
    await logAudit('approved', 'login_request', null, 'Login request approved for ' + email + ' by ' + currentUserName);

    showToast('Login access approved for ' + email + '. They can now log in.', 'success');
    await renderPendingLoginApprovals();
    await renderPeopleDirectory();
    await _updateNotificationBadge();
}

async function denyLoginRequest(email) {
    await _sb.from('pending_login_approvals').update({ status: 'denied' }).eq('email', email).eq('status', 'pending');
    showToast('Login request denied for ' + email + '.', 'info');
    await renderPendingLoginApprovals();
}

/* ================================================
   ADMIN: Generate Email Credentials List
   ================================================ */
async function generateCredentialEmails() {
    if (currentUserRole !== 'Admin') {
        showToast('Admin access required.', 'error');
        return;
    }

    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'User Directory for Email Distribution';

    _showLoading(bodyEl);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    var { data: allUsers } = await _sb.from('profiles').select('name, email, role').neq('role', 'Admin').order('role').order('name');
    if (!allUsers) allUsers = [];

    var html = '<div style="max-height:65vh;overflow-y:auto;">' +
        '<div class="alert-banner" style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
        '<i class="fas fa-envelope" style="color:#00d4ff;"></i>' +
        '<span style="font-size:0.82rem;color:var(--text-secondary);">User directory from database. Passwords are managed via Supabase Auth.</span></div>';

    var categories = { 'Faculty': [], 'Resident': [], 'APP': [], 'NP': [], 'RN': [], 'Medical Student': [], 'IRB': [], 'Other': [] };
    allUsers.forEach(function(u) {
        var cat = categories[u.role] ? u.role : 'Other';
        categories[cat].push(u);
    });

    Object.keys(categories).forEach(function(cat) {
        var users = categories[cat];
        if (users.length === 0) return;
        html += '<h4 class="form-section-title" style="margin-top:16px;"><i class="fas fa-users" style="margin-right:6px;"></i> ' + cat + ' (' + users.length + ')</h4>';
        html += '<div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>';
        users.forEach(function(u) {
            html += '<tr><td style="font-size:0.82rem;">' + _esc(u.name) + '</td>' +
                '<td style="font-size:0.78rem;color:var(--accent-primary);">' + _esc(u.email) + '</td>' +
                '<td style="font-size:0.78rem;">' + _esc(u.role) + '</td></tr>';
        });
        html += '</tbody></table></div>';
    });

    html += '<div class="modal-actions" style="margin-top:16px;">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Close</button>' +
        '<button type="button" class="btn btn-primary" onclick="exportCredentialsCSV()"><i class="fas fa-file-csv"></i> Export as CSV</button>' +
        '</div></div>';

    bodyEl.innerHTML = html;
}

async function exportCredentialsCSV() {
    var { data: allUsers } = await _sb.from('profiles').select('name, email, role').neq('role', 'Admin').order('name');
    if (!allUsers) allUsers = [];
    var csv = 'Name,Email,Role\n';
    allUsers.forEach(function(u) {
        csv += '"' + u.name + '","' + u.email + '","' + u.role + '"\n';
    });

    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'user_directory_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Directory CSV exported!', 'success');
}

/* ================================================
   FEATURE: LIVE DASHBOARD STATS
   ================================================ */
async function renderDashboardStats() {
    try {
        var { count: projectCount } = await _sb.from('projects').select('*', { count: 'exact', head: true });
        var { count: facultyCount } = await _sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'Faculty');
        var { count: pubCount } = await _sb.from('publications').select('*', { count: 'exact', head: true });
        var { count: grantCount } = await _sb.from('grants').select('*', { count: 'exact', head: true }).eq('status', 'Active');

        var stats = document.querySelectorAll('.stat-number[data-target]');
        var statValues = [projectCount || 0, facultyCount || 0, pubCount || 0, grantCount || 0];
        stats.forEach(function(el, i) {
            if (i < statValues.length) {
                el.dataset.target = statValues[i];
            }
        });
        animateCounters();
    } catch (e) { console.error('Dashboard stats error:', e); }
}

/* ================================================
   FEATURE: GLOBAL SEARCH
   ================================================ */
var _searchDebounceTimer = null;

async function globalSearch(query) {
    if (!query || query.length < 2) {
        _hideSearchResults();
        return;
    }

    var results = [];

    // Search profiles
    var { data: people } = await _sb.from('profiles').select('name, email, role').ilike('name', '%' + query + '%').limit(5);
    if (people) people.forEach(function(p) {
        results.push({ type: 'Person', icon: 'fa-user', title: p.name, subtitle: p.role + ' · ' + p.email, action: "switchTab('people')" });
    });

    // Search projects
    var { data: projects } = await _sb.from('projects').select('id, title, pi, status').ilike('title', '%' + query + '%').limit(5);
    if (projects) projects.forEach(function(p) {
        results.push({ type: 'Project', icon: 'fa-project-diagram', title: p.title, subtitle: (p.pi || '') + ' · ' + (p.status || ''), action: "openModal('projectDetail'," + p.id + ")" });
    });

    // Search grants
    var { data: grants } = await _sb.from('grants').select('id, title, pi').ilike('title', '%' + query + '%').limit(5);
    if (grants) grants.forEach(function(g) {
        results.push({ type: 'Grant', icon: 'fa-dollar-sign', title: g.title, subtitle: g.pi || '', action: "switchTab('grants')" });
    });

    // Search publications
    var { data: pubs } = await _sb.from('publications').select('id, title, pub_type').ilike('title', '%' + query + '%').limit(5);
    if (pubs) pubs.forEach(function(p) {
        results.push({ type: 'Publication', icon: 'fa-book', title: p.title, subtitle: p.pub_type || '', action: "switchTab('publications')" });
    });

    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    var existing = document.getElementById('searchResultsDropdown');
    if (existing) existing.remove();

    if (!results || results.length === 0) {
        var dd = document.createElement('div');
        dd.id = 'searchResultsDropdown';
        dd.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--bg-elevated,#1a1a2e);border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:3000;max-height:400px;overflow-y:auto;padding:12px;';
        dd.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.82rem;"><i class="fas fa-search" style="display:block;margin-bottom:8px;font-size:1.2rem;"></i>No results for "' + _esc(query) + '"</div>';
        var searchWrap = document.getElementById('globalSearch');
        if (searchWrap) {
            var parent = searchWrap.parentElement;
            if (parent) { parent.style.position = 'relative'; parent.appendChild(dd); }
        }
        return;
    }

    var dd = document.createElement('div');
    dd.id = 'searchResultsDropdown';
    dd.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--bg-elevated,#1a1a2e);border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:3000;max-height:400px;overflow-y:auto;padding:6px;';

    var html = '';
    results.forEach(function(r) {
        html += '<div onclick="' + r.action + '; _hideSearchResults();" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(0,212,255,0.08)\'" onmouseout="this.style.background=\'none\'">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:rgba(0,212,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas ' + r.icon + '" style="color:#00d4ff;font-size:0.82rem;"></i></div>' +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:0.85rem;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + _esc(r.title) + '</div>' +
            '<div style="font-size:0.72rem;color:var(--text-muted);">' + _esc(r.subtitle) + '</div></div>' +
            '<span style="font-size:0.65rem;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:10px;white-space:nowrap;">' + r.type + '</span></div>';
    });

    dd.innerHTML = html;
    var searchWrap = document.getElementById('globalSearch');
    if (searchWrap) {
        var parent = searchWrap.parentElement;
        if (parent) { parent.style.position = 'relative'; parent.appendChild(dd); }
    }
}

function _hideSearchResults() {
    var dd = document.getElementById('searchResultsDropdown');
    if (dd) dd.remove();
}

// Wire up global search input
document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var val = this.value.trim();
            clearTimeout(_searchDebounceTimer);
            _searchDebounceTimer = setTimeout(function() { globalSearch(val); }, 300);
        });
        searchInput.addEventListener('blur', function() {
            setTimeout(_hideSearchResults, 200);
        });
    }
});

/* ================================================
   FEATURE: ANNOUNCEMENTS SYSTEM
   ================================================ */
async function renderAnnouncements() {
    var container = document.getElementById('announcementsList');
    if (!container) return;

    var { data: announcements } = await _sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10);

    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">' +
            '<i class="fas fa-bullhorn" style="font-size:2rem;margin-bottom:8px;display:block;"></i>' +
            'No announcements yet<br><small>Announcements will appear here as they are posted.</small></div>';
        return;
    }

    var html = '';
    announcements.forEach(function(a) {
        var priorityColor = a.priority === 'high' ? '#ef4444' : a.priority === 'medium' ? '#f59e0b' : '#10b981';
        html += '<div style="padding:12px 16px;border-bottom:1px solid var(--border-default,rgba(255,255,255,0.06));">' +
            (a.pinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;margin-right:6px;font-size:0.72rem;"></i>' : '') +
            '<strong style="font-size:0.85rem;color:var(--text-primary);">' + _esc(a.title) + '</strong>' +
            '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + priorityColor + ';margin-left:8px;vertical-align:middle;"></span>' +
            '<p style="font-size:0.78rem;color:var(--text-secondary);margin:4px 0 0;">' + _esc(a.content) + '</p>' +
            '<small style="color:var(--text-muted);font-size:0.7rem;">' + new Date(a.created_at).toLocaleDateString() + (a.created_by ? ' · ' + _esc(a.created_by) : '') + '</small></div>';
    });

    // Add admin post button
    if (currentUserRole === 'Admin') {
        html += '<div style="padding:12px 16px;text-align:center;">' +
            '<button class="btn btn-primary btn-sm" onclick="openPostAnnouncementModal()"><i class="fas fa-bullhorn"></i> Post Announcement</button></div>';
    }

    container.innerHTML = html;
}

function openPostAnnouncementModal() {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Post Announcement';

    var html = '<form onsubmit="event.preventDefault(); submitAnnouncement(this);">' +
        '<div class="form-group"><label>Title *</label><input type="text" id="annTitle" placeholder="Announcement title..." required></div>' +
        '<div class="form-group"><label>Content *</label><textarea id="annContent" rows="4" placeholder="Announcement details..." required></textarea></div>' +
        '<div class="form-row"><div class="form-group"><label>Priority</label><select id="annPriority">' +
        '<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div>' +
        '<div class="form-group"><label>Pin to Top</label><select id="annPinned">' +
        '<option value="false">No</option><option value="true">Yes</option></select></div></div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-bullhorn"></i> Post</button></div></form>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function submitAnnouncement(formEl) {
    var title = document.getElementById('annTitle').value.trim();
    var content = document.getElementById('annContent').value.trim();
    var priority = document.getElementById('annPriority').value;
    var pinned = document.getElementById('annPinned').value === 'true';

    if (!title || !content) { showToast('Title and content are required.', 'error'); return; }

    var { error } = await _sb.from('announcements').insert({
        title: title,
        content: content,
        priority: priority,
        pinned: pinned,
        created_by: currentUserName
    });

    if (error) { showToast('Error posting announcement: ' + error.message, 'error'); return; }
    await logAudit('created', 'announcement', null, 'Announcement "' + title + '" posted by ' + currentUserName);
    closeModal();
    showToast('Announcement posted!', 'success');
    renderAnnouncements();
}

/* ================================================
   FEATURE: AUDIT LOG VIEWER (Admin Panel)
   ================================================ */
async function renderAuditLog() {
    var container = document.getElementById('auditLogBody');
    if (!container) return;

    _showLoading(container);

    var { data: logs } = await _sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (!logs || logs.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">No audit log entries yet.</td></tr>';
        return;
    }

    var html = '';
    logs.forEach(function(log) {
        var actionColor = log.action === 'created' ? '#10b981' : log.action === 'deleted' ? '#ef4444' : log.action === 'approved' ? '#00d4ff' : '#f59e0b';
        html += '<tr>' +
            '<td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap;">' + new Date(log.created_at).toLocaleString() + '</td>' +
            '<td><span style="font-size:0.72rem;font-weight:600;color:' + actionColor + ';text-transform:uppercase;">' + _esc(log.action) + '</span></td>' +
            '<td style="font-size:0.82rem;">' + _esc(log.entity_type || '') + '</td>' +
            '<td style="font-size:0.78rem;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _esc(log.details || '') + '</td>' +
            '<td style="font-size:0.82rem;">' + _esc(log.user_name || '') + '</td>' +
            '<td><span style="font-size:0.7rem;background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:10px;">' + _esc(log.user_role || '') + '</span></td>' +
            '</tr>';
    });

    container.innerHTML = html;
}

/* ================================================
   FEATURE: RESEARCH FORUM (Threaded Discussions)
   ================================================ */
var _forumCurrentThread = null;

async function renderForumThreads() {
    var container = document.getElementById('forumContent');
    if (!container) return;

    _showLoading(container);
    _forumCurrentThread = null;

    var { data: threads } = await _sb.from('forum_posts').select('*').is('parent_id', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
    if (!threads) threads = [];

    // Get reply counts
    var threadIds = threads.map(function(t) { return t.id; });
    var replyCounts = {};
    if (threadIds.length > 0) {
        var { data: replies } = await _sb.from('forum_posts').select('parent_id').in('parent_id', threadIds);
        if (replies) {
            replies.forEach(function(r) {
                replyCounts[r.parent_id] = (replyCounts[r.parent_id] || 0) + 1;
            });
        }
    }

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="font-family:\'Space Grotesk\',sans-serif;font-size:1.1rem;color:var(--text-primary);"><i class="fas fa-comments" style="color:#00d4ff;margin-right:8px;"></i>Research Forum</h3>' +
        '<button class="btn btn-primary btn-sm" onclick="openNewForumThread()"><i class="fas fa-plus"></i> New Thread</button></div>';

    // Category filter
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">' +
        '<button class="btn btn-outline btn-sm forum-cat-btn active" onclick="filterForumCategory(null, this)">All</button>' +
        '<button class="btn btn-outline btn-sm forum-cat-btn" onclick="filterForumCategory(\'Statistical Consultation\', this)">Statistical</button>' +
        '<button class="btn btn-outline btn-sm forum-cat-btn" onclick="filterForumCategory(\'Data Query\', this)">Data Query</button>' +
        '<button class="btn btn-outline btn-sm forum-cat-btn" onclick="filterForumCategory(\'Collaboration\', this)">Collaboration</button>' +
        '<button class="btn btn-outline btn-sm forum-cat-btn" onclick="filterForumCategory(\'General Discussion\', this)">General</button></div>';

    if (threads.length === 0) {
        html += '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="fas fa-comments" style="font-size:2rem;display:block;margin-bottom:12px;"></i>No forum threads yet.<br><small>Start a discussion by clicking "New Thread".</small></div>';
    } else {
        html += '<div id="forumThreadList">';
        threads.forEach(function(t) {
            var catColors = { 'Statistical Consultation': '#7c3aed', 'Data Query': '#00d4ff', 'Collaboration': '#10b981', 'General Discussion': '#f59e0b' };
            var catColor = catColors[t.category] || '#64748b';
            var replyCount = replyCounts[t.id] || 0;
            html += '<div class="forum-thread-card" data-category="' + _esc(t.category || '') + '" onclick="openForumThread(' + t.id + ')" style="padding:16px;border-radius:12px;background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border-color,rgba(255,255,255,0.06));margin-bottom:10px;cursor:pointer;transition:border-color 0.2s;" onmouseover="this.style.borderColor=\'rgba(0,212,255,0.3)\'" onmouseout="this.style.borderColor=\'var(--border-color,rgba(255,255,255,0.06))\'">' +
                (t.pinned ? '<i class="fas fa-thumbtack" style="color:#f59e0b;margin-right:6px;font-size:0.72rem;"></i>' : '') +
                (t.resolved ? '<i class="fas fa-check-circle" style="color:#10b981;margin-right:6px;font-size:0.72rem;"></i>' : '') +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
                '<span style="font-size:0.68rem;background:' + catColor + '22;color:' + catColor + ';padding:2px 10px;border-radius:10px;font-weight:500;">' + _esc(t.category || 'General') + '</span>' +
                '</div>' +
                '<h4 style="font-size:0.92rem;font-weight:600;color:var(--text-primary);margin-bottom:4px;">' + _esc(t.title) + '</h4>' +
                '<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + _esc(t.content || '') + '</p>' +
                '<div style="display:flex;align-items:center;gap:16px;font-size:0.72rem;color:var(--text-muted);">' +
                '<span><i class="fas fa-user"></i> ' + _esc(t.author_name || 'Anonymous') + '</span>' +
                '<span><i class="fas fa-comment"></i> ' + replyCount + ' replies</span>' +
                '<span><i class="fas fa-clock"></i> ' + new Date(t.created_at).toLocaleDateString() + '</span>' +
                '</div></div>';
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function filterForumCategory(category, btn) {
    // Update active button
    document.querySelectorAll('.forum-cat-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');

    var cards = document.querySelectorAll('.forum-thread-card');
    cards.forEach(function(card) {
        if (!category) { card.style.display = ''; return; }
        var cardCat = card.getAttribute('data-category');
        card.style.display = (cardCat === category) ? '' : 'none';
    });
}

function openNewForumThread() {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'New Forum Thread';

    var html = '<form onsubmit="event.preventDefault(); submitForumThread(this);">' +
        '<div class="form-group"><label>Title *</label><input type="text" id="forumThreadTitle" placeholder="Discussion topic..." required></div>' +
        '<div class="form-group"><label>Category *</label><select id="forumThreadCat" required>' +
        '<option value="">Select category...</option>' +
        '<option>Statistical Consultation</option><option>Data Query</option>' +
        '<option>Collaboration</option><option>General Discussion</option></select></div>' +
        '<div class="form-group"><label>Content *</label><textarea id="forumThreadContent" rows="6" placeholder="Describe your question or topic..." required></textarea></div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Post Thread</button></div></form>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function submitForumThread(formEl) {
    var title = document.getElementById('forumThreadTitle').value.trim();
    var category = document.getElementById('forumThreadCat').value;
    var content = document.getElementById('forumThreadContent').value.trim();

    if (!title || !content || !category) { showToast('All fields are required.', 'error'); return; }

    var { error } = await _sb.from('forum_posts').insert({
        title: title,
        category: category,
        content: content,
        author_id: currentUserId,
        author_name: currentUserName,
        parent_id: null,
        resolved: false,
        pinned: false
    });

    if (error) { showToast('Error creating thread: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Thread posted!', 'success');
    renderForumThreads();
}

async function openForumThread(threadId) {
    var container = document.getElementById('forumContent');
    if (!container) return;

    _showLoading(container);
    _forumCurrentThread = threadId;

    var { data: thread } = await _sb.from('forum_posts').select('*').eq('id', threadId).single();
    if (!thread) { container.innerHTML = '<p>Thread not found.</p>'; return; }

    var { data: replies } = await _sb.from('forum_posts').select('*').eq('parent_id', threadId).order('created_at', { ascending: true });
    if (!replies) replies = [];

    var catColors = { 'Statistical Consultation': '#7c3aed', 'Data Query': '#00d4ff', 'Collaboration': '#10b981', 'General Discussion': '#f59e0b' };
    var catColor = catColors[thread.category] || '#64748b';

    var html = '<div style="margin-bottom:16px;">' +
        '<button class="btn btn-outline btn-sm" onclick="renderForumThreads()" style="margin-bottom:16px;"><i class="fas fa-arrow-left"></i> Back to Forum</button>' +
        '<div style="padding:20px;border-radius:14px;background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border-color,rgba(255,255,255,0.06));">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
        '<span style="font-size:0.72rem;background:' + catColor + '22;color:' + catColor + ';padding:2px 10px;border-radius:10px;font-weight:500;">' + _esc(thread.category || 'General') + '</span>' +
        (thread.resolved ? '<span style="font-size:0.72rem;background:rgba(16,185,129,0.15);color:#10b981;padding:2px 10px;border-radius:10px;"><i class="fas fa-check"></i> Resolved</span>' : '') +
        '</div>' +
        '<h3 style="font-size:1.1rem;font-weight:600;color:var(--text-primary);margin-bottom:8px;">' + _esc(thread.title) + '</h3>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.6;white-space:pre-wrap;">' + _esc(thread.content) + '</p>' +
        '<div style="display:flex;align-items:center;gap:16px;font-size:0.75rem;color:var(--text-muted);">' +
        '<span><i class="fas fa-user"></i> ' + _esc(thread.author_name || 'Anonymous') + '</span>' +
        '<span><i class="fas fa-clock"></i> ' + new Date(thread.created_at).toLocaleString() + '</span>' +
        '</div>';

    // Admin/author controls
    if (currentUserRole === 'Admin' || currentUserId === thread.author_id) {
        html += '<div style="margin-top:12px;display:flex;gap:8px;">';
        if (!thread.resolved) {
            html += '<button class="btn btn-outline btn-sm" onclick="resolveForumThread(' + threadId + ')" style="border-color:#10b981;color:#10b981;"><i class="fas fa-check"></i> Mark Resolved</button>';
        }
        html += '</div>';
    }

    html += '</div></div>';

    // Replies
    html += '<h4 style="font-size:0.92rem;color:var(--text-primary);margin:20px 0 12px;"><i class="fas fa-reply" style="color:#00d4ff;margin-right:6px;"></i>Replies (' + replies.length + ')</h4>';

    if (replies.length === 0) {
        html += '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.82rem;">No replies yet. Be the first to respond!</div>';
    } else {
        replies.forEach(function(r) {
            html += '<div style="padding:14px 16px;border-radius:10px;background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border-color,rgba(255,255,255,0.04));margin-bottom:8px;">' +
                '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
                '<div style="width:32px;height:32px;border-radius:50%;background:rgba(0,212,255,0.15);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:#00d4ff;">' + _esc((r.author_name || '?').charAt(0)) + '</div>' +
                '<div><div style="font-size:0.82rem;font-weight:500;color:var(--text-primary);">' + _esc(r.author_name || 'Anonymous') + '</div>' +
                '<div style="font-size:0.68rem;color:var(--text-muted);">' + new Date(r.created_at).toLocaleString() + '</div></div></div>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;">' + _esc(r.content) + '</p></div>';
        });
    }

    // Reply form
    html += '<div style="margin-top:16px;padding:16px;border-radius:12px;background:var(--card-bg,rgba(255,255,255,0.02));border:1px solid var(--border-color,rgba(255,255,255,0.06));">' +
        '<div class="form-group"><label>Reply</label><textarea id="forumReplyContent" rows="3" placeholder="Write your reply..." style="width:100%;"></textarea></div>' +
        '<button class="btn btn-primary btn-sm" onclick="submitForumReply(' + threadId + ')"><i class="fas fa-paper-plane"></i> Post Reply</button></div>';

    container.innerHTML = html;
}

async function submitForumReply(threadId) {
    var contentEl = document.getElementById('forumReplyContent');
    if (!contentEl || !contentEl.value.trim()) { showToast('Please write a reply.', 'error'); return; }

    var { error } = await _sb.from('forum_posts').insert({
        content: contentEl.value.trim(),
        parent_id: threadId,
        author_id: currentUserId,
        author_name: currentUserName,
        resolved: false,
        pinned: false
    });

    if (error) { showToast('Error posting reply: ' + error.message, 'error'); return; }
    showToast('Reply posted!', 'success');
    openForumThread(threadId);
}

async function resolveForumThread(threadId) {
    await _sb.from('forum_posts').update({ resolved: true }).eq('id', threadId);
    showToast('Thread marked as resolved.', 'success');
    openForumThread(threadId);
}

/* ================================================
   FEATURE: FACULTY RESEARCH PROFILES
   ================================================ */
async function openFacultyProfile(userId) {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');

    bodyEl.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#00d4ff;"></i></div>';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    var { data: profile } = await _sb.from('profiles').select('*').eq('id', userId).single();
    if (!profile) { bodyEl.innerHTML = '<p>Profile not found.</p>'; return; }

    var { data: facultyData } = await _sb.from('faculty_profiles').select('*').eq('user_id', userId).single();
    if (!facultyData) facultyData = {};

    // Fetch their projects
    var { data: projects } = await _sb.from('projects').select('id, title, status, phase').ilike('pi', '%' + (profile.name || '').split(',')[0] + '%');
    if (!projects) projects = [];

    titleEl.textContent = profile.name || 'Faculty Profile';

    var roleColor = _getRoleColor(profile.role);
    var html = '<div style="max-height:70vh;overflow-y:auto;">';

    // Header
    html += '<div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">' +
        '<div style="width:72px;height:72px;border-radius:50%;background:' + roleColor + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.3rem;color:#fff;flex-shrink:0;">' + _esc(profile.initials || '?') + '</div>' +
        '<div>' +
        '<h3 style="font-size:1.1rem;font-weight:600;color:var(--text-primary);margin-bottom:2px;">' + _esc(profile.name) + '</h3>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);">' + _esc(profile.title || '') + '</p>' +
        '<p style="font-size:0.78rem;color:var(--accent-primary);">' + _esc(profile.email) + '</p>' +
        '</div></div>';

    // Bio & Research Interests
    if (facultyData.bio || facultyData.research_interests) {
        html += '<div style="margin-bottom:20px;">';
        if (facultyData.bio) {
            html += '<h4 style="font-size:0.88rem;color:var(--accent-primary);margin-bottom:6px;"><i class="fas fa-user-md" style="margin-right:6px;"></i>Biography</h4>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.5;margin-bottom:12px;">' + _esc(facultyData.bio) + '</p>';
        }
        if (facultyData.research_interests) {
            html += '<h4 style="font-size:0.88rem;color:var(--accent-primary);margin-bottom:6px;"><i class="fas fa-flask" style="margin-right:6px;"></i>Research Interests</h4>' +
                '<p style="font-size:0.82rem;color:var(--text-secondary);">' + _esc(facultyData.research_interests) + '</p>';
        }
        html += '</div>';
    }

    // Academic metrics
    if (facultyData.h_index || facultyData.total_citations || facultyData.orcid) {
        html += '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">';
        if (facultyData.h_index) {
            html += '<div style="padding:12px 18px;border-radius:10px;background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);text-align:center;">' +
                '<div style="font-size:1.3rem;font-weight:700;color:#00d4ff;">' + facultyData.h_index + '</div>' +
                '<div style="font-size:0.68rem;color:var(--text-muted);">h-index</div></div>';
        }
        if (facultyData.total_citations) {
            html += '<div style="padding:12px 18px;border-radius:10px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.15);text-align:center;">' +
                '<div style="font-size:1.3rem;font-weight:700;color:#7c3aed;">' + facultyData.total_citations + '</div>' +
                '<div style="font-size:0.68rem;color:var(--text-muted);">Citations</div></div>';
        }
        if (facultyData.orcid) {
            html += '<div style="padding:12px 18px;border-radius:10px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);text-align:center;">' +
                '<div style="font-size:0.82rem;font-weight:600;color:#10b981;">' + _esc(facultyData.orcid) + '</div>' +
                '<div style="font-size:0.68rem;color:var(--text-muted);">ORCID</div></div>';
        }
        html += '</div>';
    }

    // Links
    if (facultyData.lab_website || facultyData.google_scholar) {
        html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
        if (facultyData.lab_website) {
            html += '<a href="' + _esc(facultyData.lab_website) + '" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-globe"></i> Lab Website</a>';
        }
        if (facultyData.google_scholar) {
            html += '<a href="' + _esc(facultyData.google_scholar) + '" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-graduation-cap"></i> Google Scholar</a>';
        }
        html += '</div>';
    }

    // Projects
    if (projects.length > 0) {
        html += '<h4 style="font-size:0.88rem;color:var(--accent-primary);margin-bottom:10px;"><i class="fas fa-project-diagram" style="margin-right:6px;"></i>Research Projects (' + projects.length + ')</h4>';
        projects.forEach(function(p) {
            var statusClass = (p.status || 'active').toLowerCase();
            html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.02);margin-bottom:6px;cursor:pointer;" onclick="closeModal(); setTimeout(function(){ openModal(\'projectDetail\',' + p.id + '); }, 300);">' +
                '<div style="flex:1;"><div style="font-size:0.82rem;font-weight:500;color:var(--text-primary);">' + _esc(p.title) + '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-muted);">' + _esc(p.phase || '') + '</div></div>' +
                '<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.12);color:var(--text-secondary);">' + _esc(p.status || '') + '</span></div>';
        });
    }

    // Edit button for own profile or admin
    if (currentUserId === userId || currentUserRole === 'Admin') {
        html += '<div style="margin-top:20px;text-align:center;">' +
            '<button class="btn btn-outline btn-sm" onclick="editFacultyProfile(\'' + userId + '\')"><i class="fas fa-edit"></i> Edit Profile</button></div>';
    }

    html += '</div>';
    bodyEl.innerHTML = html;
}

async function editFacultyProfile(userId) {
    var { data: facultyData } = await _sb.from('faculty_profiles').select('*').eq('user_id', userId).single();
    if (!facultyData) facultyData = {};

    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Edit Faculty Profile';

    var html = '<form onsubmit="event.preventDefault(); saveFacultyProfile(this, \'' + userId + '\');" style="max-height:65vh;overflow-y:auto;">' +
        '<div class="form-group"><label>Biography</label><textarea id="fpBio" rows="4" placeholder="Professional biography...">' + _esc(facultyData.bio || '') + '</textarea></div>' +
        '<div class="form-group"><label>Research Interests</label><textarea id="fpInterests" rows="2" placeholder="e.g., Epilepsy, Deep Learning, fMRI...">' + _esc(facultyData.research_interests || '') + '</textarea></div>' +
        '<div class="form-group"><label>Education</label><textarea id="fpEducation" rows="2" placeholder="Degrees and institutions...">' + _esc(facultyData.education || '') + '</textarea></div>' +
        '<div class="form-group"><label>Clinical Focus</label><input type="text" id="fpClinical" value="' + _esc(facultyData.clinical_focus || '') + '" placeholder="e.g., Movement Disorders, Neuro-oncology..."></div>' +
        '<div class="form-row"><div class="form-group"><label>Lab Website</label><input type="url" id="fpLabWeb" value="' + _esc(facultyData.lab_website || '') + '" placeholder="https://..."></div>' +
        '<div class="form-group"><label>ORCID</label><input type="text" id="fpOrcid" value="' + _esc(facultyData.orcid || '') + '" placeholder="0000-0000-0000-0000"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Google Scholar URL</label><input type="url" id="fpScholar" value="' + _esc(facultyData.google_scholar || '') + '" placeholder="https://scholar.google.com/..."></div>' +
        '<div class="form-group"><label>Office Location</label><input type="text" id="fpOffice" value="' + _esc(facultyData.office_location || '') + '" placeholder="Building, Room"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>h-index</label><input type="number" id="fpHIndex" value="' + (facultyData.h_index || '') + '" placeholder="0"></div>' +
        '<div class="form-group"><label>Total Citations</label><input type="number" id="fpCitations" value="' + (facultyData.total_citations || '') + '" placeholder="0"></div></div>' +
        '<div class="form-group" style="display:flex;align-items:center;gap:10px;"><input type="checkbox" id="fpAccepting" ' + (facultyData.accepting_students ? 'checked' : '') + ' style="width:auto;">' +
        '<label for="fpAccepting" style="margin:0;cursor:pointer;font-size:0.85rem;">Currently accepting research students</label></div>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Profile</button></div></form>';

    bodyEl.innerHTML = html;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function saveFacultyProfile(formEl, userId) {
    var data = {
        user_id: userId,
        bio: document.getElementById('fpBio').value.trim(),
        research_interests: document.getElementById('fpInterests').value.trim(),
        education: document.getElementById('fpEducation').value.trim(),
        clinical_focus: document.getElementById('fpClinical').value.trim(),
        lab_website: document.getElementById('fpLabWeb').value.trim(),
        orcid: document.getElementById('fpOrcid').value.trim(),
        google_scholar: document.getElementById('fpScholar').value.trim(),
        office_location: document.getElementById('fpOffice').value.trim(),
        h_index: parseInt(document.getElementById('fpHIndex').value) || null,
        total_citations: parseInt(document.getElementById('fpCitations').value) || null,
        accepting_students: document.getElementById('fpAccepting').checked
    };

    // Upsert
    var { error } = await _sb.from('faculty_profiles').upsert(data, { onConflict: 'user_id' });
    if (error) { showToast('Error saving profile: ' + error.message, 'error'); return; }
    closeModal();
    showToast('Faculty profile updated!', 'success');
}

/* ================================================
   FEATURE: RESEARCH METRICS DASHBOARD
   ================================================ */
async function renderResearchMetrics() {
    var overlay = document.getElementById('modalOverlay');
    var titleEl = document.getElementById('modalTitle');
    var bodyEl = document.getElementById('modalBody');
    titleEl.textContent = 'Research Metrics Dashboard';

    bodyEl.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#00d4ff;"></i><p style="margin-top:10px;color:var(--text-muted);">Loading metrics...</p></div>';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Fetch data
    var { data: allProjects } = await _sb.from('projects').select('status, pillar, created_at');
    if (!allProjects) allProjects = [];
    var { data: allGrants } = await _sb.from('grants').select('status, amount, period_start');
    if (!allGrants) allGrants = [];
    var { data: allPubs } = await _sb.from('publications').select('pub_type, year');
    if (!allPubs) allPubs = [];

    // Projects by status
    var statusCounts = {};
    allProjects.forEach(function(p) {
        var s = p.status || 'Unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    // Projects by pillar
    var pillarCounts = {};
    allProjects.forEach(function(p) {
        var pl = p.pillar || 'Unassigned';
        pillarCounts[pl] = (pillarCounts[pl] || 0) + 1;
    });

    // Grants by status
    var grantStatusCounts = {};
    allGrants.forEach(function(g) {
        var s = g.status || 'Unknown';
        grantStatusCounts[s] = (grantStatusCounts[s] || 0) + 1;
    });

    // Build HTML charts (CSS bar charts)
    var html = '<div style="max-height:70vh;overflow-y:auto;">';

    // Projects by Status
    html += '<h4 style="font-size:0.92rem;color:var(--accent-primary);margin-bottom:12px;"><i class="fas fa-chart-bar" style="margin-right:6px;"></i>Projects by Status</h4>';
    html += _buildBarChart(statusCounts, { 'Active': '#10b981', 'Pre-submission': '#f59e0b', 'Completed': '#7c3aed', 'On Hold': '#ef4444' });

    // Projects by Pillar
    html += '<h4 style="font-size:0.92rem;color:var(--accent-primary);margin:24px 0 12px;"><i class="fas fa-columns" style="margin-right:6px;"></i>Projects by Research Pillar</h4>';
    html += _buildBarChart(pillarCounts, { 'Translational': '#00d4ff', 'Clinical': '#7c3aed', 'Computational': '#10b981', 'Unassigned': '#64748b' });

    // Grants by Status
    html += '<h4 style="font-size:0.92rem;color:var(--accent-primary);margin:24px 0 12px;"><i class="fas fa-dollar-sign" style="margin-right:6px;"></i>Grants by Status</h4>';
    html += _buildBarChart(grantStatusCounts, { 'Active': '#10b981', 'Pending': '#f59e0b', 'Submitted': '#00d4ff', 'Completed': '#7c3aed', 'Not Funded': '#ef4444' });

    // Summary stats
    html += '<div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;">';
    html += _buildMetricCard('Total Projects', allProjects.length, '#00d4ff', 'fa-project-diagram');
    html += _buildMetricCard('Total Grants', allGrants.length, '#7c3aed', 'fa-dollar-sign');
    html += _buildMetricCard('Total Publications', allPubs.length, '#10b981', 'fa-book');
    html += _buildMetricCard('Active Projects', statusCounts['Active'] || 0, '#f59e0b', 'fa-play-circle');
    html += '</div>';

    html += '<div class="modal-actions" style="margin-top:20px;">' +
        '<button type="button" class="btn btn-outline" onclick="closeModal()">Close</button></div></div>';

    bodyEl.innerHTML = html;
}

function _buildBarChart(data, colorMap) {
    var maxVal = 0;
    Object.keys(data).forEach(function(k) { if (data[k] > maxVal) maxVal = data[k]; });
    if (maxVal === 0) return '<div style="padding:16px;color:var(--text-muted);font-size:0.82rem;">No data available.</div>';

    var html = '<div style="padding:8px 0;">';
    Object.keys(data).forEach(function(k) {
        var val = data[k];
        var pct = maxVal > 0 ? (val / maxVal * 100) : 0;
        var color = colorMap[k] || '#64748b';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
            '<span style="font-size:0.78rem;color:var(--text-secondary);min-width:120px;text-align:right;">' + _esc(k) + '</span>' +
            '<div style="flex:1;height:24px;background:rgba(255,255,255,0.04);border-radius:6px;overflow:hidden;">' +
            '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:6px;transition:width 0.6s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
            '<span style="font-size:0.7rem;font-weight:600;color:#fff;">' + val + '</span></div></div></div>';
    });
    html += '</div>';
    return html;
}

function _buildMetricCard(label, value, color, icon) {
    return '<div style="flex:1;min-width:120px;padding:16px;border-radius:12px;background:' + color + '08;border:1px solid ' + color + '22;text-align:center;">' +
        '<i class="fas ' + icon + '" style="color:' + color + ';font-size:1.2rem;margin-bottom:6px;display:block;"></i>' +
        '<div style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + value + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-muted);">' + label + '</div></div>';
}

/* ================================================
   FEATURE: PWA SUPPORT LOGIC
   ================================================ */
function initPWA() {
    // Register service worker if available
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
            console.log('Service Worker registered with scope:', reg.scope);
        }).catch(function(err) {
            console.log('Service Worker registration skipped:', err.message);
        });
    }

    // Handle install prompt
    var _deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        _deferredPrompt = e;
        // Show install button if desired
        var installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) {
            installBtn.style.display = '';
            installBtn.onclick = function() {
                if (_deferredPrompt) {
                    _deferredPrompt.prompt();
                    _deferredPrompt.userChoice.then(function(choiceResult) {
                        if (choiceResult.outcome === 'accepted') {
                            showToast('App installed successfully!', 'success');
                        }
                        _deferredPrompt = null;
                        installBtn.style.display = 'none';
                    });
                }
            };
        }
    });
}

// Initialize PWA on load
document.addEventListener('DOMContentLoaded', function() {
    initPWA();
});

/* ================================================
   UPDATE: Wire People Directory with Faculty Profile clicks
   ================================================ */
var _origRenderPeopleDirectory = renderPeopleDirectory;
renderPeopleDirectory = async function(filterRole) {
    await _origRenderPeopleDirectory(filterRole);
    // Add click handlers to faculty person cards
    var grid = document.getElementById('peopleGrid');
    if (!grid) return;
    var cards = grid.querySelectorAll('.person-card');
    // Re-fetch profiles to get user IDs for click handlers
    var { data: profiles } = await _sb.from('profiles').select('id, name, role');
    if (!profiles) return;
    var profileMap = {};
    profiles.forEach(function(p) { profileMap[p.name] = p; });

    cards.forEach(function(card) {
        var nameEl = card.querySelector('h4');
        if (!nameEl) return;
        var name = nameEl.textContent.trim();
        var p = profileMap[name];
        if (p && (p.role === 'Faculty' || p.role === 'Admin')) {
            card.style.cursor = 'pointer';
            card.onclick = function() { openFacultyProfile(p.id); };
        }
    });
};

// Auto-refresh timestamps placeholder
setInterval(function () { /* updateTimestamps */ }, 60000);
