window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
(function () {
  var tabs = document.querySelectorAll('.tabs a');
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      if (tab.dataset.tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      }
    });
  });

  document.querySelectorAll('.pw-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.dataset.target);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'HIDE';
      } else {
        input.type = 'password';
        btn.textContent = 'SHOW';
      }
    });
  });

  function showNotice(elId, msg) {
    var el = document.getElementById(elId);
    if (el) el.textContent = msg;
  }
  function setLoading(btnId, on, defaultText) {
    var b = document.getElementById(btnId);
    b.disabled = on;
    b.textContent = on ? '處理中…' : defaultText;
  }

  document.getElementById('btnLogin').addEventListener('click', function () {
    var id = document.getElementById('loginId').value.trim();
    var pw = document.getElementById('password').value;
    if (!id || !pw) {
      showNotice('loginNotice', '請填寫帳號與密碼');
      return;
    }

    setLoading('btnLogin', true, '進入後台');
    fetch('/api/agency/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: id, password: pw }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        setLoading('btnLogin', false, '進入後台');
        if (data.pending) {
          showNotice('loginNotice', '申請仍在審核中，請稍候通知');
          return;
        }
        if (data.rejected) {
          showNotice('loginNotice', '申請未通過，請聯絡雫旅');
          return;
        }
        if (!data.success) {
          showNotice('loginNotice', data.message || '帳號或密碼錯誤');
          return;
        }
        sessionStorage.setItem('agency_token', data.token);
        sessionStorage.setItem('agency_name', data.displayName || '');
        if (data.mustChangePassword) {
          sessionStorage.setItem('agency_must_change_pw', '1');
        } else {
          sessionStorage.removeItem('agency_must_change_pw');
        }
        window.location.replace('/handshake/dashboard');
      })
      .catch(function () {
        setLoading('btnLogin', false, '進入後台');
        showNotice('loginNotice', '連線失敗，請稍後再試');
      });
  });

  document.getElementById('password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
  });

  document.getElementById('btnRegister').addEventListener('click', function () {
    var id = document.getElementById('regLoginId').value.trim();
    var pw = document.getElementById('regPassword').value;
    var name = document.getElementById('regDisplayName').value.trim();
    if (!id || !pw || !name) {
      showNotice('registerNotice', '請填寫所有欄位');
      return;
    }

    setLoading('btnRegister', true, '申請加入');
    fetch('/api/agency/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: id, password: pw, displayName: name }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        setLoading('btnRegister', false, '申請加入');
        if (!data.success) {
          showNotice('registerNotice', data.message || '申請失敗');
          return;
        }
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('pendingScreen').style.display = 'block';
      })
      .catch(function () {
        setLoading('btnRegister', false, '申請加入');
        showNotice('registerNotice', '連線失敗，請稍後再試');
      });
  });

  document.getElementById('btnBackToLogin').addEventListener('click', function () {
    document.getElementById('pendingScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'block';
    tabs[0].click();
  });
})();
