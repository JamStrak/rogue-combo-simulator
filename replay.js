// 播放与原推演共享同一批结果，不重新掷骰。
function makeReplay(sequence, simulation, damage, cfg) {
 const actions=simulation.rows.map(row=>({...row,id:sequence[row.index]?.id}));
 const direct=new Map(damage.events.filter(e=>e.type==='direct').map(e=>[e.index,e]));
 const events=damage.events.filter(e=>e.type!=='direct').map(e=>({...e}));
 for(const row of actions){const hit=direct.get(row.index);events.push({time:row.time,type:row.error?'error':row.wait?'wait':'action',id:row.id,index:row.index,name:row.name,damage:hit?.damage||0,crit:hit?.crit??null,critMode:hit?.critMode,notes:row.notes});}
 const order={bleed:0,white:1,action:2,wait:2,error:2};
 events.sort((a,b)=>a.time-b.time||(order[a.type]-order[b.type])||a.index-b.index);
 let cumulative=0;for(const event of events){cumulative+=event.damage||0;event.cumulative=cumulative;}
 return {actions,events,duration:Math.max(0,Number(simulation.time)||0,Number(damage.endTime)||0),cfg:{start:Number(cfg.start)||0,max:Number(cfg.max)||100,regen:Number(cfg.regen)||0},stopped:!!simulation.stopped};
}
function replayAt(model,time) {
 const t=Math.max(0,Math.min(model.duration,Number(time)||0)), {max,regen}=model.cfg;
 let energy=Math.min(max,model.cfg.start),last=0,boostUntil=0,cp=0,controlEnd=0;
 const restore=(a,b)=>regen*(b-a)+regen*Math.max(0,Math.min(b,boostUntil)-a);
 for(const row of model.actions){
  if(row.time>t+1e-9)break;
  energy=Math.min(max,energy+restore(last,row.time));
  energy=row.after;last=row.time;cp=row.cp;controlEnd=row.controlEnd;
  if(row.id==='adrenaline'&&!row.error)boostUntil=row.time+15;
 }
 energy=Math.min(max,energy+restore(last,t));
 let lo=0,hi=model.events.length;while(lo<hi){const mid=(lo+hi)>>1;if(model.events[mid].time<=t+1e-9)lo=mid+1;else hi=mid;}const total=lo?model.events[lo-1].cumulative:0;
 return {time:t,energy,cp,controlRemaining:Math.max(0,controlEnd-t),damage:total};
}
if(typeof module!=='undefined')module.exports={makeReplay,replayAt};
// 控件只播放当前已计算的结果；改动配置时由主界面重置。
const replayPlayer={model:null,status:'ready',time:0,seen:0,frame:0,lastStamp:null};
function setupReplay(){
 const byId=id=>document.getElementById(id);
 const play=byId('combatPlay'),reset=byId('combatReset'),hp=byId('combatHealthInput'),speed=byId('combatSpeed');
 const number=n=>Number((Number(n)||0).toFixed(2)).toLocaleString('zh-CN',{maximumFractionDigits:2});
 const maxHealth=()=>Math.max(1,Math.min(10000000,Number(hp.value)||10000));
 const stopFrame=()=>{if(replayPlayer.frame)cancelAnimationFrame(replayPlayer.frame);replayPlayer.frame=0;replayPlayer.lastStamp=null;};
 const label=event=>event.type==='white'?(event.hand==='main'?'主手平砍':'副手平砍'):event.type==='bleed'?(event.id==='garrote'?'绞喉流血':'割裂流血'):event.type==='error'?`${event.name} · 中断`:event.type==='wait'?`${event.name}结束`:event.name;
 function paint(){
  const model=replayPlayer.model;if(!model)return;
  const ready=replayPlayer.status==='ready';const snap=ready?{energy:Math.min(model.cfg.max,model.cfg.start),damage:0}:replayAt(model,replayPlayer.time);
  const maximum=maxHealth(),remaining=Math.max(0,maximum-snap.damage),energy=Math.max(0,Math.min(model.cfg.max,snap.energy));
  byId('combatHealthBar').max=maximum;byId('combatHealthBar').value=remaining;byId('combatHealthText').textContent=`${number(remaining)} / ${number(maximum)}`;
  byId('combatEnergyBar').max=model.cfg.max;byId('combatEnergyBar').value=energy;byId('combatEnergyText').textContent=`${number(energy)} / ${number(model.cfg.max)}`;
  byId('combatProgress').max=model.duration||1;byId('combatProgress').value=replayPlayer.time;
  byId('combatTime').textContent=`${number(replayPlayer.time)} / ${number(model.duration)} 秒`;
  const total=byId('combatDamage');if(total)total.textContent=number(snap.damage);
  play.textContent=replayPlayer.status==='playing'?'暂停':replayPlayer.status==='paused'?'继续':replayPlayer.status==='done'?'重新播放':'播放连招';
  play.disabled=!model.events.length;
 }
 function resetState(){stopFrame();replayPlayer.status='ready';replayPlayer.time=0;replayPlayer.seen=0;byId('combatLog').replaceChildren();byId('combatFloat').replaceChildren();byId('combatAction').textContent='准备就绪';paint();}
 function present(event){
  const title=label(event),amount=event.damage||0;const log=document.createElement('div');log.className='combat-log-entry';
  const ts=document.createElement('time');ts.textContent=`${number(event.time)}s`;const text=document.createElement('span');text.textContent=title;
  log.append(ts,text);if(amount>0){const damage=document.createElement('b');damage.textContent=`−${number(amount)}`;log.append(damage);}
  if(event.type==='error')log.classList.add('combat-event-error');
  byId('combatLog').prepend(log);while(byId('combatLog').children.length>6)byId('combatLog').lastChild.remove();
  byId('combatAction').textContent=title;
  if(amount>0){
   const floating=document.createElement('span');floating.className=`combat-float-${event.type}`;floating.textContent=`−${number(amount)}${event.crit===true||event.critMode==='rolled-crit'?' 暴击':''}`;
   byId('combatFloat').append(floating);setTimeout(()=>floating.remove(),1000);
  }
  const stage=byId('combatStage');stage.classList.remove('hit-main','hit-off','hit-skill','hit-bleed');void stage.offsetWidth;
  stage.classList.add(event.type==='white'?(event.hand==='main'?'hit-main':'hit-off'):event.type==='bleed'?'hit-bleed':'hit-skill');
 }
 function step(stamp){
  if(replayPlayer.status!=='playing')return;
  if(replayPlayer.lastStamp!==null)replayPlayer.time=Math.min(replayPlayer.model.duration,replayPlayer.time+(stamp-replayPlayer.lastStamp)/1000*(Number(speed.value)||1));
  replayPlayer.lastStamp=stamp;
  const events=replayPlayer.model.events;while(replayPlayer.seen<events.length&&events[replayPlayer.seen].time<=replayPlayer.time+1e-9)present(events[replayPlayer.seen++]);
  if(replayPlayer.time>=replayPlayer.model.duration){replayPlayer.status='done';stopFrame();if(replayPlayer.model.stopped)byId('combatAction').textContent='连招已中断 · 已播放已产生的尾伤';}
  paint();if(replayPlayer.status==='playing')replayPlayer.frame=requestAnimationFrame(step);
 }
 play.addEventListener('click',()=>{
  if(!replayPlayer.model||!replayPlayer.model.events.length)return;
  if(replayPlayer.status==='playing'){stopFrame();replayPlayer.status='paused';paint();return;}
  if(replayPlayer.status==='done')resetState();
  replayPlayer.status='playing';replayPlayer.lastStamp=null;step(performance.now());
 });
 reset.addEventListener('click',resetState);
 hp.addEventListener('change',()=>{hp.value=String(maxHealth());resetState();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&replayPlayer.status==='playing'){stopFrame();replayPlayer.status='paused';paint();}});
 replayPlayer.update=(sequence,simulation,damage,cfg)=>{stopFrame();replayPlayer.model=makeReplay(sequence,simulation,damage,cfg);resetState();};
}
