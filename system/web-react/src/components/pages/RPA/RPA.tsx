import { useState, useRef } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';

export default function RPA() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const fileRef = useRef<HTMLInputElement>(null);

  // Single extract
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Batch
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchExtracting, setBatchExtracting] = useState(false);
  const [batchResults, setBatchResults] = useState<any[]>([]);

  async function extractSingle(file: File) {
    setFileName(file.name);
    setExtracting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/api/rpa/extract', formData);
      setResult(res);
      showToast('提取完成', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message || '提取失败', 'error');
    } finally { setExtracting(false); }
  }

  async function extractBatch() {
    if (batchFiles.length === 0) return;
    setBatchExtracting(true);
    setBatchResults([]);
    const results: any[] = [];
    for (const file of batchFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.upload('/api/rpa/extract', formData);
        results.push({ file: file.name, success: true, data: res });
      } catch (e: unknown) {
        results.push({ file: file.name, success: false, error: (e as Error).message });
      }
    }
    setBatchResults(results);
    setBatchExtracting(false);
    showToast(`批量提取完成: ${results.filter(r => r.success).length}/${results.length} 成功`, 'info');
  }

  return (
    <div className="page-section">
      <h2 className="page-title">自动化工具</h2>
      <p className="page-desc">AI 驱动的文档数据提取（RPA）</p>

      <div className="tabs">
        <button className={`tab ${tab === 'single' ? 'active' : ''}`} onClick={() => setTab('single')}>单文档提取</button>
        <button className={`tab ${tab === 'batch' ? 'active' : ''}`} onClick={() => setTab('batch')}>批量提取</button>
      </div>

      {tab === 'single' && (
        <div>
          <div className="card" style={{ marginBottom:'1rem' }}>
            <div className="file-drop-zone" onClick={() => fileRef.current?.click()}>
              <div className="file-drop-icon">🤖</div>
              <div className="file-drop-text">{fileName || '点击上传文档进行数据提取'}</div>
              <div className="file-drop-hint">支持 DOCX / PDF / 图片格式</div>
            </div>
            <input ref={fileRef} type="file" accept=".docx,.pdf,.txt,.png,.jpg"
              style={{ display:'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) extractSingle(f); }} />
            {extracting && <div className="progress-card"><span className="spinner" /> AI 正在分析文档...</div>}
          </div>

          {result && (
            <div className="card">
              <h3 style={{ marginBottom:'.75rem' }}>提取结果</h3>
              <div className="rpa-field"><span className="rpa-field-label">合同标题</span><span className="rpa-field-value">{result.contract_title || '-'}</span></div>
              <div className="rpa-field"><span className="rpa-field-label">甲方</span><span className="rpa-field-value">{result.party_a || '-'}</span></div>
              <div className="rpa-field"><span className="rpa-field-label">乙方</span><span className="rpa-field-value">{result.party_b || '-'}</span></div>
              <div className="rpa-field"><span className="rpa-field-label">金额</span><span className="rpa-field-value">{result.amount || '-'}</span></div>
              <div className="rpa-field"><span className="rpa-field-label">期限</span><span className="rpa-field-value">{result.deadline || '-'}</span></div>
              <div className="rpa-field"><span className="rpa-field-label">争议解决</span><span className="rpa-field-value">{result.dispute_resolution || '-'}</span></div>
              {result.clauses && (
                <details style={{ marginTop:'.75rem' }}>
                  <summary>条款详情 ({result.clauses.length} 条)</summary>
                  <pre style={{ fontSize:'.78rem', marginTop:'.5rem', whiteSpace:'pre-wrap' }}>{JSON.stringify(result.clauses, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'batch' && (
        <div>
          <div className="card" style={{ marginBottom:'1rem' }}>
            <input type="file" multiple accept=".docx,.pdf,.txt"
              onChange={e => { const files = Array.from(e.target.files || []); setBatchFiles(files); setBatchResults([]); }}
              style={{ marginBottom:'1rem' }} />
            <p style={{ color:'var(--text-secondary)', marginBottom:'1rem' }}>{batchFiles.length > 0 ? `已选择 ${batchFiles.length} 个文件` : '请选择多个文件'}</p>
            <button className="btn btn-accent" onClick={extractBatch} disabled={batchFiles.length === 0 || batchExtracting}>
              {batchExtracting ? '批量处理中...' : '开始批量提取'}
            </button>
          </div>
          {batchResults.map((r, i) => (
            <div key={i} className="card" style={{ marginBottom:'.5rem' }}>
              <strong>{r.file}</strong> — {r.success ? <span className="badge badge-green">成功</span> : <span className="badge badge-red">失败: {r.error}</span>}
              {r.success && r.data && (
                <div style={{ marginTop:'.5rem', fontSize:'.85rem' }}>
                  甲方: {r.data.party_a || '-'} | 乙方: {r.data.party_b || '-'} | 金额: {r.data.amount || '-'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
