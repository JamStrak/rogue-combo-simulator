// 这些数字是可修改的相对伤害基准，不是无限服实测技能伤害。
function damageDefaults(){return {values:{ambush:300,ghost:120,hemo:110,mutilate:180,backstab:200,sinister:100,gouge:50,eviscerate:100},critMultiplier:2,burstWindow:5,bleedCritRate:20,bleedCritMode:'expected',bleeds:{garrote:{tickDamage:55,duration:18,interval:3},rupture:{tickDamageBase:0,tickDamagePerCombo:20,durationBase:6,durationPerCombo:2,interval:2}}};}
function calculateDamage(sequence, simulation, cfg, settings=damageDefaults()){
 const defaults=damageDefaults();
 const number=(x,fallback)=>Number.isFinite(Number(x))?Number(x):fallback;
 const values={...defaults.values,...(settings.values||{})};
 const critMultiplier=Math.max(1,number(settings.critMultiplier,2));
 const window=Math.max(0.1,number(settings.burstWindow,5));
 const maxChance=x=>Math.min(100,Math.max(0,x));
 const critSkills=new Set(['ambush','ghost','hemo','mutilate','backstab','sinister','gouge','eviscerate']);
 let total=0;
 const rows=[];
 const applications=[];
 for(const row of simulation.rows){
  if(row.error)break;
  const id=sequence[row.index]?.id;
  let amount=critSkills.has(id)?Math.max(0,number(values[id],0)):0;
  // 刺骨值按每个消耗的连击点计算；实际值来自该动作执行时的星数。
  if(id==='eviscerate') amount*=Math.max(0,number(row.cpBefore,0));
  let critMode='none', multiplier=1;
  if(amount>0&&critSkills.has(id)){
   const text=(row.notes||[]).join('；');
   const recorded=text.match(/暴击\s*[\d.]+%：([是否])/);
   const cold=/消耗冷血：本次暴击率提高 100%/.test(text);
   let chance=maxChance(number(cfg.crit,0)+number(cfg.maliceRank,0)+(id==='ambush'?15*number(cfg.ambushCritRank,0):id==='backstab'?10*number(cfg.punctureRank,0):id==='mutilate'?5*number(cfg.punctureRank,0):0))/100;
   if(id==='mutilate'&&!cold){
    // 两手等权。记录为至少一手暴击时按条件期望计算，而不是整招必暴。
    const any=1-(1-chance)**2;
    const fraction=recorded?(recorded[1]==='是'&&any>0?chance/any:0):chance;
    multiplier=1+(critMultiplier-1)*fraction;
    critMode=recorded?'conditional-expected':'expected';
   }else if(recorded||cold){const crit=cold||(recorded&&recorded[1]==='是');multiplier=crit?critMultiplier:1;critMode=crit?'rolled-crit':'rolled-normal';}
   else{multiplier=1+(critMultiplier-1)*chance;critMode='expected';}

  }
  const damage=amount*multiplier;total+=damage;
  rows.push({index:row.index,time:row.time,directDamage:damage,bleedDamage:0,damage,cumulative:0,critMode});
  if(id==='garrote'||id==='rupture')applications.push({id,index:row.index,time:row.time,cp:Math.max(0,number(row.cpBefore,0))});
 }
 const duration=Math.max(0,number(simulation.time,0));
 const bleedCritRate=maxChance(number(settings.bleedCritRate,defaults.bleedCritRate))/100;
 const bleedMultiplier=1+(critMultiplier-1)*bleedCritRate;
 const bleeds={garrote:{...defaults.bleeds.garrote,...(settings.bleeds?.garrote||{})},rupture:{...defaults.bleeds.rupture,...(settings.bleeds?.rupture||{})}};
 const bleedEvents=[];
 for(let i=0;i<applications.length;i++){
  const app=applications[i],spec=bleeds[app.id],next=applications.slice(i+1).find(a=>a.id===app.id);
  const interval=Math.max(0.1,number(spec.interval,app.id==='garrote'?3:2));
  const life=Math.min(3600,Math.max(0,app.id==='garrote'?number(spec.duration,18):number(spec.durationBase,6)+number(spec.durationPerCombo,2)*app.cp));
  const base=Math.max(0,app.id==='garrote'?number(spec.tickDamage,55):number(spec.tickDamageBase,0)+number(spec.tickDamagePerCombo,20)*app.cp);
  const count=Math.floor(life/interval+1e-9);
  for(let j=1;j<=count;j++){
   const time=app.time+j*interval;
   // 同刻跳伤先于重施，旧效果在刷新时刻之后消失。
   if(next&&time>next.time+1e-9)break;
   if(base>0)bleedEvents.push({time,type:'bleed',id:app.id,index:app.index,damage:base,crit:null});
  }
 }
 bleedEvents.sort((a,b)=>a.time-b.time||a.index-b.index);
 // 单独的随机流不会消耗或改变能量、连击点模拟中的随机数。
 let damageSeed=((Number(cfg.seed)||1)>>>0)^0x9e3779b9;
 for(const event of bleedEvents){
  if(settings.bleedCritMode==='random'){
   damageSeed=(Math.imul(damageSeed,1664525)+1013904223)>>>0;
   event.crit=damageSeed/4294967296<bleedCritRate;
   event.damage*=event.crit?critMultiplier:1;
  }else event.damage*=bleedMultiplier;
 }
 const directEvents=rows.filter(r=>r.directDamage>0).map(r=>({time:r.time,type:'direct',id:sequence[r.index]?.id,index:r.index,damage:r.directDamage}));
 const events=[...bleedEvents,...directEvents].sort((a,b)=>a.time-b.time||(a.type===b.type?a.index-b.index:a.type==='bleed'?-1:1));
 let cumulative=0,position=0;
 for(const row of rows){
  while(position<bleedEvents.length&&bleedEvents[position].time<=row.time+1e-9)row.bleedDamage+=bleedEvents[position++].damage;
  row.damage=row.directDamage+row.bleedDamage;cumulative+=row.damage;row.cumulative=cumulative;
 }
 const tailDamage=bleedEvents.slice(position).reduce((n,e)=>n+e.damage,0);
 const directTotal=directEvents.reduce((n,e)=>n+e.damage,0),bleedTotal=bleedEvents.reduce((n,e)=>n+e.damage,0);
 total=directTotal+bleedTotal;
 const during=total-tailDamage;
 const endTime=Math.max(duration,events.length?events[events.length-1].time:0);
 let peak={start:0,end:window,damage:0,dps:0},right=0,running=0;
 for(let left=0;left<events.length;){
  const start=events[left].time;
  while(right<events.length&&events[right].time<start+window)running+=events[right++].damage;
  if(running>peak.damage)peak={start,end:start+window,damage:running,dps:running/window};
  while(left<events.length&&events[left].time===start)running-=events[left++].damage;
 }

 return {rows,total,during,tailDamage,directTotal,bleedTotal,duration,endTime,dps:endTime>0?total/endTime:null,peak,events};
}
if(typeof module!=='undefined')module.exports={damageDefaults,calculateDamage};
