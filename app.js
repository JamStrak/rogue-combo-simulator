const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const initial={cfg:{start:100,max:100,regen:10,gcd:1,reduction:0,prepared:true,composure:0,exposeRank:0,ruthlessRank:0,ruthlessMode:"random",relentlessRank:0,relentlessMode:"random",seed:1,startStealth:true,startCombat:false,premeditation:false,initiativeRank:0,sealRank:0,bootRank:0,flashRank:0,punctureRank:0,ambushCritRank:0,efficientRank:0,dirtyTricksRank:0,flawlessReduction:0,crit:20,gapTolerance:0,mutilate:false,adrenaline:false,coldblood:false,ghost:true,autoWait:true,dr:true,drReset:18,drSecond:50,drThird:25},sequence:[{id:'cheap'},{id:'strike'},{id:'ghost'},{id:'ambush'},{id:'kidney'}],book:JSON.parse(JSON.stringify(skills))};
let state;try{const old=JSON.parse(localStorage.getItem('shadow-calc-v1'));state=old&&old.cfg&&Array.isArray(old.sequence)&&old.book?{...old,cfg:{...initial.cfg,...old.cfg},book:{...structuredClone(initial.book),...old.book}}:structuredClone(initial);if(old&&old.cfg&&old.cfg.initiativeRank===undefined)state.cfg.initiativeRank=old.cfg.premeditation?3:0;if(state.book.ambush&&state.book.ambush.cp===2)state.book.ambush.cp=1}catch{state=structuredClone(initial)}
if(!Array.isArray(state.savedCombos))state.savedCombos=[];
if(!state.talents || validateTalents(state.talents)) {state.talents=blankTalents();state.talentsApplied=false;}
let selectedTalent=null;
const numIds=['start','max','regen','gcd','reduction','drReset','drSecond','drThird','crit','gapTolerance','flawlessReduction'], boolIds=['prepared','startStealth','startCombat','mutilate','adrenaline','coldblood','ghost','autoWait','dr'];
function save(){try{localStorage.setItem('shadow-calc-v1',JSON.stringify(state));return true}catch{return false}}
function syncConfig(){$('#dirtyDeeds').value=[0,10,20].includes(Number(state.cfg.reduction))?String(state.cfg.reduction):'custom';numIds.forEach(id=>$('#'+id).value=state.cfg[id]);boolIds.forEach(id=>$('#'+id).checked=state.cfg[id]);['composure','exposeRank','ruthlessRank','ruthlessMode','relentlessRank','relentlessMode','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank'].forEach(id=>$('#'+id).value=String(state.cfg[id]));}
function drawPalette(){
 const seq=state.sequence,cfg=state.cfg,book=state.book;
 $('#palette').innerHTML=Object.entries(book).map(([id,s])=>{
  let label=s.wait?'自由间隔':s.leave?'手动标记':'';
  if(!label){const entry={id,...(id==='premed'?{offGcd:true}:{})},result=simulate([...seq,entry],cfg,book),row=result.rows.at(-1);
   label=!row||row.index!==seq.length?'前序步骤中断':row.error?'当前条件不足':`预计消耗 ${fmt(row.cost)} 能量`;
  }
  return `<button class="skill" data-add="${id}"><b>+</b> ${s.name}<span>${label}</span></button>`;
 }).join('');
}
function updateSkillCostHint(){const id=$('#editSkill').value,current=state.book[id].cost,standard=initial.book[id].cost;$('#editBaseNote').textContent=Number(current)!==Number(standard)?`当前基础消耗 ${fmt(current)}，默认 ${fmt(standard)}；天赋和被动会继续减免。`:'填写未减免的基础消耗；天赋和被动会另行计算。';}
function editDraw(){const sel=$('#editSkill'), current=sel.value;sel.innerHTML=Object.entries(state.book).filter(([id])=>id!=='wait'&&id!=='leave').map(([id,s])=>`<option value="${id}">${s.name}</option>`).join('');if(state.book[current])sel.value=current;const s=state.book[sel.value];['Cost','Gain','Cc','Cd'].forEach(n=>$('#edit'+n).value=s[n.toLowerCase()]);$('#editDr').value=s.dr||'';$('#editDr').disabled=!s.type;updateSkillCostHint();}
function drawSequence(){const dest=$('#sequence');if(!state.sequence.length){dest.innerHTML='<div class="empty">从上方选择技能，开始构建你的连招。</div>';return}dest.innerHTML=state.sequence.map((a,i)=>`<div class="seqrow"><span class="seqindex">${String(i+1).padStart(2,'0')}</span><strong>${state.book[a.id].name}</strong>${a.id==='wait'?`<label class="waitfield">等待 <input data-wait="${i}" type="number" min="0" max="120" step="0.1" value="${Number(a.wait??1)}"> 秒</label>`:a.id==='leave'?'<span class="offgcd">手动假设已脱离战斗</span>':`<label class="offgcd"><input type="checkbox" data-off="${i}" ${a.offGcd?'checked':''}> 不占公共CD</label>`}<div class="rowbuttons"><button data-up="${i}" aria-label="上移" ${i===0?'disabled':''}>↑</button><button data-down="${i}" aria-label="下移" ${i===state.sequence.length-1?'disabled':''}>↓</button><button data-del="${i}" aria-label="移除">×</button></div></div>`).join('');}
function drawCompare(){const c=state.cfg,b=state.book;$('#costCompare').innerHTML=['cheap','ambush','garrote'].map(id=>{let full=skillCost(id,c,b,c.max,false).cost, normal=skillCost(id,c,b,c.max,true).cost;return `<article><span>${b[id].name}</span><p><small>脱战满能量</small><b>${fmt(full)}</b></p><p><small>战斗中 / 未满</small><b>${fmt(normal)}</b></p></article>`}).join('');}
function renderNotes(notes,error=false){
 return notes.flatMap(note=>note.split('；')).map(note=>{
  const warning=error||/能量不足|可反制空档|控制空档|控制免疫|可能提前打破/.test(note);
  const overflow=!warning&&/连击点溢出/.test(note);
  const success=!warning&&!overflow&&!/未触发/.test(note)&&/暴击 [\d.]+%：是|(?:：|封印命运)触发|强化破甲：5 星返还/.test(note);
  const safe=note.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return `<span${warning?' class="note-warning"':overflow?' class="note-overflow"':success?' class="note-success"':''}>${safe}</span>`;
 }).join('；')||'—';
}
function drawResult(){drawPalette();const oldAnalysis=$('#probabilityResult');if(oldAnalysis&&oldAnalysis.dataset.ready){oldAnalysis.innerHTML='配置或队列已变化，请重新计算概率。';delete oldAnalysis.dataset.ready;}drawCompare();const v=simulate(state.sequence,state.cfg,state.book),$s=$('#status');$s.textContent=v.stopped?'存在阻断':'计算完成';$s.className='status '+(v.stopped?'bad':'good');$('#summary').innerHTML=`<div><span>最终能量</span><b>${fmt(v.energy)} <small>/ ${fmt(state.cfg.max)}</small></b></div><div><span>最终连击点</span><b>${v.cp} <small>/ 5</small></b></div><div><span>本段历时</span><b>${fmt(v.time)} <small>秒</small></b></div><div class="${v.gap>0?'danger':''}"><span>累计控制空档</span><b>${fmt(v.gap)} <small>秒</small></b></div>`;$('#warnings').textContent=state.cfg.dr?'PvP 递减采用假设：同组第 2 / 3 次分别按设定比例，第 4 次免疫；重置从控制结束计时。':'PvP 递减当前关闭，控制时长可能高估。';$('#rows').innerHTML=v.rows.length?v.rows.map(x=>`<tr class="${x.error?'error':''}"><td class="time">${fmt(x.time)}s</td><td><strong>${x.name}</strong></td><td><b class="energy">${fmt(x.before)} → ${fmt(x.after)}</b></td><td>${'●'.repeat(x.cp)}<span class="dim">${'○'.repeat(5-x.cp)}</span></td><td>${x.controlEnd>x.time?fmt(x.controlEnd)+'s':'—'}</td><td>${renderNotes(x.notes,x.error)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">添加技能后自动计算</td></tr>';drawComboComparison();}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function savedCombos(){return state.savedCombos.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&Array.isArray(x.sequence)&&x.sequence.every(a=>a&&state.book[a.id]));}
function drawLibrary(){
 const items=savedCombos(),saved=$('#savedCombo'),old=saved.value;
 saved.innerHTML='<option value="">请选择连招</option>'+items.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('');saved.value=items.some(x=>x.id===old)?old:'';
 for(const id of ['compareA','compareB']){const select=$('#'+id),previous=select.value;select.innerHTML='<option value="current">当前编辑的连招</option>'+items.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('');select.value=previous==='current'||items.some(x=>x.id===previous)?previous:'current';}
 drawComboComparison();
}
function drawComboComparison(){
 const items=savedCombos();const selected=id=>{const value=$('#'+id).value;return value==='current'?{name:'当前编辑的连招',sequence:state.sequence}:items.find(x=>x.id===value);};
 const a=selected('compareA'),b=selected('compareB'),target=$('#comboComparison');if(!a||!b){target.textContent='请选择要对比的连招。';return;}
 if(!a.sequence.length||!b.sequence.length){target.textContent='请先为两边选择非空连招。';return;}
 const x=simulate(a.sequence,state.cfg,state.book),y=simulate(b.sequence,state.cfg,state.book);
 const diff=(n,m)=>Math.abs(n-m)<0.005?'相同':`${n>m?'A 多':'B 多'} ${fmt(Math.abs(n-m))}`;
 const metrics=[['控制总时长',x.controlled,y.controlled,'秒'],['累计控制空档',x.gap,y.gap,'秒'],['能量不足等待',x.energyWait,y.energyWait,'秒'],['执行历时',x.time,y.time,'秒'],['结束时能量',x.energy,y.energy,'点']];
 const status=v=>v.stopped?`第 ${v.rows.at(-1).index+1} 步 ${escapeHtml(v.rows.at(-1).name)} 中断`:'执行完成';
 const insights=[];if(!x.stopped&&!y.stopped){for(const [label,v,w,preferMore] of [['控制时间更长',x.controlled,y.controlled,true],['控制空档更少',x.gap,y.gap,false],['回能等待更少',x.energyWait,y.energyWait,false]])if(Math.abs(v-w)>=0.005)insights.push(`${(v>w)===preferMore?'A':'B'} 的${label} ${fmt(Math.abs(v-w))} 秒`);}
 target.innerHTML=`<div class="comparison-scroll"><table><thead><tr><th>指标</th><th>A · ${escapeHtml(a.name)}</th><th>B · ${escapeHtml(b.name)}</th><th>差异</th></tr></thead><tbody><tr><th>执行结果</th><td>${status(x)}</td><td>${status(y)}</td><td>—</td></tr>${metrics.map(([label,v,w,unit])=>`<tr><th>${label}</th><td>${fmt(v)} ${unit}</td><td>${fmt(w)} ${unit}</td><td>${diff(v,w)}${Math.abs(v-w)<0.005?'':` ${unit}`}</td></tr>`).join('')}</tbody></table></div><p class="comparison-insights">${insights.length?insights.join('；'):x.stopped||y.stopped?'存在中断，请先查看各自中断原因。':'两套连招在控制时间、空档和回能等待方面相同。'}</p><p class="small">中断结果仅统计执行到中断时的情况，不能直接与完整连招比较；控制总时长不重复计算覆盖部分。</p>`;
}
function refresh(){drawSequence();drawResult();save();}
syncConfig();editDraw();drawTalents();drawLibrary();refresh();
numIds.forEach(id=>$('#'+id).addEventListener('input',e=>{if(e.target.value==='')return;let n=Number(e.target.value);if(!Number.isFinite(n)||n<Number(e.target.min)||n>Number(e.target.max))return;state.cfg[id]=n;if(id==='reduction')$('#dirtyDeeds').value=[0,10,20].includes(n)?String(n):'custom';drawResult();save()}));boolIds.forEach(id=>$('#'+id).addEventListener('change',e=>{state.cfg[id]=e.target.checked;drawResult();save()}));
['composure','exposeRank','ruthlessRank','ruthlessMode','relentlessRank','relentlessMode','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank'].forEach(id=>$('#'+id).addEventListener('change',e=>{state.cfg[id]=id.endsWith('Mode')?e.target.value:Number(e.target.value);drawResult();save()}));
$('#reroll').onclick=()=>{state.cfg.seed=(Math.random()*4294967295>>>0)||1;drawResult();save()};
$('#editSkill').addEventListener('change',editDraw);['Cost','Gain','Cc','Cd'].forEach(n=>$('#edit'+n).addEventListener('input',e=>{if(e.target.value==='')return;let v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=Number(e.target.max)){state.book[$('#editSkill').value][n.toLowerCase()]=v;if(n==='Cost')updateSkillCostHint();refresh()}}));$('#editDr').addEventListener('change',e=>{state.book[$('#editSkill').value].dr=e.target.value;refresh()});
$('#restoreSkills').onclick=()=>{state.book=structuredClone(initial.book);editDraw();refresh()};$('#palette').onclick=e=>{let b=e.target.closest('[data-add]');if(b){state.sequence.push({id:b.dataset.add,...(b.dataset.add==='wait'?{wait:1}:{}),...(b.dataset.add==='premed'?{offGcd:true}:{})});refresh()}};
$('#sequence').onclick=e=>{const b=e.target.closest('button');if(!b)return;let i=Number(b.dataset.up??b.dataset.down??b.dataset.del);if(b.dataset.del!==undefined)state.sequence.splice(i,1);else {let j=b.dataset.up!==undefined?i-1:i+1;if(j>=0&&j<state.sequence.length)[state.sequence[i],state.sequence[j]]=[state.sequence[j],state.sequence[i]]}refresh()};
$('#sequence').oninput=e=>{if(e.target.dataset.wait!==undefined&&e.target.value!==''){let n=Number(e.target.value);if(n>=0&&n<=120){state.sequence[+e.target.dataset.wait].wait=n;drawResult();save()}}};$('#sequence').onchange=e=>{if(e.target.dataset.off!==undefined){state.sequence[+e.target.dataset.off].offGcd=e.target.checked;drawResult();save()}};
$('#savedCombo').onchange=()=>{const item=savedCombos().find(x=>x.id===$('#savedCombo').value);if(item)$('#comboName').value=item.name;};
$('#saveCombo').onclick=()=>{const name=$('#comboName').value.trim();if(!name||!state.sequence.length){$('#comboMessage').textContent='请填写名称并先添加至少一个技能。';return;}if(savedCombos().some(x=>x.name===name)){$('#comboMessage').textContent='这个名称已存在，请换一个名称，或选择已有连招后点击更新。';return;}const id='combo-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);state.savedCombos.push({id,name,sequence:structuredClone(state.sequence)});if(!save()){state.savedCombos.pop();$('#comboMessage').textContent='保存失败：浏览器不允许保存或存储空间已满。';return;}drawLibrary();$('#savedCombo').value=id;$('#compareB').value=id;drawComboComparison();$('#comboMessage').textContent=`已保存“${name}”。`;};
$('#loadCombo').onclick=()=>{const item=savedCombos().find(x=>x.id===$('#savedCombo').value);if(!item){$('#comboMessage').textContent='请先选择已保存的连招。';return;}state.sequence=structuredClone(item.sequence);$('#comboName').value=item.name;refresh();$('#comboMessage').textContent=`已载入“${item.name}”，编辑后需点击“更新所选”才会覆盖保存版本。`;};
$('#updateCombo').onclick=()=>{const item=savedCombos().find(x=>x.id===$('#savedCombo').value),name=$('#comboName').value.trim();if(!item||!name||!state.sequence.length){$('#comboMessage').textContent='请选择连招、填写名称并添加技能。';return;}if(savedCombos().some(x=>x.id!==item.id&&x.name===name)){$('#comboMessage').textContent='这个名称已存在，请换一个名称。';return;}const previous=structuredClone(item);item.name=name;item.sequence=structuredClone(state.sequence);if(!save()){Object.assign(item,previous);$('#comboMessage').textContent='更新失败：浏览器不允许保存或存储空间已满。';return;}drawLibrary();$('#comboMessage').textContent=`已更新“${name}”。`;};
$('#deleteCombo').onclick=()=>{const item=savedCombos().find(x=>x.id===$('#savedCombo').value);if(!item){$('#comboMessage').textContent='请先选择已保存的连招。';return;}if(!confirm(`确定删除已保存的连招“${item.name}”？`))return;const previous=state.savedCombos;state.savedCombos=state.savedCombos.filter(x=>x.id!==item.id);if(!save()){state.savedCombos=previous;$('#comboMessage').textContent='删除失败：浏览器不允许保存。';return;}drawLibrary();$('#comboMessage').textContent=`已删除“${item.name}”。`;};
$('#compareA').onchange=drawComboComparison;$('#compareB').onchange=drawComboComparison;
$('#clear').onclick=()=>{state.sequence=[];refresh()};$('#reset').onclick=()=>{state.sequence=structuredClone(initial.sequence);refresh()};

$('#analyze').onclick=()=>{
 const target=$('#probabilityResult');
 if(!state.sequence.length){target.textContent='请先添加需要分析的连招。';return;}
 const a=analyzeProbability(state.sequence,state.cfg,state.book),percent=n=>n>0&&n<0.000001?'<0.0001%':n<1&&n>0.999999?'>99.9999%':Number((n*100).toFixed(4))+'%';
 const steps=obj=>Object.entries(obj).sort((a,b)=>Number(b[1])-Number(a[1])).map(([i,p])=>`<li>第 ${Number(i)+1} 步 ${state.book[state.sequence[i].id].name}：${percent(p)}</li>`).join('')||'<li>未出现</li>';
 target.dataset.ready='1';
 target.innerHTML=`<div class="prob-grid"><div><span>无缝衔接概率</span><strong>${percent(a.success)}</strong></div><div><span>队列执行完成</span><strong>${percent(a.complete)}</strong></div><div><span>出现能量不足</span><strong>${percent(a.energy)}</strong></div><div><span>控制空档超出容许</span><strong>${percent(a.gap)}</strong></div></div><p class="analysis-method">${a.method==='exact'?`完整枚举：${a.leaves} 条结果分支`:`分支过多，采用 ${a.samples} 次随机抽样估计`}；终点能量 ${fmt(a.minEnergy)}–${fmt(a.maxEnergy)}，平均 ${fmt(a.sumEnergy)}（含中断分支）。概率问题可同时发生，不能直接相加。</p><div class="issue-grid"><div><b>各步能量不足概率</b><ul>${steps(a.energySteps)}</ul></div><div><b>各步出现控制空档概率</b><ul>${steps(a.gapSteps)}</ul></div><div><b>无法继续的步骤</b><ul>${steps(a.blockedSteps)}</ul></div></div>`;
};

$('#dirtyDeeds').addEventListener('change',e=>{if(e.target.value==='custom')return;state.cfg.reduction=Number(e.target.value);$('#reduction').value=state.cfg.reduction;drawResult();save()});

const myTalentLink='2253202120105003--0052230313110011';
function drawTalents(){
 const totals=state.talents.map(a=>a.reduce((s,n)=>s+n,0));
 $('#talentTree').innerHTML=talentTrees.map((tree,x)=>`<section class="talent-branch"><h4>${tree.name}<span>${totals[x]} 点</span></h4><div class="talent-grid">${tree.talents.map((t,i)=>{let n=state.talents[x][i];return `<div class="talent-node ${n?'chosen':''}" style="grid-row:${t.row};grid-column:${t.col}"><button class="talent-name" data-talent-detail="${x},${i}" title="${t.name}：${talentDescriptions[t.name](n||1)}"><img class="talent-icon" src="assets/talents/${talentVisuals[t.name].icon}" alt="" loading="lazy"><strong>${t.name}</strong></button><span>${n}/${t.max}</span><small>${modeledTalents.has(t.name)?'已计算':'仅加点'}</small><div><button aria-label="减少${t.name}" data-talent-minus="${x},${i}">−</button><button aria-label="增加${t.name}" data-talent-plus="${x},${i}">+</button></div></div>`}).join('')}</div></section>`).join('');
 if(selectedTalent)showTalentDetail(...selectedTalent);
 $('#talentStatus').textContent=`已分配 ${totals.reduce((s,n)=>s+n,0)} / 51 点 · ${totals.join(' / ')}。${state.talentsApplied?'天赋已应用；下方设定可继续微调。':'尚未应用或已手动调整模拟设定；可点击“重新应用天赋”。'}`;
}
function showTalentDetail(x,i){
 const t=talentTrees[x].talents[i], n=state.talents[x][i], v=talentVisuals[t.name], describe=talentDescriptions[t.name], req=t.req===null?'无':talentTrees[x].talents[t.req].name+'（需点满）';
 const next=n<t.max?`<div><b>下一级 ${n+1}/${t.max}</b> ${describe(n+1)}</div>`:'<div><b>已达到最高等级</b></div>';
 const current=n?`<div><b>当前 ${n}/${t.max}</b> ${describe(n)}</div>`:'<div><b>当前未学习</b> 加入 1 点后生效。</div>';
 const ranks=Array.from({length:t.max},(_,j)=>`<li><b>${j+1} 级：</b>${describe(j+1)}</li>`).join('');
 $('#talentDetail').innerHTML=`<div class="talent-detail-head"><img src="assets/talents/${v.icon}" alt=""><div><strong>${t.name}</strong> <span>${n}/${t.max} · ${modeledTalents.has(t.name)?'资源 / 控制相关效果已计算':'仅加点，效果尚未计算'}</span>${v.cost?`<div class="talent-cost">${v.cost}</div>`:''}</div></div><div class="talent-rank-info">${current}${next}<div><b>前置天赋</b> ${req}；本系前置层数至少 ${(t.row-1)*5} 点。</div></div><details><summary>查看全部 ${t.max} 个等级</summary><ul>${ranks}</ul></details>`;
}
function talentApply(){applyTalentConfig(state.talents,state.cfg);state.talentsApplied=true;syncConfig();drawTalents();drawResult();save();}
$('#talentTree').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.talentDetail!==undefined){selectedTalent=b.dataset.talentDetail.split(',').map(Number);showTalentDetail(...selectedTalent);return;}const plus=b.dataset.talentPlus!==undefined, [x,i]=(plus?b.dataset.talentPlus:b.dataset.talentMinus).split(',').map(Number), t=talentTrees[x].talents[i],next=state.talents[x][i]+(plus?1:-1);if(next<0||next>t.max)return;const a=structuredClone(state.talents);a[x][i]=next;const err=validateTalents(a);if(err){$('#talentStatus').textContent=err;return;}state.talents=a;talentApply();};
$('#talentApply').onclick=talentApply;
$('#talentClear').onclick=()=>{state.talents=blankTalents();talentApply();};
function importTalents(text){try{state.talents=parseTalentLink(text);talentApply();}catch(e){$('#talentStatus').textContent='导入失败：'+e.message;}}
$('#talentImport').onclick=()=>importTalents($('#talentLink').value);
$('#talentPreset').onclick=()=>{ $('#talentLink').value='https://wowhandbook.com/zh/classes/rogue/talents/#'+myTalentLink;importTalents(myTalentLink); };
const talentOverrideIds=['reduction','flawlessReduction','dirtyDeeds','composure','exposeRank','ruthlessRank','relentlessRank','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank','mutilate','adrenaline','coldblood','ghost'];
talentOverrideIds.forEach(id=>$('#'+id).addEventListener('change',()=>{if(state.talentsApplied){state.talentsApplied=false;drawTalents();save();}}));
