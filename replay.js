// 播放与原推演共享同一批结果，不重新掷骰。
const replayEnergyAfter=typeof module!=='undefined'?require('./engine.js').energyAfter:energyAfter;
const replayTimedActions=new Set(['wait','stop','evade']);
function makeReplay(sequence, simulation, damage, cfg) {
 const actions=simulation.rows.map((row,index)=>{
  const id=row.id??sequence[row.index]?.id;
  const startTime=row.startTime??simulation.rows[index-1]?.time??0;
  const energyWaitStart=row.energyWait>0?row.time-row.energyWait:null;
  let gapTime=row.time-(row.controlGap||0);
  const gaps=(row.gapReasons||[]).map(reason=>{
   const start=gapTime;
   gapTime+=reason.duration;
   return {...reason,start,end:gapTime};
  });
  return {...row,id,startTime,energyWaitStart,gaps};
 });
 const direct=new Map(damage.events.filter(event=>event.type==='direct').map(event=>[event.index,event]));
 const events=damage.events.filter(event=>event.type!=='direct').map(event=>({...event}));
 for(const row of actions){
  const hit=direct.get(row.index);
  events.push({time:row.time,type:row.error?'error':row.wait?'wait':'action',id:row.id,index:row.index,name:row.name,damage:hit?.damage||0,crit:hit?.crit??null,critMode:hit?.critMode,skillCritical:row.critOutcome?.critical===true||hit?.crit===true||hit?.critMode==='rolled-crit',notes:row.notes});
 }
 const order={bleed:0,white:1,deathmark:2,action:3,wait:3,error:3};
 events.sort((a,b)=>a.time-b.time||(order[a.type]-order[b.type])||a.index-b.index);
 const actionByIndex=new Map(actions.map(row=>[row.index,row]));
 let cumulative=0;
 for(const [index,event] of events.entries()){
  cumulative+=event.damage||0;event.cumulative=cumulative;
  if(['action','wait','error'].includes(event.type))actionByIndex.get(event.index).eventIndex=index;
 }
 return {
  actions,events,stepCount:sequence.length,
  duration:Math.max(0,simulation.time||0,damage.endTime||0,simulation.controlEnd||0),
  cfg:{start:Number(cfg.start)||0,max:Number(cfg.max)||100,regen:Number(cfg.regen)||0,startCombat:!!cfg.startCombat,startStealth:cfg.startStealth!==false},
  stopped:!!simulation.stopped
 };
}
function replayAt(model,time,seen=Infinity) {
 const t=Math.max(0,Math.min(model.duration,Number(time)||0));
 const {max,regen}=model.cfg;
 let previous=null,next=null;
 for(const row of model.actions){
  if(row.time>t+1e-9||row.eventIndex>=seen){next=row;break;}
  previous=row;
 }
 const lastEnergy=previous?.after??Math.min(max,model.cfg.start);
 const energy=replayEnergyAfter(lastEnergy,previous?.time??0,t,max,regen,previous?.adrenalineUntil);
 const controlRemaining=Math.max(0,(previous?.controlEnd||0)-t);
 const gap=next?.gaps.find(interval=>interval.start<=t+1e-9&&interval.end>t+1e-9)??null;
 const energyWaiting=next?.energyWaitStart!=null&&t+1e-9>=next.energyWaitStart;
 const timedAction=next&&!next.error&&replayTimedActions.has(next.id)&&next.startTime<=t+1e-9?next:null;
 const step=energyWaiting||gap||timedAction?next:previous;
 const inCombat=timedAction?.combatChangedAt!=null&&timedAction.combatChangedAt<=t+1e-9
  ?timedAction.inCombat:previous?.inCombat??model.cfg.startCombat;
 const autoAttacking=timedAction?.autoAttackChangedAt!=null&&timedAction.autoAttackChangedAt<=t+1e-9
  ?timedAction.autoAttacking:previous?.autoAttacking??false;
 const combatRemaining=timedAction?.id==='evade'&&inCombat
  ?Math.max(0,(timedAction.combatChangedAt??timedAction.time+timedAction.combatRemaining)-t):0;
 const stealth=previous?.stealth??model.cfg.startStealth;
 let lo=0,hi=model.events.length;
 while(lo<hi){const mid=(lo+hi)>>1;if(model.events[mid].time<=t+1e-9)lo=mid+1;else hi=mid;}
 lo=Math.min(lo,seen);
 return {
  time:t,energy,cp:Math.max(0,(previous?.cp||0)-(previous?.premedPending&&t>=previous.premedUntil?previous.premedPending:0)),controlRemaining,damage:lo?model.events[lo-1].cumulative:0,
  step,gap,energyWaiting,timedAction,inCombat,autoAttacking,combatRemaining,stealth,blocked:previous?.error?previous:null,previous
 };
}
if(typeof module!=='undefined')module.exports={makeReplay,replayAt};

// 控件只播放当前已计算的结果。改动配置时由主界面重置。
const replayPlayer={model:null,status:'ready',time:0,seen:0,frame:0,lastStamp:null};
function setupReplay(){
 const byId=id=>document.getElementById(id);
 const play=byId('combatPlay'),reset=byId('combatReset'),hp=byId('combatHealthInput'),speed=byId('combatSpeed');
 const stage=byId('combatStage'),actionText=byId('combatAction'),floatBox=byId('combatFloat'),logBox=byId('combatLog');
 const healthBar=byId('combatHealthBar'),healthText=byId('combatHealthText');
 const energyBar=byId('combatEnergyBar'),energyText=byId('combatEnergyText');
 const progress=byId('combatProgress'),timeText=byId('combatTime'),damageText=byId('combatDamage');
 const combo=byId('combatCombo'),comboText=byId('combatComboText'),comboOrbs=[...combo.querySelectorAll('i')];
 const cue=document.createElement('div');
 cue.className='combat-cast-cue';
 cue.setAttribute('aria-live','polite');
 stage.querySelector('.combat-arena').append(cue);
 const skillFloat=document.createElement('div');
 skillFloat.className='combat-skill-float';
 skillFloat.setAttribute('aria-hidden','true');
 stage.querySelector('.combat-arena').append(skillFloat);
 const stepBox=document.createElement('div');
 stepBox.className='combat-step';
 stepBox.innerHTML='<span>连招步骤</span><strong id="combatStepIndex">—</strong><b id="combatStepName">等待播放</b>';
 actionText.parentNode.firstElementChild.textContent='最近事件';
 actionText.parentNode.prepend(stepBox);
 const stepIndex=byId('combatStepIndex'),stepName=byId('combatStepName');
 const diagnostics=document.createElement('div');
 diagnostics.className='combat-diagnostics';
 diagnostics.innerHTML='<div><span>木桩状态</span><strong id="combatControlStatus"></strong><small id="combatControlDetail"></small></div><div><span>施放状态</span><strong id="combatCastStatus"></strong><small id="combatCastDetail"></small></div>';
 stage.after(diagnostics);
 const controlStatus=byId('combatControlStatus'),controlDetail=byId('combatControlDetail');
 const castStatus=byId('combatCastStatus'),castDetail=byId('combatCastDetail');
 const format=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
 const formatTenths=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1});
 const number=n=>format.format(Number(n)||0);
 const seconds=n=>`${formatTenths.format(Math.ceil(Math.max(0,n)*10-1e-8)/10)} 秒`;
 const maxHealth=()=>Math.max(1,Math.min(10000000,Number(hp.value)||10000));
 const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
 const hitClasses=['hit-main','hit-off','hit-skill','hit-bleed'];
 function stopFrame(){
  if(replayPlayer.frame)cancelAnimationFrame(replayPlayer.frame);
  replayPlayer.frame=0;
  replayPlayer.lastStamp=null;
 }
 function setSkillAnimationsPaused(paused){
  for(const icon of skillFloat.children){
   for(const animation of icon.getAnimations()){
    if(paused){
     // 固定当前时间，避免暂停请求等待下一次渲染时仍继续走时。
     const current=animation.currentTime;
     animation.pause();
     if(current!==null)animation.currentTime=current;
    }else animation.play();
   }
  }
 }
 function paintDiagnostics(model,snap,ready){
  const {step,gap,energyWaiting,blocked,previous}=snap;
  setText(stepIndex,`${step?step.index+1:'—'} / ${model.stepCount}`);
  setText(stepName,step?.name||(ready?'等待播放':'等待起手'));
  const controlled=snap.controlRemaining>1e-8;
  const controlState=controlled?'held':gap?'gap':'free';
  if(stage.dataset.control!==controlState)stage.dataset.control=controlState;
  setText(controlStatus,controlled?`控制中 · ${seconds(snap.controlRemaining)}`:gap?'控制空档':previous?.controlEnd>0?'控制已结束':'未受控制');
  const gapBefore=previous?.controlGap>1e-8?`施放前空档 ${number(previous.controlGap)} 秒`:'';
  setText(controlDetail,gap?`${gap.cause} · 第 ${step.index+1} 步前`:(gapBefore||''));

  const delayed=previous===step&&previous?.energyWait>0;
  const castState=blocked?'blocked':energyWaiting?'waiting':delayed?'delayed':'free';
  if(stage.dataset.cast!==castState)stage.dataset.cast=castState;
  if(diagnostics.dataset.control!==controlState)diagnostics.dataset.control=controlState;
  if(diagnostics.dataset.cast!==castState)diagnostics.dataset.cast=castState;
  if(blocked){
   const reasons=(blocked.notes||[]).filter(note=>!note.startsWith('控制空档'));
   setText(castStatus,blocked.energyShortage&&!blocked.energyWait?'能量不足 · 连招中断':'施放失败 · 连招中断');
   setText(castDetail,reasons.join('，'));
  }else if(energyWaiting){
   setText(castStatus,`能量不足 · 等 ${seconds(step.time-snap.time)}`);
   setText(castDetail,`等到 ${number(step.before)} 能量后尝试施放`);
  }else if(snap.timedAction){
   const remaining=seconds(step.time-snap.time);
   if(step.id==='evade'){
    setText(castStatus,snap.inCombat?`脱战等待 · ${seconds(snap.combatRemaining)}`:`已脱战 · 等 ${remaining}`);
    setText(castDetail,snap.autoAttacking?'':'已停止自动攻击');
   }else{
    setText(castStatus,`${step.id==='wait'?'主动等待':step.name} · ${remaining}`);
    setText(castDetail,'');
   }
  }else if(delayed){
   setText(castStatus,`本步等待回能 ${number(previous.energyWait)} 秒`);
   setText(castDetail,'');
  }else{
   const done=replayPlayer.status==='done';
   setText(castStatus,ready?'准备就绪':done?(model.stopped?'连招中断':'连招已结束'):replayPlayer.status==='paused'?'已暂停':'推进中');
   setText(castDetail,snap.stealth?'已潜行':'');
  }
 }
 function paint(){
  const model=replayPlayer.model;
  if(!model)return;
  const ready=replayPlayer.status==='ready';
  const snap=ready?{energy:Math.min(model.cfg.max,model.cfg.start),damage:0,cp:0}:replayAt(model,replayPlayer.time,replayPlayer.seen);
  const maximum=maxHealth();
  const remaining=Math.max(0,maximum-snap.damage);
  const energy=Math.max(0,Math.min(model.cfg.max,snap.energy));
  if(healthBar.max!==maximum)healthBar.max=maximum;
  if(healthBar.value!==remaining)healthBar.value=remaining;
  setText(healthText,`${number(remaining)} / ${number(maximum)}`);
  if(energyBar.max!==model.cfg.max)energyBar.max=model.cfg.max;
  energyBar.value=energy;
  setText(energyText,`${formatTenths.format(energy)} / ${number(model.cfg.max)}`);
  if(progress.max!==(model.duration||1))progress.max=model.duration||1;
  progress.value=replayPlayer.time;
  setText(timeText,`${formatTenths.format(replayPlayer.time)} / ${formatTenths.format(model.duration)} 秒`);
  if(damageText)setText(damageText,number(snap.damage));
  const cp=Math.max(0,Math.min(5,Number(snap.cp)||0));
  if(combo.dataset.points!==String(cp)){
   combo.dataset.points=String(cp);
   combo.setAttribute('aria-label',`播放连击点 ${cp} / 5`);
   setText(comboText,`${cp} / 5`);
   comboOrbs.forEach((orb,index)=>orb.classList.toggle('active',index<cp));
  }
  paintDiagnostics(model,snap,ready);
  stage.dataset.playback=replayPlayer.status;
  const labels={playing:'暂停',paused:'继续',done:'重新播放',ready:'播放连招'};
  setText(play,labels[replayPlayer.status]);
  play.disabled=!model.events.length;
 }
 function resetState(){
  stopFrame();
  replayPlayer.status='ready';
  replayPlayer.time=0;
  replayPlayer.seen=0;
  logBox.replaceChildren();
  floatBox.replaceChildren();
  skillFloat.replaceChildren();
  cue.replaceChildren();
  cue.classList.remove('visible');
  stage.classList.remove(...hitClasses);
  setText(actionText,'—');
  paint();
 }
 function eventLabel(event){
  if(event.type==='white')return event.hand==='main'?'主手平砍':'副手平砍';
  if(event.type==='bleed')return event.id==='garrote'?'绞喉流血':'割裂流血';
  if(event.type==='deathmark')return '死亡印记结算';
  if(event.type==='error')return `${event.name} · 中断`;
  return event.id==='wait'?'等待结束':event.name;
 }
 function cueParts(event,before,after){
  const row=replayPlayer.model.actions.find(action=>action.index===event.index);
  const title=document.createElement('strong');
  title.textContent=eventLabel(event);
  const detail=document.createElement('span');
  detail.className='combat-cast-details';
  const add=(text,kind)=>{const el=document.createElement('span');el.textContent=text;el.dataset.kind=kind;detail.append(el);};
  const energyBefore=row?.before??before.energy,energyAfter=row?.after??after.energy;
  const cpBefore=row?.cpBefore??before.cp,cpAfter=after.cp;
  const attemptedEnergyChange=Number(row?.cost)>0||row?.notes?.some(note=>/恢复 .*能量/.test(note));
  if(Math.abs(energyAfter-energyBefore)>1e-8||attemptedEnergyChange)add(`能量 ${number(energyBefore)} → ${number(energyAfter)}`,'energy');
  if(cpBefore!==cpAfter)add(`连击 ${number(cpBefore)} → ${number(cpAfter)}`,'combo');
  if(event.damage>0)add(`伤害 ${number(event.damage)}${event.crit===true||event.critMode==='rolled-crit'?' 暴击':''}`,'damage');
  if(event.type==='error')add('未施放','error');
  if(!detail.childNodes.length)add('状态已更新','neutral');
  const item=document.createElement('div');
  item.className='combat-cast-item';
  item.append(title,detail);
  return [item];
 }
 function showCues(parts){
  if(!parts.length)return;
  cue.classList.remove('visible');
  cue.replaceChildren(...parts);
  cue.style.setProperty('--cue-duration','800ms');
  void cue.offsetWidth;
  cue.classList.add('visible');
 }
 function present(event,floatLanes){
  const title=eventLabel(event),amount=event.damage||0;
  if(event.type==='action'&&typeof skillIcons!=='undefined'&&skillIcons[event.id]){
   const icon=document.createElement('img');
   icon.src=skillIcons[event.id];
   icon.alt='';
   if(event.skillCritical)icon.classList.add('combat-skill-crit');
   const stack=floatLanes.get('skill-icon')||0;
   floatLanes.set('skill-icon',stack+1);
   icon.style.setProperty('--skill-lane',Math.floor(stack/4));
   icon.style.setProperty('--skill-stack',stack%4);
   icon.addEventListener('animationend',()=>icon.remove(),{once:true});
   skillFloat.append(icon);
  }
  const critical=event.crit===true||event.critMode==='rolled-crit';
  const log=document.createElement('div');
  log.className='combat-log-entry';
  log.dataset.kind=event.type;
  const time=document.createElement('time');
  time.textContent=`${number(event.time)}s`;
  const titleText=document.createElement('span');
  const stepLabel=['action','wait','error'].includes(event.type)?`第 ${event.index+1} 步 · `:'';
  titleText.textContent=stepLabel+title;
  log.append(time,titleText);
  if(amount>0){
   const damage=document.createElement('b');
   damage.textContent=`−${number(amount)}${critical?' 暴击':''}`;
   if(critical)damage.className='combat-log-crit';
   log.append(damage);
   const floating=document.createElement('span');
   floating.className=`combat-float-${event.type==='deathmark'?'action':event.type}`;
   if(event.hand)floating.dataset.hand=event.hand;
   const lane=event.hand||event.type;
   const stack=floatLanes.get(lane)||0;
   floatLanes.set(lane,stack+1);
   if(stack>0)floating.style.setProperty('--float-stack',Math.min(4,stack));
   const amountText=document.createElement('b');
   amountText.textContent=`−${number(amount)}`;
   floating.append(amountText);
   if(critical){
    floating.classList.add('combat-float-crit');
    const critLabel=document.createElement('small');
    critLabel.textContent='暴击';
    floating.append(critLabel);
   }
   floatBox.append(floating);
   setTimeout(()=>floating.remove(),1050);
  }
  if(event.type==='error')log.classList.add('combat-event-error');
  logBox.prepend(log);
  setText(actionText,title);
  if(event.type==='white')return event.hand==='main'?'hit-main':'hit-off';
  if(event.type==='bleed')return 'hit-bleed';
  if((event.type==='action'||event.type==='deathmark')&&amount>0)return 'hit-skill';
 }
 function step(stamp){
  if(replayPlayer.status!=='playing')return;
  let elapsed=replayPlayer.lastStamp===null?0:Math.max(0,stamp-replayPlayer.lastStamp);
  replayPlayer.lastStamp=stamp;
  const model=replayPlayer.model,events=model.events,hits=new Set(),floatLanes=new Map(),cueNodes=[];
  const target=Math.min(model.duration,replayPlayer.time+elapsed/1000*(Number(speed.value)||1));
  while(replayPlayer.seen<events.length&&events[replayPlayer.seen].time<=target+1e-9){
   const event=events[replayPlayer.seen];
   const before=replayAt(model,event.time,replayPlayer.seen);
   const hit=present(event,floatLanes);
   replayPlayer.seen++;
   if(hit)hits.add(hit);
   if(['action','wait','error'].includes(event.type)){
    const after=replayAt(model,event.time,replayPlayer.seen);
    cueNodes.push(...cueParts(event,before,after));
   }
  }
  replayPlayer.time=target;
  showCues(cueNodes);
  if(hits.size){
   stage.classList.remove(...hitClasses);
   void stage.offsetWidth;
   stage.classList.add(...hits);
  }
  if(replayPlayer.time>=model.duration&&replayPlayer.seen>=events.length){replayPlayer.status='done';stopFrame();}
  paint();
  if(replayPlayer.status==='playing')replayPlayer.frame=requestAnimationFrame(step);
 }
 play.addEventListener('click',()=>{
  if(!replayPlayer.model?.events.length)return;
  if(replayPlayer.status==='playing'){stopFrame();setSkillAnimationsPaused(true);replayPlayer.status='paused';paint();return;}
  if(replayPlayer.status==='done')resetState();
  replayPlayer.status='playing';
  replayPlayer.lastStamp=null;
  paint();
  setSkillAnimationsPaused(false);
  step(performance.now());
 });
 reset.addEventListener('click',resetState);
 hp.addEventListener('change',()=>{hp.value=String(maxHealth());resetState();});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&replayPlayer.status==='playing'){stopFrame();setSkillAnimationsPaused(true);replayPlayer.status='paused';paint();}
 });
 replayPlayer.update=(sequence,simulation,damage,cfg)=>{
  replayPlayer.model=makeReplay(sequence,simulation,damage,cfg);
  resetState();
 };
}
