/**
 * 智能法务系统 · 前端应用逻辑
 */
const API = window.location.origin;

// =========== GSAP 动画系统 ===========
gsap.registerPlugin(ScrollTrigger);

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
let authToken = localStorage.getItem('legal_auth_token') || null;
let currentUser = JSON.parse(localStorage.getItem('legal_auth_user') || 'null');

const ROLE_PAGE_PERMISSIONS = {
  home: ['admin','legal','business','auditor'],
  contract: ['admin','legal','business'],
  consultation: ['admin','legal','business','auditor'],
  kg: ['admin','legal'],
  audit: ['admin','auditor'],
  rpa: ['admin','legal'],
  settings: ['admin'],
};

const ROLE_LABELS = {
  admin: '系统管理员',
  legal: '法务人员',
  business: '业务人员',
  auditor: '审计员',
};

function getAuthHeaders() {
  return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}

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

// =========== 认证操作 ===========
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
    applyRoleUI();
    showToast(`欢迎回来，${currentUser.display_name}`, 'success');
    loadContracts();
    loadChatHistory();
    loadAudit();
    loadSettings();
    loadKGStats();
  } catch(e) {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-error').textContent = e.message;
  }
}

function doLogout() {
  // 保存当前对话
  saveChatToStorage();
  clearAuth();
  showLoginOverlay();
  closeSidebar();
  showToast('已退出登录', 'info');
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
    area.innerHTML = `<div class="chat-empty"><div class="icon">⚖️</div><div>欢迎使用智能法律咨询</div><div style="font-size:.85rem;color:var(--text-muted)">AI 将基于法律法规知识库为您解答</div></div>`;
    chatRendered = 0;
    return;
  }
  let exportBtn = chatHistory.length ? '<div style="text-align:right;margin-bottom:.5rem"><button class="btn btn-outline btn-sm" onclick="exportChat()">📥 导出对话为 Word</button></div>' : '';
  area.innerHTML = exportBtn + chatHistory.map((m, idx) => {
    let body = m.role === 'assistant' ? renderMarkdown(m.content) : m.content.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let extra = '';
    if (m.law_basis?.length) extra += `<details style="margin-top:.5rem"><summary style="cursor:pointer;font-size:.82rem;color:var(--accent)">📚 法律依据 (${m.law_basis.length}条)</summary>${m.law_basis.map(b=>`<div style="font-size:.8rem;margin-top:.25rem">· ${b}</div>`).join('')}</details>`;
    if (m.search_results?.length) extra += `<details style="margin-top:.3rem"><summary style="cursor:pointer;font-size:.82rem;color:var(--accent)">🔍 检索来源 (${m.search_results.length}条)</summary>${m.search_results.map(r=>`<div style="font-size:.78rem;color:var(--text-secondary);margin-top:.25rem">${r.source||''} ${r.article||''} · 相关度:${r.relevance||'中'}</div>`).join('')}</details>`;
    if (m.disclaimer) extra += `<div style="font-size:.72rem;color:var(--text-muted);margin-top:.5rem">${m.disclaimer}</div>`;
    return `<div class="chat-msg ${m.role}" data-chat-idx="${idx}">${m.role==='user'?'您':'AI 助手'}<div style="margin-top:.3rem">${body}</div>${extra}</div>`;
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
    let html = '<div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.5rem">已保存的合同</div>';
    data.forEach(c => {
      const status = c.review_status === '已审查' ? '<span class="badge badge-green">已审查</span>' : '<span class="badge badge-gray">未审查</span>';
      const preview = (c.content||'').substring(0,150).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += `<div class="expander" style="margin-bottom:3px">
        <div class="expander-header" style="font-size:.84rem;padding:.5rem .8rem" onclick="this.parentElement.classList.toggle('open')">
          <span>📄 ${c.title} <span style="color:var(--text-muted);font-size:.75rem">${c.id}</span></span>
          <span style="display:flex;gap:.4rem;align-items:center">${status}<span class="expander-arrow">▼</span></span>
        </div>
        <div class="expander-body" style="padding:.6rem .8rem">
          <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.4rem">${c.party_a ? '甲方: '+c.party_a+' · ':''}${c.party_b ? '乙方: '+c.party_b : ''}${c.contract_type ? ' · '+c.contract_type : ''}</div>
          <div style="font-size:.78rem;color:var(--text-muted);max-height:120px;overflow-y:auto;white-space:pre-wrap;line-height:1.6;background:var(--bg);padding:.4rem .6rem;border-radius:4px">${preview}</div>
          <div style="margin-top:.5rem;display:flex;gap:.4rem">
            <button class="btn btn-accent btn-sm" onclick="document.getElementById('review-contract-id').value='${c.id}';showToast('已选中: ${c.title}','info')">🔍 审查</button>
            <button class="btn btn-outline btn-sm" onclick="document.getElementById('compare-contract-a-id').value='${c.id}';showToast('已选中: ${c.title}','info')">⚖ 比对</button>
            ${c.review_status==='已审查' ? `<button class="btn btn-outline btn-sm" onclick="exportReview('${c.id}')">📥 导出</button>` : ''}
          </div>
        </div></div>`;
    });
    area.innerHTML = html;
    initExpanders();
  } catch(e) {}
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
  };
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

// =========== Markdown 渲染 ===========
function renderMarkdown(md) {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h5 style="font-size:.92rem;margin:1.2rem 0 .4rem;color:var(--primary-dark)">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:1.02rem;margin:1.4rem 0 .5rem;color:var(--primary-dark);padding-bottom:.3rem;border-bottom:2px solid var(--border)">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1.12rem;margin:1.5rem 0 .6rem;color:var(--primary)">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">')
    .replace(/^- (.+)$/gm, '<li style="margin:.25rem 0;line-height:1.7;font-size:.88rem">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);margin:.5rem 0;padding:.4rem 1rem;background:#f8fafc;border-radius:0 6px 6px 0;font-size:.85rem;color:var(--text-secondary)">$1</blockquote>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:2px 7px;border-radius:3px;font-size:.84rem;color:var(--danger)">$1</code>');

  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="padding-left:1.2rem;margin:.5rem 0">$1</ul>');
  html = html.replace(/\n\n/g, '<br>');
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
