const e = React.createElement;
function Badge({children, color='gray'}){
  const classes = {
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-rose-100 text-rose-800',
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800'
  }[color] || 'bg-gray-100 text-gray-800';
  return e('span',{className:`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${classes}`}, children);
}

function Sparkline({points, width=200, height=40}){
  if(!points || points.length===0) return e('svg',{width, height});
  const vals = points.map(p=>p.gas_gwei);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = 4;
  const scaleX = (i) => pad + (i/(vals.length-1))*(width-2*pad);
  const scaleY = (v) => height - pad - ((v - min)/(Math.max(1e-6, max-min)))*(height-2*pad);
  const d = vals.map((v,i)=>`${i===0?'M':'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`).join(' ');
  return e('svg',{width,height, className:'block'}, e('path',{d, stroke:'#f59e0b', fill:'none', 'stroke-width':2}));
}

function useInterval(callback, delay){
  const savedRef = React.useRef();
  React.useEffect(()=>{ savedRef.current = callback; }, [callback]);
  React.useEffect(()=>{ if(delay==null) return; const id = setInterval(()=>savedRef.current(), delay); return ()=>clearInterval(id); }, [delay]);
}

function App(){
  const [tx, setTx] = React.useState('swap 0.5 ETH to USDC on Uniswap');
  const [gas, setGas] = React.useState('12');
  const [explain, setExplain] = React.useState(null);
  const [opt, setOpt] = React.useState(null);
  const [trend, setTrend] = React.useState(null);
  const [recent, setRecent] = React.useState([]);
  const [recentSource, setRecentSource] = React.useState('');
  const [recentLoading, setRecentLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState(null);
  const [loadingOpt, setLoadingOpt] = React.useState(false);
  const [loadingExplain, setLoadingExplain] = React.useState(false);
  const [loadingPredict, setLoadingPredict] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [ethPrice, setEthPrice] = React.useState('1800');
  const [gasLimit, setGasLimit] = React.useState('21000');

  async function runExplain(){
    setError(null); setExplain(null); setLoadingExplain(true);
    try{
      const res = await fetch('http://127.0.0.1:8000/explain',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({tx})});
      if(!res.ok) throw new Error('Backend error');
      const j = await res.json(); setExplain(j.explanation);
    }catch(err){ setError('Could not reach backend for explanation. Is it running?'); }
    setLoadingExplain(false);
  }

  async function runTrend(){ try{ const res = await fetch('http://127.0.0.1:8000/gas-trend'); const j = await res.json(); setTrend(j.message);}catch(e){ setTrend(null); } }

  async function fetchRecent(count=20){
    setError(null);
    setRecentLoading(true);
    try{
      const res = await fetch(`http://127.0.0.1:8000/fetch-recent?count=${count}`);
      if(!res.ok) throw new Error('Backend returned ' + res.status);
      const j = await res.json();
      setRecent(j.recent || []);
      setRecentSource(j.source || 'unknown');
      setLastUpdated(new Date());
      setToast(`Loaded ${ (j.recent || []).length } points (${j.source || 'unknown'})`);
      setTimeout(()=>setToast(null), 3000);
      return j.recent || [];
    }catch(e){
      console.error('fetchRecent error', e);
      setError('Could not fetch recent gas from backend. Is it running?');
      setToast('Failed to fetch recent blocks');
      setTimeout(()=>setToast(null), 3000);
      return [];
    } finally{
      setRecentLoading(false);
    }
  }

  async function runOptimize(){ setError(null); setOpt(null); setLoadingOpt(true); try{ const res = await fetch('http://127.0.0.1:8000/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({tx, current_gas: parseFloat(gas)})}); if(!res.ok) throw new Error('Backend error'); const j = await res.json(); setOpt(j); if(!recent || recent.length===0) fetchRecent(); }catch(err){ setError('Could not reach backend for optimization. Is it running?'); } setLoadingOpt(false); }

  async function runAIPredict(){ setLoadingPredict(true); try{ const res = await fetch('http://127.0.0.1:8000/ai-predict',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({count:20})}); const j = await res.json(); setExplain(prev=>`AI prediction: ${j.message}`); }catch(e){ setError('AI predict failed'); } setLoadingPredict(false); }

  function copySuggested(){ if(opt && opt.suggested_gas){ navigator.clipboard.writeText(String(opt.suggested_gas)).then(()=> { setToast('Copied suggested gas to clipboard'); setTimeout(()=>setToast(null),2000); }).catch(()=>{ setToast('Copy failed'); setTimeout(()=>setToast(null),2000); }); }}

  // live countdown for wait_seconds
  const [countdown, setCountdown] = React.useState(null);
  useInterval(()=>{ if(!opt || opt.wait_seconds==null) return; if(opt.wait_seconds>0){ opt.wait_seconds = Math.max(0,opt.wait_seconds-1); setCountdown(opt.wait_seconds); } else setCountdown(0); }, 1000);

  React.useEffect(()=>{ runTrend(); fetchRecent(); }, []);

  const estCost = React.useMemo(()=>{
    if(!opt) return null; try{ const gl = parseFloat(gasLimit); const ethP = parseFloat(ethPrice); const suggestedGwei = parseFloat(opt.suggested_gas); const currGwei = parseFloat(gas); const suggestedETH = suggestedGwei * 1e-9 * gl; const currentETH = currGwei * 1e-9 * gl; const deltaETH = currentETH - suggestedETH; return {suggestedETH, currentETH, deltaETH, deltaUSD: deltaETH * ethP}; }catch(e){ return null; } }, [opt, gas, ethPrice, gasLimit]);

  return e('div', {className:'max-w-4xl w-full'},
    e('div', {className:'bg-white rounded-2xl shadow-lg p-6 md:p-8'},
      e('div', {className:'flex items-start justify-between gap-4 mb-4'},
        e('div', null, e('h1',{className:'text-2xl font-semibold'}, 'Gas Whisperer'), e('div',{className:'text-sm text-slate-500 mt-1'}, 'AI + Stylus gas fee optimizer — demo')),
        e('div', null, trend ? e(Badge, {color:'blue'}, trend) : e(Badge, {color:'gray'}, 'No trend'))
      ),

      e('div', {className:'grid grid-cols-1 md:grid-cols-3 gap-6'},
        e('div', {className:'md:col-span-2'},
          e('label',{className:'block text-sm font-medium text-slate-700 mb-2'}, 'Paste transaction (plain text)'),
          e('textarea',{className:'w-full p-3 border rounded-lg bg-slate-50 text-slate-800 resize-none focus:ring-2 focus:ring-blue-200', rows:4, value:tx, onChange: (ev)=>setTx(ev.target.value)}),
          e('div',{className:'flex items-center gap-3 mt-4'},
            e('div', {className:'flex-1'}, e('label',{className:'block text-sm font-medium text-slate-700 mb-1'}, 'Current gas (gwei)'), e('input',{className:'w-36 p-2 border rounded-lg', value:gas, onChange:(ev)=>setGas(ev.target.value), inputMode:'numeric'})),
            e('div', {className:'flex gap-2'},
              e('button',{className:`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white ${loadingOpt? 'bg-slate-400':'bg-amber-600 hover:bg-amber-700'}`, onClick: runOptimize, disabled:loadingOpt}, loadingOpt ? 'Optimizing...' : 'Optimize'),
              e('button',{className:`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${loadingExplain? 'text-slate-400 border-slate-200':'text-slate-700 border-slate-200 hover:bg-slate-50'}`, onClick: runExplain, disabled:loadingExplain}, loadingExplain ? 'Explaining...' : 'Explain'),
              e('button',{className:`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${loadingPredict? 'text-slate-400':'text-slate-700 hover:bg-slate-50'}`, onClick: runAIPredict, disabled:loadingPredict}, loadingPredict ? 'Predicting...' : 'AI Predict')
            )
          )
        ),

        e('aside', {className:'bg-slate-50 p-4 rounded-lg border'},
          e('div', {className:'flex items-center justify-between mb-2'}, e('div',{className:'text-sm text-slate-600'}, 'Quick actions'), recentSource ? e(Badge,{color: recentSource==='rpc'?'blue':'gray'}, recentSource.toUpperCase()) : null),
          e('div', {className:'mb-3'}, e(Sparkline,{points: recent, width:240, height:48})),
          e('div', {className:'flex flex-col gap-2'},
            e('button',{className:`text-sm text-left p-2 rounded hover:bg-white ${recentLoading? 'opacity-60 cursor-wait':''}`, onClick: ()=>fetchRecent(20), disabled: recentLoading}, recentLoading ? 'Refreshing...' : 'Refresh recent blocks'),
            e('button',{className:`text-sm text-left p-2 rounded hover:bg-white ${recentLoading? 'opacity-60 cursor-wait':''}`, onClick: ()=>fetchRecent(50), disabled: recentLoading}, recentLoading ? 'Loading...' : 'Load last 50')
          ),
          lastUpdated ? e('div',{className:'mt-3 text-xs text-slate-500'}, `Last: ${lastUpdated.toLocaleTimeString()}`) : null,
          e('div',{className:'mt-4 text-xs text-slate-500'}, 'Backend: http://127.0.0.1:8000')
        )
      ),

  error ? e('div',{className:'mt-4 p-3 bg-rose-50 text-rose-800 rounded-lg border'}, error) : null,

  // Toast
  toast ? e('div',{style:{position:'fixed',right:20,top:20,zIndex:9999}}, e('div',{className:'px-4 py-2 rounded bg-slate-900 text-white shadow'}, toast)) : null,

      opt ? e('div',{className:'mt-6 p-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border'},
          e('div',{className:'flex items-center justify-between gap-4'},
            e('div', null, e('div',{className:'text-sm text-slate-500'}, 'Suggested gas'), e('div',{className:'text-2xl font-semibold mt-1'}, `${opt.suggested_gas} gwei`)),
            e('div', {className:'flex items-center gap-3'}, opt.risk ? e(Badge,{color:'red'}, 'Risk: High') : e(Badge,{color:'green'}, 'Risk: Low'), e('button',{className:'px-2 py-1 bg-slate-100 rounded text-sm', onClick: copySuggested}, 'Copy'))
          ),
          e('div',{className:'mt-3 text-sm text-slate-600'}, e('strong',null,'Optimal time: '), ' ', (function(){ try{ const dt = new Date(opt.optimal_time_iso); const diff = Math.round((dt - new Date())/1000); if (diff <= 30 && diff >= -30) return 'Now'; if (diff > 30 && diff < 3600) return `In ${Math.round(diff/60)} min (${dt.toLocaleTimeString()})`; return dt.toLocaleString(); }catch(e){ return new Date(opt.optimal_time_iso).toLocaleString(); } })()),
          e('div',{className:'mt-2 text-sm text-slate-500'}, opt.reason),
          estCost ? e('div',{className:'mt-3 text-sm text-slate-700'}, e('div',null, `Estimated cost now: ${estCost.currentETH.toFixed(6)} ETH (~$${(estCost.currentETH*parseFloat(ethPrice)).toFixed(2)})`), e('div',null, `If you use suggested gas: ${estCost.suggestedETH.toFixed(6)} ETH (~$${(estCost.suggestedETH*parseFloat(ethPrice)).toFixed(2)})`), e('div',null, e('strong',null, `Estimated savings: $${(estCost.deltaUSD).toFixed(2)}`))) : null
        ) : null,

      explain ? e('div',{className:'mt-6 p-4 bg-amber-50 rounded-lg border'}, e('div',{className:'text-sm font-medium text-slate-700 mb-1'}, 'AI explanation'), e('div',{className:'text-sm text-slate-800'}, explain)) : null,

      e('div',{className:'mt-6 grid grid-cols-1 md:grid-cols-3 gap-4'},
        e('div', {className:'md:col-span-2 p-4 bg-slate-50 rounded-lg border'},
          e('div',{className:'text-sm font-medium text-slate-700 mb-2'}, 'Simulation controls'),
          e('div',{className:'flex gap-3 items-center'}, e('label', {className:'text-sm'}, 'ETH price (USD)'), e('input',{className:'w-28 p-2 border rounded', value:ethPrice, onChange:(ev)=>setEthPrice(ev.target.value)}), e('label',{className:'text-sm ml-2'}, 'Gas limit'), e('input',{className:'w-28 p-2 border rounded', value:gasLimit, onChange:(ev)=>setGasLimit(ev.target.value)}))
        ),
        e('div', {className:'p-4 bg-slate-50 rounded-lg border'}, e('div',{className:'text-sm text-slate-600'}, 'This is a demo. For production, secure the backend.'))
      )
    )
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(e(App));
