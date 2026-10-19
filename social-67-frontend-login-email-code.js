/* 67 Social frontend additions — load AFTER the existing page script.
   Before publishing, replace TURNSTILE_SITE_KEY with the Cloudflare Turnstile
   site key for 67.shiraali.ir. The matching secret must be set as the Worker
   secret TURNSTILE_SECRET_KEY. */
(() => {
  'use strict';
  const API = 'https://social67.shiraali.ir';
  const TURNSTILE_SITE_KEY = '0x4AAAAAAFZ561QShBA6Mxo1';
  const $ = id => document.getElementById(id);
  const status = (el, text, good = false) => {
    if (!el) return;
    el.textContent = text;
    el.style.color = good ? '#198754' : '#d93025';
  };
  const makeStatus = (id, after, initial = '') => {
    let el = $(id);
    if (!el) {
      el = document.createElement('div'); el.id = id; el.className = 'hint';
      el.setAttribute('role', 'status');
      after.insertAdjacentElement('afterend', el);
    }
    if (initial) el.textContent = initial;
    return el;
  };
  const jsonFetch = async (path, options = {}) => {
    const response = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const e = new Error(data.error || 'request_failed'); e.data = data; e.status = response.status; throw e;
    }
    return data;
  };
  const translateError = code => ({
    gmail_only: 'فقط نشانی‌های @gmail.com پذیرفته می‌شوند.',
    invalid_email: 'ساختار ایمیل معتبر نیست.',
    email_unavailable: 'یک حساب کاربری یا درخواست ثبت‌نام با این ایمیل وجود دارد.',
    username_unavailable: 'این نام کاربری قبلاً انتخاب شده یا رزرو است.',
    invalid_username: 'نام کاربری باید ۳ تا ۹ حرف یا عدد انگلیسی داشته باشد و حداقل یک حرف انگلیسی داشته باشد.',
    invalid_password: 'رمز عبور باید بین ۸ تا ۱۵ کاراکتر باشد.',
    turnstile_failed: 'اعتبارسنجی ضدربات انجام نشد؛ لطفاً دوباره تلاش کنید.',
    email_send_failed: 'ارسال ایمیل انجام نشد. تنظیمات ارسال ایمیل را بررسی کنید.',
    email_rate_limited: 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.',
    invalid_credentials: 'نام کاربری/ایمیل یا رمز عبور نادرست است.',
    invalid_or_expired_token: 'این لینک نامعتبر یا منقضی شده است.',
    invalid_verification_code: 'کد تأیید نادرست است. کد ایمیل را دقیق وارد کنید.',
    verification_code_expired: 'کد تأیید منقضی شده یا دیگر معتبر نیست؛ کد تازه درخواست کنید.',
    verification_code_locked: 'به‌دلیل تلاش‌های ناموفق، این کد قفل شده است؛ کد تازه درخواست کنید.',
    login_code_required: 'برای ورود باید کد ایمیلی را وارد کنید.',
    signup_expired: 'مهلت ثبت‌نام تمام شده است؛ دوباره ثبت‌نام کنید.',
    signup_completion_conflict: 'تکمیل ثبت‌نام با وضعیت حساب سازگار نبود. اگر حساب ساخته شده باشد، می‌توانید وارد شوید؛ در غیر این صورت کد تازه درخواست کنید.'
  })[code] || 'درخواست انجام نشد. لطفاً دوباره تلاش کنید.';

  // Turnstile widgets are created dynamically; do not silently bypass them.
  const loadTurnstile = () => new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    if (
      !TURNSTILE_SITE_KEY ||
      TURNSTILE_SITE_KEY === 'PUT_YOUR_TURNSTILE_SITE_KEY_HERE'
    ) {
      return reject(new Error('کلید عمومی Cloudflare Turnstile تنظیم نشده است.'));
    }
    const existing = document.querySelector('script[data-turnstile-loader]');
    if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.defer = true; script.dataset.turnstileLoader = '1';
    script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  const widgetTokens = { signup: '', login: '' };
  const widgetIds = { signup: null, login: null };
  const setupWidget = async (formId, kind) => {
    const form = $(formId); if (!form) return;
    let holder = $('turnstile-' + kind);
    if (!holder) {
      holder = document.createElement('div'); holder.id = 'turnstile-' + kind;
      holder.className = 'field';
      const title = document.createElement('span'); title.textContent = 'بررسی امنیتی Cloudflare';
      const target = document.createElement('div'); target.id = 'turnstile-target-' + kind;
      holder.append(title, target); form.querySelector('button[type="submit"]')?.before(holder);
    }
    try {
      await loadTurnstile();
      if (holder.dataset.rendered) return;
      widgetIds[kind] = window.turnstile.render('#turnstile-target-' + kind, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: token => { widgetTokens[kind] = token; },
        'expired-callback': () => { widgetTokens[kind] = ''; },
        'error-callback': () => { widgetTokens[kind] = ''; }
      });
      holder.dataset.rendered = '1';
    } catch (e) {
      const msg = makeStatus('turnstile-error-' + kind, holder);
      status(msg, e.message || 'بارگذاری بررسی امنیتی ممکن نشد.');
    }
  };
  setupWidget('signupForm', 'signup');
  setupWidget('loginForm', 'login');

  // Add live, independent username/email checks.
  const userInput = $('username'), emailInput = $('email');
  let userTimer, emailTimer, userSeq = 0, emailSeq = 0;
  const userStatus = userInput && makeStatus('usernameAvailability', userInput);
  const emailStatus = emailInput && makeStatus('emailAvailability', emailInput);
  if (userInput) userInput.addEventListener('input', () => {
    clearTimeout(userTimer); const value = userInput.value.trim().toLowerCase(); const seq = ++userSeq;
    if (!/^[a-z][a-z0-9]{2,8}$/.test(value)) { status(userStatus, '✕ نام کاربری باید ۳ تا ۹ کاراکتر باشد و با حرف انگلیسی شروع شود.'); return; }
    status(userStatus, 'در حال بررسی…', true);
    userTimer = setTimeout(async () => {
      try { const r = await jsonFetch('/check-username?username=' + encodeURIComponent(value)); if (seq !== userSeq) return;
        status(userStatus, r.available ? '✓ این نام کاربری آزاد است.' : '✕ این نام کاربری در دسترس نیست.', !!r.available);
      } catch { if (seq === userSeq) status(userStatus, 'بررسی نام کاربری فعلاً ممکن نیست.'); }
    }, 350);
  });
  if (emailInput) emailInput.addEventListener('input', () => {
    clearTimeout(emailTimer); const value = emailInput.value.trim().toLowerCase(); const seq = ++emailSeq;
    if (!/^[^\s@]+@gmail\.com$/i.test(value)) { status(emailStatus, 'فقط ایمیل معتبر @gmail.com مجاز است.'); return; }
    status(emailStatus, 'در حال بررسی…', true);
    emailTimer = setTimeout(async () => {
      try { const r = await jsonFetch('/check-email?email=' + encodeURIComponent(value)); if (seq !== emailSeq) return;
        status(emailStatus, r.available ? '✓ این ایمیل در سایت استفاده نشده است.' : '✕ یک حساب یا ثبت‌نام در انتظار تأیید با این ایمیل وجود دارد.', !!r.available);
      } catch { if (seq === emailSeq) status(emailStatus, 'بررسی ایمیل فعلاً ممکن نیست.'); }
    }, 350);
  });

  // Add the separate password-recovery page and links.
  const loginForm = $('loginForm');
  if (loginForm && !$('forgotPasswordButton')) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'forgotPasswordButton';
    b.className = 'text-button'; b.textContent = 'فراموشی رمز عبور';
    loginForm.insertAdjacentElement('afterend', b);
    b.addEventListener('click', () => showRecoveryPage());
  }
  function showRecoveryPage() {
    let page = $('passwordRecoveryPage');
    if (!page) {
      page = document.createElement('section'); page.id = 'passwordRecoveryPage'; page.className = 'page';
      page.innerHTML = `<div class="panel"><h1>فراموشی رمز عبور</h1><p class="subtitle">نام کاربری و ایمیل ثبت‌شده را وارد کنید. اگر هر دو با یک حساب تطبیق داشته باشند، لینک بازنشانی ارسال می‌شود.</p><form id="passwordRecoveryForm"><label class="field"><span>نام کاربری</span><input id="recoveryUsername" autocomplete="username" required minlength="3" maxlength="9"></label><label class="field"><span>ایمیل Gmail</span><input id="recoveryEmail" type="email" autocomplete="email" required></label><button class="btn" type="submit">ارسال لینک بازنشانی</button><div class="message" id="recoveryMessage" role="status"></div></form><button class="text-button" id="recoveryBack">بازگشت به ورود</button></div>`;
      document.querySelector('.app').appendChild(page);
      page.querySelector('#passwordRecoveryForm').addEventListener('submit', async ev => {
        ev.preventDefault(); const msg = $('recoveryMessage');
        try { await jsonFetch('/request-password-reset', {method:'POST', body:JSON.stringify({username:$('recoveryUsername').value.trim().toLowerCase(),email:$('recoveryEmail').value.trim().toLowerCase()})});
          status(msg, 'اگر نام کاربری و ایمیل با یک حساب مطابقت داشته باشند، لینک بازنشانی ارسال می‌شود.', true);
        } catch { status(msg, 'درخواست ارسال نشد؛ کمی بعد دوباره تلاش کنید.'); }
      });
      page.querySelector('#recoveryBack').addEventListener('click', () => { page.classList.remove('active'); $('loginPage')?.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); });
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    page.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});
  }

  // Signup email verification uses a 6-digit code entered on this website; no signup link is opened.
  const signupForm = $('signupForm');
  let verificationPage, verificationEmailInput, verificationCodeInput, verificationMessage, verificationReturnPage;
  function showVerificationPage(email='') {
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage !== verificationPage) verificationReturnPage = currentPage;
    if (!verificationPage) {
      verificationPage = document.createElement('section');
      verificationPage.id = 'signupVerificationPage'; verificationPage.className = 'page';
      verificationPage.innerHTML = `<div class="panel"><h1>تأیید ایمیل</h1><p class="subtitle">کد ۶ رقمی ارسال‌شده به ایمیل Gmail را وارد کنید. کد تا ۱۵ دقیقه معتبر است.</p><form id="signupVerificationForm"><label class="field"><span>ایمیل</span><input id="verificationEmail" type="email" autocomplete="email" required></label><label class="field"><span>کد تأیید ۶ رقمی</span><input id="signupVerificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button class="btn" type="submit">تأیید کد و تکمیل ثبت‌نام</button><div class="message" id="verificationMessage" role="status"></div></form><button class="text-button" id="resendSignupCode" type="button">ارسال دوبارهٔ کد</button><button class="text-button" id="verificationBack" type="button">بازگشت</button></div>`;
      document.querySelector('.app').appendChild(verificationPage);
      verificationEmailInput = $('verificationEmail'); verificationCodeInput = $('signupVerificationCode'); verificationMessage = $('verificationMessage');
      $('signupVerificationForm').addEventListener('submit', async ev => {
        ev.preventDefault();
        const email = verificationEmailInput.value.trim().toLowerCase();
        const code = verificationCodeInput.value.trim();
        if (!/^[^\s@]+@gmail\.com$/i.test(email)) return status(verificationMessage, 'فقط ایمیل @gmail.com مجاز است.');
        if (!/^\d{6}$/.test(code)) return status(verificationMessage, 'کد باید دقیقاً ۶ رقم باشد.');
        try {
          const data = await jsonFetch('/verify-email', {method:'POST', body:JSON.stringify({email,code})});
          try { if (data.user) sessionStorage.setItem('67-social-user', JSON.stringify(data.user)); } catch {}
          status(verificationMessage, 'ایمیل تأیید شد. حالا اطلاعات پروفایل خود را تکمیل کنید.', true);
          verificationCodeInput.value = '';
          setTimeout(() => {
            verificationPage.classList.remove('active');
            if ($('profileSetupPage')) {
              if ($('fullName')) $('fullName').value = data.user?.display_name || $('username')?.value || '';
              if ($('avatarPreview') && data.user?.avatar_id) $('avatarPreview').textContent = data.user.avatar_id;
              if (data.user?.avatar_id) { const av = [...document.querySelectorAll('#avatarChoices .avatar-option')].find(b => b.textContent === data.user.avatar_id); av?.click(); }
              $('accountButton') && ($('accountButton').hidden = false);
              document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
              $('profileSetupPage').classList.add('active');
            } else $('loginPage')?.classList.add('active');
            window.scrollTo({top:0,behavior:'smooth'});
          }, 500);
        } catch (e) { status(verificationMessage, translateError(e.message)); }
      });
      $('resendSignupCode').addEventListener('click', async () => {
        const email = verificationEmailInput.value.trim().toLowerCase();
        if (!/^[^\s@]+@gmail\.com$/i.test(email)) return status(verificationMessage, 'ابتدا ایمیل معتبر @gmail.com را وارد کنید.');
        try { await jsonFetch('/resend-signup-code', {method:'POST', body:JSON.stringify({email})}); status(verificationMessage, 'اگر ثبت‌نامی در انتظار تأیید باشد، کد تازه ارسال می‌شود. صندوق ورودی و هرزنامه را بررسی کنید.', true); verificationCodeInput.value=''; }
        catch (e) { status(verificationMessage, translateError(e.message)); }
      });
      $('verificationBack').addEventListener('click', () => { verificationPage.classList.remove('active'); (verificationReturnPage || $('signupPage') || $('loginPage'))?.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); });
    }
    verificationEmailInput.value = email || verificationEmailInput.value || '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    verificationPage.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});
  }
  if (signupForm) {
    const enterCode = document.createElement('button'); enterCode.type='button'; enterCode.className='text-button'; enterCode.textContent='قبلاً ثبت‌نام کرده‌اید؟ ورود کد تأیید ایمیل';
    signupForm.insertAdjacentElement('afterend', enterCode);
    enterCode.addEventListener('click', () => showVerificationPage(emailInput?.value.trim().toLowerCase() || ''));
    signupForm.addEventListener('submit', async ev => {
      ev.preventDefault(); ev.stopImmediatePropagation();
      const msg = $('signupMessage');
      const username = userInput.value.trim().toLowerCase(), email = emailInput.value.trim().toLowerCase();
      const password = $('password').value, confirm = $('confirmPassword').value;
      if (!/^[a-z][a-z0-9]{2,8}$/.test(username)) return status(msg, 'نام کاربری باید ۳ تا ۹ کاراکتر انگلیسی و عدد داشته باشد و با حرف شروع شود.');
      if (!/^[^\s@]+@gmail\.com$/i.test(email)) return status(msg, 'فقط ایمیل @gmail.com مجاز است.');
      if (password.length < 8 || password.length > 15) return status(msg, 'رمز عبور باید بین ۸ تا ۱۵ کاراکتر باشد.');
      if (password !== confirm) return status(msg, 'رمز عبور و تکرار آن یکسان نیستند.');
      if (!widgetTokens.signup) return status(msg, 'ابتدا بررسی امنیتی Cloudflare را تکمیل کنید.');
      const display = $('fullName')?.value.trim() || username;
      const avatar = document.querySelector('#avatarChoices .selected')?.textContent || '🙂';
      try {
        await jsonFetch('/signup', {method:'POST', body:JSON.stringify({username,email,password,display_name:display,avatar_id:avatar,turnstile_token:widgetTokens.signup})});
        widgetTokens.signup = ''; if (window.turnstile) window.turnstile.reset(widgetIds.signup);
        showVerificationPage(email);
        status(verificationMessage, 'کد تأیید به ایمیل شما ارسال شد. صندوق ورودی و پوشهٔ هرزنامه را بررسی کنید.', true);
      } catch (e) {
        status(msg, translateError(e.message)); if (window.turnstile) window.turnstile.reset(widgetIds.signup); widgetTokens.signup = '';
      }
    }, true);
  }

  let loginVerificationPage, loginCodeInput, loginCodeMessage, loginEmailInput;
  function showLoginCodePage(email='') {
    if (!loginVerificationPage) {
      loginVerificationPage = document.createElement('section');
      loginVerificationPage.id = 'loginVerificationPage'; loginVerificationPage.className = 'page';
      loginVerificationPage.innerHTML = `<div class="panel"><h1>تأیید ورود</h1><p class="subtitle">کد ۶ رقمی ارسال‌شده به ایمیل را وارد کنید. کد تا ۱۵ دقیقه معتبر است.</p><form id="loginVerificationForm"><label class="field"><span>ایمیل</span><input id="loginVerificationEmail" type="email" autocomplete="email" required readonly></label><label class="field"><span>کد تأیید ۶ رقمی</span><input id="loginVerificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button class="btn" type="submit">تأیید کد و ورود</button><div class="message" id="loginVerificationMessage" role="status"></div></form><button class="text-button" id="loginCodeBack" type="button">بازگشت به ورود</button></div>`;
      document.querySelector('.app').appendChild(loginVerificationPage);
      loginEmailInput = $('loginVerificationEmail'); loginCodeInput = $('loginVerificationCode'); loginCodeMessage = $('loginVerificationMessage');
      $('loginVerificationForm').addEventListener('submit', async ev => {
        ev.preventDefault();
        const email = loginEmailInput.value.trim().toLowerCase(), code = loginCodeInput.value.trim();
        if (!/^\d{6}$/.test(code)) return status(loginCodeMessage, 'کد باید دقیقاً ۶ رقم باشد.');
        try {
          const data = await jsonFetch('/verify-login-code', {method:'POST', body:JSON.stringify({email,code})});
          try { if (data.user) sessionStorage.setItem('67-social-user', JSON.stringify(data.user)); } catch {}
          status(loginCodeMessage, 'ورود با موفقیت انجام شد.', true);
          loginCodeInput.value = '';
          setTimeout(() => {
            loginVerificationPage.classList.remove('active');
            if ($('profileSetupPage') && data.user && (!data.user.display_name || data.user.display_name === data.user.username)) {
              $('fullName').value = data.user.display_name || data.user.username;
              document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
              $('profileSetupPage').classList.add('active');
            } else {
              $('accountButton') && ($('accountButton').hidden = false);
              document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
              $('timelinePage')?.classList.add('active');
              if (typeof window.social67LoadFeed === 'function') window.social67LoadFeed();
            }
            window.scrollTo({top:0,behavior:'smooth'});
          }, 450);
        } catch (e) { status(loginCodeMessage, translateError(e.message)); }
      });
      $('loginCodeBack').addEventListener('click', () => { loginVerificationPage.classList.remove('active'); $('loginPage')?.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); });
    }
    loginEmailInput.value = email;
    loginCodeInput.value = '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    loginVerificationPage.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'});
  }


  // Persist profile setup (display name, avatar, bio) before entering the timeline.
  const profileForm = $('profileForm');
  if (profileForm) profileForm.addEventListener('submit', async ev => {
    ev.preventDefault(); ev.stopImmediatePropagation();
    const display_name = $('fullName')?.value.trim() || '';
    const bio = $('bio')?.value.trim() || '';
    const avatar_id = $('avatarPreview')?.textContent || '🙂';
    const msg = makeStatus('profileSaveMessage', profileForm);
    if (!display_name) return status(msg, 'نام نمایشی را وارد کنید.');
    try {
      const data = await jsonFetch('/profile', {method:'POST', body:JSON.stringify({display_name,avatar_id,bio})});
      try { sessionStorage.setItem('67-social-user', JSON.stringify(data.user)); } catch {}
      status(msg, 'پروفایل ذخیره شد.', true);
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      $('accountButton') && ($('accountButton').hidden = false);
      $('timelinePage')?.classList.add('active');
      if (typeof window.social67LoadFeed === 'function') window.social67LoadFeed();
      window.scrollTo({top:0,behavior:'smooth'});
    } catch (e) { status(msg, translateError(e.message)); }
  }, true);

  const editProfileForm = $('editProfileForm');
  if (editProfileForm) editProfileForm.addEventListener('submit', async ev => {
    ev.preventDefault(); ev.stopImmediatePropagation();
    const display_name = $('editFullName')?.value.trim() || '';
    const bio = $('editBio')?.value.trim() || '';
    const avatar_id = [...document.querySelectorAll('#editAvatarChoices .avatar-option.selected')][0]?.textContent || $('avatarPreview')?.textContent || '🙂';
    const msg = $('editMessage');
    try {
      const data = await jsonFetch('/profile', {method:'POST', body:JSON.stringify({display_name,avatar_id,bio})});
      try { sessionStorage.setItem('67-social-user', JSON.stringify(data.user)); } catch {}
      status(msg, 'تغییرات پروفایل ذخیره شد.', true);
      if ($('publicName')) $('publicName').textContent = display_name;
      if ($('publicBio')) $('publicBio').textContent = bio;
      if ($('publicAvatar')) $('publicAvatar').textContent = avatar_id;
    } catch (e) { status(msg, translateError(e.message)); }
  }, true);

  if (loginForm) loginForm.addEventListener('submit', async ev => {
    ev.preventDefault(); ev.stopImmediatePropagation();
    const msg = $('loginMessage');
    if (!widgetTokens.login) return status(msg, 'ابتدا بررسی امنیتی Cloudflare را تکمیل کنید.');
    try {
      const data = await jsonFetch('/request-login-code', {method:'POST', body:JSON.stringify({identifier:$('loginIdentifier').value.trim(),password:$('loginPassword').value,turnstile_token:widgetTokens.login})});
      status(msg, 'کد تأیید به ایمیل حساب ارسال شد.', true);
      showLoginCodePage(data.email || $('loginIdentifier').value.trim().toLowerCase());
    } catch (e) { status(msg, translateError(e.message)); }
    finally { widgetTokens.login = ''; if (window.turnstile) window.turnstile.reset(widgetIds.login); }
  }, true);

})();
