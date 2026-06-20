import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';
import Loading from '../../common/Loading';

export default function Templates() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [wizard, setWizard] = useState<{ template: any; fields: Record<string, string> } | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await api.get('/api/templates');
      setTemplates(data || []);
    } catch (e: unknown) { showToast((e as Error).message || '加载失败', 'error'); }
    finally { setLoading(false); }
  }

  const categories = ['all', '起诉类', '申请类', '答辩类', '上诉类', '协议类'];
  const filtered = category === 'all' ? templates : templates.filter(t => t.category === category);

  async function assemble(templateId: string, fields: Record<string, string>) {
    try {
      const res = await api.post(`/api/templates/${templateId}/assemble`, fields);
      setResult(res);
      showToast('文书生成成功', 'success');
    } catch (e: unknown) { showToast((e as Error).message || '生成失败', 'error'); }
  }

  function download(templateId: string, filename?: string) {
    const url = filename
      ? `${api['BASE_URL'] || window.location.origin}/api/templates/${templateId}/download/${filename}`
      : `${window.location.origin}/api/templates/${templateId}/download`;
    window.open(url, '_blank');
  }

  return (
    <div className="page-section">
      <h2 className="page-title">文书模板</h2>
      <p className="page-desc">法律文书模板库，支持智能填写和 DOCX 导出</p>

      <div className="tabs">
        {categories.map(c => (
          <button key={c} className={`tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c === 'all' ? '全部' : c}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div className="stats-grid">
          {filtered.map(t => (
            <div key={t.template_id || t.id} className="card">
              <h4>{t.name || t.title}</h4>
              <span className="badge badge-blue" style={{ marginTop:'.25rem' }}>{t.category}</span>
              <p style={{ fontSize:'.82rem', color:'var(--text-secondary)', marginTop:'.5rem' }}>{t.description}</p>
              <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => download(t.template_id || t.id)}>下载空白模板</button>
                {t.required_fields?.length > 0 && (
                  <button className="btn btn-sm btn-accent" onClick={() => setWizard({ template: t, fields: {} })}>智能填写</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {wizard && (
        <div className="modal-overlay" onClick={() => setWizard(null)}>
          <div className="modal-dialog" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{wizard.template.name || wizard.template.title} — 填写信息</h3>
            {wizard.template.required_fields?.map((f: any) => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="form-select" value={wizard.fields[f.key] || ''}
                    onChange={e => setWizard({ ...wizard, fields: { ...wizard.fields, [f.key]: e.target.value } })}>
                    <option value="">-- 选择 --</option>
                    {(f.options || []).map((o: string) => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea className="form-textarea" value={wizard.fields[f.key] || ''} rows={3}
                    onChange={e => setWizard({ ...wizard, fields: { ...wizard.fields, [f.key]: e.target.value } })} />
                ) : (
                  <input className="form-input" value={wizard.fields[f.key] || ''}
                    onChange={e => setWizard({ ...wizard, fields: { ...wizard.fields, [f.key]: e.target.value } })} />
                )}
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setWizard(null)}>取消</button>
              <button className="btn btn-accent" onClick={() => assemble(wizard.template.template_id || wizard.template.id, wizard.fields)}>生成文书</button>
            </div>
            {result && (
              <div style={{ marginTop:'1rem' }}>
                <p style={{ fontSize:'.85rem', color:'var(--success)', marginBottom:'.5rem' }}>生成成功！</p>
                {result.download_url && (
                  <button className="btn btn-accent btn-sm" onClick={() => download(wizard.template.template_id || wizard.template.id, result.download_url?.split('/').pop())}>
                    下载 DOCX
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
