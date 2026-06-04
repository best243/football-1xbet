// pronostic.js — Moteur Poisson (partagé index + match)
const PRONO = (() => {
  const FACT=[1,1,2,6,24,120,720,5040,40320,362880,3628800];
  const pmf=(k,l)=>l<=0?(k===0?1:0):Math.exp(-l)*Math.pow(l,k)/FACT[Math.min(k,10)];
  const fs=f=>f.reduce((s,r)=>s+(r==='W'?3:r==='D'?1:0),0)/(f.length*3);

  function predict(m){
    const hf=fs(m.hForm),af=fs(m.aForm);
    const hl=Math.max(0.3,m.hGA*(0.35+hf*0.95)+0.15);
    const al=Math.max(0.2,m.aGA*(0.35+af*0.95));
    let hw=0,dr=0,aw=0;
    for(let i=0;i<=7;i++)for(let j=0;j<=7;j++){
      const p=pmf(i,hl)*pmf(j,al);
      i>j?hw+=p:i===j?dr+=p:aw+=p;
    }
    const t=hw+dr+aw;
    hw=Math.round(hw/t*100);dr=Math.round(dr/t*100);aw=100-hw-dr;
    const conf=Math.min(95,Math.round(48+Math.max(hw,dr,aw)*0.52));
    let verdict,vc;
    if(hw>=dr&&hw>=aw){verdict=`Victoire ${shortN(m.home)}`;vc='home'}
    else if(dr>=hw&&dr>=aw){verdict='Match nul probable';vc='draw'}
    else{verdict=`Victoire ${shortN(m.away)}`;vc='away'}
    return{hw,dr,aw,conf,verdict,vc,hl:hl.toFixed(2),al:al.toFixed(2)};
  }

  function shortN(n){const w=n.split(' ');return w.length>2?w.slice(1).join(' '):n;}

  function formBadges(form){
    const cfg={W:{bg:'#3daa57',l:'V'},D:{bg:'#f5a623',l:'N'},L:{bg:'#e5332e',l:'D'}};
    return form.map(r=>`<span class="form-badge" style="background:${cfg[r].bg}">${cfg[r].l}</span>`).join('');
  }

  function renderDetail(m,pred){
    return `
    <div class="pred-teams-grid">
      <div class="ptg-team">
        <span class="ptg-name">${m.home}</span>
        <div class="ptg-form">${formBadges(m.hForm)}</div>
        <span class="ptg-stat">Moy. buts : ${m.hGA} | λ=${pred.hl}</span>
      </div>
      <div style="padding-top:.2rem;font-size:1rem;color:var(--text3)">⚔️</div>
      <div class="ptg-team">
        <span class="ptg-name">${m.away}</span>
        <div class="ptg-form">${formBadges(m.aForm)}</div>
        <span class="ptg-stat">Moy. buts : ${m.aGA} | λ=${pred.al}</span>
      </div>
    </div>
    <div class="pred-bars">
      ${bar(shortN(m.home),pred.hw,'h')}
      ${bar('Nul',pred.dr,'d')}
      ${bar(shortN(m.away),pred.aw,'a')}
    </div>
    <div class="pred-verdict ${pred.vc}">
      🤖 <strong>${pred.verdict}</strong> &nbsp;|&nbsp; Confiance : <strong>${pred.conf}%</strong>
    </div>
    <p class="pred-legal">Pronostic à titre éducatif uniquement. Pas de conseil de pari.</p>`;
  }

  function bar(lbl,pct,cls){
    return `<div class="bar-row">
      <span class="bar-lbl">${lbl}</span>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
      <span class="bar-pct">${pct}%</span>
    </div>`;}

  return{predict,renderDetail,formBadges,shortN};
})();
