import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../../../types';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="page-section">
      <h2 className="page-title">系统首页</h2>
      <p className="page-desc">欢迎回来，{user.display_name}</p>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="icon">📄</div>
          <div className="value">合同管理</div>
          <div className="label">智能审查 · 风险预警</div>
        </div>
        <div className="stat-card">
          <div className="icon">💬</div>
          <div className="value">7×24h</div>
          <div className="label">智能法律咨询</div>
        </div>
        <div className="stat-card">
          <div className="icon">🔗</div>
          <div className="value">知识图谱</div>
          <div className="label">法条 · 判例 · 关联追溯</div>
        </div>
      </div>

      {/* Role-specific Dashboard */}
      <RoleDashboard role={user.role} navigate={navigate} />

      {/* System Info */}
      <div className="card" style={{ marginTop:'1.5rem' }}>
        <div className="tabs">
          <button className="tab active">AI 引擎</button>
          <button className="tab">技术架构</button>
          <button className="tab">安全合规</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>模块</th><th>技术栈</th><th>状态</th></tr>
            </thead>
            <tbody>
              <tr><td>LLM 引擎</td><td>DeepSeek / Claude / GPT-4o</td><td><span className="badge badge-green">运行中</span></td></tr>
              <tr><td>RAG 检索</td><td>ChromaDB + Whoosh 混合检索</td><td><span className="badge badge-green">运行中</span></td></tr>
              <tr><td>知识图谱</td><td>Neo4j 图数据库</td><td><span className="badge badge-green">运行中</span></td></tr>
              <tr><td>Embedding</td><td>BGE-large-zh-v1.5 (本地)</td><td><span className="badge badge-green">运行中</span></td></tr>
              <tr><td>Agent 编排</td><td>LangGraph Supervisor</td><td><span className="badge badge-green">运行中</span></td></tr>
              <tr><td>审计日志</td><td>JSONL 追加写入</td><td><span className="badge badge-green">运行中</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleDashboard({ role, navigate }: { role: Role; navigate: (path: string) => void }) {
  switch (role) {
    case 'business':
      return (
        <div className="home-grid">
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>📋 我的合同</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              上传合同、指派法务审查、追踪审查进度
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/contract')}>上传合同</button>
              <button className="btn btn-outline" onClick={() => navigate('/tasks')}>我的任务</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>💬 智能咨询</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              7×24 小时 AI 法律咨询，支持人工转接
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/consultation')}>开始咨询</button>
            </div>
          </div>
        </div>
      );

    case 'legal':
      return (
        <div className="home-grid">
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>📌 待办任务</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              待审查合同、待分析案件、待回复转接
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/tasks')}>查看任务看板</button>
              <button className="btn btn-outline" onClick={() => navigate('/contract')}>合同审查</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>🔗 知识图谱</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              法条关联检索、判例追溯、实体查询
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/kg')}>打开图谱</button>
            </div>
          </div>
        </div>
      );

    case 'auditor':
      return (
        <div className="home-grid">
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>🔍 审计概览</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              系统操作日志、AI 调用追溯、合规检查
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/audit')}>审计报告</button>
              <button className="btn btn-outline" onClick={() => navigate('/tasks')}>整改任务</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>📋 案件全局视野</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              独立监督职责，查看全部案件处理情况
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/case-center')}>案件中心</button>
            </div>
          </div>
        </div>
      );

    case 'admin':
      return (
        <div className="home-grid">
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>⚙️ 系统管理</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              用户管理、系统配置、知识库初始化
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/settings')}>系统设置</button>
              <button className="btn btn-outline" onClick={() => navigate('/tasks')}>任务分配</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>📊 全局监控</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'.88rem', marginBottom:'1rem' }}>
              各角色工作量分布、系统运行状态
            </p>
            <div className="quick-actions">
              <button className="btn btn-accent" onClick={() => navigate('/audit')}>审计日志</button>
              <button className="btn btn-outline" onClick={() => navigate('/case-center')}>案件中心</button>
            </div>
          </div>
        </div>
      );
  }
}
