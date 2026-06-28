import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';
import Loading from '../../common/Loading';
import EmptyState from '../../common/EmptyState';

export default function Audit() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadLogs(); }, [taskFilter, search]);

  async function loadLogs() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (taskFilter) qs.set('task_type', taskFilter);
      if (search) qs.set('search', search);
      qs.set('limit', '50');
      const data: any = await api.get(`/api/audit/logs?${qs.toString()}`);
      setLogs(data.logs || []);
    } catch (e: unknown) {
      showToast((e as Error).message || '加载审计日志失败', 'error');
    } finally { setLoading(false); }
  }

  const stats = {
    total: logs.length,
    errorRate: logs.filter(l => l.latency_ms > 10000).length,
  };

  return (
    <div className="page-section">
      <h2 className="page-title">审计报告</h2>
      <p className="page-desc">AI 调用全链路追溯与合规审计</p>

      <div className="stats-grid">
        <div className="stat-card"><div className="value">{stats.total}</div><div className="label">审计记录</div></div>
        <div className="stat-card"><div className="value">{stats.errorRate}</div><div className="label">慢请求 (&gt;10s)</div></div>
      </div>

      <div className="card" style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
          <select className="form-select" style={{ width:'150px' }} value={taskFilter} onChange={e => setTaskFilter(e.target.value)}>
            <option value="">全部类型</option>
            <option value="contract_review">合同审查</option>
            <option value="legal_consultation">法律咨询</option>
            <option value="rpa_data_extraction">RPA 提取</option>
            <option value="contract_generation">合同生成</option>
          </select>
          <input className="form-input" style={{ flex:1, minWidth:'200px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索关键词..." />
        </div>
      </div>

      {loading ? <Loading /> : logs.length === 0 ? (
        <EmptyState icon="🔍" title="暂无审计记录" description="系统产生的 AI 调用记录将显示在这里" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>时间</th><th>任务类型</th><th>案件ID</th><th>用户</th><th>模型</th><th>延迟(ms)</th><th>审计ID</th></tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontSize:'.8rem' }}>{l.timestamp ? new Date(l.timestamp).toLocaleString('zh-CN') : '-'}</td>
                  <td><span className="badge badge-blue">{l.task_type || '-'}</span></td>
                  <td>{l.case_id || '-'}</td>
                  <td>{l.user_id || '-'}</td>
                  <td>{l.model || '-'}</td>
                  <td style={{ color: l.latency_ms > 10000 ? 'var(--danger)' : 'var(--text-secondary)' }}>{l.latency_ms || '-'}</td>
                  <td style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>{l.audit_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
