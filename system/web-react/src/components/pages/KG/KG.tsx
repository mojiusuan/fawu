import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useToast } from '../../../contexts/ToastContext';

type TabKey = 'search' | 'ontology' | 'trace';

const TYPE_LABELS: Record<string, string> = {
  Law: '法律', Article: '条文', Case: '判例', Contract: '合同',
  Clause: '条款', RiskPoint: '风险点', LegalConcept: '法律概念', Court: '法院',
};

const TYPE_BADGES: Record<string, string> = {
  Law: 'badge-red', Article: 'badge-blue', Case: 'badge-yellow', Contract: 'badge-green',
  Clause: 'badge-blue', RiskPoint: 'badge-orange', LegalConcept: 'badge-purple', Court: 'badge-blue',
};

export default function KG() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('search');
  const [available, setAvailable] = useState(true);

  // Check availability on mount
  useEffect(() => {
    api.get('/api/kg/search?keyword=').then((d: any) => setAvailable(d.available)).catch(() => {});
  }, []);

  return (
    <div className="page-section">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 className="page-title">知识图谱</h2>
          <p className="page-desc">法律法规、判例、法律概念关联网络</p>
        </div>
        {!available && <span className="badge badge-red">Neo4j 未连接</span>}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>数据浏览</button>
        <button className={`tab ${tab === 'ontology' ? 'active' : ''}`} onClick={() => setTab('ontology')}>本体结构</button>
        <button className={`tab ${tab === 'trace' ? 'active' : ''}`} onClick={() => setTab('trace')}>关系追溯</button>
      </div>

      {tab === 'search' && <SearchTab showToast={showToast} />}
      {tab === 'ontology' && <OntologyTab />}
      {tab === 'trace' && <TraceTab showToast={showToast} />}
    </div>
  );
}

/* ============ Search Tab ============ */

function SearchTab({ showToast }: { showToast: (msg: string, type: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ type: string; id: string; props: any } | null>(null);
  const [entityDetail, setEntityDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function search() {
    if (!keyword.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      const data: any = await api.get(`/api/kg/search?keyword=${encodeURIComponent(keyword)}`);
      setResults(data.results || []);
      if (!data.available) showToast('知识图谱不可用', 'warning');
    } catch (e: unknown) {
      showToast((e as Error).message || '搜索失败', 'error');
    } finally { setSearching(false); }
  }

  async function viewEntity(type: string, id: string, props: any) {
    setSelected({ type, id, props });
    setLoadingDetail(true);
    try {
      const data: any = await api.get(`/api/kg/entity/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
      setEntityDetail(data);
    } catch {
      setEntityDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div>
      {/* Search bar */}
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <input className="form-input" style={{ flex:1 }} value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()} placeholder="输入关键词搜索法律实体..." />
          <button className="btn btn-accent" onClick={search} disabled={searching}>{searching ? '搜索中...' : '搜索'}</button>
        </div>
      </div>

      {/* Results list */}
      {results.length > 0 && !selected && (
        <div className="card" style={{ padding:0 }}>
          {results.map((r, i) => {
            const props = r.properties || r.props || r;
            const etype = r.type || 'Entity';
            const eid = props.name || props.title || props.case_number || props.article_number || props.clause_number || props.risk_type || '';
            return (
              <div key={i} className="kg-result-item" style={{ cursor:'pointer' }}
                onClick={() => viewEntity(etype, eid, props)}>
                <span className={`badge ${TYPE_BADGES[etype] || 'badge-blue'}`} style={{ flexShrink:0 }}>
                  {TYPE_LABELS[etype] || etype}
                </span>
                <div style={{ flex:1 }}>
                  <strong>{eid || '(未命名)'}</strong>
                  <div style={{ fontSize:'.78rem', color:'var(--text-secondary)' }}>
                    {props.article_number && `第${props.article_number}条 `}
                    {(props.content || props.definition || props.description || props.facts || '').substring(0, 150)}
                  </div>
                </div>
                {r.score != null && (
                  <span className="kg-result-score">相关度: {(r.score * 100).toFixed(0)}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Entity detail panel */}
      {selected && (
        <div>
          <button className="btn btn-outline btn-sm" style={{ marginBottom:'.75rem' }}
            onClick={() => { setSelected(null); setEntityDetail(null); }}>
            ← 返回搜索结果
          </button>

          {/* Entity properties */}
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.75rem' }}>
              <span className={`badge ${TYPE_BADGES[selected.type] || 'badge-blue'}`}>
                {TYPE_LABELS[selected.type] || selected.type}
              </span>
              <h3 style={{ margin:0 }}>{selected.id}</h3>
            </div>
            <div style={{ fontSize:'.85rem' }}>
              {Object.entries(selected.props).filter(([k]) => !['name','title','case_number','article_number','clause_number','risk_type'].includes(k) || selected.props[k] !== selected.id).map(([k, v]) => (
                <div key={k} style={{ padding:'.3rem 0', borderBottom:'1px solid var(--border)', display:'flex' }}>
                  <span style={{ fontWeight:600, minWidth:100, color:'var(--text-muted)' }}>{k}</span>
                  <span style={{ color:'var(--text-secondary)' }}>{String(v).substring(0, 300)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relations */}
          <div className="card">
            <h3 style={{ marginBottom:'.75rem' }}>
              关联关系
              {loadingDetail && <span className="spinner" style={{ width:14, height:14, borderWidth:2, marginLeft:'.5rem' }} />}
            </h3>
            {entityDetail?.relations?.length > 0 ? (
              entityDetail.relations.map((rel: any, i: number) => (
                <div key={i} style={{ padding:'.5rem 0', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'.5rem' }}>
                  <span className={`badge ${TYPE_BADGES[rel.source_type] || 'badge-blue'}`}>{TYPE_LABELS[rel.source_type] || rel.source_type}</span>
                  <span style={{ fontWeight:600, color:'var(--accent)' }}>—[{rel.relation}]→</span>
                  <span className={`badge ${TYPE_BADGES[rel.target_type] || 'badge-blue'}`}>{TYPE_LABELS[rel.target_type] || rel.target_type}</span>
                  <span style={{ color:'var(--text-secondary)' }}>{rel.target_id}</span>
                </div>
              ))
            ) : !loadingDetail && (
              <p style={{ color:'var(--text-muted)' }}>暂无关联关系</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Ontology Tab ============ */

function OntologyTab() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/api/kg/stats').then((d: any) => setStats(d.stats)).catch(() => {});
  }, []);

  const staticOntology = [
    ['法律 (Law)', '名称、编号、发布日期', '包含 → 条文'],
    ['条文 (Article)', '编号、内容', '属于 → 法律'],
    ['判例 (Case)', '标题、案号、日期', '引用 → 条文 / 关联 → 判例'],
    ['合同 (Contract)', '标题、类型、签约方', '包含 → 条款 / 引用 → 条文'],
    ['条款 (Clause)', '内容、风险等级', '属于 → 合同'],
    ['风险点 (RiskPoint)', '描述、严重程度', '关联 → 条款 / 关联 → 条文'],
    ['法律概念 (LegalConcept)', '名称、定义', '关联 → 条文 / 关联 → 判例'],
    ['法院 (Court)', '名称、级别', '审理 → 判例'],
  ];

  const TYPE_KEYS = ['Law', 'Article', 'Case', 'Contract', 'Clause', 'RiskPoint', 'LegalConcept', 'Court'];

  return (
    <div className="card">
      <h3 style={{ marginBottom:'1rem' }}>知识本体结构</h3>
      {stats && (
        <div style={{ marginBottom:'1rem', fontSize:'.85rem', color:'var(--text-secondary)' }}>
          当前数据：总计 {stats.total_nodes || 0} 个实体，{stats.relationships || 0} 条关系
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>实体类型</th><th>数量</th><th>属性</th><th>关系</th></tr></thead>
          <tbody>
            {staticOntology.map(([entity, props, rels], i) => {
              const count = stats?.nodes?.[TYPE_KEYS[i]] ?? '-';
              return (
                <tr key={i}>
                  <td style={{ fontWeight:600 }}>{entity}</td>
                  <td style={{ textAlign:'center', fontWeight:600, color:'var(--accent)' }}>{count}</td>
                  <td style={{ fontSize:'.82rem', color:'var(--text-secondary)' }}>{props}</td>
                  <td style={{ fontSize:'.82rem', color:'var(--text-secondary)' }}>{rels}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ Trace Tab ============ */

function TraceTab({ showToast }: { showToast: (msg: string, type: string) => void }) {
  const [entityType, setEntityType] = useState('Law');
  const [entityId, setEntityId] = useState('');
  const [depth, setDepth] = useState(2);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function trace() {
    if (!entityId.trim()) { showToast('请输入实体标识', 'warning'); return; }
    setLoading(true);
    try {
      const data: any = await api.get(
        `/api/kg/subgraph/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?depth=${depth}`
      );
      setResult(data);
      if (!data.available) showToast('知识图谱不可用', 'warning');
    } catch (e: unknown) {
      showToast((e as Error).message || '查询失败', 'error');
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">实体类型</label>
            <select className="form-select" value={entityType} onChange={e => setEntityType(e.target.value)}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({k})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">实体标识</label>
            <input className="form-input" value={entityId} onChange={e => setEntityId(e.target.value)}
              placeholder="如：民法典、劳动合同法第39条" onKeyDown={e => e.key === 'Enter' && trace()} />
          </div>
          <div className="form-group">
            <label className="form-label">追溯深度</label>
            <select className="form-select" value={depth} onChange={e => setDepth(Number(e.target.value))}>
              <option value={1}>1 跳</option><option value={2}>2 跳</option><option value={3}>3 跳</option>
            </select>
          </div>
        </div>
        <button className="btn btn-accent" onClick={trace} disabled={loading}>
          {loading ? '查询中...' : '开始追溯'}
        </button>
      </div>

      {result && (
        <div>
          {/* Subgraph visualization - text-based */}
          <div className="card" style={{ marginBottom:'.75rem' }}>
            <h3 style={{ marginBottom:'.75rem' }}>
              关系追溯结果
              <span style={{ fontSize:'.8rem', fontWeight:400, color:'var(--text-muted)', marginLeft:'.5rem' }}>
                ({result.entities?.length || 0} 个实体, {result.relationships?.length || 0} 条关系)
              </span>
            </h3>
            {result.relationships?.length > 0 && (
              <div className="kg-diagram" style={{ whiteSpace:'pre', fontFamily:'monospace', fontSize:'.82rem', lineHeight:1.8 }}>
                {result.relationships.map((rel: any, i: number) => {
                  const srcLabel = TYPE_LABELS[rel.source_type] || rel.source_type || '?';
                  const tgtLabel = TYPE_LABELS[rel.target_type] || rel.target_type || '?';
                  return (
                    <div key={i}>
                      [{srcLabel}]{rel.source_id || '?'}
                      <span style={{ color:'var(--accent)', fontWeight:600 }}> —[{rel.relation}]→ </span>
                      [{tgtLabel}]{rel.target_id || '?'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Entities list */}
          {result.entities?.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom:'.75rem' }}>关联实体</h3>
              {result.entities.map((ent: any, i: number) => (
                <div key={i} style={{ padding:'.5rem 0', borderBottom:'1px solid var(--border)' }}>
                  <span className={`badge ${TYPE_BADGES[ent.entity_type] || 'badge-blue'}`} style={{ marginRight:'.5rem' }}>
                    {TYPE_LABELS[ent.entity_type] || ent.entity_type}
                  </span>
                  <strong>{ent.entity_id}</strong>
                  {ent.properties && (
                    <div style={{ fontSize:'.78rem', color:'var(--text-secondary)', marginTop:'.2rem' }}>
                      {Object.entries(ent.properties).filter(([k]) => !['entity_id','name','title'].includes(k)).slice(0, 3).map(([k, v]) => (
                        <span key={k} style={{ marginRight:'1rem' }}>{k}: {String(v).substring(0, 80)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
