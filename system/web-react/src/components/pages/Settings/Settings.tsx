import { useState, useEffect } from 'react';
import { settingsApi } from '../../../api/settings';
import { authApi } from '../../../api/auth';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { UserInfo, Role } from '../../../types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'legal', label: '法务人员' },
  { value: 'business', label: '业务人员' },
  { value: 'auditor', label: '审计员' },
];

export default function Settings() {
  const { user, hasRole } = useAuth();
  const { showToast } = useToast();

  if (!hasRole('admin')) {
    return (
      <div className="page-section">
        <h2 className="page-title">系统设置</h2>
        <p style={{ color:'var(--text-secondary)' }}>仅管理员可访问此页面。</p>
      </div>
    );
  }

  return (
    <div className="page-section">
      <h2 className="page-title">系统设置</h2>
      <p className="page-desc">管理 LLM 配置、API 密钥、Neo4j 连接和用户账户</p>

      <div className="settings-grid">
        <LLMConfig showToast={showToast} />
        <ApiKeys showToast={showToast} />
        <Neo4jConfig showToast={showToast} />
        <SystemParams showToast={showToast} />
        <KnowledgeBase showToast={showToast} />
        <UserManagement showToast={showToast} />
      </div>
    </div>
  );
}

/* ====== LLM Config ====== */

function LLMConfig({ showToast }: any) {
  const [provider, setProvider] = useState('deepseek');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-6');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await settingsApi.save({
        LLM_PROVIDER: provider,
        LLM_TEMPERATURE: temperature,
        LLM_MAX_TOKENS: maxTokens,
        CLAUDE_MODEL: claudeModel,
        OPENAI_MODEL: openaiModel,
        DEEPSEEK_MODEL: deepseekModel,
      });
      showToast('LLM 配置已保存', 'success');
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>🤖 LLM 配置</h3>
      <div className="form-group">
        <label className="form-label">服务商</label>
        <select className="form-select" value={provider} onChange={e => setProvider(e.target.value)}>
          <option value="deepseek">DeepSeek</option>
          <option value="claude">Claude</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">温度 ({temperature})</label>
        <input type="range" min="0" max="1" step="0.1" value={temperature}
          onChange={e => setTemperature(parseFloat(e.target.value))} style={{ width:'100%' }} />
      </div>
      <div className="form-group">
        <label className="form-label">模型</label>
        {provider === 'claude' && <input className="form-input" value={claudeModel} onChange={e => setClaudeModel(e.target.value)} />}
        {provider === 'openai' && <input className="form-input" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} />}
        {provider === 'deepseek' && <input className="form-input" value={deepseekModel} onChange={e => setDeepseekModel(e.target.value)} />}
      </div>
      <div className="form-group">
        <label className="form-label">最大 Tokens</label>
        <input className="form-input" type="number" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value) || 4096)} />
      </div>
      <button className="btn btn-accent btn-sm" onClick={save} disabled={loading}>保存配置</button>
    </div>
  );
}

/* ====== API Keys ====== */

function ApiKeys({ showToast }: any) {
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');

  async function save() {
    try {
      await settingsApi.save({
        CLAUDE_API_KEY: claudeKey || undefined,
        OPENAI_API_KEY: openaiKey || undefined,
        DEEPSEEK_API_KEY: deepseekKey || undefined,
      });
      showToast('API 密钥已保存', 'success');
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>🔑 API 密钥</h3>
      <div className="form-group">
        <label className="form-label">Anthropic API Key</label>
        <input className="form-input" type="password" value={claudeKey} onChange={e => setClaudeKey(e.target.value)} placeholder="sk-ant-..." />
      </div>
      <div className="form-group">
        <label className="form-label">OpenAI API Key</label>
        <input className="form-input" type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
      </div>
      <div className="form-group">
        <label className="form-label">DeepSeek API Key</label>
        <input className="form-input" type="password" value={deepseekKey} onChange={e => setDeepseekKey(e.target.value)} placeholder="sk-..." />
      </div>
      <button className="btn btn-accent btn-sm" onClick={save}>保存密钥</button>
      <button className="btn btn-outline btn-sm" style={{ marginLeft:'.5rem' }} onClick={async () => {
        try {
          const res = await settingsApi.testLLM();
          showToast(res.message, res.success ? 'success' : 'error');
        } catch (e: any) { showToast(e.message || '测试失败', 'error'); }
      }}>测试连接</button>
    </div>
  );
}

/* ====== Neo4j Config ====== */

function Neo4jConfig({ showToast }: any) {
  const [uri, setUri] = useState('neo4j://127.0.0.1:7687');
  const [username, setUsername] = useState('neo4j');
  const [password, setPassword] = useState('');

  async function save() {
    try {
      await settingsApi.save({ NEO4J_URI: uri, NEO4J_USERNAME: username, NEO4J_PASSWORD: password || undefined });
      showToast('Neo4j 配置已保存', 'success');
    } catch (e: any) { showToast(e.message || '保存失败', 'error'); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>🔗 Neo4j 图数据库</h3>
      <div className="form-group">
        <label className="form-label">连接地址</label>
        <input className="form-input" value={uri} onChange={e => setUri(e.target.value)} placeholder="neo4j://127.0.0.1:7687" />
      </div>
      <div className="form-group">
        <label className="form-label">用户名</label>
        <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">密码</label>
        <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <button className="btn btn-accent btn-sm" onClick={save}>保存</button>
      <button className="btn btn-outline btn-sm" style={{ marginLeft:'.5rem' }} onClick={async () => {
        try {
          const res = await settingsApi.testNeo4j();
          showToast(res.message, res.success ? 'success' : 'error');
        } catch (e: any) { showToast(e.message || '测试失败', 'error'); }
      }}>测试连接</button>
    </div>
  );
}

/* ====== System Params ====== */

function SystemParams({ showToast }: any) {
  const [port, setPort] = useState('8080');
  const [jwtKey, setJwtKey] = useState('');
  const [jwtExpire, setJwtExpire] = useState('480');
  const [logLevel, setLogLevel] = useState('INFO');

  async function save() {
    try {
      await settingsApi.save({
        PORT: parseInt(port) || 8080,
        ACCESS_TOKEN_EXPIRE_MINUTES: parseInt(jwtExpire) || 480,
        LOG_LEVEL: logLevel,
      });
      showToast('系统参数已保存', 'success');
    } catch (e: any) { showToast(e.message || '保存失败', 'error'); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>⚙️ 系统参数</h3>
      <div className="form-group">
        <label className="form-label">服务端口</label>
        <input className="form-input" type="number" value={port} onChange={e => setPort(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Token 有效期 (分钟)</label>
        <input className="form-input" type="number" value={jwtExpire} onChange={e => setJwtExpire(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">日志级别</label>
        <select className="form-select" value={logLevel} onChange={e => setLogLevel(e.target.value)}>
          <option>DEBUG</option><option>INFO</option><option>WARNING</option><option>ERROR</option>
        </select>
      </div>
      <button className="btn btn-accent btn-sm" onClick={save}>保存参数</button>
    </div>
  );
}

/* ====== Knowledge Base ====== */

function KnowledgeBase({ showToast }: any) {
  const [status, setStatus] = useState<any>(null);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => { loadStatus(); }, []);

  async function loadStatus() {
    try {
      const s = await settingsApi.kbStatus();
      setStatus(s);
    } catch { /* kb not available */ }
  }

  async function initKB() {
    setInitializing(true);
    try {
      const res = await settingsApi.initKB();
      showToast(res.message, res.success ? 'success' : 'error');
      loadStatus();
    } catch (e: any) { showToast(e.message || '初始化失败', 'error'); }
    finally { setInitializing(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>📚 知识库管理</h3>
      {status ? (
        <div style={{ fontSize:'.85rem', marginBottom:'1rem' }}>
          <div>法规文档: {status.law_count || 0}</div>
          <div>判例文档: {status.case_count || 0}</div>
          <div>ChromaDB: {status.chromadb ? '✅' : '❌'}</div>
          <div>Whoosh: {status.whoosh ? '✅' : '❌'}</div>
        </div>
      ) : <p style={{ color:'var(--text-muted)', marginBottom:'1rem' }}>点击刷新获取状态</p>}
      <button className="btn btn-accent btn-sm" onClick={loadStatus}>刷新状态</button>
      <button className="btn btn-primary btn-sm" style={{ marginLeft:'.5rem' }} onClick={initKB} disabled={initializing}>
        {initializing ? '初始化中...' : '初始化知识库'}
      </button>
    </div>
  );
}

/* ====== User Management ====== */

function UserManagement({ showToast }: any) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [newName, setNewName] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<Role>('business');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const data = await authApi.getUsers();
      setUsers(data);
    } catch (e: any) { showToast(e.message || '加载用户失败', 'error'); }
  }

  async function createUser() {
    if (!newName || !newPass || !newDisplay) { showToast('请填写完整信息', 'warning'); return; }
    setCreating(true);
    try {
      await authApi.createUser({ username: newName, display_name: newDisplay, password: newPass, role: newRole });
      showToast('用户创建成功', 'success');
      setNewName(''); setNewDisplay(''); setNewPass('');
      loadUsers();
    } catch (e: any) { showToast(e.message || '创建失败', 'error'); }
    finally { setCreating(false); }
  }

  async function deleteUser(uid: string) {
    if (!confirm('确定删除该用户？')) return;
    try {
      await authApi.deleteUser(uid);
      showToast('用户已删除', 'info');
      loadUsers();
    } catch (e: any) { showToast(e.message || '删除失败', 'error'); }
  }

  async function roleChange(uid: string, role: Role) {
    try {
      await authApi.updateUser(uid, { role, password: undefined });
      showToast('角色已更新', 'success');
      loadUsers();
    } catch (e: any) { showToast(e.message || '更新失败', 'error'); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>👥 用户管理</h3>

      {/* Create user form */}
      <div style={{ background:'var(--bg)', padding:'1rem', borderRadius:'var(--radius-sm)', marginBottom:'1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="英文+数字" maxLength={32} />
          </div>
          <div className="form-group">
            <label className="form-label">显示名</label>
            <input className="form-input" value={newDisplay} onChange={e => setNewDisplay(e.target.value)} placeholder="中文名称" maxLength={64} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">密码</label>
            <input className="form-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="至少8位" minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label">角色</label>
            <select className="form-select" value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-accent btn-sm" onClick={createUser} disabled={creating}>
          {creating ? '创建中...' : '创建用户'}
        </button>
      </div>

      {/* User list */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>用户名</th><th>显示名</th><th>角色</th><th>创建时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.display_name}</td>
                <td>
                  <select className="form-select" value={u.role} onChange={e => roleChange(u.id, e.target.value as Role)}
                    style={{ width:'auto', padding:'.2rem .5rem', fontSize:'.8rem' }} disabled={u.id === me?.id}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td style={{ fontSize:'.8rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.id)} disabled={u.id === me?.id}
                    title={u.id === me?.id ? '不能删除自己' : '删除用户'}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
