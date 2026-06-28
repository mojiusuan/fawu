import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { caseApi } from '../../../api/cases';
import { useToast } from '../../../contexts/ToastContext';
import type { CaseAnalysis as CaseAnalysisType } from '../../../types';

interface CaseTypeDef {
  key: string;
  name: string;
  description?: string;
  fields: { key: string; label: string; type: string; options?: string[] }[];
}

export default function CaseAnalysis() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [caseTypes, setCaseTypes] = useState<CaseTypeDef[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [caseName, setCaseName] = useState('');
  const [description, setDescription] = useState('');
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CaseAnalysisType | null>(null);

  useEffect(() => {
    loadCaseTypes();
  }, []);

  async function loadCaseTypes() {
    try {
      const data = await caseApi.getTypes();
      setCaseTypes((data as any).types || data);
    } catch { /* will show empty */ }
  }

  const selectedTypeDef = caseTypes.find(t => t.key === selectedType);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // 创建案件
      await caseApi.create({ case_name: caseName, case_type: selectedType, description });
      // 执行分析
      const analysis = await caseApi.analyze(selectedType, facts);
      setResult(analysis);
      setStep(3);
      showToast('分析完成', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message || '分析失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="page-section">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <h2 className="page-title">分析报告</h2>
          <button className="btn btn-outline" onClick={() => navigate(`/case-center`)}>返回案件中心</button>
        </div>

        <div className="card" style={{ marginBottom:'.75rem' }}>
          <h3>📋 案件摘要</h3>
          <p style={{ marginTop:'.5rem', lineHeight:1.8 }}>{result.summary}</p>
        </div>

        <div className="card" style={{ marginBottom:'.75rem' }}>
          <h3>⚖️ 法律依据</h3>
          {(result.legal_basis || []).map((lb, i) => (
            <div key={i} style={{ marginTop:'.5rem', padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
              <strong>{lb.law} 第{lb.article}条</strong>
              <p style={{ color:'var(--text-secondary)' }}>{lb.content}</p>
            </div>
          ))}
        </div>

        {result.similar_cases?.length > 0 && (
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <h3>📖 相似判例</h3>
            {result.similar_cases.map((sc, i) => (
              <div key={i} style={{ marginTop:'.5rem', padding:'.5rem 0' }}>
                <strong>{sc.title}</strong> <span style={{ color:'var(--text-muted)' }}>案号: {sc.case_number}</span>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom:'.75rem' }}>
          <h3>⚠️ 风险评估</h3>
          <p style={{ marginTop:'.5rem' }}>
            整体风险: <span className={`badge badge-${result.risk_assessment?.overall_risk === 'high' ? 'red' : result.risk_assessment?.overall_risk === 'medium' ? 'yellow' : 'green'}`}>
              {result.risk_assessment?.overall_risk || '-'}
            </span>
          </p>
          {result.risk_assessment?.verdict && <p style={{ marginTop:'.5rem', color:'var(--text-secondary)' }}>{result.risk_assessment.verdict}</p>}
        </div>

        {result.evidence_checklist?.length > 0 && (
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <h3>📎 证据清单</h3>
            {result.evidence_checklist.map((ev, i) => (
              <div key={i} style={{ marginTop:'.5rem' }}>
                <input type="checkbox" defaultChecked={ev.status === 'required'} readOnly /> {ev.item}
              </div>
            ))}
          </div>
        )}

        {result.limitation_check && (
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <h3>⏰ 时效检查</h3>
            <p>类型: {result.limitation_check.type} | 期限: {result.limitation_check.period}</p>
            <p>截止日期: {result.limitation_check.deadline} | {result.limitation_check.is_expired ? '⚠️ 已过期' : '✅ 在时效内'}</p>
          </div>
        )}

        {result.fee_estimate && (
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <h3>💰 费用预估</h3>
            <p>诉讼费: ¥{result.fee_estimate.court_fee?.toLocaleString()}</p>
            {result.fee_estimate.note && <p style={{ color:'var(--text-muted)' }}>{result.fee_estimate.note}</p>}
          </div>
        )}

        <div className="chat-disclaimer">{result.disclaimer}</div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <h2 className="page-title">案情分析</h2>
      <p className="page-desc">AI 辅助案情分析，生成结构化报告</p>

      {/* Step Indicator */}
      <div style={{ display:'flex', gap:'2rem', marginBottom:'1.5rem' }}>
        {['选择案件类型', '填写案情事实', '生成分析报告'].map((label, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'.5rem', opacity: step === i + 1 ? 1 : 0.4 }}>
            <div style={{
              width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
              background: step === i + 1 ? 'var(--accent)' : 'var(--text-muted)', color:'#fff', fontWeight:600, fontSize:'.85rem'
            }}>{i + 1}</div>
            <span style={{ fontSize:'.88rem', fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">案件名称</label>
              <input className="form-input" value={caseName} onChange={e => setCaseName(e.target.value)} placeholder="为案件命名" />
            </div>
            <div className="form-group">
              <label className="form-label">案件描述</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述案件情况" rows={2} />
            </div>
          </div>

          <div className="stats-grid" style={{ marginTop:'1rem' }}>
            {caseTypes.map(ct => (
              <div key={ct.key} className={`card`} style={{
                cursor:'pointer', border: selectedType === ct.key ? '2px solid var(--accent)' : undefined,
                textAlign:'center'
              }} onClick={() => setSelectedType(ct.key)}>
                <div style={{ fontSize:'2rem' }}>📋</div>
                <div style={{ fontWeight:600, marginTop:'.5rem' }}>{ct.name}</div>
              </div>
            ))}
          </div>

          <button className="btn btn-accent" style={{ marginTop:'1rem' }}
            disabled={!selectedType || !caseName.trim()}
            onClick={() => setStep(2)}>
            下一步 → 填写案情事实
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && selectedTypeDef && (
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginBottom:'1rem' }} onClick={() => setStep(1)}>← 返回选择类型</button>
          <div className="card">
            <h3 style={{ marginBottom:'1rem' }}>{selectedTypeDef.name} — 案件信息</h3>
            {selectedTypeDef.fields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="form-select" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))}>
                    <option value="">-- 选择 --</option>
                    {(f.options || []).map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="form-textarea" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))} rows={3} />
                ) : f.type === 'date' ? (
                  <input className="form-input" type="date" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))} />
                ) : f.type === 'number' ? (
                  <input className="form-input" type="number" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))} />
                ) : f.type === 'boolean' ? (
                  <select className="form-select" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))}>
                    <option value="">-- 选择 --</option><option value="是">是</option><option value="否">否</option>
                  </select>
                ) : (
                  <input className="form-input" value={facts[f.key] || ''} onChange={e => setFacts(prev => ({ ...prev, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
            <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
              <button className="btn btn-outline" onClick={() => setStep(1)}>上一步</button>
              <button className="btn btn-accent" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '分析中...' : '提交分析'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
