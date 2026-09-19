/* ============================================================
   RailSync operator authentication (frontend gate)

   - The operator username + password live ONLY on the backend
     (backend/main.py -> OPERATOR_USERNAME / OPERATOR_PASSWORD,
     POST /auth/operator/verify). This file never contains them.
   - After the backend confirms the credentials, we store a
     simple "1" flag in sessionStorage (per tab/session only).
   - Passenger pages intercept clicks to operator pages and
     show the login modal instead of navigating directly.
   - Operator pages call protectOperatorPage() on load, so a
     refresh or a directly-entered URL still requires auth.
   - To upgrade later: make /auth/operator/verify return a
     signed token and send it on operator write calls, instead
     of relying on this sessionStorage flag for page gating.
   ============================================================ */

(function () {
    console.log('RailSync auth.js loaded');
    var AUTH_KEY = 'railsync_operator_auth';
    var OPERATOR_PAGES = [
        'operator.html',
        'events.html',
        'simulation.html',
        'analytics.html'
    ];

    function apiBase() {
        try {
            if (typeof RAILSYNC_API_BASE !== 'undefined' && RAILSYNC_API_BASE) {
                return RAILSYNC_API_BASE;
            }
        } catch (e) { /* fall through to default */ }
        if (typeof window !== 'undefined' && window.RAILSYNC_API_BASE) {
            return window.RAILSYNC_API_BASE;
        }
        return 'http://127.0.0.1:8000';
    }

    function isOperatorAuthenticated() {
        try {
            return sessionStorage.getItem(AUTH_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setOperatorAuthenticated() {
        try {
            sessionStorage.setItem(AUTH_KEY, '1');
        } catch (e) { /* storage unavailable: gate will re-ask */ }
    }

    function clearOperatorAuth() {
        try {
            sessionStorage.removeItem(AUTH_KEY);
        } catch (e) { /* ignore */ }
    }

    function pageOf(href) {
        if (!href) {
            return '';
        }
        return String(href).split('#')[0].split('?')[0];
    }

    function isOperatorPage(href) {
        var page = pageOf(href);
        // Match "operator.html" as well as "./operator.html" / "/operator.html".
        return OPERATOR_PAGES.some(function (name) {
            return page === name || page.slice(-name.length - 1) === '/' + name;
        });
    }

    function currentPageName() {
        try {
            return pageOf(location.pathname.split('/').pop());
        } catch (e) {
            return '';
        }
    }

    // Real route check: this app is one static HTML file per route,
    // so the requested FILENAME is the route (not just data-view).
    function isCurrentPageOperator() {
        if (isOperatorPage(currentPageName())) {
            return true;
        }
        return !!(document.body && document.body.dataset &&
            document.body.dataset.view === 'operator');
    }

    function lockOperatorContent() {
        if (document.body && !isOperatorAuthenticated()) {
            document.body.classList.add('auth-locked');
        }
    }

    function unlockOperatorContent() {
        if (document.body) {
            document.body.classList.remove('auth-locked');
        }
    }

    // Lock immediately at parse time (this script sits at the end of
    // <body>, before first paint) so a directly-opened operator page
    // never flashes its dashboard before the login modal appears.
    try {
        if (isCurrentPageOperator()) {
            lockOperatorContent();
        }
    } catch (e) { /* DOM not ready: DOMContentLoaded handler retries */ }

    async function verifyViaBackend(username, password) {
        var res = await fetch(apiBase() + '/auth/operator/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        });
        if (res.ok) {
            return true;
        }
        var err = {};
        try {
            err = await res.json();
        } catch (e) { /* non-JSON error body */ }
        if (res.status === 401) {
            throw new Error(err.detail || 'Invalid username or password');
        }
        throw new Error(err.detail || 'Backend unavailable. Is FastAPI running?');
    }

    function showOperatorAuthModal(options) {
        options = options || {};
        var gateMode = options.mode === 'gate';
        var nextUrl = options.nextUrl || 'operator.html';

        var content =
            '<h2>Operator Login</h2>' +
            '<p class="muted" style="margin:0 0 14px">Enter your operator credentials to continue.</p>' +
            '<form onsubmit="return submitOperatorAuth(event)">' +
            '<label class="field">Username' +
            '<input id="operatorUsername" type="text" placeholder="Enter operator username" autocomplete="username" required>' +
            '</label>' +
            '<label class="field" style="margin-top:10px">Password' +
            '<input id="operatorPassword" type="password" placeholder="Enter operator password" autocomplete="current-password" required>' +
            '</label>' +
            '<label class="muted" style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:13px;font-weight:600;cursor:pointer">' +
            '<input type="checkbox" id="operatorShowPassword" onchange="toggleOperatorPassword()"> Show password' +
            '</label>' +
            '<p class="auth-error" id="operatorAuthError" role="alert" style="display:none"></p>' +
            '<div class="actions">' +
            '<button type="submit" class="btn" id="operatorAuthSubmit">Login</button>' +
            '<button type="button" class="btn ghost" onclick="cancelOperatorAuth()">Cancel</button>' +
            '</div></form>';

        UI.modal('operatorAuth', content);

        var back = document.getElementById('operatorAuth');
        // Visibility fallback: if the shared CSS (.modal-back.open)
        // did not make the modal visible (e.g. stale/cached CSS),
        // force it visible inline so login is never silently skipped.
        if (back) {
            back.classList.add('open');
            try {
                var shown = window.getComputedStyle(back).display !== 'none' &&
                    back.getBoundingClientRect().width > 0;
                if (!shown) {
                    back.style.display = 'flex';
                    back.style.position = 'fixed';
                    back.style.inset = '0';
                    back.style.zIndex = '9999';
                    back.style.alignItems = 'center';
                    back.style.justifyContent = 'center';
                    back.style.background = 'rgba(9,18,40,.56)';
                    var box = back.querySelector('.modal');
                    if (box) {
                        box.style.background = '#fff';
                        box.style.borderRadius = '16px';
                        box.style.padding = '24px';
                        box.style.maxWidth = '550px';
                        box.style.width = '100%';
                    }
                }
            } catch (e) { /* computed style unavailable: keep .open class */ }
        }
        if (back) {
            // Store flow context on the backdrop element itself.
            back.dataset.mode = gateMode ? 'gate' : 'navigate';
            back.dataset.next = nextUrl;
            if (gateMode) {
                // The shared UI.modal() closes on backdrop click.
                // On a directly-opened operator page that would expose
                // the dashboard, so send the user back instead.
                back.addEventListener('click', function (e) {
                    if (!isOperatorAuthenticated() &&
                        (e.target === back || e.target.hasAttribute('data-close'))) {
                        location.href = 'passenger.html';
                    }
                });
            }
        }

        var userInput = document.getElementById('operatorUsername');
        var passInput = document.getElementById('operatorPassword');
        if (userInput) {
            // Focus username first after the modal is painted.
            setTimeout(function () { userInput.focus(); }, 50);
            [userInput, passInput].forEach(function (input) {
                if (input) {
                    input.addEventListener('input', function () {
                        var errBox = document.getElementById('operatorAuthError');
                        if (errBox) {
                            errBox.style.display = 'none';
                        }
                    });
                }
            });
        }
    }

    function toggleOperatorPassword() {
        var passInput = document.getElementById('operatorPassword');
        var checkbox = document.getElementById('operatorShowPassword');
        if (passInput && checkbox) {
            passInput.type = checkbox.checked ? 'text' : 'password';
        }
    }

    function requestOperatorAccess(nextUrl) {
        if (isOperatorAuthenticated()) {
            location.href = nextUrl || 'operator.html';
            return;
        }
        showOperatorAuthModal({ mode: 'navigate', nextUrl: nextUrl || 'operator.html' });
    }

    function protectOperatorPage() {
        if (isOperatorAuthenticated()) {
            return;
        }
        showOperatorAuthModal({ mode: 'gate', nextUrl: location.pathname.split('/').pop() || 'operator.html' });
    }

    async function submitOperatorAuth(event) {
        if (event) {
            event.preventDefault();
        }
        var userInput = document.getElementById('operatorUsername');
        var passInput = document.getElementById('operatorPassword');
        var errBox = document.getElementById('operatorAuthError');
        var submitBtn = document.getElementById('operatorAuthSubmit');
        var back = document.getElementById('operatorAuth');
        var username = userInput ? userInput.value.trim() : '';
        var password = passInput ? passInput.value : '';

        if (!username && !password) {
            if (errBox) {
                errBox.textContent = 'Please enter your username and password.';
                errBox.style.display = 'block';
            }
            return false;
        }
        if (!username) {
            if (errBox) {
                errBox.textContent = 'Please enter your username.';
                errBox.style.display = 'block';
            }
            if (userInput) {
                userInput.focus();
            }
            return false;
        }
        if (!password) {
            if (errBox) {
                errBox.textContent = 'Please enter your password.';
                errBox.style.display = 'block';
            }
            if (passInput) {
                passInput.focus();
            }
            return false;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verifying…';
        }

        try {
            await verifyViaBackend(username, password);
        } catch (err) {
            if (errBox) {
                errBox.textContent = err && err.message
                    ? err.message
                    : 'Invalid username or password';
                errBox.style.display = 'block';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
            if (passInput) {
                passInput.focus();
                passInput.select();
            }
            return false;
        }

        setOperatorAuthenticated();
        unlockOperatorContent();
        if (back) {
            back.classList.remove('open');
        }
        var next = (back && back.dataset.next) || 'operator.html';
        var isGate = back && back.dataset.mode === 'gate';
        // In gate mode we are already on an operator page: just close
        // the modal and stay. In navigate mode, go to the target page.
        if (!isGate && pageOf(next) !== pageOf(location.pathname.split('/').pop())) {
            location.href = next;
        }
        return false;
    }

    function cancelOperatorAuth() {
        var back = document.getElementById('operatorAuth');
        var isGate = back && back.dataset.mode === 'gate';
        if (back) {
            back.classList.remove('open');
        }
        if (isGate) {
            // Cancel on a directly-opened operator page returns
            // to the Passenger Dashboard.
            location.href = 'passenger.html';
        }
        return false;
    }

    function operatorLogout() {
        clearOperatorAuth();
        location.href = 'passenger.html';
        return false;
    }

    // Intercept EVERY navigation to an operator page while
    // unauthenticated. Capture phase (third arg true) so this runs
    // before any other handler and navigation is stopped first.
    // Covers: nav "Switch to Operator" button (injected by ui.js),
    // hero "Operator Dashboard" button, operator nav links, and any
    // plain <a href="operator.html|events.html|..."> in page HTML.
    function interceptNav(e) {
        var anchor = e.target && e.target.closest
            ? e.target.closest('a[href]')
            : null;
        if (!anchor) {
            return;
        }
        var href = anchor.getAttribute('href');
        if (!href || href.charAt(0) === '#') {
            return;
        }
        if (!isOperatorPage(href)) {
            return;
        }
        if (isOperatorAuthenticated()) {
            return; // allow normal navigation within the session
        }
        e.preventDefault();
        e.stopPropagation();
        console.log('RailSync: operator navigation intercepted, login required');
        requestOperatorAccess(href);
    }
    document.addEventListener('click', interceptNav, true);
    // Middle-click opens links via auxclick (no click event fires),
    // so block that vector too; the new tab would have no session
    // auth anyway and its own gate would trigger there.
    document.addEventListener('auxclick', interceptNav, true);

    // Gate operator pages against refresh / direct-URL access.
    // Decided by the real route (filename) + data-view, and the
    // content stays locked (body.auth-locked) until login.
    document.addEventListener('DOMContentLoaded', function () {
        if (isCurrentPageOperator()) {
            if (isOperatorAuthenticated()) {
                unlockOperatorContent();
            } else {
                lockOperatorContent();
                console.log('RailSync: operator page locked, login required');
                protectOperatorPage();
            }
        }
    });

    window.RailSyncAuth = {
        isOperatorAuthenticated: isOperatorAuthenticated,
        requestOperatorAccess: requestOperatorAccess,
        protectOperatorPage: protectOperatorPage,
        clearOperatorAuth: clearOperatorAuth
    };
    window.requestOperatorAccess = requestOperatorAccess;
    window.submitOperatorAuth = submitOperatorAuth;
    window.cancelOperatorAuth = cancelOperatorAuth;
    window.toggleOperatorPassword = toggleOperatorPassword;
    window.operatorLogout = operatorLogout;
})();
