window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});

(function () {
  var loginEl = document.getElementById('loginId');
  var pwEl    = document.getElementById('password');
  var btn     = document.getElementById('btnEnter');
  var notice  = document.getElementById('notice');
  var toggle  = document.getElementById('pwToggle');

  toggle.addEventListener('click', function () {
    if (pwEl.type === 'password') {
      pwEl.type = 'text';
      toggle.textContent = 'HIDE';
    } else {
      pwEl.type = 'password';
      toggle.textContent = 'SHOW';
    }
  });

  [loginEl, pwEl].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });
  });

  btn.addEventListener('click', function () {
    var id = (loginEl.value || '').trim();
    var pw = pwEl.value || '';
    if (!id || !pw) {
      showNotice('請輸入帳號與密碼');
      return;
    }

    setLoading(true);
    fetch('/api/drift/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId: id, password: pw }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        setLoading(false);
        if (!data || !data.token) {
          showNotice(data && data.error ? data.error : '帳號或密碼錯誤');
          pwEl.select();
          return;
        }
        sessionStorage.setItem('admin_key', data.token);
        window.location.replace('/notforyou/home');
      })
      .catch(function () {
        setLoading(false);
        showNotice('連線失敗，請稍後再試');
      });
  });

  function setLoading(on) {
    btn.disabled    = on;
    btn.textContent = on ? '驗證中…' : '踏進雫旅';
  }
  function showNotice(msg) {
    notice.textContent = msg;
  }

  if (sessionStorage.getItem('admin_key')) {
    window.location.replace('/notforyou/home');
  }
})();
