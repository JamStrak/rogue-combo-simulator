const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const initial={cfg:{start:100,max:100,regen:10,gcd:1,reduction:0,prepared:true,composure:0,exposeRank:0,ruthlessRank:0,ruthlessMode:"random",relentlessRank:0,relentlessMode:"random",seed:1,startStealth:true,startCombat:false,premeditation:false,initiativeRank:0,sealRank:0,bootRank:0,flashRank:0,punctureRank:0,ambushCritRank:0,efficientRank:0,dirtyTricksRank:0,flawlessReduction:0,crit:20,gapTolerance:0,mutilate:false,adrenaline:false,coldblood:false,ghost:true,autoWait:true,dr:true,drReset:18,drSecond:50,drThird:25},sequence:[{id:'cheap'},{id:'strike'},{id:'ghost'},{id:'ambush'},{id:'kidney'}],book:JSON.parse(JSON.stringify(skills))};
let state;try{const old=JSON.parse(localStorage.getItem('shadow-calc-v1'));state=old&&old.cfg&&Array.isArray(old.sequence)&&old.book?{...old,cfg:{...initial.cfg,...old.cfg},book:{...structuredClone(initial.book),...old.book}}:structuredClone(initial);if(old&&old.cfg&&old.cfg.initiativeRank===undefined)state.cfg.initiativeRank=old.cfg.premeditation?3:0;if(state.book.ambush&&state.book.ambush.cp===2)state.book.ambush.cp=1}catch{state=structuredClone(initial)}
const damageInitial=damageDefaults(),savedDamage=state.damage&&typeof state.damage==='object'?state.damage:{};
// 示例双匕首来自无限服装备数据库；面板 AP 为可编辑的示例，不重复叠加装备属性。
const referenceWeapon={enabled:true,attackPower:528,mainMin:55,mainMax:102,mainSpeed:1.9,offMin:37,offMax:69,offSpeed:1.3,offhandPenalty:0.5,strikeCoefficient:0.5};
state.damage={...damageInitial,skillModel:'weapon',...savedDamage,weapon:{...referenceWeapon,...(savedDamage.weapon||{})},values:{...damageInitial.values,...(savedDamage.values||{})},bleeds:{garrote:{...damageInitial.bleeds.garrote,...(savedDamage.bleeds?.garrote||{})},rupture:{...damageInitial.bleeds.rupture,...(savedDamage.bleeds?.rupture||{})}}};
for(const id of Object.keys(damageInitial.values))if(!Number.isFinite(Number(state.damage.values[id]))||Number(state.damage.values[id])<0||Number(state.damage.values[id])>1000000)state.damage.values[id]=damageInitial.values[id];
for(const [key,min,max] of [['attackPower',0,10000],['mainMin',0,10000],['mainMax',0,10000],['mainSpeed',0.1,10],['offMin',0,10000],['offMax',0,10000],['offSpeed',0.1,10],['offhandPenalty',0,2],['strikeCoefficient',0,2]]){const value=Number(state.damage.weapon[key]);if(!Number.isFinite(value)||value<min||value>max)state.damage.weapon[key]=referenceWeapon[key];}
state.damage.weapon.enabled=!!state.damage.weapon.enabled;
const weaponTypes=['dagger','fist','sword','mace','axe','other'];
for(const key of ['mainWeaponType','offWeaponType'])if(!weaponTypes.includes(state.cfg[key]))state.cfg[key]='dagger';
if(!['random','expected'].includes(state.damage.whiteCritMode))state.damage.whiteCritMode='random';
if(!['base','manual'].includes(state.damage.bleedCritSource)){
 const savedRate=savedDamage.bleedCritRate;
 state.damage.bleedCritSource=savedRate!==undefined&&Number(savedRate)!==damageInitial.bleedCritRate?'manual':'base';
}
if(savedDamage.bleedCritMode===undefined)state.damage.bleedCritMode='random';
if(!['weapon','manual'].includes(state.damage.skillModel))state.damage.skillModel='weapon';
if(!['expected','random'].includes(state.damage.bleedCritMode))state.damage.bleedCritMode='expected';
if(!Number.isFinite(Number(state.damage.bleedCritRate))||state.damage.bleedCritRate<0||state.damage.bleedCritRate>100)state.damage.bleedCritRate=damageInitial.bleedCritRate;
for(const [id,config] of Object.entries(damageInitial.bleeds))for(const [key,value] of Object.entries(config)){const n=Number(state.damage.bleeds[id][key]),min=(key==='interval'||key==='duration')?0.1:0,max=(key==='interval'||key==='duration'||key==='durationBase'||key==='durationPerCombo')?120:1000000;if(!Number.isFinite(n)||n<min||n>max)state.damage.bleeds[id][key]=value;}
if(!Number.isFinite(Number(state.damage.critMultiplier))||state.damage.critMultiplier<1||state.damage.critMultiplier>5)state.damage.critMultiplier=damageInitial.critMultiplier;
if(!Number.isFinite(Number(state.damage.burstWindow))||state.damage.burstWindow<0.1||state.damage.burstWindow>120)state.damage.burstWindow=damageInitial.burstWindow;
if(!Array.isArray(state.savedCombos))state.savedCombos=[];
if(!state.talents || validateTalents(state.talents)) {state.talents=blankTalents();state.talentsApplied=false;}
// Older saved builds predate the weapon-specific critical strike mapping.
if(state.talentsApplied&&state.cfg.slashRank===undefined)state.cfg.slashRank=state.talents[1][16]||0;
if(state.talentsApplied&&state.cfg.lethalityRank===undefined)state.cfg.lethalityRank=state.talents[0][8]||0;
if(state.talentsApplied&&state.cfg.camouflageRank===undefined)state.cfg.camouflageRank=state.talents[2][4]||0;
let selectedTalent=null, mobileTalentBranch=0;
const numIds=['start','max','regen','gcd','reduction','drReset','drSecond','drThird','crit','gapTolerance','flawlessReduction'], boolIds=['prepared','startStealth','startCombat','mutilate','adrenaline','coldblood','ghost','autoWait','dr'];
function save(){try{localStorage.setItem('shadow-calc-v1',JSON.stringify(state));return true}catch{return false}}
function syncConfig(){$('#dirtyDeeds').value=[0,10,20].includes(Number(state.cfg.reduction))?String(state.cfg.reduction):'custom';numIds.forEach(id=>$('#'+id).value=state.cfg[id]);boolIds.forEach(id=>$('#'+id).checked=state.cfg[id]);['composure','exposeRank','ruthlessRank','ruthlessMode','relentlessRank','relentlessMode','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank'].forEach(id=>$('#'+id).value=String(state.cfg[id]));}
const draftActions={wait:{seconds:1,tip:'维持当前攻击状态并经过一段时间'},stop:{label:'停砍',seconds:1,tip:'停止平砍并经过一段时间'},evade:{seconds:6,tip:'停止平砍并按无交战情形推演脱战'},stealth:{tip:'已脱战时进入潜行'}};
function draftEntry(id){
 const seconds=draftActions[id]?.seconds;
 if(seconds!==undefined)return {id,wait:seconds};
 return id==='premed'?{id,offGcd:true}:{id};
}
function drawPalette(result){
 const seq=state.sequence,cfg=state.cfg,book=state.book;
 const talentSkills={mutilate:'mutilate',ghost:'ghost',adrenaline:'adrenaline',coldblood:'coldblood',premed:'premedTalent',preparation:'preparationTalent',hemo:'hemoTalent',deathmark:'deathmarkTalent'};
 $('#palette').innerHTML=Object.entries(book).filter(([id])=>!Object.hasOwn(draftActions,id)&&id!=='leave').map(([id,s])=>{
  const talentKey=talentSkills[id];
  const requiresTree=['premed','preparation','hemo','deathmark'].includes(id);
  const unlearned=talentKey&&(!requiresTree||cfg.enforceTalents)&&!cfg[talentKey];
  const cooldown=result.cooldownRemaining?.[id]||0;
  const row=simulate([...seq,draftEntry(id)],cfg,book).rows.at(-1);
  let label='前序步骤中断',fit='blocked',cost='—';
  if(row?.index===seq.length){
   if(row.error){
    label=`当前条件不足 · ${row.notes[0]}`;
    if(row.energyShortage)fit='energy';
   }else{
    cost=fmt(row.cost);
    fit=row.energyWait>0?'energy':'ready';
    label=`预计消耗 ${cost} 能量${fit==='energy'?`，需额外回能 ${fmt(row.energyWait)} 秒`:''}`;
   }
  }
  if(unlearned){label='未学习对应天赋';fit='unlearned';}
  if(cooldown>0)label+=` · 冷却 ${fmt(cooldown)} 秒`;
  const hint=escapeHtml(`${s.name}：${label}`);
  const icon=skillIcons[id];
  return `<button type="button" class="skill${cost==='—'?' skill-na':''}" data-add="${id}" data-fit="${fit}" title="${hint}" aria-label="${hint}" ${unlearned?'disabled':''}><span class="skill-picture">${icon?`<img src="${icon}" alt="" loading="lazy">`:''}${unlearned?'<span class="skill-cooldown">未学</span>':cooldown>0?`<span class="skill-cooldown">${fmt(cooldown)}秒</span>`:''}<span class="skill-cost">${cost}</span></span><span class="skill-name">${escapeHtml(s.name)}</span></button>`;
 }).join('');
}
function updateSkillCostHint(){const id=$('#editSkill').value,current=state.book[id].cost,standard=initial.book[id].cost;$('#editBaseNote').textContent=Number(current)!==Number(standard)?`当前基础消耗 ${fmt(current)}，默认 ${fmt(standard)}；天赋和被动会继续减免。`:'填写未减免的基础消耗；天赋和被动会另行计算。';}
function editDraw(){const sel=$('#editSkill'), current=sel.value;sel.innerHTML=Object.entries(state.book).filter(([id])=>!Object.hasOwn(draftActions,id)&&id!=='leave').map(([id,s])=>`<option value="${id}">${s.name}</option>`).join('');if([...sel.options].some(option=>option.value===current))sel.value=current;const s=state.book[sel.value];['Cost','Gain','Cc','Cd'].forEach(n=>$('#edit'+n).value=s[n.toLowerCase()]);$('#editDr').value=s.dr||'';$('#editDr').disabled=!s.type;updateSkillCostHint();}
function sequenceControls(entry,index){
 const seconds=draftActions[entry.id]?.seconds;
 if(seconds!==undefined)return `<label class="waitfield">时长 <input data-wait="${index}" type="number" min="0" max="120" step="0.1" inputmode="decimal" value="${Number(entry.wait??seconds)}"> 秒</label>`;
 if(entry.id==='leave')return '<span class="offgcd">手动假设已脱离战斗</span>';
 if(entry.id==='stealth')return '<span class="offgcd">脱战后可潜行</span>';
 return `<label class="offgcd"><input type="checkbox" data-off="${index}" ${entry.offGcd?'checked':''}> 不占公共CD</label>`;
}
function drawSequence(){const dest=$('#sequence');if(!state.sequence.length){dest.innerHTML='<div class="empty">从上方选择技能，开始构建你的连招。</div>';return}dest.innerHTML=state.sequence.map((a,i)=>`<div class="seqrow"><span class="seqindex">${String(i+1).padStart(2,'0')}</span><strong>${skillIcons[a.id]?`<img class="sequence-icon" src="${skillIcons[a.id]}" alt="" loading="lazy">`:''}${escapeHtml(state.book[a.id].name)}</strong>${sequenceControls(a,i)}<div class="rowbuttons"><button data-up="${i}" aria-label="上移" ${i===0?'disabled':''}>↑</button><button data-down="${i}" aria-label="下移" ${i===state.sequence.length-1?'disabled':''}>↓</button><button data-del="${i}" aria-label="移除">×</button></div><div class="seq-preview" data-step-preview="${i}"></div></div>`).join('');}
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
function syncDamageEditor(){
 const select=$('#damageSkill'),id=select.value,isBleed=id==='garrote'||id==='rupture',isRupture=id==='rupture',dot=state.damage.bleeds[id];
 $('#weaponEnabled').checked=state.damage.weapon.enabled;$('#damageModel').value=state.damage.skillModel;document.querySelectorAll('[data-weapon]').forEach(el=>el.value=state.damage.weapon[el.dataset.weapon]);$('#damageWindow').value=state.damage.burstWindow;$('#damageCrit').value=state.damage.critMultiplier;$('#damageBleedCrit').value=state.damage.bleedCritRate;$('#damageBleedMode').value=state.damage.bleedCritMode;
 $('#damageWhiteMode').value=state.damage.whiteCritMode;
 $('#damageBleedSource').value=state.damage.bleedCritSource;
 $('#damageBleedRateLabel').hidden=state.damage.bleedCritSource!=='manual';
 for(const select of $$('[data-weapon-type]'))select.value=state.cfg[select.dataset.weaponType+'WeaponType'];
 $('#damageBase').disabled=state.damage.skillModel==='weapon'&&!isBleed;$('#damageDurationLabel').hidden=!isBleed;$('#damageIntervalLabel').hidden=!isBleed;$('#damageDurationPerLabel').hidden=!isRupture;$('#damageTickPerLabel').hidden=!isRupture;
 if(isBleed){
  $('#damageBase').value=isRupture?dot.tickDamageBase:dot.tickDamage;
  $('#damageBaseLabel').textContent=isRupture?'割裂每跳基础伤害':'绞喉每跳普通伤害';
  $('#damageDurationText').textContent=isRupture?'割裂基础持续时间（秒）':'绞喉持续时间（秒）';
  $('#damageDuration').value=isRupture?dot.durationBase:dot.duration;$('#damageInterval').value=dot.interval;
  if(isRupture){$('#damageTickPer').value=dot.tickDamagePerCombo;$('#damageDurationPer').value=dot.durationPerCombo;}
  $('#damageSkillHint').textContent=isRupture?'割裂每跳 = 基础伤害 + 每星增加 × 实际消耗星数；持续时间也按实际星数计算。':'绞喉每跳按输入值计算，首次跳伤在一个间隔后。';
 }else{
  $('#damageBase').value=state.damage.values[id];$('#damageBaseLabel').textContent=id==='eviscerate'?'刺骨每消耗 1 星的伤害':'普通命中伤害';
  $('#damageSkillHint').textContent=(state.damage.skillModel==='weapon'?'技能采用装备公式，此处数值仅在切换手动基准后生效。':'')+(id==='eviscerate'?'例如填写 100，消耗 5 星时按 500 点基础直接伤害计算。':'输入该技能一次普通命中的直接伤害；毁伤输入两手合计。');
 }
}
function setupDamageEditor(){
 $('#damageSkill').innerHTML=[...Object.keys(damageInitial.values),'garrote','rupture'].map(id=>`<option value="${id}">${state.book[id].name}</option>`).join('');syncDamageEditor();
 $('#damageSkill').onchange=syncDamageEditor;
 for(const [id,key] of [['damageWhiteMode','whiteCritMode'],['damageBleedSource','bleedCritSource']]){
  $('#'+id).onchange=e=>{state.damage[key]=e.target.value;syncDamageEditor();drawResult();save();};
 }
 for(const select of $$('[data-weapon-type]'))select.onchange=e=>{
  state.cfg[select.dataset.weaponType+'WeaponType']=e.target.value;drawResult();save();
 };
 $('#weaponEnabled').onchange=e=>{state.damage.weapon.enabled=e.target.checked;drawResult();save();};
 $('#damageModel').onchange=e=>{state.damage.skillModel=e.target.value;syncDamageEditor();drawResult();save();};
 document.querySelectorAll('[data-weapon]').forEach(el=>el.addEventListener('input',e=>{if(e.target.value==='')return;const value=Number(e.target.value),min=Number(e.target.min),max=Number(e.target.max);if(Number.isFinite(value)&&value>=min&&value<=max){state.damage.weapon[e.target.dataset.weapon]=value;drawResult();save();}}));
 $('#weaponPreset').onclick=()=>{state.damage.weapon={...referenceWeapon};state.cfg.mainWeaponType=state.cfg.offWeaponType='dagger';syncDamageEditor();drawResult();save();};
 $('#damageBleedMode').onchange=e=>{state.damage.bleedCritMode=e.target.value;drawResult();save();};
 for(const [selector,key,min,max] of [['#damageWindow','burstWindow',0.1,120],['#damageCrit','critMultiplier',1,5],['#damageBleedCrit','bleedCritRate',0,100]])$(selector).addEventListener('input',e=>{if(e.target.value==='')return;const n=Number(e.target.value);if(Number.isFinite(n)&&n>=min&&n<=max){state.damage[key]=n;drawResult();save();}});
 $('#damageBase').addEventListener('input',e=>{if(e.target.value==='')return;const n=Number(e.target.value),id=$('#damageSkill').value;if(Number.isFinite(n)&&n>=0&&n<=1000000){if(id==='garrote')state.damage.bleeds.garrote.tickDamage=n;else if(id==='rupture')state.damage.bleeds.rupture.tickDamageBase=n;else state.damage.values[id]=n;drawResult();save();}});
 for(const [selector,property] of [['#damageDuration','duration'],['#damageInterval','interval'],['#damageDurationPer','durationPerCombo'],['#damageTickPer','tickDamagePerCombo']])$(selector).addEventListener('input',e=>{if(e.target.value==='')return;const id=$('#damageSkill').value,n=Number(e.target.value),key=property==='duration'&&id==='rupture'?'durationBase':property,min=property==='interval'||(property==='duration'&&id==='garrote')?0.1:0,max=property==='tickDamagePerCombo'?1000000:120;if(state.damage.bleeds[id]&&Number.isFinite(n)&&n>=min&&n<=max){state.damage.bleeds[id][key]=n;drawResult();save();}});
 $('#damageReset').onclick=()=>{state.damage={...damageDefaults(),skillModel:'weapon',whiteCritMode:'random',bleedCritMode:'random',bleedCritSource:'base',weapon:{...referenceWeapon}};state.cfg.mainWeaponType=state.cfg.offWeaponType='dagger';syncDamageEditor();drawResult();save();};
}
function damageLabel(row){return !row?'—':fmt(row.damage);}
function stageFlags(row,limit=Infinity){
 const notes=row.notes.flatMap(note=>note.split('；'));
 const flags=notes.filter(note=>row.error||/暴击 [\d.]+%：是(?!.*未触发)/.test(note)||/能量不足|可反制空档|控制空档|控制免疫|可能提前打破|连击点溢出/.test(note)||(!/未触发/.test(note)&&/暴击 [\d.]+%：是|(?:：|封印命运)触发|强化破甲：5 星返还/.test(note)));
 const priority=note=>/连击点溢出/.test(note)?2:Number(/能量不足|空档|免疫|打破/.test(note));
 flags.sort((a,b)=>priority(b)-priority(a));
 return flags.slice(0,limit).map(note=>{const cls=row.error||/能量不足|空档|免疫|打破/.test(note)?'note-warning':/溢出/.test(note)?'note-overflow':'note-success';const short=note.replace(/ [\d.]+%：触发/gu,' 触发').replace(/暴击 [\d.]+%：是/gu,'暴击');return `<span class="stage-flag ${cls}">${escapeHtml(short)}</span>`}).join('');
}
function stageMetrics(row,dmg){
 const control=row.controlEnd>row.time?fmt(row.controlEnd-row.time)+'秒':'无';
 return `<div class="stage-primary"><div class="stage-damage"><span>本步伤害</span><b>${damageLabel(dmg)}</b></div><div class="stage-cumulative"><span>累计至此</span><b>${dmg?fmt(dmg.cumulative):'—'}</b></div></div><div class="stage-stats"><span>能量 <b class="stage-energy">${fmt(row.before)} → ${fmt(row.after)}</b></span><span>连击点 <b class="stage-stars" aria-label="${row.cp} 星">${'●'.repeat(row.cp)}<i>${'○'.repeat(5-row.cp)}</i></b></span><span>控制剩余 <b>${control}</b></span></div>`;
}
function stageDetails(row,dmg){
 return `<details class="stage-details"><summary>展开详细分析</summary><div>${dmg?`本步伤害 = 技能 ${fmt(dmg.directDamage)} + 平砍 ${fmt(dmg.whiteDamage)} + 流血 ${fmt(dmg.bleedDamage)}；累计不含未来尾伤。<br>`:'未执行<br>'}${renderNotes(row.notes,row.error)}</div></details>`;
}
function drawDraftEnergy(result){
 const {energy,gcdRemaining,energyAtGcd,timeToFull,inCombat,stealth,autoAttacking,combatRemaining,stealthCooldownRemaining}=result;
 const max=state.cfg.max,bar=$('#draftEnergyBar');
 bar.max=max;
 bar.value=energy;
 const number=`${fmt(energy)} / ${fmt(max)}`;
 bar.setAttribute('aria-valuetext',`${number} 点能量`);
 $('#draftEnergyText').textContent=number;
 $('#draftGcd').textContent=gcdRemaining>0?`公共 CD ${fmt(gcdRemaining)} 秒 · 届时 ${fmt(energyAtGcd)} 能量`:'公共 CD 就绪';
 $('#draftEnergyFull').textContent=timeToFull===0?'能量已满':Number.isFinite(timeToFull)?`${fmt(timeToFull)} 秒回满`:'自然回能关闭';
 const attack=autoAttacking?(state.damage.weapon.enabled?'平砍中':'平砍伤害关闭'):'已停手';
 const combat=inCombat?`战斗中 · ${attack} · 避战需 ${fmt(combatRemaining)} 秒`:'已脱战';
 const stealthStatus=stealth?' · 已潜行':stealthCooldownRemaining>0?` · 潜行冷却 ${fmt(stealthCooldownRemaining)} 秒`:inCombat?'':' · 可潜行';
 const poised=state.cfg.prepared&&!inCombat&&timeToFull===0?' · 蓄势待发':'';
 $('#draftCombat').textContent=`${combat}${stealthStatus}${poised}`;
 const stealthButton=$('[data-add="stealth"]');
 stealthButton.title=inCombat?'潜行需要先脱战':stealthCooldownRemaining>0?`潜行冷却剩余 ${fmt(stealthCooldownRemaining)} 秒`:'可进入潜行';
 stealthButton.querySelector('.draft-stealth-cd').textContent=stealthCooldownRemaining>0?`${fmt(stealthCooldownRemaining)}秒`:'';
 const last=state.sequence.at(-1),seconds=draftActions[last?.id]?.seconds;
 $('#draftTiming').hidden=seconds===undefined;
 const swingInfo=$('#draftSwingInfo');
 swingInfo.hidden=last?.id!=='wait';
 if(!swingInfo.hidden){
  const weapon=state.damage.weapon;
  swingInfo.textContent=!weapon.enabled?'平砍伤害计算已关闭':autoAttacking?`等待期间继续平砍 · 主手 ${fmt(weapon.mainSpeed)} 秒 / 副手 ${fmt(weapon.offSpeed)} 秒`:'当前已停手，等待期间不会平砍';
 }
 if(seconds!==undefined){
  $('#draftTimingLabel').textContent=`调整末步${state.book[last.id].name}时长`;
  const input=$('#draftDuration');
  const value=last.wait??seconds;
  if(input.valueAsNumber!==Number(value))input.value=value;
 }
}
function autoWaitCard(row){
 const wait=row?.autoEnergyWait;
 if(!wait||wait.seconds<=0)return '';
 const action=wait.autoAttacking?(state.damage.weapon.enabled?'平砍回能':'平砍中（伤害计算关闭）'):'停手回能';
 const gap=wait.controlGap>0?`控制空档 ${fmt(wait.controlGap)} 秒`:'等待期间无新增控制空档';
 const reason=wait.gapReasons?.length?` · ${[...new Set(wait.gapReasons.map(item=>item.cause))].map(escapeHtml).join('、')}`:'';
 return `<div class="auto-wait-card" role="note"><div class="auto-wait-title"><strong>自动额外等待 · ${action}</strong><b>${fmt(wait.seconds)} 秒</b></div><div>能量 ${fmt(wait.startEnergy)} → ${fmt(wait.endEnergy)} <span>回能 +${fmt(wait.energyGained)}</span></div><div class="${wait.controlGap>0?'auto-wait-gap':''}">${gap}${reason}</div></div>`;
}
function comboPointBadge(row){
 if(!row||row.error||!(row.cp>=4))return '';
 return row.cp>=5
  ? '<span class="combo-point-badge combo-point-full">5 星已满 · 注意溢出</span>'
  : '<span class="combo-point-badge combo-point-near">4 星 · 可考虑终结技</span>';
}
function drawNearbyResult(v,damage){
 const last=v.rows.at(-1), panel=$('#livePreview'),byDamage=new Map(damage.rows.map(row=>[row.index,row]));
 drawDraftEnergy(v);
 if(!last){panel.innerHTML='<div class="live-title"><strong>即时推演</strong><div class="preview-links"><a class="preview-replay-link" href="#combatPlayer">木桩 ↓</a><a href="#section-results">完整结果 →</a></div></div><div class="live-empty">添加技能后显示本步伤害和控制。</div>';}
 else{
  const blocked=v.stopped?' · 已中断'+(state.sequence.length>last.index+1?'，后续未执行':''):'';
  panel.innerHTML=`<div class="live-title"><strong>第 ${last.index+1} 步 · ${escapeHtml(last.name)} <small>${fmt(last.time)}秒${blocked}</small></strong><div class="preview-links"><a class="preview-replay-link" href="#combatPlayer">木桩 ↓</a><a href="#section-results">完整结果 →</a></div></div>${comboPointBadge(last)}${autoWaitCard(last)}${stageMetrics(last,byDamage.get(last.index))}<div class="stage-flags">${stageFlags(last,2)}</div>`;
 }
 const byIndex=new Map(v.rows.map(row=>[row.index,row]));
 $$('#sequence .auto-wait-card').forEach(el=>el.remove());
 $$('#sequence [data-step-preview]').forEach(el=>{
  const row=byIndex.get(Number(el.dataset.stepPreview)),dmg=row&&byDamage.get(row.index);
  const title=el.closest('.seqrow').querySelector('strong');
  title.querySelector('.combo-point-badge')?.remove();
  title.insertAdjacentHTML('beforeend',comboPointBadge(row));
  if(row?.autoEnergyWait)el.closest('.seqrow').insertAdjacentHTML('beforebegin',autoWaitCard(row));
  el.innerHTML=row?`${stageMetrics(row,dmg)}<div class="stage-flags">${stageFlags(row)}</div>${stageDetails(row,dmg)}`:'<span class="note-warning">前面的步骤已中断，尚未执行</span>';
 });
}
function drawGearOverview(){
 const {weapon,ap,critRate,mainCrit,offCrit,mainNormal,offNormal,mainExpected,offExpected}=weaponMetrics(state.damage,state.cfg);
 const matches=(...keys)=>keys.every(key=>Number(weapon[key])===referenceWeapon[key]);
 const isMain=state.cfg.mainWeaponType==='dagger'&&matches('mainMin','mainMax','mainSpeed');
 const isOff=state.cfg.offWeaponType==='dagger'&&matches('offMin','offMax','offSpeed');
 $('#gearProfile').textContent=isMain&&isOff&&matches('attackPower','offhandPenalty','strikeCoefficient')?'示例配装 · 迅影八件 / 双匕首':'自定义配装';
 $('#mainWeaponName').textContent=isMain?'觅心者':'自定义';
 $('#offWeaponName').textContent=isOff?'扰乱之匕':'自定义';
 for(const [hand,normal,expected] of [['main',mainNormal,mainExpected],['off',offNormal,offExpected]]){
  $('#'+hand+'WeaponHit').innerHTML=`普通命中 <b>${fmt(normal)}</b> · 含暴击每击期望 <b>${fmt(expected)}</b>${weapon.enabled?'':' · 平砍关闭'}`;
 }
 const skillModel=state.damage.skillModel==='weapon'?'装备公式':'手动伤害';
 $('#activeGear').textContent=`${fmt(ap)} 攻强 · 主手 ${fmt(weapon.mainSpeed)}s / 副手 ${fmt(weapon.offSpeed)}s · ${weapon.enabled?'平砍开启':'平砍关闭'} · ${skillModel}`;
 const skillRates=[['背刺','backstab'],['伏击','ambush'],['刺击','strike']].map(([name,id])=>[name,meleeCritChance(state.cfg,id)]);
 skillRates.push(['毁伤主手',meleeCritChance(state.cfg,'mutilate','main')],['毁伤副手',meleeCritChance(state.cfg,'mutilate','off')]);
 $('#gearSkillCrit').innerHTML=skillRates.map(([name,rate])=>`<span>${name} <b>${fmt(rate)}%</b></span>`).join('');
 $('#gearCritGuide').textContent=`通用暴击 ${fmt(critRate)}% · 主手白字 ${fmt(mainCrit)}% · 副手白字 ${fmt(offCrit)}%。基础值不含恶意、劈斩和技能专属天赋。`;
}
function drawResult(){drawGearOverview();const v=simulate(state.sequence,state.cfg,state.book);drawPalette(v);const oldAnalysis=$('#probabilityResult');if(oldAnalysis&&oldAnalysis.dataset.ready){oldAnalysis.innerHTML='配置或队列已变化，请重新计算概率。';delete oldAnalysis.dataset.ready;}drawCompare();const damage=calculateDamage(state.sequence,v,state.cfg,state.damage),damageRows=new Map(damage.rows.map(row=>[row.index,row])),$s=$('#status');$s.textContent=v.stopped?'存在阻断':'计算完成';$s.className='status '+(v.stopped?'bad':'good');$('#summary').innerHTML=`<div><span>最终能量</span><b>${fmt(v.energy)} <small>/ ${fmt(state.cfg.max)}</small></b></div><div><span>最终连击点</span><b>${v.cp} <small>/ 5</small></b></div><div><span>本段历时</span><b>${fmt(v.time)} <small>秒</small></b></div><div class="${v.gap>0?'danger':''}"><span>累计控制空档</span><b>${fmt(v.gap)} <small>秒</small></b></div>`;$('#damageSummary').innerHTML=`<div class="summary-hero"><span>${v.stopped?'已施加的估算伤害（中断）':'估算总伤害（含尾伤）'}</span><b>${fmt(damage.total)}</b></div><div><span>动作期间伤害</span><b>${fmt(damage.during)}</b></div><div><span>控制收尾平砍</span><b>${fmt(damage.whiteTailDamage)}</b></div><div><span>结束后流血尾伤</span><b>${fmt(damage.tailDamage)}</b></div><div><span>平均伤害 / 秒</span><b>${damage.dps===null?'—':fmt(damage.dps)}</b></div><div><span>${fmt(state.damage.burstWindow)} 秒最高爆发</span><b>${fmt(damage.peak.damage)}</b><small> · ${fmt(damage.peak.start)}–${fmt(damage.peak.end)} 秒</small></div>`;
$('#damageMethod').textContent='平砍按武器速度和面板攻击强度估算，暴击按装备设置结算；敌对技能开启自动攻击，停砍、避战、消失、脱战、凿击和致盲会停手，之后敌对技能重新开始计时。末步控制期间的平砍单列，不随流血尾伤延长。刺击按副手武器和可调整倍率估算，是否额外受副手惩罚有待验证。技能按选定模式计算；忽略护甲、命中、躲闪、武器触发和毒药；流血跳伤仍可能提前打破控制但尚未模拟。计入刺击、伏击、鬼魅攻击、出血、毁伤、背刺、邪恶攻击、凿击、刺骨的直接伤害，及绞喉、割裂的逐跳流血。'+(state.damage.bleedCritMode==='random'?'流血每跳独立掷骰，同种子结果可复现，可重新掷骰。':'流血按暴击概率计算期望。')+'直接攻击有掷骰则沿用，否则按期望估算。相同流血重施覆盖旧效果；爆发窗口含起点、不含终点。平均值以推演结束和最后伤害时刻中较晚者为分母。未计毒药、武器触发及未自动套用的伤害天赋。';
const ticks=damage.events.filter(event=>event.type==='bleed');$('#bleedTimeline').innerHTML=ticks.length?`<p class="small">${state.damage.bleedCritMode==='random'?'逐跳独立判定暴击':'每跳显示含暴击概率的期望伤害'}；总计 ${ticks.length} 跳，列出前 ${Math.min(ticks.length,1000)} 跳。</p><div class="bleed-timeline">${ticks.slice(0,1000).map(event=>`<span>${fmt(event.time)} 秒 · ${state.book[event.id].name} <b${event.crit===true?' class="note-success"':''}>${fmt(event.damage)}${event.crit===true?' 暴击':event.crit===false?' 普通':' 期望'}</b></span>`).join('')}</div>`:'<p class="small">当前推演没有流血跳伤。</p>';
$('#warnings').textContent=state.cfg.dr?'PvP 递减采用假设：同组第 2 / 3 次分别按设定比例，第 4 次免疫；重置从控制结束计时。':'PvP 递减当前关闭，控制时长可能高估。';$('#rows').innerHTML=v.rows.length?v.rows.map(x=>{const dmg=damageRows.get(x.index);return `${autoWaitCard(x)}<article class="stage-card${x.error?' error':''}"><div class="stage-head"><strong><span> ${String(x.index+1).padStart(2,'0')} </span>${escapeHtml(x.name)}</strong><time>${fmt(x.time)} 秒</time></div>${comboPointBadge(x)}${stageMetrics(x,dmg)}<div class="stage-flags">${stageFlags(x)}</div>${stageDetails(x,dmg)}</article>`}).join(''):'<div class="empty">添加技能后自动计算</div>';drawNearbyResult(v,damage);drawComboComparison();replayPlayer.update(state.sequence,v,damage,state.cfg);}
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
 const x=simulate(a.sequence,state.cfg,state.book),y=simulate(b.sequence,state.cfg,state.book),xd=calculateDamage(a.sequence,x,state.cfg,state.damage),yd=calculateDamage(b.sequence,y,state.cfg,state.damage);
 const diff=(n,m)=>n===null||m===null?'—':Math.abs(n-m)<0.005?'相同':`${n>m?'A 多':'B 多'} ${fmt(Math.abs(n-m))}`;
 const metrics=[['估算总伤害（含尾伤）',xd.total,yd.total,'点'],['动作期间伤害',xd.during,yd.during,'点'],['平砍总伤害',xd.whiteTotal,yd.whiteTotal,'点'],['控制收尾平砍',xd.whiteTailDamage,yd.whiteTailDamage,'点'],['结束后流血尾伤',xd.tailDamage,yd.tailDamage,'点'],[`${fmt(state.damage.burstWindow)} 秒最高爆发`,xd.peak.damage,yd.peak.damage,'点'],['平均伤害 / 秒',xd.dps,yd.dps,'点/秒'],['控制总时长',x.controlled,y.controlled,'秒'],['累计控制空档',x.gap,y.gap,'秒'],['能量不足等待',x.energyWait,y.energyWait,'秒'],['执行历时',x.time,y.time,'秒'],['结束时能量',x.energy,y.energy,'点']];
 const status=v=>v.stopped?`第 ${v.rows.at(-1).index+1} 步 ${escapeHtml(v.rows.at(-1).name)} 中断`:'执行完成';
 const insights=[];if(!x.stopped&&!y.stopped){for(const [label,v,w,preferMore] of [['控制时间更长',x.controlled,y.controlled,true],['控制空档更少',x.gap,y.gap,false],['回能等待更少',x.energyWait,y.energyWait,false]])if(Math.abs(v-w)>=0.005)insights.push(`${(v>w)===preferMore?'A':'B'} 的${label} ${fmt(Math.abs(v-w))} 秒`);}
 target.innerHTML=`<div class="comparison-scroll"><table><thead><tr><th>指标</th><th>A · ${escapeHtml(a.name)}</th><th>B · ${escapeHtml(b.name)}</th><th>差异</th></tr></thead><tbody><tr><th>执行结果</th><td>${status(x)}</td><td>${status(y)}</td><td>—</td></tr>${metrics.map(([label,v,w,unit])=>`<tr><th>${label}</th><td>${v===null?'—':fmt(v)+' '+unit}</td><td>${w===null?'—':fmt(w)+' '+unit}</td><td>${diff(v,w)}${v===null||w===null||Math.abs(v-w)<0.005?'':` ${unit}`}</td></tr>`).join('')}</tbody></table></div><p class="comparison-insights">${insights.length?insights.join('；'):x.stopped||y.stopped?'存在中断，请先查看各自中断原因。':'两套连招在控制时间、空档和回能等待方面相同。'}</p><p class="small">中断结果仅统计执行到中断时的情况，不能直接与完整连招比较；控制总时长不重复计算覆盖部分。最高爆发按相同长度的窗口各自寻找峰值；爆发窗口含起点、不含终点；总伤害包括连招结束后已施加的流血尾伤，平均伤害以推演结束或最后跳伤中较晚的时刻计算。${state.damage.bleedCritMode==='random'?'流血逐跳独立掷骰。':'流血暴击按概率期望估算。'}</p>`;
}
function refresh(){drawSequence();drawResult();save();}
function setupWorkspaceNavigation(){
 const views=[...$$('[data-view]')];
 const links=[...$$('[data-view-link]')];
 function route(scroll){
  const hash=location.hash.slice(1);
  const anchor=document.getElementById(hash);
  const key=hash.startsWith('talents/')?'talents':views.find(view=>view.dataset.view===hash)?.dataset.view
    || anchor?.closest('[data-view]')?.dataset.view || 'builder';
  for(const view of views)view.hidden=view.dataset.view!==key;
  for(const link of links){
   if(link.dataset.viewLink===key)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  }
  if(key!=='builder'&&replayPlayer.status==='playing')$('#combatPlay').click();
  if(anchor instanceof HTMLDetailsElement)anchor.open=true;
  if(anchor)anchor.scrollIntoView({block:'start'});
  else if(scroll)window.scrollTo(0,0);
 }
 window.addEventListener('hashchange',()=>route(true));
 $('.workspace-nav').addEventListener('click',event=>{
  const link=event.target.closest('[data-view-link]');
  if(link&&link.hash===location.hash)route(true);
 });
 route(false);
 const tabs=document.createElement('div');tabs.className='mobile-talent-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','天赋分支');tabs.innerHTML=talentTrees.map((tree,i)=>`<button type="button" role="tab" data-mobile-branch="${i}">${tree.name}</button>`).join('');$('#talentTree').before(tabs);tabs.onclick=e=>{const b=e.target.closest('[data-mobile-branch]');if(!b)return;mobileTalentBranch=Number(b.dataset.mobileBranch);updateTalentTabs();};
}
function updateTalentTabs(){const branches=[...document.querySelectorAll('#talentTree .talent-branch')];branches.forEach((branch,i)=>branch.classList.toggle('mobile-active',i===mobileTalentBranch));document.querySelectorAll('[data-mobile-branch]').forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===mobileTalentBranch));});}
$('#draftActions').innerHTML=Object.entries(draftActions).map(([id,{label,seconds,tip}])=>`<button type="button" class="quiet" data-add="${id}" title="${tip}">${id==='stealth'&&skillIcons.stealth?`<img class="draft-stealth-icon" src="${skillIcons.stealth}" alt="">`:''}${label??skills[id].name}${id==='stealth'?'<small class="draft-stealth-cd"></small>':seconds===undefined?'':`<small>${seconds}秒</small>`}</button>`).join('');
setupDamageEditor();setupReplay();setupWorkspaceNavigation();syncConfig();editDraw();drawTalents();drawLibrary();refresh();
numIds.forEach(id=>$('#'+id).addEventListener('input',e=>{if(e.target.value==='')return;let n=Number(e.target.value);if(!Number.isFinite(n)||n<Number(e.target.min)||n>Number(e.target.max))return;state.cfg[id]=n;if(id==='reduction')$('#dirtyDeeds').value=[0,10,20].includes(n)?String(n):'custom';drawResult();save()}));boolIds.forEach(id=>$('#'+id).addEventListener('change',e=>{state.cfg[id]=e.target.checked;drawResult();save()}));
['composure','exposeRank','ruthlessRank','ruthlessMode','relentlessRank','relentlessMode','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank'].forEach(id=>$('#'+id).addEventListener('change',e=>{state.cfg[id]=id.endsWith('Mode')?e.target.value:Number(e.target.value);drawResult();save()}));
$('#reroll').onclick=$('#rerollReplay').onclick=$('#rerollBuilder').onclick=()=>{state.cfg.seed=(Math.random()*4294967295>>>0)||1;drawResult();save()};
$('#editSkill').addEventListener('change',editDraw);['Cost','Gain','Cc','Cd'].forEach(n=>$('#edit'+n).addEventListener('input',e=>{if(e.target.value==='')return;let v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=Number(e.target.max)){state.book[$('#editSkill').value][n.toLowerCase()]=v;if(n==='Cost')updateSkillCostHint();refresh()}}));$('#editDr').addEventListener('change',e=>{state.book[$('#editSkill').value].dr=e.target.value;refresh()});
$('#restoreSkills').onclick=()=>{state.book=structuredClone(initial.book);editDraw();refresh()};
$('.skill-panel').addEventListener('click',event=>{
 const button=event.target.closest('[data-add]');
 if(!button)return;
 state.sequence.push(draftEntry(button.dataset.add));
 refresh();
});
$('#sequence').onclick=e=>{const b=e.target.closest('button');if(!b)return;let i=Number(b.dataset.up??b.dataset.down??b.dataset.del);if(b.dataset.del!==undefined)state.sequence.splice(i,1);else {let j=b.dataset.up!==undefined?i-1:i+1;if(j>=0&&j<state.sequence.length)[state.sequence[i],state.sequence[j]]=[state.sequence[j],state.sequence[i]]}refresh()};
function updateDuration(input,index){
 const entry=state.sequence[index];
 if(draftActions[entry?.id]?.seconds===undefined)return;
 const seconds=input.valueAsNumber;
 if(!Number.isFinite(seconds)||seconds<0||seconds>120)return;
 entry.wait=seconds;
 const queueInput=$(`[data-wait="${index}"]`);
 if(queueInput&&queueInput!==input)queueInput.value=seconds;
 drawResult();save();
}
$('#draftDuration').oninput=event=>updateDuration(event.target,state.sequence.length-1);
$('#sequence').oninput=event=>{
 if(event.target.dataset.wait!==undefined)updateDuration(event.target,Number(event.target.dataset.wait));
};
$('#sequence').onchange=e=>{if(e.target.dataset.off!==undefined){state.sequence[+e.target.dataset.off].offGcd=e.target.checked;drawResult();save()}};
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
const talentTree=$('#talentTree');
const talentDetail=$('#talentDetail');

function keepTalentLevelValid(level=state.talentLab.level){
 const lab=state.talentLab;
 const minimum=requiredTalentLevel(totalTalentPoints(state.talents),lab.gift);
 lab.level=Math.min(60,Math.max(minimum,Math.round(level)||60));
 return minimum;
}
function activeTalentBuilds(){
 const lab=state.talentLab;
 return lab.slot==='A'?[state.talents,lab.other]:[lab.other,state.talents];
}
function setupTalentLab(){
 const saved=state.talentLab||{};
 const other=validateTalents(saved.other)?null:saved.other;
 state.talentLab={level:Number(saved.level)||60,gift:Math.max(0,Math.min(5,Math.round(Number(saved.gift)||0))),
  slot:other&&saved.slot==='B'?'B':'A',other,filter:['a','b','both'].includes(saved.filter)?saved.filter:'both'};
 const status=$('#talentStatus');
 status.insertAdjacentHTML('beforebegin',`<section class="talent-lab" aria-label="天赋方案">
  <div class="talent-level-controls">
   <label>角色等级<input type="number" id="talentLevel" min="1" max="60" step="1" inputmode="numeric" value="60"></label>
   <label>才华横溢<select id="talentGift" aria-describedby="talentGiftHint">${Array.from({length:6},(_,i)=>`<option value="${i}">${i} 级</option>`).join('')}</select></label>
   <strong id="talentBudget"></strong>
  </div>
  <p id="talentGiftHint" class="small">才华横溢每级让首个天赋点提前 1 级获得。角色等级调整可用天赋点，伤害仍按当前装备与技能设定。</p>
  <div class="talent-compare-actions">
   <button class="quiet" id="talentCompareStart" type="button">对比两套天赋</button>
   <button class="quiet" id="talentCompareCopy" type="button" hidden>复制对比链接</button>
   <button class="quiet" id="talentCompareStop" type="button" hidden>结束对比</button>
  </div>
  <div id="talentCompare" hidden>
   <div class="talent-compare-slots" aria-label="选用天赋方案">
    <button type="button" data-talent-slot="A">方案 A</button><button type="button" data-talent-slot="B">方案 B</button>
   </div>
   <div class="talent-compare-filters" aria-label="天赋差异分类">
    <button class="quiet" type="button" data-talent-filter="a">只在 A</button><button class="quiet" type="button" data-talent-filter="b">只在 B</button><button class="quiet" type="button" data-talent-filter="both">点数不同</button>
   </div>
   <ul class="talent-diff-list"></ul>
  </div>
 </section>`);
 const level=$('#talentLevel');
 const setLevel=value=>{
  if(!Number.isFinite(value))return;
  const minimum=keepTalentLevelValid(Math.max(1,Math.min(60,value)));
  drawTalents();save();
  if(value<minimum)status.textContent+=` · 当前加点至少需要 ${minimum} 级，减点后可调低等级`;
 };
 level.addEventListener('change',()=>setLevel(Number.isFinite(level.valueAsNumber)?level.valueAsNumber:state.talentLab.level));
 level.addEventListener('keydown',event=>{
  const current=state.talentLab.level;
  if(event.key==='PageUp'||event.key==='PageDown'){
   event.preventDefault();
   setLevel(event.key==='PageUp'?Math.floor(current/10)*10+10:Math.ceil(current/10)*10-10);
  }
 });
 $('#talentGift').addEventListener('change',event=>{
  state.talentLab.gift=Number(event.target.value);
  drawTalents();save();
 });
 $('#talentCompareStart').addEventListener('click',()=>{
  const lab=state.talentLab;
  lab.other=state.talents.map(branch=>branch.slice());
  lab.slot='B';
  drawTalents();save();
  $('[data-talent-slot="B"]').focus({preventScroll:true});
 });
 $('#talentCompareStop').addEventListener('click',()=>{
  const lab=state.talentLab;
  const retained=lab.slot;
  lab.other=null;lab.slot='A';
  drawTalents();save();
  status.textContent+=` · 已保留方案 ${retained}`;
  $('#talentCompareStart').focus({preventScroll:true});
 });
 $('#talentCompareCopy').addEventListener('click',()=>{
  const encoded=activeTalentBuilds().map(serializeTalentBuild).join('~');
  copyTalentLink('https://jamstrak.github.io/rogue-combo-simulator/#talents/'+encoded);
 });
 $('#talentCompare').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const lab=state.talentLab;
  const {talentSlot,talentFilter,talentDiff}=button.dataset;
  if(talentSlot&&lab.slot!==talentSlot){
   closeTalentDetail();
   [state.talents,lab.other]=[lab.other,state.talents];
   lab.slot=talentSlot;talentApply();
  }else if(talentFilter){
   lab.filter=talentFilter;renderTalentLab();save();
  }else if(talentDiff){
   const [branch,index]=talentDiff.split(',').map(Number);
   mobileTalentBranch=branch;updateTalentTabs();
   const node=talentAnchor(branch,index);
   node.scrollIntoView({block:'center'});node.focus({preventScroll:true});
   showTalentDetail(branch,index,coarseTalentPointer.matches?'sheet':'hover');
  }
 });
}
function renderTalentLab(){
 const lab=state.talentLab,total=totalTalentPoints(state.talents),minimum=keepTalentLevelValid();
 const budget=talentPointBudget(lab.level,lab.gift);
 $('#talentLevel').value=lab.level;
 $('#talentGift').value=lab.gift;
 $('#talentBudget').textContent=`${total} / ${budget} 点 · 剩余 ${budget-total} 点 · 需要等级 ${total?minimum:'—'}`;
 const comparing=!!lab.other;
 $('#talentCompare').hidden=!comparing;
 $('#talentCompareStart').hidden=comparing;
 $('#talentCompareCopy').hidden=!comparing;
 $('#talentCompareStop').hidden=!comparing;
 if(!comparing)return budget;
 const [a,b]=activeTalentBuilds();
 const branches={A:a,B:b};
 for(const [slot,build] of Object.entries(branches)){
  const button=$(`[data-talent-slot="${slot}"]`),selected=lab.slot===slot;
  const counts=build.map(ranks=>ranks.reduce((sum,rank)=>sum+rank,0));
  button.setAttribute('aria-pressed',String(selected));
  button.innerHTML=`<strong>方案 ${slot}</strong><span>${counts.join(' / ')}</span><small>${selected?'编辑中 · 用于推演':'点击切换编辑及推演'}</small>`;
 }
 const changes={a:[],b:[],both:[]};
 talentTrees.forEach((tree,branch)=>tree.talents.forEach((talent,index)=>{
  const rankA=a[branch][index],rankB=b[branch][index];
  if(rankA!==rankB)changes[!rankB?'a':!rankA?'b':'both'].push({branch,index,name:talent.name,rankA,rankB});
 }));
 for(const [key,label] of Object.entries({a:'只在 A',b:'只在 B',both:'点数不同'})){
  const button=$(`[data-talent-filter="${key}"]`);
  button.setAttribute('aria-pressed',String(lab.filter===key));
  button.textContent=`${label} ${changes[key].length}`;
 }
 $('.talent-diff-list').innerHTML=changes[lab.filter].map(item=>`<li><button class="quiet" type="button" data-talent-diff="${item.branch},${item.index}"><span>${item.name}</span><small>${talentTrees[item.branch].name}</small><b>A ${item.rankA} · B ${item.rankB}</b></button></li>`).join('')||'<li class="small">此分类没有差异</li>';
 return budget;
}
function drawTalentBranch(tree, branchIndex){
 const nodes=tree.talents.map((talent,index)=>{
  const icon=talentVisuals[talent.name].icon;
  return `<div class="talent-node" style="grid-row:${talent.row};grid-column:${talent.col}">
   <button type="button" class="talent-name" data-talent-detail="${branchIndex},${index}">
    <img class="talent-icon" src="assets/talents/${icon}" alt="" loading="lazy">
    <span class="talent-rank" aria-hidden="true">0/${talent.max}</span>
    <span class="talent-diff-rank" aria-hidden="true" hidden></span>
   </button>
  </div>`;
 });
 const links=tree.talents.flatMap((talent,index)=>{
  if(talent.req===null)return [];
  const from=tree.talents[talent.req];
  return `<span class="talent-link" data-talent-link="${index}" style="--talent-col:${from.col};--talent-row:${from.row};--talent-depth:${talent.row-from.row}"></span>`;
 });
 return `<section class="talent-branch" data-talent-branch="${branchIndex}">
  <h4>${tree.name}<span data-talent-points>0 点</span></h4>
  <div class="talent-grid"><div class="talent-links" aria-hidden="true">${links.join('')}</div>${nodes.join('')}</div>
  <button type="button" class="quiet talent-reset-branch" data-talent-reset="${branchIndex}">重置${tree.name}</button>
 </section>`;
}
function drawTalents(){
 const treeElement=$('#talentTree');
 if(!treeElement.children.length){
  treeElement.innerHTML=talentTrees.map(drawTalentBranch).join('');
  setupTalentLab();
  const detail=$('#talentDetail');
  detail.hidden=true;
  detail.removeAttribute('role');
 }
 const totals=state.talents.map(ranks=>ranks.reduce((sum,rank)=>sum+rank,0));
 const total=totals.reduce((sum,rank)=>sum+rank,0),budget=renderTalentLab();
 const lab=state.talentLab;
 talentTrees.forEach((tree,branchIndex)=>{
  const branch=treeElement.children[branchIndex],ranks=state.talents[branchIndex];
  branch.querySelector('[data-talent-points]').textContent=`${totals[branchIndex]} 点`;
  branch.querySelector('[data-talent-reset]').disabled=totals[branchIndex]===0;
  tree.talents.forEach((talent,index)=>{
   const rank=ranks[index],button=branch.querySelector(`[data-talent-detail="${branchIndex},${index}"]`);
   const prior=ranks.reduce((sum,n,i)=>sum+(tree.talents[i].row<talent.row?n:0),0);
   const prereq=talent.req===null||ranks[talent.req]===tree.talents[talent.req].max;
   const locked=prior<(talent.row-1)*5||!prereq;
   button.parentElement.dataset.rank=rank===talent.max?'max':rank?'partial':locked?'locked':total>=budget?'capped':'available';
   button.querySelector('.talent-rank').textContent=`${rank}/${talent.max}`;
   const otherRank=lab.other?.[branchIndex][index],otherSlot=lab.slot==='A'?'B':'A';
   const diff=button.querySelector('.talent-diff-rank');
   diff.hidden=otherRank===undefined||otherRank===rank;
   diff.textContent=diff.hidden?'':`${otherSlot} ${otherRank}`;
   button.setAttribute('aria-label',`${talent.name}，${rank}/${talent.max} 点${locked?'，前置条件未满足':''}${diff.hidden?'':`，方案 ${otherSlot} 为 ${otherRank} 点`}`);
   if(talent.req!==null)branch.querySelector(`[data-talent-link="${index}"]`).classList.toggle('is-unlocked',prereq);
  });
 });
 updateTalentTabs();
 if(selectedTalent&&!$('#talentDetail').hidden)showTalentDetail(...selectedTalent,$('#talentDetail').dataset.mode);
 $('#talentStatus').textContent=`${totals.join(' / ')}${state.talentsApplied?' · 已同步推演':''}${lab.other?` · 当前方案 ${lab.slot}`:''}`;
}
function talentAnchor(branch,index){
 return talentTree.querySelector(`[data-talent-detail="${branch},${index}"]`);
}
function positionTalentDetail(anchor){
 const box=anchor.getBoundingClientRect(),width=talentDetail.offsetWidth,height=talentDetail.offsetHeight;
 const roomRight=innerWidth-box.right,roomLeft=box.left;
 const placeRight=roomRight>=width+12||roomRight>=roomLeft;
 const edge=placeRight?box.right+10:box.left-width-10;
 talentDetail.style.left=`${Math.max(8,Math.min(innerWidth-width-8,edge))}px`;
 talentDetail.style.top=`${Math.max(8,Math.min(innerHeight-height-8,box.top))}px`;
}
function showTalentDetail(x,i,mode='hover'){
 const tree=talentTrees[x],t=tree.talents[i],n=state.talents[x][i];
 const v=talentVisuals[t.name],describe=talentDescriptions[t.name];
 const conditions=[];
 if(t.row>1)conditions.push(`前面层级已投入 ${(t.row-1)*5} 点`);
 if(t.req!==null)conditions.push(`点满${tree.talents[t.req].name}`);
 const current=n?`<div><b>当前 ${n}/${t.max}</b> ${describe(n)}</div>`:'';
 const next=n<t.max?`<div><b>${n?`下一级 ${n+1}/${t.max}`:'第 1 级'}</b> ${describe(n+1)}</div>`:'';
 const ranks=Array.from({length:t.max},(_,j)=>`<li><b>${j+1} 级</b> ${describe(j+1)}</li>`).join('');
 const sheet=mode==='sheet';
 const oldAnchor=selectedTalent&&talentAnchor(...selectedTalent);
 if(oldAnchor&&oldAnchor!==talentAnchor(x,i))oldAnchor.removeAttribute('aria-describedby');
 selectedTalent=[x,i];
 talentDetail.dataset.mode=mode;
 talentDetail.setAttribute('role',sheet?'dialog':'tooltip');
 if(sheet)talentDetail.setAttribute('aria-label',t.name);
 else talentDetail.removeAttribute('aria-label');
 talentDetail.innerHTML=`<div class="talent-detail-head">
   <img src="assets/talents/${v.icon}" alt=""><div><strong>${t.name}</strong><div class="talent-detail-meta">${tree.name} · ${n}/${t.max} 点${n?'':' · 当前未学习'}</div></div>
   ${sheet?'<button type="button" class="quiet talent-tip-close" data-talent-close aria-label="关闭天赋说明">×</button>':''}
  </div>
  ${v.cost?`<div class="talent-cost">${v.cost}</div>`:''}
  <div class="talent-rank-info">${current}${next}
   ${conditions.length?`<div class="talent-condition">需${conditions.join('，并且')}</div>`:''}
  </div>
  <p class="talent-tip-model">${modeledTalents.has(t.name)?'已纳入当前推演':'可分配点数 · 战斗效果待建模'}</p>
  ${sheet?`<details><summary>查看全部等级</summary><ul>${ranks}</ul></details>
  <div class="talent-tip-actions"><button type="button" class="quiet" data-talent-minus="${x},${i}"${n===0?' disabled':''}>− 减 1 点</button><button type="button" data-talent-plus="${x},${i}"${n===t.max?' disabled':''}>＋ 加 1 点</button></div>
  <p class="talent-tip-message" role="status"></p>`:'<p class="talent-tip-keys">左键加点 · 右键减点 · 键盘 + / −</p>'}`;
 talentDetail.hidden=false;
 const anchor=talentAnchor(x,i);
 if(!sheet){anchor.setAttribute('aria-describedby','talentDetail');positionTalentDetail(anchor);}
 else{anchor.removeAttribute('aria-describedby');talentDetail.style.removeProperty('left');talentDetail.style.removeProperty('top');}
}
function closeTalentDetail(){
 if(selectedTalent)talentAnchor(...selectedTalent)?.removeAttribute('aria-describedby');
 talentDetail.hidden=true;
 selectedTalent=null;
}
function talentApply(){
 applyTalentConfig(state.talents,state.cfg);
 state.talentsApplied=true;
 syncConfig();drawTalents();drawResult();save();
}
function changeTalentRank(branch,index,delta){
 const rank=state.talents[branch][index],talent=talentTrees[branch].talents[index],next=rank+delta;
 if(next<0||next>talent.max)return;
 const proposed=state.talents.map(ranks=>ranks.slice());
 proposed[branch][index]=next;
 const lab=state.talentLab;
 const error=validateTalents(proposed)||(delta>0&&totalTalentPoints(proposed)>talentPointBudget(lab.level,lab.gift)?`角色 ${lab.level} 级的天赋点数已用完`:'');
 if(error){
  $('#talentStatus').textContent=error;
  const message=talentDetail.querySelector('.talent-tip-message');
  if(message)message.textContent=error;
  return;
 }
 const focusedAction=document.activeElement?.matches('[data-talent-plus], [data-talent-minus]') ? document.activeElement.dataset : null;
 state.talents=proposed;
 talentApply();
 if(focusedAction){
  const selector=focusedAction.talentPlus?'[data-talent-plus]':'[data-talent-minus]';
  (talentDetail.querySelector(`${selector}:enabled`)||talentDetail.querySelector('[data-talent-close]'))?.focus({preventScroll:true});
 }
}
function talentNodeFromEvent(event){return event.target.closest('[data-talent-detail]');}
function talentCoords(node){return node.dataset.talentDetail.split(',').map(Number);}
const coarseTalentPointer=window.matchMedia('(hover: none)');
talentTree.addEventListener('pointerover',event=>{
 const node=talentNodeFromEvent(event);
 if(!node||event.pointerType==='touch'||event.pointerType==='pen'||coarseTalentPointer.matches||node.contains(event.relatedTarget))return;
 showTalentDetail(...talentCoords(node));
});
talentTree.addEventListener('pointerout',event=>{
 const node=talentNodeFromEvent(event);
 if(node&&!node.contains(event.relatedTarget)&&talentDetail.dataset.mode==='hover')closeTalentDetail();
});
talentTree.addEventListener('focusin',event=>{
 const node=talentNodeFromEvent(event);
 if(node&&node.matches(':focus-visible')&&!coarseTalentPointer.matches)showTalentDetail(...talentCoords(node));
});
talentTree.addEventListener('focusout',event=>{
 if(talentNodeFromEvent(event)&&talentDetail.dataset.mode==='hover')closeTalentDetail();
});
talentTree.addEventListener('click',event=>{
 const reset=event.target.closest('[data-talent-reset]');
 if(reset){state.talents[Number(reset.dataset.talentReset)].fill(0);talentApply();return;}
 const node=talentNodeFromEvent(event);
 if(!node)return;
 const coords=talentCoords(node);
 if(event.pointerType==='touch'||event.pointerType==='pen'||coarseTalentPointer.matches){showTalentDetail(...coords,'sheet');return;}
 showTalentDetail(...coords);
 changeTalentRank(...coords,1);
});
talentTree.addEventListener('contextmenu',event=>{
 const node=talentNodeFromEvent(event);
 if(!node)return;
 event.preventDefault();
 if(event.pointerType==='touch'||event.pointerType==='pen'||coarseTalentPointer.matches)return;
 const coords=talentCoords(node);
 showTalentDetail(...coords);
 changeTalentRank(...coords,-1);
});
talentTree.addEventListener('keydown',event=>{
 const node=talentNodeFromEvent(event);
 if(!node||!['+','=','-'].includes(event.key))return;
 event.preventDefault();
 const coords=talentCoords(node);
 showTalentDetail(...coords);
 changeTalentRank(...coords,event.key==='-'?-1:1);
});
talentDetail.addEventListener('click',event=>{
 const close=event.target.closest('[data-talent-close]');
 if(close){closeTalentDetail();return;}
 const action=event.target.closest('[data-talent-plus], [data-talent-minus]');
 if(!action)return;
 const coords=(action.dataset.talentPlus||action.dataset.talentMinus).split(',').map(Number);
 changeTalentRank(...coords,action.dataset.talentPlus?1:-1);
});
document.addEventListener('pointerdown',event=>{
 if(!talentDetail.hidden&&!talentDetail.contains(event.target)&&!talentNodeFromEvent(event))closeTalentDetail();
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!talentDetail.hidden){event.preventDefault();closeTalentDetail();}
});
window.addEventListener('resize',()=>{
 if(talentDetail.dataset.mode==='hover')closeTalentDetail();
});
window.addEventListener('hashchange',closeTalentDetail);
window.addEventListener('scroll',()=>{
 if(!talentDetail.hidden&&talentDetail.dataset.mode==='hover'&&selectedTalent)positionTalentDetail(talentAnchor(...selectedTalent));
},{passive:true});
$('#talentApply').onclick=talentApply;
$('#talentClear').onclick=()=>{closeTalentDetail();state.talents=blankTalents();talentApply();};
function importTalents(source){
 try{
  const lab=state.talentLab;
  if(source.includes('~')){
   const [a,b]=parseTalentComparison(source);
   lab.other=a;lab.slot='B';state.talents=b;
  }else{
   state.talents=parseTalentLink(source);
  }
  closeTalentDetail();talentApply();
  return true;
 }catch(error){$('#talentStatus').textContent='导入失败：'+error.message;return false;}
}
async function copyTalentLink(link){
 const input=$('#talentLink'),status=$('#talentStatus');
 input.value=link;
 try{await navigator.clipboard.writeText(link);status.textContent='已复制链接。';}
 catch{input.focus();input.select();status.textContent='链接已填入输入框，可手动复制。';}
}
$('#talentImport').onclick=()=>importTalents($('#talentLink').value);
$('#talentPreset').onclick=()=>{ $('#talentLink').value='https://wowhandbook.com/zh/classes/rogue/talents/#'+myTalentLink;importTalents(myTalentLink); };
$('#talentCopy')?.addEventListener('click',()=>{
 const code=serializeTalentBuild(state.talents);
 copyTalentLink('https://wowhandbook.com/zh/classes/rogue/talents/#'+(code||'0'));
});
function openSharedTalentBuild(){
 if(location.hash.startsWith('#talents/')&&importTalents(location.hash))history.replaceState(null,'','#talents');
}
window.addEventListener('hashchange',openSharedTalentBuild);
openSharedTalentBuild();
const talentOverrideIds=['reduction','flawlessReduction','dirtyDeeds','composure','exposeRank','ruthlessRank','relentlessRank','initiativeRank','sealRank','bootRank','flashRank','punctureRank','ambushCritRank','efficientRank','dirtyTricksRank','mutilate','adrenaline','coldblood','ghost'];
talentOverrideIds.forEach(id=>$('#'+id).addEventListener('change',()=>{if(state.talentsApplied){state.talentsApplied=false;drawTalents();save();}}));
