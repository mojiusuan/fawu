import { useState } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';

export default function Calculators() {
  const [tab, setTab] = useState<'fee' | 'comp' | 'limitation'>('fee');

  return (
    <div className="page-section" data-section="calculators">
      <h2 className="page-title">计算工具</h2>
      <p className="page-desc">诉讼费、赔偿金、诉讼时效计算</p>

      <div className="tabs" data-section="calculators-tabs">
        <button className={`tab ${tab === 'fee' ? 'active' : ''}`} onClick={() => setTab('fee')}>诉讼费计算</button>
        <button className={`tab ${tab === 'comp' ? 'active' : ''}`} onClick={() => setTab('comp')}>赔偿金计算</button>
        <button className={`tab ${tab === 'limitation' ? 'active' : ''}`} onClick={() => setTab('limitation')}>时效检查</button>
      </div>

      {tab === 'fee' && <FeeCalculator />}
      {tab === 'comp' && <CompensationCalculator />}
      {tab === 'limitation' && <LimitationCalculator />}
    </div>
  );
}

function FeeCalculator() {
  const { showToast } = useToast();
  const [caseType, setCaseType] = useState('property');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);

  async function calc() {
    if (!amount) { showToast('请输入标的额', 'warning'); return; }
    try {
      const data = await api.post('/api/calculator/court-fee', { case_type: caseType, claim_amount: parseFloat(amount) });
      setResult(data);
    } catch (e: unknown) { showToast((e as Error).message || '计算失败', 'error'); }
  }

  return (
    <div className="card">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">案件类型</label>
          <select className="form-select" value={caseType} onChange={e => setCaseType(e.target.value)}>
            <option value="property">财产案件</option>
            <option value="non_property">非财产案件</option>
            <option value="divorce">离婚案件</option>
            <option value="labor">劳动争议</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">标的额 (元)</label>
          <input className="form-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="如: 500000" />
        </div>
      </div>
      <button className="btn btn-accent" onClick={calc}>计算</button>
      {result && (
        <div style={{ marginTop:'1rem' }}>
          <div className="stats-grid">
            <div className="stat-card"><div className="value">¥{(result.court_fee ?? 0).toLocaleString()}</div><div className="label">受理费</div></div>
            {result.preservation_fee ? <div className="stat-card"><div className="value">¥{result.preservation_fee.toLocaleString()}</div><div className="label">保全费</div></div> : null}
            {result.execution_fee ? <div className="stat-card"><div className="value">¥{result.execution_fee.toLocaleString()}</div><div className="label">执行费</div></div> : null}
            <div className="stat-card"><div className="value" style={{ color:'var(--accent)' }}>¥{(result.total ?? 0).toLocaleString()}</div><div className="label">合计</div></div>
          </div>
          {result.breakdown && (
            <div className="card" style={{ marginTop:'.75rem' }}>
              <h4>费用明细</h4>
              {result.breakdown.map((b: any, i: number) => (
                <div key={i} style={{ padding:'.4rem 0', borderBottom:'1px solid var(--border)' }}>
                  <strong>{b.item}</strong>: ¥{b.amount?.toLocaleString()} <span style={{ color:'var(--text-muted)', fontSize:'.8rem' }}>{b.basis}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompensationCalculator() {
  const { showToast } = useToast();
  const [scenario, setScenario] = useState('labor_illegal_dismissal');
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);

  // Map scenario to input fields
  const SCENARIO_FIELDS: Record<string, { label: string; key: string }[]> = {
    labor_illegal_dismissal: [
      { label: '月工资 (元)', key: 'monthly_salary' },
      { label: '工作年限', key: 'years_of_service' },
    ],
    labor_unpaid_salary: [
      { label: '月工资 (元)', key: 'monthly_salary' },
      { label: '拖欠月数', key: 'unpaid_months' },
    ],
    personal_injury: [
      { label: '医疗费 (元)', key: 'medical_cost' },
      { label: '日收入 (元)', key: 'daily_income' },
      { label: '误工天数', key: 'lost_days' },
      { label: '护理费/天 (元)', key: 'daily_care' },
      { label: '护理天数', key: 'care_days' },
      { label: '交通费 (元)', key: 'transport_cost' },
      { label: '伙食补助/天 (元)', key: 'food_allowance' },
      { label: '住院天数', key: 'hospital_days' },
      { label: '营养费 (元)', key: 'nutrition_cost' },
      { label: '年残疾赔偿金基数 (元)', key: 'annual_disability_income' },
      { label: '伤残比例 (0-1)', key: 'disability_ratio' },
      { label: '精神损害赔偿 (元)', key: 'mental_damage' },
    ],
    consumer_fraud: [
      { label: '购买金额 (元)', key: 'purchase_amount' },
    ],
  };

  async function calc() {
    const numParams: Record<string, number> = {};
    for (const [k, v] of Object.entries(params)) {
      numParams[k] = parseFloat(v) || 0;
    }
    try {
      const data: any = await api.post('/api/calculator/compensation', { scenario, params: numParams });
      if (data.error) { showToast(data.error, 'error'); return; }
      setResult(data);
    } catch (e: unknown) { showToast((e as Error).message || '计算失败', 'error'); }
  }

  const fields = SCENARIO_FIELDS[scenario] || [];

  return (
    <div className="card">
      <div className="form-group">
        <label className="form-label">赔偿场景</label>
        <select className="form-select" value={scenario} onChange={e => { setScenario(e.target.value); setParams({}); setResult(null); }}>
          <option value="labor_illegal_dismissal">违法解除劳动合同</option>
          <option value="labor_unpaid_salary">拖欠工资</option>
          <option value="personal_injury">人身损害赔偿</option>
          <option value="consumer_fraud">消费欺诈</option>
        </select>
      </div>
      <div className="form-row">
        {fields.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input className="form-input" type="number" value={params[f.key] || ''}
              onChange={e => setParams(prev => ({ ...prev, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <button className="btn btn-accent" onClick={calc}>计算</button>
      {result && !result.error && (
        <div style={{ marginTop:'1rem' }}>
          <div className="stats-grid">
            {result.items?.map((item: any, i: number) => (
              <div className="stat-card" key={i}>
                <div className="value">¥{item.amount?.toLocaleString()}</div>
                <div className="label">{item.name}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop:'.75rem', background:'var(--bg)' }}>
            <p><strong>总计:</strong> ¥{result.total_min?.toLocaleString()} ~ ¥{result.total_max?.toLocaleString()}</p>
            {result.legal_basis && <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:'.25rem' }}>法律依据: {result.legal_basis}</p>}
            {result.notes?.map((n: string, i: number) => (
              <p key={i} style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LimitationCalculator() {
  const { showToast } = useToast();
  const [caseType, setCaseType] = useState('general');
  const [eventDate, setEventDate] = useState('');
  const [result, setResult] = useState<any>(null);

  async function check() {
    if (!eventDate) { showToast('请选择事件日期', 'warning'); return; }
    try {
      const data = await api.post('/api/calculator/limitation', { case_type: caseType, event_date: eventDate });
      setResult(data);
    } catch (e: unknown) { showToast((e as Error).message || '检查失败', 'error'); }
  }

  return (
    <div className="card">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">案件类型</label>
          <select className="form-select" value={caseType} onChange={e => setCaseType(e.target.value)}>
            <option value="general">一般民事</option>
            <option value="contract">合同纠纷</option>
            <option value="tort">侵权纠纷</option>
            <option value="labor">劳动争议</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">事件发生日期</label>
          <input className="form-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-accent" onClick={check}>检查时效</button>
      {result && (
        <div style={{ marginTop:'1rem' }}>
          <div className="stat-card" style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:'3rem' }}>{result.is_expired ? '⚠️' : '✅'}</div>
            <div className="value" style={{ color: result.is_expired ? 'var(--danger)' : 'var(--success)' }}>
              {result.is_expired ? '已过期' : '在时效内'}
            </div>
            <div className="label">截止日期: {result.deadline}</div>
          </div>
          <p style={{ fontSize:'.85rem', color:'var(--text-secondary)' }}>时效类型: {result.type} | 期限: {result.period}</p>
          {result.legal_basis && <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:'.5rem' }}>{result.legal_basis}</p>}
        </div>
      )}
    </div>
  );
}
