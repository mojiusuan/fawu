import { useState, useEffect, useRef, type DragEvent, type FormEvent } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { contractApi } from '../../../api/contracts';
import type { Contract, Clause } from '../../../types';

type TabKey = 'upload' | 'review' | 'compare' | 'generate';

const CONTRACT_TYPES = ['买卖合同', '租赁合同', '服务合同', '劳动合同', '借款合同'];

export default function Contract() {
  const [tab, setTab] = useState<TabKey>('upload');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setLoadingContracts(true);
    try {
      const data = await contractApi.list();
      setContracts(data);
    } catch (e) {
      showToast('加载合同列表失败', 'error');
    } finally {
      setLoadingContracts(false);
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'upload', label: '上传合同' },
    { key: 'review', label: '合同审查' },
    { key: 'compare', label: '合同比对' },
    { key: 'generate', label: '合同生成' },
  ];

  return (
    <div className="page-section" data-section="contract">
      <h2 className="page-title">合同管理</h2>
      <p className="page-desc">上传、审查、比对和生成法律合同</p>

      <div className="tabs" data-section="contract-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div data-section={`contract-tab-${tab}`}>
      {tab === 'upload' && <UploadTab onUploaded={loadContracts} />}
      {tab === 'review' && <ReviewTab contracts={contracts} loading={loadingContracts} onReload={loadContracts} />}
      {tab === 'compare' && <CompareTab contracts={contracts} loading={loadingContracts} />}
      {tab === 'generate' && <GenerateTab />}
      </div>
    </div>
  );
}

/* ============ Upload Tab ============ */

function UploadTab({ onUploaded }: { onUploaded: () => void }) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState('');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(`正在解析: ${file.name}`);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await contractApi.upload(formData);
      if (result.title) setTitle(result.title);
      if (result.content) setContent(result.content);
      setFileName(`解析完成: ${file.name}`);
      showToast('文件解析完成', 'success');
    } catch {
      if (file.name.endsWith('.txt')) {
        setContent(await file.text());
        setFileName(`已读取文本: ${file.name}`);
      } else {
        setFileName(`解析失败: ${file.name}`);
        showToast('文件解析失败', 'error');
      }
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) { showToast('请输入合同正文或上传文件', 'warning'); return; }
    setUploading(true);
    try {
      const result = await contractApi.create({ title, contract_type: contractType, party_a: partyA, party_b: partyB, content });
      showToast(`上传成功: ${result.title || result.id}`, 'success');
      setTitle(''); setContent(''); setFileName(''); setPartyA(''); setPartyB('');
      onUploaded();
    } catch (e: any) {
      showToast(e.message || '上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} data-section="contract-tab-upload">
      <div
        className={`file-drop-zone ${dragOver ? 'dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="file-drop-icon">📁</div>
        <div className="file-drop-text">{fileName || '拖拽文件到此处或点击上传'}</div>
        <div className="file-drop-hint">支持 DOCX / PDF / TXT 格式</div>
        <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">合同标题</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="输入合同标题" />
        </div>
        <div className="form-group">
          <label className="form-label">合同类型</label>
          <select className="form-select" value={contractType} onChange={e => setContractType(e.target.value)}>
            <option value="">选择类型</option>
            {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">甲方</label>
          <input className="form-input" value={partyA} onChange={e => setPartyA(e.target.value)} placeholder="甲方名称" />
        </div>
        <div className="form-group">
          <label className="form-label">乙方</label>
          <input className="form-input" value={partyB} onChange={e => setPartyB(e.target.value)} placeholder="乙方名称" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">合同正文</label>
        <textarea className="form-textarea" value={content} onChange={e => setContent(e.target.value)}
          placeholder="粘贴合同文本，或拖拽上传文件" rows={8} />
      </div>
      <button type="submit" className="btn btn-accent" disabled={uploading}>
        {uploading ? '上传中...' : '上传并创建合同'}
      </button>
    </form>
  );
}

/* ============ Review Tab ============ */

function ReviewTab({ contracts, loading, onReload }: { contracts: Contract[]; loading: boolean; onReload: () => void }) {
  const { showToast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ clauses: Clause[]; summary: string; stats: { high: number; medium: number; low: number } } | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<number>>(new Set());

  async function handleReview() {
    if (!selectedId) { showToast('请选择合同', 'warning'); return; }
    setReviewing(true);
    setResult(null);

    const stages = ['正在解析合同条款...', '正在检索相关法律依据...', '正在分析风险等级...', '正在生成审查意见...'];
    let i = 0;
    setProgress(stages[0]);
    const timer = setInterval(() => { i++; if (i < stages.length) setProgress(stages[i]); }, 3000);

    try {
      const res = await contractApi.review(selectedId);
      clearInterval(timer);
      setProgress('');
      const high = (res.clauses || []).filter(c => c.risk_level === 'high').length;
      const medium = (res.clauses || []).filter(c => c.risk_level === 'medium').length;
      const low = (res.clauses || []).filter(c => c.risk_level === 'low').length;
      setResult({ clauses: res.clauses || [], summary: res.review_summary || '', stats: { high, medium, low } });
      showToast('审查完成', 'success');
      onReload();
    } catch (e: any) {
      clearInterval(timer);
      setProgress('');
      showToast(e.message || '审查失败', 'error');
    } finally {
      setReviewing(false);
    }
  }

  function toggleClause(idx: number) {
    setExpandedClauses(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });
  }

  return (
    <div data-section="contract-tab-review">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            选择合同
            {loading && <span style={{ marginLeft:'.5rem' }}><span className="spinner" style={{ width:12, height:12, borderWidth:2 }} /></span>}
            {!loading && <span style={{ marginLeft:'.5rem', color:'var(--text-muted)', fontWeight:400 }}>({contracts.length} 份)</span>}
          </label>
          <select className="form-select" value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading}>
            <option value="">{loading ? '加载中...' : '-- 选择合同 --'}</option>
            {contracts.map(c => (
              <option key={c.id} value={c.id}>{c.title || c.id} ({c.review_status || '未审查'})</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ display:'flex', alignItems:'flex-end' }}>
          <button className="btn btn-accent" onClick={handleReview} disabled={reviewing || !selectedId}>
            {reviewing ? '审查中...' : '🔍 开始审查'}
          </button>
        </div>
      </div>

      {progress && <div className="progress-card"><span className="spinner" /> {progress}</div>}

      {result && (
        <div data-section="contract-review-result">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1rem', marginBottom:'.5rem' }}>
            <h3 style={{ margin:0 }}>审查结果</h3>
            <button className="btn btn-outline btn-sm" onClick={() => {
              const token = localStorage.getItem('auth_token');
              const headers: Record<string, string> = {};
              if (token) headers['Authorization'] = `Bearer ${JSON.parse(token)}`;
              fetch(`${window.location.origin}/api/export/contract-review/${selectedId}`, { headers })
                .then(r => r.blob()).then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `审查报告.docx`;
                  document.body.appendChild(a); a.click(); a.remove();
                  URL.revokeObjectURL(url);
                }).catch(() => showToast('导出失败', 'error'));
            }}>📥 导出 Word</button>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="icon">🔴</div><div className="value">{result.stats.high}</div><div className="label">高风险</div></div>
            <div className="stat-card"><div className="icon">🟡</div><div className="value">{result.stats.medium}</div><div className="label">中风险</div></div>
            <div className="stat-card"><div className="icon">🟢</div><div className="value">{result.stats.low}</div><div className="label">低风险</div></div>
          </div>

          {result.clauses.map((c, idx) => {
            const icons: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
            const isOpen = expandedClauses.has(idx);
            return (
              <div key={idx} className={`expander ${isOpen ? 'open' : ''}`}>
                <div className="expander-header" onClick={() => toggleClause(idx)}>
                  <span>{icons[c.risk_level] || '⚪'} {c.clause_number || `条款 ${idx + 1}`}</span>
                  <span className="expander-arrow">▼</span>
                </div>
                {isOpen && (
                  <div className="expander-body">
                    {c.content && <p style={{ color:'var(--text-secondary)', marginBottom:'.5rem' }}>📝 原文: {c.content.substring(0, 400)}</p>}
                    {c.risk_analysis && <div style={{ marginTop:'.4rem', lineHeight:1.7 }} dangerouslySetInnerHTML={{ __html: c.risk_analysis }} />}
                    {c.law_basis && <p style={{ marginTop:'.4rem' }}><strong>法律依据:</strong> <code>{c.law_basis}</code></p>}
                    {c.suggestion && (
                      <div style={{ marginTop:'.4rem' }}>
                        <strong>修改建议:</strong>
                        <div style={{ lineHeight:1.7 }} dangerouslySetInnerHTML={{ __html: c.suggestion }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {result.summary && (
            <div className="card" style={{ marginTop:'1rem', lineHeight:1.8 }}>
              <strong>审查总结</strong>
              <div dangerouslySetInnerHTML={{ __html: result.summary }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============ Compare Tab ============ */

function CompareTab({ contracts }: { contracts: Contract[]; loading: boolean }) {
  const { showToast } = useToast();
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [result, setResult] = useState<{ diffs: any[]; stats: any } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [progress, setProgress] = useState('');

  async function handleCompare() {
    if (!idA || !idB) { showToast('请选择两份合同', 'warning'); return; }
    if (idA === idB) { showToast('请选择两份不同的合同', 'warning'); return; }
    setComparing(true);
    setResult(null);

    const stages = ['正在加载合同条款...', '正在逐条比对分析...', '正在识别差异类型...', '正在评估条款利弊...', '正在生成比对报告...'];
    let i = 0;
    setProgress(stages[0]);
    const timer = setInterval(() => { i++; if (i < stages.length) setProgress(stages[i]); }, 3000);

    try {
      const res = await contractApi.compare(idA, idB);
      clearInterval(timer);
      setProgress('');
      setResult(res);
    } catch (e: any) {
      clearInterval(timer);
      setProgress('');
      showToast(e.message || '比对失败', 'error');
    } finally {
      setComparing(false);
    }
  }

  return (
    <div data-section="contract-tab-compare">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">合同 A</label>
          <select className="form-select" value={idA} onChange={e => setIdA(e.target.value)}>
            <option value="">-- 选择 --</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">合同 B</label>
          <select className="form-select" value={idB} onChange={e => setIdB(e.target.value)}>
            <option value="">-- 选择 --</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.title || c.id}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-accent" onClick={handleCompare} disabled={comparing || !idA || !idB}>
        {comparing ? '比对中...' : '开始比对'}
      </button>

      {progress && <div className="progress-card"><span className="spinner" /> {progress}</div>}

      {result && (
        <div style={{ marginTop:'1rem' }}>
          <div className="stats-grid">
            <div className="stat-card"><div className="value">{result.total_clauses || 0}</div><div className="label">总条款</div></div>
            <div className="stat-card"><div className="value">{result.identical || 0}</div><div className="label">一致</div></div>
            <div className="stat-card"><div className="value">{result.formal_diff || 0}</div><div className="label">形式差异</div></div>
            <div className="stat-card"><div className="value">{result.substantive_diff || 0}</div><div className="label">实质性差异</div></div>
          </div>
          {(result.differences || []).filter((d: any) => d.type !== '一致' && d.type !== 'identical').map((d: any, i: number) => {
            const typeLabel = d.type === 'substantive' ? '实质性差异' : d.type === 'formal' ? '形式差异' : d.type === 'identical' ? '一致' : (d.type || '差异');
            const favorLabel = d.favor === '甲方' || d.favor === '乙方' || d.favor === '无' ? d.favor : '';
            return (
            <div key={i} className="card" style={{ marginBottom:'.5rem' }}>
              <strong>{d.clause || '条款'} — {typeLabel}</strong>
              <p style={{ marginTop:'.25rem', color:'var(--text-secondary)' }}>{d.detail}{favorLabel ? `（对${favorLabel}有利）` : ''}</p>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ Generate Tab ============ */

function GenerateTab() {
  const { showToast } = useToast();
  const [contractType, setContractType] = useState('买卖合同');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [keyTerms, setKeyTerms] = useState('');
  const [result, setResult] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await contractApi.generate({ contract_type: contractType, party_a: partyA, party_b: partyB, key_terms: keyTerms });
      setResult(res);
      showToast('合同草案已生成', 'success');
    } catch (e: any) {
      showToast(e.message || '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div data-section="contract-tab-generate">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">合同类型</label>
          <select className="form-select" value={contractType} onChange={e => setContractType(e.target.value)}>
            {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">甲方</label>
          <input className="form-input" value={partyA} onChange={e => setPartyA(e.target.value)} placeholder="甲方名称" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">乙方</label>
          <input className="form-input" value={partyB} onChange={e => setPartyB(e.target.value)} placeholder="乙方名称" />
        </div>
        <div className="form-group">
          <label className="form-label">关键条款</label>
          <input className="form-input" value={keyTerms} onChange={e => setKeyTerms(e.target.value)} placeholder="如：金额100万，期限3年" />
        </div>
      </div>
      <button className="btn btn-accent" onClick={handleGenerate} disabled={generating}>
        {generating ? '生成中...' : '生成合同'}
      </button>

      {result?.content && (
        <div className="card" style={{ marginTop:'1rem', lineHeight:1.8 }}>
          <div dangerouslySetInnerHTML={{ __html: result.content }} />
        </div>
      )}
    </div>
  );
}
