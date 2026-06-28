import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../contexts/ToastContext';
import { caseApi } from '../../../api/cases';
import type { CaseProfile } from '../../../types';
import Loading from '../../common/Loading';
import EmptyState from '../../common/EmptyState';
import ConfirmDialog from '../../common/ConfirmDialog';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'assessing', label: '评估中' },
  { value: 'negotiating', label: '协商中' },
  { value: 'litigating', label: '诉讼中' },
  { value: 'closed', label: '已结案' },
];

export default function CaseCenter() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseProfile | null>(null);

  useEffect(() => { loadCases(); }, [statusFilter]);

  async function loadCases() {
    setLoading(true);
    try {
      const data = await caseApi.list(statusFilter ? { status: statusFilter } : undefined);
      setCases(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '加载案件失败', 'error');
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await caseApi.delete(deleteTarget);
      showToast('案件已删除', 'success');
      setDeleteTarget(null);
      setSelectedCase(null);
      loadCases();
    } catch (e) { showToast(e instanceof Error ? e.message : '删除失败', 'error'); }
  }

  // Show case detail
  if (selectedCase) {
    const c = selectedCase;
    return (
      <div className="page-section">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 className="page-title">{c.case_name}</h2>
          <div style={{ display:'flex', gap:'.5rem' }}>
            <button className="btn btn-outline" onClick={() => setSelectedCase(null)}>← 返回列表</button>
            <button className="btn btn-accent" onClick={() => navigate(`/case-analysis?case_type=${c.case_type}&case_name=${encodeURIComponent(c.case_name)}`)}>AI 分析</button>
            <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(c.case_id)}>删除</button>
          </div>
        </div>
        <div className="card" style={{ marginBottom:'.75rem' }}>
          <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <span className="badge badge-blue">{c.case_type_name}</span>
            <span className={`badge badge-${c.status === 'closed' ? 'green' : c.status === 'litigating' ? 'red' : 'blue'}`}>
              {STATUS_OPTIONS.find(s => s.value === c.status)?.label || c.status}
            </span>
            <span style={{ fontSize:'.8rem', color:'var(--text-muted)' }}>创建于 {new Date(c.created_at).toLocaleDateString('zh-CN')}</span>
          </div>
          <h4>案件描述</h4>
          <p style={{ marginTop:'.5rem', color:'var(--text-secondary)', lineHeight:1.8 }}>{c.description || '无'}</p>
          {c.structured_facts && Object.keys(c.structured_facts).length > 0 && (
            <>
              <h4 style={{ marginTop:'1rem' }}>案情要素</h4>
              <div style={{ marginTop:'.5rem' }}>
                {Object.entries(c.structured_facts).map(([k, v]) => (
                  <div key={k} style={{ padding:'.3rem 0', borderBottom:'1px solid var(--border)', display:'flex' }}>
                    <span style={{ fontWeight:600, minWidth:120 }}>{k}:</span>
                    <span style={{ color:'var(--text-secondary)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <ConfirmDialog
          open={!!deleteTarget}
          title="删除案件"
          message="确定要删除该案件吗？此操作不可撤销。"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="删除"
          danger
        />
      </div>
    );
  }

  return (
    <div className="page-section">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div>
          <h2 className="page-title">案件中心</h2>
          <p className="page-desc">管理和追踪法律案件</p>
        </div>
        <button className="btn btn-accent" onClick={() => navigate('/case-analysis')}>+ 新建分析</button>
      </div>

      <div style={{ marginBottom:'1rem' }}>
        <select className="form-select" style={{ width:'200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : cases.length === 0 ? (
        <EmptyState icon="📋" title="暂无案件" description="点击「新建分析」开始第一个案件分析"
          action={{ label: '新建分析', onClick: () => navigate('/case-analysis') }} />
      ) : (
        <div className="stats-grid">
          {cases.map(c => (
            <div key={c.case_id} className="card" style={{ cursor:'pointer' }} onClick={() => setSelectedCase(c)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <h4 style={{ marginBottom:'.5rem' }}>{c.case_name}</h4>
                <span className={`badge badge-${c.status === 'closed' ? 'green' : c.status === 'litigating' ? 'red' : 'blue'}`}>
                  {STATUS_OPTIONS.find(s => s.value === c.status)?.label || c.status}
                </span>
              </div>
              <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginBottom:'.5rem' }}>{c.case_type_name}</p>
              <p style={{ fontSize:'.85rem', color:'var(--text-secondary)', marginBottom:'.75rem' }}>
                {c.description?.substring(0, 100)}{(c.description?.length || 0) > 100 ? '...' : ''}
              </p>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.75rem', color:'var(--text-muted)' }}>
                <span>创建于 {new Date(c.created_at).toLocaleDateString('zh-CN')}</span>
                <button className="btn btn-sm btn-outline" style={{ color:'var(--danger)', borderColor:'var(--danger)' }}
                  onClick={e => { e.stopPropagation(); setDeleteTarget(c.case_id); }}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="删除案件" message="确定要删除该案件吗？此操作不可撤销。"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmText="删除" danger />
    </div>
  );
}
