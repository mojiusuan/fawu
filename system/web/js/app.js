/**
 * 智能法务系统 · 前端应用逻辑
 *
 * 注意：登录等核心认证功能定义在最顶部，确保后续任何代码错误都不会导致登录按钮失效。
 */
const API = window.location.origin;

// =========== 认证管理（最高优先级） ===========
let authToken = localStorage.getItem('legal_auth_token') || null;
let currentUser = JSON.parse(localStorage.getItem('legal_auth_user') || 'null');

const ROLE_LABELS = { admin:'系统管理员', legal:'法务人员', business:'业务人员', auditor:'审计员' };

function getAuthHeaders() {
  return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('legal_auth_token');
  localStorage.removeItem('legal_auth_user');
}

function showLoginOverlay(msg) {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
  if (msg) {
    const err = document.getElementById('login-error');
    if (err) { err.style.display = 'block'; err.textContent = msg; }
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
  const err = document.getElementById('login-error');
  if (err) err.style.display = 'none';
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-error').textContent = '请输入用户名和密码';
    return;
  }
  try {
    const resp = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || '登录失败');
    }
    const data = await resp.json();
    authToken = data.access_token;
    currentUser = data.user;
    localStorage.setItem('legal_auth_token', authToken);
    localStorage.setItem('legal_auth_user', JSON.stringify(currentUser));
    hideLoginOverlay();
    if (typeof applyRoleUI === 'function') applyRoleUI();
    if (typeof showToast === 'function') showToast('欢迎回来，'+currentUser.display_name, 'success');
    if (typeof loadContracts === 'function') loadContracts();
    if (typeof loadChatHistory === 'function') loadChatHistory();
    if (typeof loadAudit === 'function') loadAudit();
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof loadKGStats === 'function') loadKGStats();
  } catch(e) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-error').textContent = e.message;
  }
}

function doLogout() {
  if (typeof saveChatToStorage === 'function') saveChatToStorage();
  clearAuth();
  showLoginOverlay();
  if (typeof closeSidebar === 'function') closeSidebar();
  if (typeof showToast === 'function') showToast('已退出登录', 'info');
}

// =========== GSAP 动画系统（安全回退） ===========
// CDN 可能加载失败（尤其国内网络），回退为无动画模式以保证核心功能可用
(function() {
var _gsapOk = typeof gsap !== 'undefined';
if (!_gsapOk) {
  var _noop = function(){};
  window.gsap = { registerPlugin:_noop, matchMedia:function(){ return {add:_noop}; }, set:_noop, from:_noop, fromTo:_noop, to:_noop, timeline:function(){ return {to:_noop, fromTo:_noop}; } };
  window.ScrollTrigger = { create:_noop, batch:_noop, refresh:_noop, getAll:function(){ return []; } };
}
try { gsap.registerPlugin(ScrollTrigger); } catch(e) { console.warn('GSAP plugin registration failed, animations disabled'); }
})();

const ANIM = {
  _reduced: false,
  _mm: null,

  init() {
    this._mm = gsap.matchMedia();
    this._mm.add("(prefers-reduced-motion: reduce)", (ctx) => {
      this._reduced = ctx.conditions.reduceMotion;
    });
    this._setupNavHover();
    this._setupHomeCards();
    this._setupScrollReveal();
  },

  pageTransition(fromEl, toEl) {
    if (this._reduced || !fromEl) { if (toEl) gsap.set(toEl, { autoAlpha: 1 }); return; }
    const tl = gsap.timeline({ defaults: { duration: 0.2, ease: "power2.out" } });
    tl.to(fromEl, { autoAlpha: 0, scale: 0.98 })
      .fromTo(toEl, { autoAlpha: 0, scale: 1.02 }, { autoAlpha: 1, scale: 1, duration: 0.25 }, "-=0.1");
  },

  toastEnter(el) {
    if (this._reduced) { el.style.opacity = "1"; return null; }
    return gsap.fromTo(el, { x: 120, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, ease: "back.out(1.4)" });
  },
  toastExit(el, onComplete) {
    if (this._reduced) { el.remove(); onComplete?.(); return; }
    gsap.to(el, { x: 80, autoAlpha: 0, duration: 0.25, ease: "power2.in", onComplete });
  },

  chatMsgEnter(el, role) {
    if (this._reduced) return;
    const x = role === "user" ? 30 : -30;
    gsap.fromTo(el, { x, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out" });
  },

  expanderToggle(body, open) {
    if (this._reduced) { body.style.display = open ? "block" : "none"; return; }
    if (open) {
      body.style.display = "block";
      const h = body.scrollHeight;
      gsap.fromTo(body, { height: 0, autoAlpha: 0 }, { height: h, autoAlpha: 1, duration: 0.3, ease: "power2.out", onComplete: () => { body.style.height = "auto"; } });
    } else {
      const curH = body.scrollHeight;
      body.style.height = curH + "px";
      body.style.overflow = "hidden";
      gsap.to(body, { height: 0, autoAlpha: 0, duration: 0.2, ease: "power2.in", onComplete: () => { body.style.display = "none"; body.style.height = ""; } });
    }
  },

  animateCounter(el, target, decimals = 0) {
    if (this._reduced) { el.textContent = target.toFixed(decimals); return; }
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => { el.textContent = obj.val.toFixed(decimals); }
    });
  },

  animateAuditCounters() {
    if (this._reduced) return;
    const cards = document.querySelectorAll("#page-audit .stat-card .value");
    cards.forEach(card => {
      const text = card.textContent;
      const num = parseFloat(text);
      if (isNaN(num)) return;
      const isPercent = text.includes("%");
      ScrollTrigger.create({
        trigger: card,
        start: "top 85%",
        once: true,
        onEnter: () => this.animateCounter(card, num, isPercent ? 1 : 0)
      });
    });
  },

  _setupNavHover() {
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("mouseenter", () => {
        if (this._reduced) return;
        gsap.to(item, { x: 4, duration: 0.2, ease: "power2.out" });
      });
      item.addEventListener("mouseleave", () => {
        if (this._reduced) return;
        gsap.to(item, { x: 0, duration: 0.2, ease: "power2.out" });
      });
    });
  },

  _setupHomeCards() {
    if (this._reduced) return;
    const cards = document.querySelectorAll("#page-home .stat-card");
    if (!cards.length) return;
    ScrollTrigger.batch(cards, {
      start: "top 85%",
      once: true,
      onEnter: (elements) => {
        gsap.fromTo(elements, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.12, duration: 0.5, ease: "power2.out" });
      }
    });
  },

  _setupScrollReveal() {
    if (this._reduced) return;
    ScrollTrigger.batch(".card, .stat-card, .table-wrap", {
      start: "top 92%",
      once: true,
      onEnter: (elements) => {
        gsap.fromTo(elements, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.4, ease: "power2.out" });
      }
    });
  },

  refresh() { ScrollTrigger.refresh(); },
  killAll() { ScrollTrigger.getAll().forEach(t => t.kill()); }
};

// =========== 认证管理 ===========
const ROLE_PAGE_PERMISSIONS = {
  home: ['admin','legal','business','auditor'],
  'case-center': ['admin','legal','business','auditor'],
  'case-analysis': ['admin','legal','business','auditor'],
  contract: ['admin','legal','business'],
  consultation: ['admin','legal','business','auditor'],
  kg: ['admin','legal'],
  templates: ['admin','legal','business','auditor'],
  calculators: ['admin','legal','business','auditor'],
  evidence: ['admin','legal','business','auditor'],
  audit: ['admin','auditor'],
  rpa: ['admin','legal'],
  settings: ['admin'],
};

// =========== 导航 ===========
function initNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      navigateTo(page);
      // 移动端：导航后关闭侧边栏
      closeSidebar();
    });
  });
}

function navigateTo(page) {
  if (currentUser) {
    const allowed = ROLE_PAGE_PERMISSIONS[page] || [];
    if (!allowed.includes(currentUser.role)) {
      showToast('您没有访问此页面的权限', 'error');
      return;
    }
  }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

  const current = document.querySelector('.page-section.active');
  const section = document.getElementById(`page-${page}`);
  if (!section) return;
  if (current === section) return;

  if (current) {
    ANIM.pageTransition(current, section);
    current.classList.remove('active');
  }
  section.classList.add('active');
  window.location.hash = page;

  // 设置页自动加载
  if (page === 'settings') { loadSettings(); loadUsers(); loadKBStatus(); }

  requestAnimationFrame(() => ANIM.refresh());
}

// =========== 移动端侧边栏 ===========
function initMobileMenu() {
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    }
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
}

// =========== 自定义确认对话框 ===========
let _confirmCallback = null;

function confirmDialog(message, callback, title = '确认操作') {
  _confirmCallback = callback;
  document.getElementById('confirm-dialog-title').textContent = title;
  document.getElementById('confirm-dialog-message').textContent = message;
  document.getElementById('confirm-dialog-overlay').style.display = 'flex';
  document.getElementById('confirm-dialog-ok').focus();
}

function closeConfirmDialog() {
  document.getElementById('confirm-dialog-overlay').style.display = 'none';
  _confirmCallback = null;
}

function initConfirmDialog() {
  document.getElementById('confirm-dialog-ok')?.addEventListener('click', () => {
    document.getElementById('confirm-dialog-overlay').style.display = 'none';
    if (_confirmCallback) { _confirmCallback(); _confirmCallback = null; }
  });
  document.getElementById('confirm-dialog-cancel')?.addEventListener('click', closeConfirmDialog);
  document.getElementById('confirm-dialog-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConfirmDialog();
  });
}

// =========== 标签页 ===========
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    tabGroup.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const parent = tab.closest('.page-section');
        tabGroup.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        parent.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        const target = parent.querySelector(`.tab-content[data-tab="${tab.dataset.tab}"]`);
        if (target) target.style.display = 'block';
      });
    });
  });
}

// =========== 展开面板 ===========
function initExpanders() {
  document.querySelectorAll('.expander-header').forEach(header => {
    const clone = header.cloneNode(true);
    header.parentNode.replaceChild(clone, header);
    clone.addEventListener('click', () => {
      const expander = clone.parentElement;
      const body = expander.querySelector('.expander-body');
      if (!body) return;
      const willOpen = !expander.classList.contains('open');
      expander.classList.toggle('open');
      ANIM.expanderToggle(body, willOpen);
    });
  });
}

// =========== Toast 通知 ===========
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);

  const tween = ANIM.toastEnter(el);
  const hide = () => {
    ANIM.toastExit(el, () => el.remove());
  };
  el.addEventListener('click', () => { tween?.kill(); hide(); });
  setTimeout(hide, duration);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// =========== API 辅助 ===========
async function api(path, options = {}) {
  const url = `${API}${path}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
  };
  const merged = { ...defaults, ...options };
  if (options.headers) {
    merged.headers = { ...defaults.headers, ...options.headers };
  }
  const resp = await fetch(url, merged);
  if (resp.status === 401) {
    clearAuth();
    showLoginOverlay('登录已过期，请重新登录');
    throw new Error('登录已过期');
  }
  if (!resp.ok) {
    const text = await resp.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j.detail || j.message || text; } catch(e) {}
    throw new Error(msg);
  }
  return resp.json();
}

// =========== 认证操作（续） ===========
// 注意：doLogin / doLogout / clearAuth / showLoginOverlay / hideLoginOverlay 已在文件顶部定义

function applyRoleUI() {
  if (!currentUser) return;

  const userInfo = document.getElementById('user-info');
  if (userInfo) userInfo.style.display = 'block';
  const displayName = document.getElementById('user-display-name');
  if (displayName) displayName.textContent = currentUser.display_name;
  const roleTag = document.getElementById('user-role-tag');
  if (roleTag) roleTag.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;

  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    const page = el.dataset.page;
    const allowedRoles = ROLE_PAGE_PERMISSIONS[page] || [];
    if (allowedRoles.includes(currentUser.role)) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  const hashPage = window.location.hash.replace('#', '') || 'home';
  const allowed = ROLE_PAGE_PERMISSIONS[hashPage] || [];
  if (!allowed.includes(currentUser.role)) {
    navigateTo('home');
  }
}

function initAuth() {
  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  if (!authToken || !currentUser) {
    showLoginOverlay();
  } else {
    applyRoleUI();
    fetch(`${API}/api/auth/me`, {
      headers: getAuthHeaders()
    }).then(resp => {
      if (!resp.ok) { clearAuth(); showLoginOverlay('登录已过期，请重新登录'); }
    }).catch(() => {});
  }
}

// =========== 状态检测 ===========
async function checkStatus() {
  try {
    const resp = await fetch(`${API}/api/health`);
    if (resp.ok) {
      document.querySelector('#status-indicator')?.classList.replace('offline', 'online');
      document.querySelector('#status-indicator')?.setAttribute('aria-label', '服务运行中');
      document.querySelector('#status-text') && (document.querySelector('#status-text').textContent = '服务运行中');
    }
  } catch (e) {}
}

// =========== 合同管理 ===========
// 文件拖拽上传
function initContractFileUpload() {
  const dropZone = document.getElementById('contract-file-drop');
  const fileInput = document.getElementById('contract-file-input');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processContractFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processContractFile(file);
  });
}

async function processContractFile(file) {
  const fileName = document.getElementById('contract-file-name');
  const contentArea = document.getElementById('contract-content');

  // 尝试从文件名推断合同名称
  const titleInput = document.getElementById('contract-title');
  if (!titleInput.value.trim()) {
    titleInput.value = file.name.replace(/\.(docx|pdf|txt)$/i, '');
  }

  fileName.style.display = 'block';
  fileName.textContent = `正在解析文件: ${file.name}...`;

  try {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API}/api/rpa/extract`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!resp.ok) throw new Error('文件解析失败');
    const result = await resp.json();

    // 从提取结果中获取信息
    if (result.contract_title && !document.getElementById('contract-title').value.trim()) {
      document.getElementById('contract-title').value = result.contract_title;
    }
    if (result.party_a) document.getElementById('contract-party-a').value = result.party_a;
    if (result.party_b) document.getElementById('contract-party-b').value = result.party_b;

    // 对于 TXT 文件，直接用提取的内容；其他格式尝试从结果重建
    if (file.name.endsWith('.txt')) {
      const text = await file.text();
      contentArea.value = text;
    } else {
      // 重建合同文本
      let text = '';
      if (result.contract_title) text += `合同名称: ${result.contract_title}\n`;
      if (result.party_a) text += `甲方: ${result.party_a}\n`;
      if (result.party_b) text += `乙方: ${result.party_b}\n`;
      if (result.amount) text += `金额: ${result.amount}\n`;
      if (result.deadline) text += `期限: ${result.deadline}\n`;
      if (result.dispute_resolution) text += `争议解决: ${result.dispute_resolution}\n`;
      text += `\n请将完整合同文本粘贴到此处进行审查`;
      contentArea.value = text;
    }

    fileName.textContent = `文件解析完成: ${file.name}`;
    showToast('文件解析完成，已自动填充合同信息', 'success');
  } catch (e) {
    fileName.textContent = `解析失败: ${e.message}`;
    showToast(`文件解析失败: ${e.message}`, 'error');
    // 兜底：TXT 直接读
    if (file.name.endsWith('.txt')) {
      try {
        const text = await file.text();
        contentArea.value = text;
        fileName.textContent = `已读取文本: ${file.name}`;
      } catch(_) {}
    }
  }
}

async function uploadContract() {
  const data = {
    title: document.getElementById('contract-title').value,
    contract_type: document.getElementById('contract-type').value,
    content: document.getElementById('contract-content').value,
    party_a: document.getElementById('contract-party-a').value,
    party_b: document.getElementById('contract-party-b').value,
  };
  if (!data.content.trim()) { showToast('请输入合同正文或上传文件', 'warning'); return; }
  try {
    const result = await api('/api/contracts/upload', { method: 'POST', body: JSON.stringify(data) });
    showToast(`上传成功: ${data.title || result.id}`, 'success');
    document.getElementById('review-contract-id').value = result.id;
    document.getElementById('compare-contract-a-id').value = result.id;
    loadContracts();
  } catch (e) { showToast(`上传失败: ${e.message}`, 'error'); }
}

async function reviewContract() {
  const id = document.getElementById('review-contract-id').value.trim();
  if (!id) { showToast('请输入合同 ID', 'warning'); return; }
  const btn = document.getElementById('review-btn');
  const progress = document.getElementById('review-progress');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 审查中...';

  const stages = ['正在解析合同条款...', '正在检索相关法律依据...', '正在分析风险等级...', '正在生成审查意见...'];
  let stageIdx = 0;
  progress.style.display = 'flex';
  progress.innerHTML = `<span class="spinner"></span> ${stages[0]}`;
  const stageTimer = setInterval(() => {
    stageIdx++;
    if (stageIdx < stages.length) {
      progress.innerHTML = `<span class="spinner"></span> ${stages[stageIdx]}`;
    }
  }, 3000);

  try {
    const result = await api(`/api/contracts/review/${id}`, { method: 'POST' });
    clearInterval(stageTimer);
    progress.style.display = 'none';
    document.getElementById('review-stats').innerHTML = `
      <div class="stat-card"><div class="icon">🔴</div><div class="value">${result.high_risks || 0}</div><div class="label">高风险</div></div>
      <div class="stat-card"><div class="icon">🟡</div><div class="value">${result.medium_risks || 0}</div><div class="label">中风险</div></div>
      <div class="stat-card"><div class="icon">🟢</div><div class="value">${result.low_risks || 0}</div><div class="label">低风险</div></div>
    `;
    const clausesHtml = (result.clauses || []).map(c => {
      const icons = {high:'🔴',medium:'🟡',low:'🟢',none:'⚪'};
      return `<div class="expander"><div class="expander-header">${icons[c.risk_level]||'⚪'} ${c.clause_number||'条款'} <span class="expander-arrow">▼</span></div>
        <div class="expander-body">
          ${c.content ? `<p style="color:var(--text-secondary);margin-bottom:.5rem">原文: ${c.content.substring(0,400)}</p>` : ''}
          ${c.risk_analysis ? `<div style="margin-top:.4rem">${renderMarkdown(c.risk_analysis)}</div>` : ''}
          ${c.law_basis ? `<p style="margin-top:.4rem"><strong>法律依据:</strong> <code>${c.law_basis}</code></p>` : ''}
          ${c.suggestion ? `<div style="margin-top:.4rem"><strong>修改建议:</strong><div>${renderMarkdown(c.suggestion)}</div></div>` : ''}
        </div></div>`;
    }).join('');
    document.getElementById('review-clauses').innerHTML = clausesHtml;
    if (result.suggestions) {
      document.getElementById('review-summary').innerHTML = `
        <div style="display:flex;justify-content:flex-end;margin-top:1rem"><button class="btn btn-accent btn-sm" onclick="exportReview('${id}')">📥 导出 Word</button></div>
        <div class="card" style="margin-top:.5rem">${renderMarkdown(result.suggestions)}</div>`;
    }
    initExpanders();
    showToast('审查完成', 'success');
    loadContracts();
  } catch (e) {
    clearInterval(stageTimer);
    progress.style.display = 'none';
    showToast(`审查失败: ${e.message}`, 'error');
  }
  finally { btn.disabled = false; btn.innerHTML = '🔍 开始审查'; }
}

async function compareContracts() {
  const a = document.getElementById('compare-contract-a-id').value.trim();
  const b = document.getElementById('compare-contract-b-id').value.trim();
  if (!a || !b) { showToast('请输入两份合同 ID', 'warning'); return; }
  try {
    const result = await api('/api/contracts/compare', { method: 'POST', body: JSON.stringify({ contract_a_id: a, contract_b_id: b }) });
    document.getElementById('compare-stats').innerHTML = `
      <div class="stat-card"><div class="value">${result.total_clauses||0}</div><div class="label">总条款</div></div>
      <div class="stat-card"><div class="value">${result.identical||0}</div><div class="label">一致</div></div>
      <div class="stat-card"><div class="value">${result.formal_diff||0}</div><div class="label">形式差异</div></div>
      <div class="stat-card"><div class="value">${result.substantive_diff||0}</div><div class="label">实质性差异</div></div>
    `;
    const names = {'identical':'一致','formal':'形式差异','substantive':'实质性差异'};
    const diffsHtml = (result.differences||[]).filter(d=>d.type!=='identical').map(d =>
      `<div class="expander"><div class="expander-header">${d.clause||'条款'} — ${names[d.type]||d.type} <span class="expander-arrow">▼</span></div>
        <div class="expander-body">${d.detail||''} ${d.favor ? '(对'+d.favor+'有利)' : ''}</div></div>`
    ).join('');
    document.getElementById('compare-diffs').innerHTML = diffsHtml || '<p style="color:var(--text-muted)">未发现实质性差异</p>';
    initExpanders();
  } catch (e) { showToast(`比对失败: ${e.message}`, 'error'); }
}

async function generateContract() {
  const data = {
    contract_type: document.getElementById('gen-type').value,
    party_a: document.getElementById('gen-pa').value,
    party_b: document.getElementById('gen-pb').value,
    key_terms: document.getElementById('gen-terms').value,
  };
  try {
    const result = await api('/api/contracts/generate', { method: 'POST', body: JSON.stringify(data) });
    const genContent = result.content;
    const genTitle = (data.contract_type || '合同') + '.docx';
    document.getElementById('gen-result').innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:.5rem"><button class="btn btn-accent btn-sm" id="gen-export-btn">📥 导出 Word</button></div><div class="card" style="font-size:.9rem;line-height:1.8;margin-top:.5rem">${renderMarkdown(genContent)}</div>`;
    document.getElementById('gen-export-btn').onclick = () => downloadGenerated(genTitle, genContent);
    showToast('合同草案已生成', 'success');
  } catch (e) { showToast(`生成失败: ${e.message}`, 'error'); }
}

// =========== 智能咨询 (含持久化 + 打字动画) ===========
const CHAT_STORAGE_KEY = 'legal_chat_history';
let chatHistory = [];
let chatRendered = 0;

function saveChatToStorage() {
  if (chatHistory.length > 0) {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatHistory));
    } catch(e) {}
  }
}

function loadChatFromStorage() {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      chatHistory = JSON.parse(saved);
      chatRendered = 0;
      return true;
    }
  } catch(e) {}
  return false;
}

async function askQuestion() {
  const q = document.getElementById('chat-input').value.trim();
  if (!q) return;
  const scope = document.getElementById('chat-scope').value;

  chatHistory.push({ role: 'user', content: q });
  renderChat();
  document.getElementById('chat-input').value = '';
  saveChatToStorage();

  // 显示打字指示器
  const typingEl = document.getElementById('typing-indicator');
  if (typingEl) typingEl.style.display = 'flex';
  const area = document.getElementById('chat-area');
  if (area) area.scrollTop = area.scrollHeight;

  try {
    const result = await api('/api/consultation/ask', { method: 'POST', body: JSON.stringify({ question: q, source_type: scope }) });
    if (typingEl) typingEl.style.display = 'none';
    chatHistory.push({ role: 'assistant', content: result.answer, law_basis: result.law_basis || [], search_results: result.search_results || [], disclaimer: result.disclaimer });
    renderChat();
    saveChatToStorage();
  } catch (e) {
    if (typingEl) typingEl.style.display = 'none';
    chatHistory.push({ role: 'assistant', content: `请求失败: ${e.message}。请确保后端服务已启动。` });
    renderChat();
  }
}

function renderChat() {
  const area = document.getElementById('chat-area');
  if (chatHistory.length === 0) {
    area.innerHTML = `<div class="chat-empty">
      <div class="chat-empty-icon">⚖️</div>
      <div class="chat-empty-title">欢迎使用智能法律咨询</div>
      <div class="chat-empty-desc">我是您的 AI 法律助手 <strong>法小智</strong>，基于中国法律法规知识库为您提供 7×24 小时咨询服务。</div>
      <div class="chat-empty-hints">
        <div class="chat-hint" onclick="document.getElementById('chat-input').value='公司拖欠工资怎么办？';document.getElementById('chat-input').focus()">💬 公司拖欠工资怎么办？</div>
        <div class="chat-hint" onclick="document.getElementById('chat-input').value='借钱不还怎么起诉？';document.getElementById('chat-input').focus()">💬 借钱不还怎么起诉？</div>
        <div class="chat-hint" onclick="document.getElementById('chat-input').value='签合同要注意哪些条款？';document.getElementById('chat-input').focus()">💬 签合同要注意哪些条款？</div>
      </div>
    </div>`;
    chatRendered = 0;
    return;
  }
  let exportBtn = chatHistory.length ? '<div style="text-align:right;margin-bottom:.5rem"><button class="btn btn-outline btn-sm" onclick="exportChat()">📥 导出对话</button></div>' : '';
  area.innerHTML = exportBtn + chatHistory.map((m, idx) => {
    let body = m.role === 'assistant' ? renderMarkdown(m.content) : `<div class="chat-user-text">${m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
    let extra = '';
    if (m.law_basis?.length) extra += `<details class="chat-details"><summary class="chat-details-summary">📚 引用法律依据（${m.law_basis.length}条）</summary><div class="chat-details-body">${m.law_basis.map(b=>`<div class="law-basis-item">📜 ${b}</div>`).join('')}</div></details>`;
    if (m.search_results?.length) extra += `<details class="chat-details"><summary class="chat-details-summary">🔍 检索来源（${m.search_results.length}条）</summary><div class="chat-details-body">${m.search_results.map(r=>`<div class="search-result-item"><span class="search-result-source">${r.source||''}</span> ${r.article||''}<span class="search-result-relevance"> · ${r.relevance||'中'}</span></div>`).join('')}</div></details>`;
    if (m.disclaimer) extra += `<div class="chat-disclaimer">⚠ ${m.disclaimer}</div>`;
    const avatar = m.role === 'user' ? '👤' : '⚖️';
    const name = m.role === 'user' ? '您' : '法小智';
    return `<div class="chat-msg ${m.role}" data-chat-idx="${idx}">
      <div class="chat-msg-avatar">${avatar}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name">${name}</div>
        <div class="chat-msg-content">${body}</div>
        ${extra}
      </div>
    </div>`;
  }).join('');

  const newStart = chatRendered;
  chatRendered = chatHistory.length;
  if (newStart < chatHistory.length) {
    requestAnimationFrame(() => {
      const msgs = area.querySelectorAll('.chat-msg');
      msgs.forEach((el) => {
        const idx = parseInt(el.dataset.chatIdx);
        if (idx >= newStart) {
          ANIM.chatMsgEnter(el, chatHistory[idx].role);
        }
      });
    });
  }

  area.scrollTop = area.scrollHeight;
}

function clearChat() {
  confirmDialog('确定要清空当前对话吗？此操作不可恢复。', () => {
    chatHistory = [];
    chatRendered = 0;
    localStorage.removeItem(CHAT_STORAGE_KEY);
    renderChat();
    showToast('对话已清空', 'info');
  }, '清空对话');
}

async function exportReview(contractId) {
  try {
    const resp = await fetch(`${API}/api/export/contract-review/${contractId}`, { headers: getAuthHeaders() });
    if (!resp.ok) { const e = await resp.json(); showToast(e.error||'导出失败','error'); return; }
    const blob = await resp.blob();
    if (blob.size < 100) { showToast('导出内容为空，请先审查合同','warning'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `审查报告_${contractId}.docx`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url); showToast('下载成功','success');
  } catch(e) { showToast('导出失败: '+e.message,'error'); }
}

async function downloadGenerated(filename, content) {
  try {
    const resp = await fetch(`${API}/api/export/contract-draft`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
      body: JSON.stringify({title: filename.replace('.docx',''), content: content})
    });
    if (!resp.ok) throw new Error('导出失败');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Word 已下载','success');
  } catch(e) { showToast('导出失败: '+e.message,'error'); }
}

async function clearContracts() {
  try {
    await api('/api/contracts/clear', { method: 'DELETE' });
    document.getElementById('contract-list').innerHTML = '';
    showToast('所有合同已清除','success');
  } catch(e) { showToast('清除失败: '+e.message,'error'); }
}

async function loadContracts() {
  try {
    const resp = await fetch(`${API}/api/contracts/`, { headers: getAuthHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data || !data.length) return;
    const area = document.getElementById('contract-list');
    if (!area) return;
    let html = '<div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem">已保存的合同（点击合同行自动选中并切换到审查Tab）</div>';
    data.forEach(c => {
      const status = c.review_status === '已审查' ? '<span class="badge badge-green">已审查</span>' : '<span class="badge badge-gray">未审查</span>';
      const preview = (c.content||'').substring(0,150).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safeTitle = escHtml(c.title);
      const safeId = escHtml(c.id);
      html += `<div class="expander contract-item" style="margin-bottom:3px" data-contract-id="${safeId}" data-contract-title="${safeTitle}">
        <div class="expander-header contract-header" style="font-size:.84rem;padding:.5rem .8rem;cursor:pointer"
             data-contract-id="${safeId}" data-contract-title="${safeTitle}">
          <span>📄 ${safeTitle} <span style="color:var(--text-muted);font-size:.75rem">${safeId}</span></span>
          <span style="display:flex;gap:.4rem;align-items:center">${status}<span class="expander-arrow">▼</span></span>
        </div>
        <div class="expander-body" style="padding:.6rem .8rem">
          <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.4rem">${c.party_a ? '甲方: '+escHtml(c.party_a)+' · ':''}${c.party_b ? '乙方: '+escHtml(c.party_b) : ''}${c.contract_type ? ' · '+escHtml(c.contract_type) : ''}</div>
          <div style="font-size:.78rem;color:var(--text-muted);max-height:120px;overflow-y:auto;white-space:pre-wrap;line-height:1.6;background:var(--bg);padding:.4rem .6rem;border-radius:4px">${preview}</div>
          <div style="margin-top:.5rem;display:flex;gap:.4rem">
            <button class="btn btn-accent btn-sm contract-action" data-action="review" data-contract-id="${safeId}">🔍 直接审查</button>
            <button class="btn btn-outline btn-sm contract-action" data-action="select" data-contract-id="${safeId}" data-contract-title="${safeTitle}">📋 选中审查</button>
            <button class="btn btn-outline btn-sm contract-action" data-action="compare" data-contract-id="${safeId}" data-contract-title="${safeTitle}">⚖ 比对</button>
            ${c.review_status==='已审查' ? `<button class="btn btn-outline btn-sm contract-action" data-action="export" data-contract-id="${safeId}">📥 导出</button>` : ''}
          </div>
        </div></div>`;
    });
    area.innerHTML = html;
    initExpanders();
    // 使用事件委托，避免 initExpanders 的 cloneNode 导致事件丢失
    initContractListDelegation();
  } catch(e) {}
}

function initContractListDelegation() {
  const list = document.getElementById('contract-list');
  if (!list || list._contractDelegated) return;
  list._contractDelegated = true;

  list.addEventListener('click', function(e) {
    const target = e.target;

    // 点击合同头部 → 选中审查
    const header = target.closest('.contract-header');
    if (header) {
      const id = header.dataset.contractId;
      const title = header.dataset.contractTitle;
      if (id) selectContractForReview(id, title);
      return;
    }

    // 点击操作按钮
    const btn = target.closest('.contract-action');
    if (btn) {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.contractId;
      const title = btn.dataset.contractTitle;
      if (action === 'review') reviewContractById(id);
      else if (action === 'select') selectContractForReview(id, title);
      else if (action === 'compare') {
        document.getElementById('compare-contract-a-id').value = id;
        showToast('已选中: ' + title, 'info');
      } else if (action === 'export') exportReview(id);
    }
  });
}

function selectContractForReview(id, title) {
  document.getElementById('review-contract-id').value = id;
  const reviewTab = document.querySelector('.tab[data-tab="contract-review"]');
  if (reviewTab) reviewTab.click();
  showToast('已选中: ' + title + '，可直接点击"开始审查"', 'info');
}

function reviewContractById(id) {
  document.getElementById('review-contract-id').value = id;
  const reviewTab = document.querySelector('.tab[data-tab="contract-review"]');
  if (reviewTab) reviewTab.click();
  setTimeout(() => reviewContract(), 300);
}

async function loadChatHistory() {
  // 先尝试从 localStorage 恢复
  if (loadChatFromStorage()) {
    renderChat();
    return;
  }
  // 否则从后端加载摘要
  try {
    const resp = await fetch(`${API}/api/consultation/history`, { headers: getAuthHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data || !data.length) return;
    const area = document.getElementById('chat-history-list');
    if (!area) return;
    let html = '<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.3rem">历史咨询</div>';
    data.slice(-5).forEach(h => {
      html += `<div style="font-size:.8rem;padding:.2rem 0;color:var(--text-secondary);cursor:pointer" onclick="document.getElementById('chat-input').value='${h.question.replace(/'/g,"\\'")}';showToast('问题已填入输入框','info')" title="点击重新提问">💬 ${h.question.substring(0,40)}${h.question.length>40?'…':''}</div>`;
    });
    area.innerHTML = html;
  } catch(e) {}
}

async function exportChat() {
  try {
    const resp = await fetch(`${API}/api/export/consultation`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
      body: JSON.stringify({messages: chatHistory})
    });
    if (!resp.ok) throw new Error('导出失败');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '咨询记录.docx'; a.click();
    URL.revokeObjectURL(url);
  } catch(e) { showToast('导出失败: '+e.message, 'error'); }
}

// =========== 知识图谱 ===========
async function searchKG() {
  const keyword = document.getElementById('kg-search-input').value.trim();
  if (!keyword) { showToast('请输入搜索关键词', 'warning'); return; }
  const statusEl = document.getElementById('kg-search-status');
  const resultsEl = document.getElementById('kg-search-results');
  statusEl.textContent = '搜索中...';
  resultsEl.innerHTML = '';

  try {
    const resp = await fetch(`${API}/api/kg/search?keyword=${encodeURIComponent(keyword)}`, { headers: getAuthHeaders() });
    const data = await resp.json();
    if (!data.available) {
      statusEl.textContent = 'Neo4j 知识图谱未连接，请先启动数据库服务';
      resultsEl.innerHTML = '<div class="card" style="padding:1rem;text-align:center;color:var(--text-muted)">知识图谱服务未启动，请检查 Neo4j 连接</div>';
      return;
    }
    const results = data.results || [];
    statusEl.textContent = `找到 ${results.length} 条结果`;
    if (!results.length) {
      resultsEl.innerHTML = '<div class="card" style="padding:1rem;text-align:center;color:var(--text-muted)">未找到相关实体</div>';
      return;
    }
    const typeLabels = {Law:'法律法规',Article:'法条',Case:'判例',Contract:'合同',Clause:'条款',RiskPoint:'风险点',LegalConcept:'法律概念',Court:'法院'};
    const typeBadges = {Law:'badge-blue',Article:'badge-green',Case:'badge-yellow',Contract:'badge-gray',Clause:'badge-gray',RiskPoint:'badge-red',LegalConcept:'badge-blue',Court:'badge-yellow'};
    let html = '<div class="card" style="padding:0"><div class="table-wrap"><table><thead><tr><th>类型</th><th>名称</th><th>详情</th><th>相关度</th></tr></thead><tbody>';
    results.forEach(r => {
      const props = r.properties || {};
      const type = r.type || 'Unknown';
      const name = props.name || props.article_number || props.case_number || props.title || props.risk_type || JSON.stringify(props).substring(0,60);
      const detail = props.content || props.definition || props.description || '';
      html += `<tr>
        <td><span class="badge ${typeBadges[type]||'badge-gray'}">${typeLabels[type]||type}</span></td>
        <td style="font-weight:500">${name}</td>
        <td style="font-size:.82rem;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${detail}</td>
        <td>${r.score ? (r.score*100).toFixed(0)+'%' : '-'}</td>
      </tr>`;
    });
    html += '</tbody></table></div></div>';
    resultsEl.innerHTML = html;
  } catch(e) {
    statusEl.textContent = '搜索失败';
    resultsEl.innerHTML = `<div class="card" style="padding:1rem;border-color:var(--danger)">搜索失败: ${e.message}</div>`;
  }
}

async function loadKGStats() {
  try {
    const resp = await fetch(`${API}/api/kg/stats`, { headers: getAuthHeaders() });
    const data = await resp.json();
    if (data.available && data.stats) {
      const cards = document.querySelectorAll('#kg-stats-grid .stat-card .value');
      if (cards.length >= 4) {
        cards[2].textContent = data.stats.total_nodes || 0;
        cards[3].textContent = data.stats.relationships || 0;
      }
    }
  } catch(e) {}
}

// =========== 审计日志 ===========
async function loadAudit() {
  try {
    const taskType = document.getElementById('aud-filter-task')?.value || '';
    const search = document.getElementById('aud-filter-search')?.value || '';
    let url = `${API}/api/audit/logs?limit=200`;
    if (taskType) url += `&task_type=${encodeURIComponent(taskType)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const resp = await fetch(url, { headers: getAuthHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    const logs = data.logs || [];
    document.getElementById('aud-total').textContent = logs.length;
    document.getElementById('aud-cases').textContent = new Set(logs.map(l=>l.case_id)).size;
    document.getElementById('aud-users').textContent = new Set(logs.map(l=>l.user_id)).size;
    const errs = logs.filter(l=>l.latency_ms>30000).length;
    document.getElementById('aud-errors').textContent = logs.length ? (errs/logs.length*100).toFixed(1)+'%' : '0%';

    const table = document.getElementById('audit-table');
    if (logs.length) {
      let html = '<div class="table-wrap"><table><thead><tr><th>时间</th><th>任务</th><th>案件</th><th>用户</th><th>模型</th><th>延迟</th><th>审计ID</th></tr></thead><tbody>';
      logs.slice(-50).reverse().forEach(l => {
        const taskLabels = {contract_review:'合同审查',legal_consultation:'法律咨询',rpa_data_extraction:'RPA提取',contract_generation:'合同生成'};
        html += `<tr>
          <td>${(l.timestamp||'').substring(0,19)}</td>
          <td>${taskLabels[l.task_type]||l.task_type||'-'}</td>
          <td>${(l.case_id||'-').substring(0,12)}</td>
          <td>${l.user_id||'-'}</td>
          <td>${l.model||'-'}</td>
          <td style="color:${(l.latency_ms||0)>15000?'var(--warning)':'var(--text-secondary)'}">${((l.latency_ms||0)/1000).toFixed(1)}s</td>
          <td style="font-family:monospace;font-size:.75rem">${l.audit_id||'-'}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      table.innerHTML = html;
    } else {
      table.innerHTML = '<p style="font-size:.85rem;color:var(--text-secondary);text-align:center;padding:2rem">暂无审计记录。完成一次合同审查或法律咨询后，日志将在此显示。</p>';
    }
    setTimeout(() => ANIM.animateAuditCounters(), 100);
  } catch(e) {}
}

// =========== 系统配置 (含预填) ===========
async function loadSettings() {
  try {
    const resp = await fetch(`${API}/api/settings/`, { headers: getAuthHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();

    // 回填 LLM 配置
    const prov = data.LLM_PROVIDER || 'deepseek';
    const providerMap = {deepseek:0,claude:1,openai:2};
    const sel = document.getElementById('cfg-provider');
    if (sel) sel.selectedIndex = providerMap[prov] || 0;

    const modelMap = {
      claude: {id:'cfg-claude-model', val:data.CLAUDE_MODEL},
      openai: {id:'cfg-openai-model', val:data.OPENAI_MODEL},
      deepseek: {id:'cfg-deepseek-model', val:data.DEEPSEEK_MODEL},
    };
    Object.values(modelMap).forEach(m => {
      const el = document.getElementById(m.id);
      if (el && m.val) {
        const opt = Array.from(el.options).find(o => o.value === m.val);
        if (opt) el.value = m.val;
      }
    });

    const tempEl = document.getElementById('cfg-temp');
    if (tempEl && data.LLM_TEMPERATURE) { tempEl.value = data.LLM_TEMPERATURE; }
    const tempVal = document.getElementById('cfg-temp-val');
    if (tempVal && data.LLM_TEMPERATURE) { tempVal.textContent = data.LLM_TEMPERATURE; }

    const tokensEl = document.getElementById('cfg-max-tokens');
    if (tokensEl && data.LLM_MAX_TOKENS) { tokensEl.value = data.LLM_MAX_TOKENS; }

    // 回填 API Key (脱敏后的值留空，让用户重新输入)
    // 不自动填充 API Key，保持安全

    // 回填 Neo4j
    if (data.NEO4J_URI) { const el = document.getElementById('cfg-neo4j-uri'); if (el) el.value = data.NEO4J_URI; }
    if (data.NEO4J_USERNAME) { const el = document.getElementById('cfg-neo4j-user'); if (el) el.value = data.NEO4J_USERNAME; }

    // 回填系统参数
    if (data.PORT) { const el = document.getElementById('cfg-port'); if (el) el.value = data.PORT; }
    if (data.ACCESS_TOKEN_EXPIRE_MINUTES) { const el = document.getElementById('cfg-jwt-expire'); if (el) el.value = data.ACCESS_TOKEN_EXPIRE_MINUTES; }
    if (data.LOG_LEVEL) { const el = document.getElementById('cfg-log-level'); if (el) el.value = data.LOG_LEVEL; }
    if (data.EMBEDDING_PROVIDER) { const el = document.getElementById('cfg-embedding-provider'); if (el) el.value = data.EMBEDDING_PROVIDER; }
  } catch(e) {}
}

async function saveConfig() {
  const prov = document.getElementById('cfg-provider').value;
  const isDeepSeek = prov.includes('DeepSeek');
  const isClaude = prov.includes('Claude');
  const data = {
    llm_provider: isDeepSeek ? 'deepseek' : (isClaude ? 'claude' : 'openai'),
    claude_model: document.getElementById('cfg-claude-model').value,
    openai_model: document.getElementById('cfg-openai-model').value,
    deepseek_model: document.getElementById('cfg-deepseek-model').value,
    llm_temperature: parseFloat(document.getElementById('cfg-temp').value),
    llm_max_tokens: parseInt(document.getElementById('cfg-max-tokens').value),
    neo4j_uri: document.getElementById('cfg-neo4j-uri').value,
    neo4j_username: document.getElementById('cfg-neo4j-user').value,
    neo4j_password: document.getElementById('cfg-neo4j-pass').value,
    port: parseInt(document.getElementById('cfg-port').value) || 8000,
    log_level: document.getElementById('cfg-log-level').value,
    embedding_provider: document.getElementById('cfg-embedding-provider').value,
  };
  const jwtKey = document.getElementById('cfg-jwt-key').value.trim();
  if (jwtKey) data.jwt_secret_key = jwtKey;
  const jwtExpire = document.getElementById('cfg-jwt-expire').value.trim();
  if (jwtExpire) data.access_token_expire_minutes = parseInt(jwtExpire);
  const ak = document.getElementById('cfg-ak').value.trim();
  const ok = document.getElementById('cfg-ok').value.trim();
  const dk = document.getElementById('cfg-dk').value.trim();
  if (ak) data.anthropic_api_key = ak;
  if (ok) data.openai_api_key = ok;
  if (dk) data.deepseek_api_key = dk;
  try {
    const result = await api('/api/settings/update', { method: 'POST', body: JSON.stringify(data) });
    showToast(result.message || '配置已保存', 'success');
  } catch (e) { showToast(`保存失败: ${e.message}`, 'error'); }
}

async function testLLM() {
  const area = document.getElementById('test-result');
  area.innerHTML = '<div class="card" style="text-align:center;padding:1.5rem"><span class="spinner"></span> 正在测试大模型连接…</div>';
  try {
    const d = await api('/api/settings/test-connection', { method: 'POST' });
    const labels = {embedding:'向量嵌入', chat:'对话模型'};
    let html = '<div class="card" style="padding:1rem"><h4 style="margin-bottom:.75rem">🔍 测试结果</h4>';
    let allOk = true;
    Object.entries(d.results||{}).forEach(([k,v]) => {
      const ok = v.includes('OK');
      if (!ok) allOk = false;
      html += `<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;font-size:.88rem">
        <span style="font-size:1.1rem">${ok ? '✅' : '❌'}</span>
        <span style="font-weight:500">${labels[k]||k}</span>
        <span style="color:var(--text-secondary)">${v}</span>
      </div>`;
    });
    html += `<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border);font-weight:600;font-size:.9rem;color:${allOk?'var(--success)':'var(--danger)'}">${allOk ? '✅ 全部连接正常' : '❌ 部分连接失败，请检查 API Key 和网络'}</div>`;
    html += '</div>';
    area.innerHTML = html;
  } catch (e) {
    area.innerHTML = `<div class="card" style="padding:1rem;border-color:var(--danger)"><h4 style="color:var(--danger);margin-bottom:.5rem">❌ 测试失败</h4><p style="font-size:.88rem">${e.message}</p></div>`;
  }
}

async function testNeo4j() {
  const area = document.getElementById('test-result');
  area.innerHTML = '<div class="card" style="text-align:center;padding:1.5rem"><span class="spinner"></span> 正在测试知识图谱连接…</div>';
  try {
    const d = await api('/api/settings/test-neo4j', { method: 'POST' });
    const ok = d.status === 'ok';
    area.innerHTML = `<div class="card" style="padding:1rem;border-color:${ok?'var(--success)':'var(--warning)'}"><h4 style="margin-bottom:.5rem;color:${ok?'var(--success)':'var(--warning)'}">${ok ? '✅ 知识图谱连接正常' : '⚠️ '+d.message}</h4></div>`;
  } catch (e) {
    area.innerHTML = `<div class="card" style="padding:1rem;border-color:var(--danger)"><h4 style="color:var(--danger);margin-bottom:.5rem">❌ 测试失败</h4><p style="font-size:.88rem">${e.message}</p></div>`;
  }
}

// =========== 用户管理 ===========
async function loadUsers() {
  try {
    const users = await api('/api/auth/users');
    const el = document.getElementById('user-list');
    if (!users.length) { el.innerHTML = '<div style="color:var(--text-muted);padding:.5rem 0">暂无用户</div>'; return; }
    el.innerHTML = users.map(u => `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;border-bottom:1px solid var(--border)">
        <span style="flex:1;font-weight:500">${u.display_name}</span>
        <span style="color:var(--text-muted);font-size:.82rem">${u.username}</span>
        <span class="badge" style="font-size:.72rem">${ROLE_LABELS[u.role]||u.role}</span>
        <select onchange="updateUserRole('${u.id}', this.value)" style="font-size:.75rem;padding:.15rem .35rem;border:1px solid var(--border);border-radius:4px">
          <option value="business" ${u.role==='business'?'selected':''}>业务人员</option>
          <option value="legal" ${u.role==='legal'?'selected':''}>法务人员</option>
          <option value="auditor" ${u.role==='auditor'?'selected':''}>审计员</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
        </select>
        <button onclick="deleteUser('${u.id}','${u.username}')" style="font-size:.75rem;padding:.15rem .5rem;border:1px solid var(--danger);border-radius:4px;background:transparent;color:var(--danger);cursor:pointer">删除</button>
      </div>`).join('');
  } catch (e) { showToast('加载用户失败: ' + e.message, 'error'); }
}

async function createUser() {
  const username = document.getElementById('new-user-name').value.trim();
  const display = document.getElementById('new-user-display').value.trim();
  const password = document.getElementById('new-user-pass').value;
  const role = document.getElementById('new-user-role').value;
  if (!username || !display || !password) { showToast('请填写完整的用户信息', 'warning'); return; }
  if (password.length < 6) { showToast('密码至少6位', 'warning'); return; }
  try {
    await api('/api/auth/users', { method: 'POST', body: JSON.stringify({ username, password, display_name: display, role }) });
    showToast('用户创建成功', 'success');
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-display').value = '';
    document.getElementById('new-user-pass').value = '';
    loadUsers();
  } catch (e) { showToast('创建失败: ' + e.message, 'error'); }
}

async function updateUserRole(userId, newRole) {
  try {
    await api(`/api/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
    showToast('角色已更新', 'success');
  } catch (e) { showToast('更新失败: ' + e.message, 'error'); }
}

async function deleteUser(userId, username) {
  if (!confirm(`确定删除用户「${username}」吗？此操作不可撤销。`)) return;
  try {
    await api(`/api/auth/users/${userId}`, { method: 'DELETE' });
    showToast('用户已删除', 'success');
    loadUsers();
  } catch (e) { showToast('删除失败: ' + e.message, 'error'); }
}

// =========== 知识库管理 ===========
async function loadKBStatus() {
  const el = document.getElementById('kb-status');
  el.innerHTML = '加载中...';
  try {
    const d = await api('/api/knowledge/status');
    el.innerHTML = `ChromaDB: ${d.chromadb.available ? '✅ 已就绪 (' + d.chromadb.count + ' 条)' : '❌ 未初始化'} &nbsp;|&nbsp; Whoosh: ${d.whoosh.available ? '✅ 已就绪' : '❌ 未初始化'} &nbsp;|&nbsp; 知识源: ${d.knowledge_files.count} 个文件`;
  } catch (e) { el.innerHTML = `加载失败: ${e.message}`; }
}

async function initKB() {
  if (!confirm('初始化将重建整个知识库索引，可能需要几分钟。确认继续？')) return;
  const el = document.getElementById('kb-result');
  el.innerHTML = '<span class="spinner"></span> 正在初始化知识库，请稍候...';
  try {
    const d = await api('/api/knowledge/init', { method: 'POST' });
    if (d.status === 'ok') {
      el.innerHTML = `✅ ${d.message}（处理 ${d.files_processed} 个文件，${d.chunks_indexed} 个文档块）`;
      loadKBStatus();
    } else {
      el.innerHTML = `❌ ${d.message}`;
    }
  } catch (e) { el.innerHTML = `❌ 初始化失败: ${e.message}`; }
}

// =========== RPA (含格式化结果卡片) ===========
async function extractData() {
  const file = document.getElementById('rpa-file').files[0];
  if (!file) { showToast('请选择文件', 'warning'); return; }
  const area = document.getElementById('rpa-result');
  area.innerHTML = '<div class="card" style="text-align:center;padding:1.5rem"><span class="spinner"></span> AI 正在分析文档…</div>';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API}/api/rpa/extract`, { method: 'POST', headers: getAuthHeaders(), body: formData });
    if (!resp.ok) { const t = await resp.text(); throw new Error(t); }
    const result = await resp.json();

    // 格式化卡片展示
    const fieldLabels = {
      contract_title: '📄 合同标题',
      party_a: '🏢 甲方',
      party_b: '🏢 乙方',
      amount: '💰 合同金额',
      deadline: '📅 约定期限',
      dispute_resolution: '⚖️ 争议解决',
    };
    let html = '<div class="card rpa-result-card"><h4 style="margin-bottom:.75rem">提取结果</h4>';
    let hasFields = false;
    Object.entries(fieldLabels).forEach(([key, label]) => {
      if (result[key]) {
        hasFields = true;
        html += `<div class="rpa-field"><div class="rpa-field-label">${label}</div><div class="rpa-field-value">${result[key]}</div></div>`;
      }
    });
    if (!hasFields) html += '<p style="color:var(--text-muted);text-align:center">未提取到关键信息</p>';
    html += '</div>';
    // 也保留 JSON 细节供高级用户查看
    html += `<details style="margin-top:.5rem"><summary style="cursor:pointer;font-size:.8rem;color:var(--text-muted)">查看原始 JSON</summary><pre style="background:#f8fafc;padding:.75rem;border-radius:var(--radius-sm);font-size:.78rem;overflow-x:auto;margin-top:.25rem">${JSON.stringify(result, null, 2)}</pre></details>`;
    area.innerHTML = html;
    showToast('提取成功', 'success');
  } catch (e) {
    area.innerHTML = `<div class="card" style="padding:1rem;border-color:var(--danger)"><h4 style="color:var(--danger);margin-bottom:.5rem">❌ 提取失败</h4><p style="font-size:.88rem">${e.message}</p></div>`;
  }
}

async function batchExtract() {
  const files = document.getElementById('rpa-batch-file').files;
  if (!files.length) { showToast('请选择文件', 'warning'); return; }
  const area = document.getElementById('rpa-batch-result');
  area.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem"><span class="spinner"></span> 正在处理 ${files.length} 个文件…</div>`;

  let allHtml = '';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch(`${API}/api/rpa/batch-extract`, { method: 'POST', headers: getAuthHeaders(), body: formData });
      if (!resp.ok) { const t = await resp.text(); throw new Error(t); }
      const result = await resp.json();
      const clauses = result.key_clauses || [];
      allHtml += `<div class="card" style="padding:.75rem 1rem;margin-bottom:.5rem"><strong>📄 ${result.file||file.name}</strong><span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem">${result.total_clauses||0} 条 · 关键 ${clauses.length} 条</span>`;
      clauses.forEach(c => { allHtml += `<div style="margin:.3rem 0;font-size:.82rem"><span style="color:var(--accent)">${c.title}</span>: ${c.summary}</div>`; });
      if (!clauses.length) allHtml += '<p style="color:var(--text-muted);font-size:.8rem">未发现关键条款</p>';
      allHtml += '</div>';
    } catch (e) {
      allHtml += `<div class="card" style="padding:.5rem 1rem;margin-bottom:.5rem;border-color:var(--danger)"><strong>📄 ${file.name}</strong> <span style="color:var(--danger);font-size:.8rem">失败: ${e.message}</span></div>`;
    }
  }
  area.innerHTML = allHtml;
  showToast(`处理完成: ${files.length} 个文件`, 'success');
}

// =========== Markdown 渲染（增强版） ===========
function renderMarkdown(md) {
  // 先转义 HTML
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 标题（h3 用于 ### ，h4 用于 ####）
  html = html.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 代码块
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // 水平线
  html = html.replace(/^---$/gm, '<hr class="md-hr">');

  // 列表（编号和无序）
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="md-li-ol">$1. $2</li>');
  html = html.replace(/^- (.+)$/gm, '<li class="md-li">$1</li>');

  // 引用块
  html = html.replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // 将连续 li 包裹在 ul/ol 中
  html = html.replace(/((?:<li class="md-li">.*?<\/li>\s*)+)/g, '<ul class="md-ul">$1</ul>');
  html = html.replace(/((?:<li class="md-li-ol">.*?<\/li>\s*)+)/g, '<ol class="md-ol">$1</ol>');

  // 段落：连续两个换行
  html = html.replace(/\n\n+/g, '</p><p class="md-p">');
  html = '<p class="md-p">' + html + '</p>';

  // 清理空段落
  html = html.replace(/<p class="md-p"><\/p>/g, '');
  html = html.replace(/<p class="md-p">(\s*<h[234])/g, '$1');
  html = html.replace(/(<\/h[234]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p class="md-p">(\s*<ul)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p class="md-p">(\s*<ol)/g, '$1');
  html = html.replace(/(<\/ol>)\s*<\/p>/g, '$1');
  html = html.replace(/<p class="md-p">(\s*<pre)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p class="md-p">(\s*<hr)/g, '$1');
  html = html.replace(/(<hr[^>]*>)\s*<\/p>/g, '$1');
  html = html.replace(/<p class="md-p">(\s*<blockquote)/g, '$1');
  html = html.replace(/(<\/blockquote>)\s*<\/p>/g, '$1');

  return html;
}

// =========== 键盘快捷键 ===========
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter: 发送咨询消息
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      const chatInput = document.getElementById('chat-input');
      if (chatInput && document.activeElement === chatInput) {
        askQuestion();
      }
    }
    // Ctrl+K: 聚焦知识图谱搜索
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      navigateTo('kg');
      setTimeout(() => {
        document.getElementById('kg-search-input')?.focus();
      }, 300);
    }
    // Escape: 关闭弹窗/侧边栏
    if (e.key === 'Escape') {
      closeSidebar();
      closeConfirmDialog();
    }
  });

  // Temperature 滑块实时显示值
  const tempSlider = document.getElementById('cfg-temp');
  const tempVal = document.getElementById('cfg-temp-val');
  if (tempSlider && tempVal) {
    tempSlider.addEventListener('input', () => {
      tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
    });
  }
}

// =========== 初始化 ===========
document.addEventListener('DOMContentLoaded', () => {
  ANIM.init();
  initAuth();
  initNav();
  initTabs();
  initExpanders();
  initMobileMenu();
  initConfirmDialog();
  initContractFileUpload();
  initKeyboardShortcuts();

  if (currentUser) {
    const hash = window.location.hash.replace('#', '') || 'home';
    navigateTo(hash);
    // 尝试恢复对话
    loadChatFromStorage();
  }

  checkStatus();
  setInterval(checkStatus, 15000);

  // Enter 发送
  document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askQuestion(); }
  });

  // 快捷问题：点击后填入输入框（不直接发送）
  document.querySelectorAll('.quick-q').forEach(el => {
    el.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      input.value = el.dataset.q;
      input.focus();
      showToast('问题已填入，按 Enter 发送', 'info');
    });
  });

  // 加载数据（仅在已登录时）
  if (currentUser) {
    loadContracts();
    loadChatHistory();
    loadAudit();
    loadSettings();
    loadKGStats();
  }

  // 登录卡片入场动画
  const loginCard = document.querySelector('.login-card');
  if (loginCard && !ANIM._reduced) {
    gsap.from(loginCard, { y: 40, autoAlpha: 0, duration: 0.5, ease: "back.out(1.3)" });
  }
});
/* =========== 新功能 JS（追加到 app.js 末尾） =========== */

// =========== 案件中心 ===========
async function loadCaseList() {
  if (!currentUser) return;
  try {
    const status = document.getElementById('case-status-filter')?.value || '';
    const data = await api(`/api/case/profiles?status=${status}`);
    const container = document.getElementById('case-list');
    if (!container) return;
    if (!data.length) {
      container.innerHTML = '<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted)">暂无案件，点击"新建案情分析"开始</div>';
      return;
    }
    const statusLabels = {assessing:'评估中',negotiating:'协商中',litigating:'诉讼中',closed:'已结案'};
    container.innerHTML = data.map(c => `
      <div class="card" style="cursor:pointer" onclick="viewCase('${c.case_id}')">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <strong style="font-size:.95rem">${escHtml(c.case_name)}</strong>
            <span style="font-size:.75rem;margin-left:.5rem;padding:2px 8px;border-radius:10px;background:var(--bg);color:var(--text-secondary)">${c.case_type_name}</span>
          </div>
          <span style="font-size:.75rem;padding:2px 10px;border-radius:10px;background:${c.status==='closed'?'#f0fdf4':'#eff6ff'};color:${c.status==='closed'?'#16a34a':'#3b82f6'}">${statusLabels[c.status]||c.status}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:.5rem;line-height:1.5">${escHtml(c.description||'').substring(0,150)}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.5rem">更新于 ${c.updated_at?.substring(0,10)}</div>
      </div>
    `).join('');
  } catch(e) { showToast('加载案件列表失败: '+e.message,'error'); }
}

function escHtml(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }

async function viewCase(caseId) {
  try {
    const c = await api(`/api/case/profiles/${caseId}`);
    const container = document.getElementById('case-list');
    if (!container) return;
    const statusLabels = {assessing:'评估中',negotiating:'协商中',litigating:'诉讼中',closed:'已结案'};
    let html = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <strong style="font-size:1.1rem">${escHtml(c.case_name)}</strong>
        <div style="display:flex;gap:.5rem">
          <select class="form-select" id="view-case-status" style="width:120px;font-size:.8rem" onchange="updateCaseStatus('${c.case_id}', this.value)">
            ${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v}</option>`).join('')}
          </select>
          <button class="btn btn-outline btn-sm" onclick="deleteCase('${c.case_id}')">🗑</button>
        </div>
      </div>
      <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.5rem">案由: ${c.case_type_name} | 创建: ${c.created_at?.substring(0,10)}</div>
      <div style="font-size:.88rem;line-height:1.7;margin:.75rem 0">${escHtml(c.description)}</div>
      ${c.structured_facts && Object.keys(c.structured_facts).length ? `<div class="card" style="background:var(--bg)"><strong style="font-size:.82rem">结构化要素</strong><pre style="font-size:.8rem;margin-top:.25rem;white-space:pre-wrap">${JSON.stringify(c.structured_facts,null,2)}</pre></div>` : ''}
      ${c.analysis_ids && c.analysis_ids.length ? `<div style="margin-top:.5rem"><strong style="font-size:.85rem">分析报告: </strong>${c.analysis_ids.map(id=>`<a href="javascript:void(0)" onclick="viewAnalysis('${id}')" style="color:var(--accent);margin-right:.5rem">#${id}</a>`).join('')}</div>` : '<div style="margin-top:.5rem;font-size:.82rem;color:var(--text-muted)">暂无分析报告，请通过案情分析页创建</div>'}
      <button class="btn btn-outline btn-sm" style="margin-top:.75rem" onclick="loadCaseList()">← 返回列表</button>
    </div>`;
    container.innerHTML = html;
  } catch(e) { showToast('加载案件详情失败: '+e.message,'error'); }
}

async function updateCaseStatus(caseId, status) {
  try { await api(`/api/case/profiles/${caseId}`, {method:'PUT',body:JSON.stringify({status})}); showToast('状态已更新','success'); }
  catch(e) { showToast('更新失败: '+e.message,'error'); }
}

async function deleteCase(caseId) {
  confirmDialog('确定删除此案件吗？此操作不可恢复。', async () => {
    try { await api(`/api/case/profiles/${caseId}`,{method:'DELETE'}); showToast('已删除','success'); loadCaseList(); }
    catch(e) { showToast('删除失败: '+e.message,'error'); }
  });
}

async function viewAnalysis(analysisId) {
  try {
    const d = await api(`/api/case/analyses/${analysisId}`);
    renderAnalysisReport(d.report || d);
    navigateTo('case-analysis');
  } catch(e) { showToast('加载分析报告失败: '+e.message,'error'); }
}

// =========== 案情分析 ===========
let selectedCaseType = '';
let analysisReportData = null;

async function initCaseTypeSelector() {
  try {
    const types = await api('/api/case/types');
    const container = document.getElementById('case-type-selector');
    if (!container) return;
    container.innerHTML = types.map(t => `
      <div class="case-type-card" data-type="${t.key}" onclick="selectCaseType('${t.key}', this)"
           style="padding:.75rem;border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all .2s">
        <strong style="font-size:.9rem">${t.name}</strong>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem">${t.description}</div>
      </div>
    `).join('');
  } catch(e) { console.error('加载案由失败:',e); }
}

function selectCaseType(type, el) {
  selectedCaseType = type;
  document.querySelectorAll('.case-type-card').forEach(c => c.style.borderColor='var(--border)');
  el.style.borderColor = 'var(--accent)';
  el.style.background = 'var(--bg)';
}

async function startAnalysis() {
  if (!selectedCaseType) { showToast('请先选择案由','warning'); return; }
  try {
    const types = await api('/api/case/types');
    const ct = types.find(t => t.key === selectedCaseType);
    if (!ct || !ct.fields) { showToast('案由数据加载失败','error'); return; }

    const fieldsHtml = ct.fields.map(f => {
      let input = '';
      if (f.type === 'textarea') {
        input = `<textarea class="form-textarea" id="field-${f.key}" style="min-height:80px" placeholder="请输入${f.label}"></textarea>`;
      } else if (f.type === 'select') {
        input = `<select class="form-select" id="field-${f.key}">${(f.options||[]).map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
      } else if (f.type === 'boolean') {
        input = `<select class="form-select" id="field-${f.key}"><option value="">-- 请选择 --</option><option value="true">是</option><option value="false">否</option></select>`;
      } else if (f.type === 'date') {
        input = `<input type="date" class="form-input" id="field-${f.key}">`;
      } else if (f.type === 'number') {
        input = `<input type="number" class="form-input" id="field-${f.key}" placeholder="请输入${f.label}">`;
      } else {
        input = `<input type="text" class="form-input" id="field-${f.key}" placeholder="请输入${f.label}">`;
      }
      return `<div class="form-group"><label class="form-label">${f.label}${f.required?' <span style="color:var(--danger)">*</span>':''}</label>${input}</div>`;
    }).join('');

    document.getElementById('analysis-fields').innerHTML = fieldsHtml;
    document.getElementById('analysis-step1').style.display = 'none';
    document.getElementById('analysis-step2').style.display = 'block';
    document.getElementById('analysis-step3').style.display = 'none';
  } catch(e) { showToast('加载案由字段失败: '+e.message,'error'); }
}

function backToStep1() {
  document.getElementById('analysis-step1').style.display = 'block';
  document.getElementById('analysis-step2').style.display = 'none';
  document.getElementById('analysis-step3').style.display = 'none';
}

function resetAnalysis() {
  selectedCaseType = '';
  analysisReportData = null;
  document.getElementById('analysis-step1').style.display = 'block';
  document.getElementById('analysis-step2').style.display = 'none';
  document.getElementById('analysis-step3').style.display = 'none';
  document.getElementById('analysis-report').innerHTML = '';
  document.querySelectorAll('.case-type-card').forEach(c => { c.style.borderColor='var(--border)'; c.style.background=''; });
}

async function submitAnalysis() {
  const btn = document.getElementById('analysis-submit-btn');
  const progress = document.getElementById('analysis-progress');
  btn.disabled = true;
  progress.style.display = 'block';
  progress.innerHTML = '<span class="spinner"></span> AI 正在分析案情，请稍候…<br><small style="color:var(--text-muted)">正在检索法律依据、匹配相似判例、评估风险...</small>';

  const facts = {};
  document.querySelectorAll('#analysis-fields [id^="field-"]').forEach(el => {
    const key = el.id.replace('field-', '');
    let val = el.value;
    if (el.tagName === 'SELECT' && (val === 'true' || val === 'false')) {
      val = val === 'true';
    }
    facts[key] = val;
  });

  const desc = document.getElementById('analysis-description')?.value || '';
  if (desc) facts.description = desc;

  try {
    const report = await api('/api/case/analyze', {
      method:'POST',
      body:JSON.stringify({case_type:selectedCaseType, structured_facts:facts})
    });
    analysisReportData = report;
    renderAnalysisReport(report);
    document.getElementById('analysis-step2').style.display = 'none';
    document.getElementById('analysis-step3').style.display = 'block';
    showToast('分析完成','success');
  } catch(e) {
    showToast('分析失败: '+e.message,'error');
  } finally {
    btn.disabled = false;
    progress.style.display = 'none';
  }
}

function renderAnalysisReport(report) {
  const container = document.getElementById('analysis-report');
  if (!container) return;

  let html = '';

  // 摘要
  if (report.summary) {
    html += `<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">📋 案情摘要</h3><p style="line-height:1.8;font-size:.9rem">${escHtml(report.summary)}</p></div>`;
  }

  // 法律依据
  if (report.legal_basis && report.legal_basis.length) {
    html += '<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">⚖ 适用法律依据</h3>';
    report.legal_basis.forEach(l => {
      html += `<div style="padding:.5rem 0;border-bottom:1px solid var(--border)"><strong>${escHtml(l.law)} ${escHtml(l.article||'')}</strong><div style="font-size:.85rem;color:var(--text-secondary);margin-top:.2rem">${escHtml(l.content||'')}</div><div style="font-size:.78rem;color:var(--text-muted)">${escHtml(l.relevance||'')}</div></div>`;
    });
    html += '</div>';
  }

  // 相似判例
  if (report.similar_cases && report.similar_cases.length) {
    html += '<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">📚 相似判例</h3>';
    report.similar_cases.forEach((c,i) => {
      html += `<div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between"><strong>#${i+1} ${escHtml(c.title||c.case_number)}</strong><span style="font-size:.75rem;color:var(--accent)">${'★'.repeat(Math.min(5,Math.ceil((c.score||0.7)*5)))}</span></div>
        <div style="font-size:.8rem;color:var(--text-secondary)">${escHtml(c.case_number||'')} ${c.court?escHtml(c.court):''} ${c.case_date?escHtml(c.case_date):''}</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:.2rem">${escHtml((c.verdict||c.similarity_reason||'').substring(0,200))}</div>
      </div>`;
    });
    html += '</div>';
  }

  // 证据清单
  if (report.evidence_checklist && report.evidence_checklist.length) {
    html += '<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">📎 证据清单</h3>';
    report.evidence_checklist.forEach(e => {
      html += `<div style="padding:.35rem 0;font-size:.88rem"><input type="checkbox" style="margin-right:.5rem">${e.required?'<strong>':''}${escHtml(e.name)}${e.required?' <span style="color:var(--danger);font-size:.75rem">(必要)</span></strong>':''} — ${escHtml(e.description||'')}${e.tip?` <span style="font-size:.75rem;color:var(--text-muted)">💡${escHtml(e.tip)}</span>`:''}</div>`;
    });
    html += '</div>';
  }

  // 时效检查
  if (report.limitation_check && report.limitation_check.limitation_name) {
    const lc = report.limitation_check;
    html += `<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">⏰ 诉讼时效检查</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.88rem">
        <div><strong>适用时效:</strong> ${escHtml(lc.limitation_name)}（${escHtml(lc.period_text)}）</div>
        <div><strong>事件日期:</strong> ${escHtml(lc.event_date||'')}</div>
        <div><strong>截止日期:</strong> ${escHtml(lc.deadline_date||'')}</div>
        <div><strong>状态:</strong> <span style="color:${lc.is_expired?'var(--danger)':'var(--success)'}">${escHtml(lc.status_text)}</span></div>
      </div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">法律依据: ${escHtml(lc.legal_basis||'')}</div>
    </div>`;
  }

  // 费用估算
  if (report.fee_estimate && report.fee_estimate.court_fee) {
    const fe = report.fee_estimate;
    html += `<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">💰 费用预估</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.88rem">
        <div><strong>争议标的:</strong> ${fe.claim_amount?.toLocaleString()} 元</div>
        <div><strong>案件受理费:</strong> ${fe.court_fee?.toLocaleString()} 元</div>
        ${fe.reduction_note?`<div style="grid-column:1/-1;font-size:.78rem;color:var(--text-muted)">${escHtml(fe.reduction_note)}</div>`:''}
      </div>
    </div>`;
  }

  // 风险评估
  if (report.risk_assessment && report.risk_assessment.level) {
    const ra = report.risk_assessment;
    html += `<div class="card"><h3 style="font-size:1rem;margin-bottom:.5rem">⚠ 风险评估</h3>
      <div style="font-size:.95rem;margin-bottom:.5rem">综合风险等级: <strong style="color:${ra.level==='高'?'var(--danger)':ra.level==='中'?'var(--warning)':'var(--success)'}">${escHtml(ra.level)}</strong></div>`;
    if (ra.factors && ra.factors.length) {
      html += '<div style="font-size:.88rem"><strong>关键因素:</strong><ul style="padding-left:1.2rem">'+ra.factors.map(f=>`<li>${escHtml(f)}</li>`).join('')+'</ul></div>';
    }
    if (ra.suggestions && ra.suggestions.length) {
      html += '<div style="font-size:.88rem"><strong>建议:</strong><ul style="padding-left:1.2rem">'+ra.suggestions.map(s=>`<li>${escHtml(s)}</li>`).join('')+'</ul></div>';
    }
    html += '</div>';
  }

  // 免责声明
  if (report.disclaimer) {
    html += `<div style="font-size:.78rem;color:var(--text-muted);text-align:center;margin-top:1rem;padding:1rem;background:var(--bg);border-radius:8px">⚠ ${escHtml(report.disclaimer)}</div>`;
  }

  container.innerHTML = html;
}

async function saveToCaseCenter() {
  if (!analysisReportData) { showToast('没有可保存的分析报告','warning'); return; }
  const caseName = document.getElementById('analysis-case-name')?.value || '未命名案件';
  try {
    const c = await api('/api/case/profiles', {
      method:'POST',
      body:JSON.stringify({case_name:caseName, case_type:selectedCaseType,
        description:document.getElementById('analysis-description')?.value||''})
    });
    showToast(`已保存到案件中心 (${c.case_id})`,'success');
  } catch(e) { showToast('保存失败: '+e.message,'error'); }
}

// =========== 计算工具 ===========
function calcFee() {
  const caseType = document.getElementById('fee-case-type').value;
  const amount = parseFloat(document.getElementById('fee-amount').value) || 0;
  const includePres = document.getElementById('fee-preservation').checked;
  const includeExec = document.getElementById('fee-execution').checked;
  const presAmount = parseFloat(document.getElementById('fee-preservation-amount')?.value) || 0;

  const presGroup = document.getElementById('fee-preservation-group');
  if (presGroup) presGroup.style.display = includePres ? 'block' : 'none';
  if (!amount) { showToast('请输入诉讼标的额','warning'); return; }

  fetch(`${API}/api/calculator/court-fee`, {
    method:'POST', headers:{'Content-Type':'application/json',...getAuthHeaders()},
    body:JSON.stringify({case_type:caseType,claim_amount:amount,include_preservation:includePres,
      include_execution:includeExec,preservation_amount:presAmount})
  }).then(r=>r.json()).then(data => {
    const area = document.getElementById('fee-result');
    if (!area) return;

    // 构建计算步骤 HTML
    let stepsHtml = '';
    if (data.calc_steps) {
      data.calc_steps.forEach(section => {
        stepsHtml += `<details class="calc-details" open>
          <summary class="calc-summary">${section.title} <strong style="color:var(--accent)">${(section.result||0).toLocaleString()} 元</strong></summary>
          <div class="calc-steps-body">`;
        (section.steps||[]).forEach(s => {
          const isResult = s.includes('合计');
          stepsHtml += `<div class="calc-step${isResult?' calc-step-result':''}">${isResult ? '→ ' : ''}${escHtml(s)}</div>`;
        });
        stepsHtml += `</div></details>`;
      });
    }

    area.innerHTML = `<div class="card" style="background:var(--bg)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
        ${data.breakdown?.map(b=>`
          <div style="padding:.5rem;background:#fff;border-radius:6px">
            <div style="font-size:.78rem;color:var(--text-muted)">${escHtml(b.item)}</div>
            <div style="font-size:1.3rem;font-weight:700;color:var(--text)">¥${(b.amount||0).toLocaleString()}</div>
            ${b.note?`<div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem">${escHtml(b.note)}</div>`:''}
          </div>
        `).join('')||''}
        <div style="grid-column:1/-1;padding:.6rem;background:var(--accent);color:#fff;border-radius:6px;text-align:center">
          <div style="font-size:.78rem;opacity:.85">费用合计</div>
          <div style="font-size:1.5rem;font-weight:700">¥${(data.total||0).toLocaleString()}</div>
        </div>
      </div>
      ${stepsHtml}
      ${data.reduction_note?`<div class="calc-note">📝 ${escHtml(data.reduction_note)}</div>`:''}
      ${data.note?`<div class="calc-note">⚠ ${escHtml(data.note)}</div>`:''}
      <div class="calc-legal-basis">法律依据：《诉讼费用交纳办法》（国务院令第481号）</div>
    </div>`;
  }).catch(e => showToast('计算失败: '+e.message,'error'));
}

function updateCompForm() {
  const scenario = document.getElementById('comp-scenario').value;
  const area = document.getElementById('comp-params');
  if (!area) return;

  const forms = {
    labor_illegal_dismissal: `<div class="form-row">
      <div class="form-group"><label class="form-label">月工资（元）</label><input type="number" class="form-input" id="cp-monthly_salary" value="8000"></div>
      <div class="form-group"><label class="form-label">工作年限（年）</label><input type="number" class="form-input" id="cp-years_of_service" value="3" step="0.5" placeholder="不满半年=0.5，满半年=1"></div>
    </div>`,
    labor_unpaid_salary: `<div class="form-row">
      <div class="form-group"><label class="form-label">月工资（元）</label><input type="number" class="form-input" id="cp-monthly_salary" value="8000"></div>
      <div class="form-group"><label class="form-label">拖欠月数</label><input type="number" class="form-input" id="cp-unpaid_months" value="3"></div>
    </div>`,
    personal_injury: `<div class="card" style="background:var(--bg);margin:1rem 0">
      <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.75rem">请填写以下各项损失金额（凭票据和证据填写）：</p>
      <div class="form-row">
        <div class="form-group"><label class="form-label">医疗费（元）</label><input type="number" class="form-input" id="cp-medical_cost" value="50000" placeholder="含诊疗费、医药费、住院费"></div>
        <div class="form-group"><label class="form-label">交通费（元）</label><input type="number" class="form-input" id="cp-transport_cost" value="2000" placeholder="就医产生的交通费用"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">日均收入（元/天）</label><input type="number" class="form-input" id="cp-daily_income" value="300"></div>
        <div class="form-group"><label class="form-label">误工天数</label><input type="number" class="form-input" id="cp-lost_days" value="90"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">护理费标准（元/天）</label><input type="number" class="form-input" id="cp-daily_care" value="150"></div>
        <div class="form-group"><label class="form-label">护理天数</label><input type="number" class="form-input" id="cp-care_days" value="60"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">伙食补助标准（元/天）</label><input type="number" class="form-input" id="cp-food_allowance" value="100" placeholder="一般50-100元/天"></div>
        <div class="form-group"><label class="form-label">住院天数</label><input type="number" class="form-input" id="cp-hospital_days" value="30"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">营养费（元）</label><input type="number" class="form-input" id="cp-nutrition_cost" value="3000" placeholder="根据医嘱确定"></div>
        <div class="form-group"><label class="form-label">精神损害抚慰金（元）</label><input type="number" class="form-input" id="cp-mental_damage" value="10000" placeholder="法院酌情确定"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">人均年可支配收入（元）</label><input type="number" class="form-input" id="cp-annual_disability_income" value="51821" placeholder="2024年全国约51,821元"></div>
        <div class="form-group"><label class="form-label">伤残系数</label>
          <select class="form-select" id="cp-disability_ratio">
            <option value="0">未构成伤残</option>
            <option value="1.0">一级伤残（1.0）</option>
            <option value="0.9">二级伤残（0.9）</option>
            <option value="0.8">三级伤残（0.8）</option>
            <option value="0.7">四级伤残（0.7）</option>
            <option value="0.6">五级伤残（0.6）</option>
            <option value="0.5">六级伤残（0.5）</option>
            <option value="0.4">七级伤残（0.4）</option>
            <option value="0.3">八级伤残（0.3）</option>
            <option value="0.2">九级伤残（0.2）</option>
            <option value="0.1">十级伤残（0.1）</option>
          </select>
        </div>
      </div>
      <p style="font-size:.72rem;color:var(--text-muted);margin-top:.5rem">💡 以上为估算参考，实际赔偿金额以法院核定为准。请保留所有医疗票据和费用凭证。</p>
    </div>`,
    consumer_fraud: `<div class="form-group"><label class="form-label">购买金额（元）</label><input type="number" class="form-input" id="cp-purchase_amount" value="5000"></div>`,
  };

  if (forms[scenario]) {
    area.innerHTML = `<div class="card" style="background:var(--bg);margin:1rem 0">${forms[scenario]}</div>`;
  } else {
    area.innerHTML = '';
  }
}

function calcCompensation() {
  const scenario = document.getElementById('comp-scenario').value;
  if (!scenario) { showToast('请选择赔偿场景','warning'); return; }
  const params = {};
  document.querySelectorAll('#comp-params input, #comp-params select').forEach(el => {
    const val = parseFloat(el.value);
    params[el.id.replace('cp-','')] = isNaN(val) ? 0 : val;
  });

  fetch(`${API}/api/calculator/compensation`, {
    method:'POST', headers:{'Content-Type':'application/json',...getAuthHeaders()},
    body:JSON.stringify({scenario, params})
  }).then(r=>r.json()).then(data => {
    const area = document.getElementById('comp-result');
    if (area) {
      area.innerHTML = `<div class="card" style="background:var(--bg)">
        <h4 style="margin-bottom:.75rem">${escHtml(data.scenario_name||'')}</h4>
        ${data.items?.map(it=>`
          <div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.88rem">
            <span>${escHtml(it.name)}</span><span><strong>¥${(it.amount||0).toLocaleString()}</strong></span>
          </div>
        `).join('')||''}
        <div style="display:flex;justify-content:space-between;padding:.6rem 0;font-size:1rem;font-weight:600">
          <span>预估赔偿总额</span><span style="color:var(--accent)">¥${(data.total_min||0).toLocaleString()} ~ ¥${(data.total_max||0).toLocaleString()}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">法律依据: ${escHtml(data.legal_basis||'')}</div>
        ${(data.notes||[]).map(n=>`<div style="font-size:.75rem;color:var(--text-muted)">📝 ${escHtml(n)}</div>`).join('')}
      </div>`;
    }
  }).catch(e => showToast('计算失败: '+e.message,'error'));
}

function checkLimitation() {
  const caseType = document.getElementById('lim-case-type').value;
  const eventDate = document.getElementById('lim-event-date').value;
  if (!eventDate) { showToast('请选择事件日期','warning'); return; }

  fetch(`${API}/api/calculator/limitation`, {
    method:'POST', headers:{'Content-Type':'application/json',...getAuthHeaders()},
    body:JSON.stringify({case_type:caseType, event_date:eventDate})
  }).then(r=>r.json()).then(data => {
    if (data.error) { showToast(data.error,'error'); return; }
    const area = document.getElementById('lim-result');
    if (area) {
      const color = data.is_expired ? 'var(--danger)' : data.days_remaining <= 30 ? '#f59e0b' : 'var(--success)';
      area.innerHTML = `<div class="card" style="background:var(--bg)">
        <div style="text-align:center;padding:1rem">
          <div style="font-size:2rem;color:${color};margin-bottom:.5rem">${data.is_expired ? '⚠' : data.days_remaining <= 30 ? '⏰' : '✅'}</div>
          <div style="font-size:1.1rem;font-weight:600">${escHtml(data.status_text)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.88rem;margin-top:.75rem">
          <div><strong>时效类型:</strong> ${escHtml(data.limitation_name||'')}</div>
          <div><strong>时效期限:</strong> ${escHtml(data.period_text||'')}</div>
          <div><strong>事件日期:</strong> ${escHtml(data.event_date||'')}</div>
          <div><strong>截止日期:</strong> ${escHtml(data.deadline_date||'')}</div>
        </div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.75rem">法律依据: ${escHtml(data.legal_basis||'')}</div>
        ${data.special_rules?.length ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem">特别规定: ${data.special_rules.map(r=>escHtml(r)).join('; ')}</div>` : ''}
        ${data.interruption_reasons?.length ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.5rem">💡 时效中断情形: ${data.interruption_reasons.map(r=>escHtml(r)).join(' / ')}</div>` : ''}
      </div>`;
    }
  }).catch(e => showToast('检查失败: '+e.message,'error'));
}

// =========== 证据指引 ===========
async function initEvidencePage() {
  try {
    const cases = await api('/api/evidence/cases');
    const selector = document.getElementById('evidence-case-selector');
    if (selector) {
      selector.innerHTML = cases.map(c => `
        <button class="btn btn-outline btn-sm" onclick="loadEvidenceGuide('${c.case_type}')">${c.name}</button>
      `).join('');
    }
  } catch(e) { console.error('加载证据案由失败:',e); }
}

async function loadEvidenceGuide(caseType) {
  try {
    const guide = await api(`/api/evidence/guide/${caseType}`);
    const container = document.getElementById('evidence-guide-content');
    if (!container) return;
    let html = `<h3 style="font-size:1rem;margin-bottom:1rem">📎 ${escHtml(guide.case_type_name)} — 证据指引</h3>`;

    html += '<div class="card"><h4 style="font-size:.9rem;margin-bottom:.5rem;color:var(--danger)">必要证据</h4>';
    guide.required_evidence?.forEach(e => {
      html += `<div style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.88rem">
        <strong>${escHtml(e.name)}</strong> — ${escHtml(e.description)}<br>
        <span style="font-size:.78rem;color:var(--text-muted)">格式: ${escHtml(e.format||'')}${e.tip?' | 💡'+escHtml(e.tip):''}</span>
      </div>`;
    });
    html += '</div>';

    html += '<div class="card" style="margin-top:.5rem"><h4 style="font-size:.9rem;margin-bottom:.5rem">补充证据</h4>';
    guide.optional_evidence?.forEach(e => {
      html += `<div style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.88rem">
        <strong>${escHtml(e.name)}</strong> — ${escHtml(e.description)}<br>
        <span style="font-size:.78rem;color:var(--text-muted)">格式: ${escHtml(e.format||'')}${e.tip?' | 💡'+escHtml(e.tip):''}</span>
      </div>`;
    });
    html += '</div>';

    if (guide.preservation_tips?.length) {
      html += '<div class="card" style="margin-top:.5rem"><h4 style="font-size:.9rem;margin-bottom:.5rem">🔒 证据保全建议</h4><ul style="padding-left:1.2rem">';
      guide.preservation_tips.forEach(t => { html += `<li style="font-size:.88rem;margin:.25rem 0">${escHtml(t)}</li>`; });
      html += '</ul></div>';
    }

    container.innerHTML = html;
  } catch(e) { showToast('加载证据指引失败: '+e.message,'error'); }
}

// =========== 文书模板 ===========
let currentTemplates = [];
let currentTemplateData = null;

async function loadTemplates() {
  try {
    currentTemplates = await api('/api/templates');
    renderTemplateList('all');
  } catch(e) {
    document.getElementById('template-list').innerHTML = '<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted)">模板加载失败，请检查服务连接</div>';
  }
}

function filterTemplates(cat, btn) {
  document.querySelectorAll('#template-categories button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTemplateList(cat);
}

function renderTemplateList(cat) {
  const list = cat === 'all' ? currentTemplates : currentTemplates.filter(t => t.category === cat);
  const container = document.getElementById('template-list');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="card" style="text-align:center;padding:2rem;color:var(--text-muted)">该类别暂无模板</div>';
    return;
  }
  container.innerHTML = list.map(t => `
    <div class="card" style="cursor:pointer" onclick="openTemplateWizard('${t.template_id}')">
      <strong style="font-size:.92rem">📄 ${escHtml(t.title)}</strong>
      <div style="font-size:.78rem;color:var(--text-muted);margin:.25rem 0">${escHtml(t.category)} | 下载 ${t.download_count||0} 次</div>
      <div style="font-size:.8rem;color:var(--text-secondary);line-height:1.5">${escHtml(t.description||'')}</div>
      <div style="margin-top:.5rem;display:flex;gap:.5rem">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();downloadTemplate('${t.template_id}')">⬇ 下载空白模板</button>
        <button class="btn btn-accent btn-sm" onclick="event.stopPropagation();openTemplateWizard('${t.template_id}')">📝 智能组装</button>
      </div>
    </div>
  `).join('');
}

async function openTemplateWizard(id) {
  try {
    const t = await api(`/api/templates/${id}`);
    currentTemplateData = t;
    document.getElementById('wizard-title').textContent = '📝 ' + t.title;
    if (t.required_fields && t.required_fields.length) {
      document.getElementById('wizard-fields').innerHTML = t.required_fields.map(f => `
        <div class="form-group">
          <label class="form-label">${escHtml(f.label)}${f.required?' <span style="color:var(--danger)">*</span>':''}</label>
          ${f.type==='textarea' ? `<textarea class="form-textarea" id="wf-${f.key}" style="min-height:80px" placeholder="请输入${f.label}"></textarea>` :
            f.options ? `<select class="form-select" id="wf-${f.key}">${f.options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>` :
            `<input type="${f.type||'text'}" class="form-input" id="wf-${f.key}" placeholder="请输入${f.label}">`}
        </div>
      `).join('');
    }
    document.getElementById('wizard-result').innerHTML = '';
    document.getElementById('template-wizard-overlay').style.display = 'flex';
  } catch(e) { showToast('加载模板失败: '+e.message,'error'); }
}

function closeTemplateWizard() {
  document.getElementById('template-wizard-overlay').style.display = 'none';
  currentTemplateData = null;
}

async function assembleDocument() {
  if (!currentTemplateData) return;
  const fields = {};
  document.querySelectorAll('#wizard-fields [id^="wf-"]').forEach(el => {
    fields[el.id.replace('wf-','')] = el.value;
  });

  try {
    const result = await api(`/api/templates/${currentTemplateData.template_id}/assemble`, {
      method:'POST', body:JSON.stringify(fields)
    });
    document.getElementById('wizard-result').innerHTML = `<div class="card" style="background:#f0fdf4;border-color:#86efac;margin-top:1rem">
      <h4 style="color:#16a34a;margin-bottom:.5rem">✅ 文书生成完成</h4>
      <pre style="font-size:.82rem;white-space:pre-wrap;max-height:300px;overflow-y:auto;background:#fff;padding:.75rem;border-radius:6px">${escHtml(result.content||'')}</pre>
      ${result.download_url?`<a href="${result.download_url}" class="btn btn-accent btn-sm" style="margin-top:.5rem">📥 下载 DOCX</a>`:''}
    </div>`;
  } catch(e) { showToast('生成失败: '+e.message,'error'); }
}

async function downloadTemplate(id) {
  try {
    window.open(`${API}/api/templates/${id}/download`, '_blank');
    showToast('开始下载','success');
  } catch(e) { showToast('下载失败: '+e.message,'error'); }
}

// =========== 导航增强：页面加载时初始化 ===========
const _origNavigateTo = navigateTo;
navigateTo = function(page) {
  _origNavigateTo(page);
  // 当导航到特定页面时加载数据
  setTimeout(() => {
    if (page === 'case-center') loadCaseList();
    if (page === 'case-analysis') initCaseTypeSelector();
    if (page === 'templates') loadTemplates();
    if (page === 'evidence') initEvidencePage();
    if (page === 'calculators') {
      if (document.getElementById('fee-preservation')) {
        document.getElementById('fee-preservation').addEventListener('change', () => {
          document.getElementById('fee-preservation-group').style.display =
            document.getElementById('fee-preservation').checked ? 'block' : 'none';
        });
      }
    }
  }, 100);
};

// 模板向导关闭按钮
document.addEventListener('click', function(e) {
  if (e.target.id === 'template-wizard-overlay') closeTemplateWizard();
});
