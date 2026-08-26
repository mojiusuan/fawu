import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const [cases, setCases] = useState<CaseProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseProfile | null>(null);

  useEffect(() => { loadCases(); }, [statusFilter]);

  // Auto-select case from URL param
  useEffect(() => {
    const caseId = searchParams.get('case');
    if (caseId && cases.length > 0) {
      const c = cases.find(x => x.case_id === caseId);
      if (c) setSelectedCase(c);
    }
  }, [cases, searchParams]);

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

  const shownContent = selectedCase ? (
    <CaseDetail
      caseProfile={selectedCase}
      onBack={() => setSelectedCase(null)}
      onDelete={() => setDeleteTarget(selectedCase.case_id)}
      onNewAnalysis={() => navigate(`/case-analysis?case_type=${selectedCase.case_type}&case_id=${selectedCase.case_id}&case_name=${encodeURIComponent(selectedCase.case_name)}`)}
    />
  ) : (
    <div className="page-section" data-section="case-center">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <div>
          <h2 className="page-title">案件中心</h2>
          <p className="page-desc">管理和追踪法律案件</p>
        </div>
        <button className="btn btn-accent" onClick={() => navigate('/case-analysis')}>+ 新建分析</button>
      </div>

      <div style={{ marginBottom:'1rem' }} data-section="case-center-filter">
        <select className="form-select" style={{ width:'200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : cases.length === 0 ? (
        <EmptyState icon="📋" title="暂无案件" description="点击「新建分析」开始第一个案件分析"
          action={{ label: '新建分析', onClick: () => navigate('/case-analysis') }} />
      ) : (
        <div className="stats-grid" data-section="case-center-grid">
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
    </div>
  );

  return (
    <>
      {shownContent}
      <ConfirmDialog open={!!deleteTarget} title="删除案件" message="确定要删除该案件吗？此操作不可撤销。"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmText="删除" danger />
    </>
  );
}

/* ============ Case Detail (with analysis history) ============ */

const RISK_ICONS: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };

function CaseDetail({ caseProfile: c, onBack, onDelete, onNewAnalysis }: {
  caseProfile: CaseProfile;
  onBack: () => void;
  onDelete: () => void;
  onNewAnalysis: () => void;
}) {
  const { showToast } = useToast();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  useEffect(() => {
    loadAnalyses();
  }, [c.case_id]);

  async function loadAnalyses() {
    setLoadingAnalyses(true);
    try {
      const data = await caseApi.listAnalyses(c.case_id);
      setAnalyses(data);
    } catch {
      // analyses may not exist yet
      setAnalyses([]);
    } finally {
      setLoadingAnalyses(false);
    }
  }

  return (
    <div className="page-section" data-section="case-center-detail">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
        <h2 className="page-title">{c.case_name}</h2>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className="btn btn-outline" onClick={onBack}>← 返回列表</button>
          <button className="btn btn-accent" onClick={onNewAnalysis}>AI 分析</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>删除</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom:'1rem' }}>
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

      {/* Analysis history */}
      <h3 style={{ marginBottom:'.75rem' }} data-section="case-center-history">
        历史分析报告
        {loadingAnalyses && <span className="spinner" style={{ width:14, height:14, borderWidth:2, marginLeft:'.5rem' }} />}
      </h3>

      {!loadingAnalyses && analyses.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
          <p>暂无分析记录</p>
          <button className="btn btn-accent" style={{ marginTop:'.75rem' }} onClick={onNewAnalysis}>→ 新建分析</button>
        </div>
      )}

      {analyses.map((a, idx) => {
        const r = a.report || a;
        const isOpen = expandedAnalysis === a.analysis_id;
        const riskLevel = r.risk_assessment?.level || '';
        return (
          <div key={a.analysis_id} className={`expander ${isOpen ? 'open' : ''}`} style={{ marginBottom:'.5rem' }}>
            <div className="expander-header" onClick={() => setExpandedAnalysis(isOpen ? null : a.analysis_id)}>
              <span>
                {RISK_ICONS[riskLevel] || '⚪'} 分析 #{idx + 1} — {r.case_type_name || a.case_type_name || ''}
              </span>
              <span style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>
                {a.generated_at ? new Date(a.generated_at).toLocaleString('zh-CN') : ''}
              </span>
              <span className="expander-arrow">▼</span>
            </div>
            {isOpen && (
              <div className="expander-body">
                {r.summary && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>案情摘要</strong>
                    <p style={{ marginTop:'.25rem', color:'var(--text-secondary)', lineHeight:1.7 }}>{r.summary}</p>
                  </div>
                )}
                {r.risk_assessment && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>风险评估：</strong>
                    <span className={`badge badge-${riskLevel === 'high' ? 'red' : riskLevel === 'medium' ? 'yellow' : 'green'}`}>
                      {riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险'}
                    </span>
                    {r.risk_assessment.factors && r.risk_assessment.factors.length > 0 && (
                      <ul style={{ marginTop:'.4rem', paddingLeft:'1.2rem' }}>
                        {r.risk_assessment.factors.map((f: string, i: number) => (
                          <li key={i} style={{ color:'var(--text-secondary)', marginBottom:'.2rem' }}>{f}</li>
                        ))}
                      </ul>
                    )}
                    {r.risk_assessment.suggestions && r.risk_assessment.suggestions.length > 0 && (
                      <div style={{ marginTop:'.5rem' }}>
                        <strong>建议：</strong>
                        <ul style={{ marginTop:'.25rem', paddingLeft:'1.2rem' }}>
                          {r.risk_assessment.suggestions.map((s: string, i: number) => (
                            <li key={i} style={{ color:'var(--text-secondary)', marginBottom:'.2rem' }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {r.legal_basis && r.legal_basis.length > 0 && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>法律依据</strong>
                    {r.legal_basis.map((lb: any, i: number) => (
                      <div key={i} style={{ marginTop:'.3rem', padding:'.4rem .6rem', background:'var(--bg)', borderRadius:4 }}>
                        <span style={{ fontWeight:600 }}>{lb.law} {lb.article}</span>
                        {lb.content && <p style={{ marginTop:'.2rem', color:'var(--text-secondary)', fontSize:'.85rem' }}>{lb.content}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {r.similar_cases && r.similar_cases.length > 0 && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>相似判例</strong>
                    {r.similar_cases.map((sc: any, i: number) => (
                      <div key={i} style={{ marginTop:'.3rem', padding:'.4rem .6rem', background:'var(--bg)', borderRadius:4 }}>
                        <span style={{ fontWeight:600 }}>{sc.title || sc.case_name || ''}</span>
                        {sc.case_number && <span style={{ marginLeft:'.5rem', color:'var(--text-muted)' }}>{sc.case_number}</span>}
                        {sc.court && <span style={{ marginLeft:'.5rem', fontSize:'.8rem', color:'var(--text-muted)' }}>{sc.court}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {r.evidence_checklist && r.evidence_checklist.length > 0 && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>证据清单</strong>
                    {r.evidence_checklist.map((ec: any, i: number) => (
                      <div key={i} style={{ marginTop:'.3rem', display:'flex', gap:'.5rem', alignItems:'center' }}>
                        <span>{ec.collected ? '✅' : '⬜'}</span>
                        <span style={{ fontWeight:500 }}>{ec.name || ec.item}</span>
                        {ec.description && <span style={{ color:'var(--text-muted)', fontSize:'.8rem' }}>— {ec.description}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {r.limitation_check && Object.keys(r.limitation_check).length > 0 && (
                  <div style={{ marginBottom:'.75rem' }}>
                    <strong>时效检查</strong>
                    <div style={{ marginTop:'.3rem', padding:'.4rem .6rem', background:'var(--bg)', borderRadius:4 }}>
                      <span>{r.limitation_check.limitation_name || ''}：{r.limitation_check.period_text || ''}</span>
                      {r.limitation_check.status_text && (
                        <span className={`badge ${r.limitation_check.is_expired ? 'badge-red' : 'badge-green'}`} style={{ marginLeft:'.5rem' }}>
                          {r.limitation_check.status_text}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {r.disclaimer && (
                  <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.75rem', padding:'.5rem', background:'var(--bg)', borderRadius:4 }}>
                    ⚠️ {r.disclaimer}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
