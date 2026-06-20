import { useState } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';

export default function KG() {
  const { showToast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<'search' | 'ontology' | 'trace'>('search');

  async function search() {
    if (!keyword.trim()) return;
    setSearching(true);
    try {
      const data = await api.get(`/api/kg/search?keyword=${encodeURIComponent(keyword)}`);
      setResults(data.results || []);
      if (!data.available) showToast('知识图谱不可用', 'warning');
    } catch (e: unknown) {
      showToast((e as Error).message || '搜索失败', 'error');
    } finally { setSearching(false); }
  }

  return (
    <div className="page-section">
      <h2 className="page-title">知识图谱</h2>
      <p className="page-desc">法律法规、判例、法律概念关联网络</p>

      <div className="tabs">
        <button className={`tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>数据浏览</button>
        <button className={`tab ${tab === 'ontology' ? 'active' : ''}`} onClick={() => setTab('ontology')}>本体结构</button>
        <button className={`tab ${tab === 'trace' ? 'active' : ''}`} onClick={() => setTab('trace')}>关系追溯</button>
      </div>

      {tab === 'search' && (
        <div>
          <div className="card" style={{ marginBottom:'1rem' }}>
            <div style={{ display:'flex', gap:'.75rem' }}>
              <input className="form-input" style={{ flex:1 }} value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()} placeholder="输入关键词搜索法律实体..." />
              <button className="btn btn-accent" onClick={search} disabled={searching}>{searching ? '搜索中...' : '搜索'}</button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="card" style={{ padding:0 }}>
              {results.map((r, i) => {
                const props = r.props || r;
                return (
                  <div key={i} className="kg-result-item">
                    <span className={`badge badge-${r.type === 'Case' ? 'yellow' : r.type === 'Law' ? 'red' : 'blue'}`} style={{ flexShrink:0 }}>
                      {r.type || 'Entity'}
                    </span>
                    <div style={{ flex:1 }}>
                      <strong>{props.name || props.title || r.entity_id}</strong>
                      <div style={{ fontSize:'.78rem', color:'var(--text-secondary)' }}>
                        {props.article_number && `第${props.article_number}条 `}
                        {(props.content || props.definition || props.description || '').substring(0, 150)}
                      </div>
                    </div>
                    {r.relevance && <span className="kg-result-score">相关度: {(r.relevance * 100).toFixed(0)}%</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'ontology' && (
        <div className="card">
          <h3 style={{ marginBottom:'1rem' }}>知识本体结构</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>实体类型</th><th>属性</th><th>关系</th></tr></thead>
              <tbody>
                {[
                  ['法律 (Law)', '名称、编号、发布日期', '包含 → 条文'],
                  ['条文 (Article)', '编号、内容', '属于 → 法律'],
                  ['判例 (Case)', '标题、案号、日期', '引用 → 条文 / 关联 → 判例'],
                  ['合同 (Contract)', '标题、类型、签约方', '包含 → 条款 / 引用 → 条文'],
                  ['条款 (Clause)', '内容、风险等级', '属于 → 合同'],
                  ['风险点 (RiskPoint)', '描述、严重程度', '关联 → 条款 / 关联 → 条文'],
                  ['法律概念 (LegalConcept)', '名称、定义', '关联 → 条文 / 关联 → 判例'],
                  ['法院 (Court)', '名称、级别', '审理 → 判例'],
                ].map(([entity, props, rels], i) => (
                  <tr key={i}><td style={{ fontWeight:600 }}>{entity}</td><td style={{ fontSize:'.82rem', color:'var(--text-secondary)' }}>{props}</td><td style={{ fontSize:'.82rem', color:'var(--text-secondary)' }}>{rels}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'trace' && (
        <div className="card">
          <h3 style={{ marginBottom:'1rem' }}>关系追溯路径</h3>
          <div className="kg-diagram">{`
            法律 ──[包含]──→ 条文
              ↑               ↑
              │               │
              ├──[依据]──→ 判例
              │               │
              └──[参考]──→ 合同 ──[包含]──→ 条款
                              │
                              └──[识别]──→ 风险点
          `}</div>
        </div>
      )}
    </div>
  );
}
