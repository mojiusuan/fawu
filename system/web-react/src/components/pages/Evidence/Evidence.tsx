import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';
import Loading from '../../common/Loading';

export default function Evidence() {
  const { showToast } = useToast();
  const [caseTypes, setCaseTypes] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/evidence/cases')
      .then(data => setCaseTypes(data.cases || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadGuide(typeKey: string) {
    setSelected(typeKey);
    try {
      const data = await api.get(`/api/evidence/${typeKey}`);
      setGuide(data);
    } catch (e: unknown) {
      showToast((e as Error).message || '加载失败', 'error');
    }
  }

  return (
    <div className="page-section">
      <h2 className="page-title">证据指引</h2>
      <p className="page-desc">各类案件的证据清单和保全提示</p>

      {loading ? <Loading /> : (
        <div>
          <div className="tabs">
            {caseTypes.map((ct: any) => (
              <button key={ct.type_key} className={`tab ${selected === ct.type_key ? 'active' : ''}`}
                onClick={() => loadGuide(ct.type_key)}>
                {ct.type_name}
              </button>
            ))}
          </div>

          {guide && (
            <div>
              {guide.required_evidence?.length > 0 && (
                <div className="card" style={{ marginBottom:'.75rem' }}>
                  <h3>📌 必需证据</h3>
                  {guide.required_evidence.map((item: any, i: number) => (
                    <div key={i} style={{ padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                      <strong>{item.name || item.item}</strong>
                      {item.description && <p style={{ fontSize:'.85rem', color:'var(--text-secondary)' }}>{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              {guide.optional_evidence?.length > 0 && (
                <div className="card" style={{ marginBottom:'.75rem' }}>
                  <h3>📎 补充证据</h3>
                  {guide.optional_evidence.map((item: any, i: number) => (
                    <div key={i} style={{ padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                      <strong>{item.name || item.item}</strong>
                      {item.description && <p style={{ fontSize:'.85rem', color:'var(--text-secondary)' }}>{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}
              {guide.preservation_tips && (
                <div className="card">
                  <h3>💡 证据保全提示</h3>
                  <p style={{ marginTop:'.5rem', lineHeight:1.8, color:'var(--text-secondary)' }}>{guide.preservation_tips}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
