// 这些数字是可修改的相对伤害基准，不是无限服实测技能伤害。
function damageDefaults(){return {values:{ambush:300,ghost:120,hemo:110,mutilate:180,backstab:200,sinister:100,gouge:50,eviscerate:100},critMultiplier:2,burstWindow:5,bleedCritRate:20,bleedCritMode:'expected',weapon:{enabled:false,attackPower:0,mainMin:0,mainMax:0,mainSpeed:2.6,offMin:0,offMax:0,offSpeed:1.8,offhandPenalty:0.5,strikeCoefficient:0.5},bleeds:{garrote:{tickDamage:55,duration:18,interval:3},rupture:{tickDamageBase:0,tickDamagePerCombo:20,durationBase:6,durationPerCombo:2,interval:2}}};}
const lethalitySkills=new Set(['sinister','gouge','backstab','mutilate','ghost','hemo']);
const damageCritChance=typeof module!=='undefined'?require('./engine.js').meleeCritChance:(...args)=>meleeCritChance(...args);
function weaponMetrics(settings,cfg){
 const number=(x,fallback)=>Number.isFinite(Number(x))?Number(x):fallback;
 const weapon={...damageDefaults().weapon,...(settings.weapon||{})};
 const ap=Math.max(0,number(weapon.attackPower,0));
 const mainSpeed=Math.max(0.1,number(weapon.mainSpeed,2.6)),offSpeed=Math.max(0.1,number(weapon.offSpeed,1.8));
 const weaponBase=(min,max,speed)=>(Math.max(0,number(min,0))+Math.max(0,number(max,0)))/2+ap/14*speed;
 const mainBase=weaponBase(weapon.mainMin,weapon.mainMax,mainSpeed);
 const offBase=weaponBase(weapon.offMin,weapon.offMax,offSpeed);
 const strikeBase=offBase*Math.max(0,number(weapon.strikeCoefficient,0.5));
 // 匕首归一化速度取 1.7 秒；此模式是可比较的怀旧系数估算，不是装备实测。
 const normalized=(min,max)=>weaponBase(min,max,1.7);
 const mainNormalized=normalized(weapon.mainMin,weapon.mainMax),offNormalized=normalized(weapon.offMin,weapon.offMax);
 const offhandPenalty=Math.max(0,number(weapon.offhandPenalty,0.5));
 const critMultiplier=Math.max(1,number(settings.critMultiplier,2));
 const critRate=damageCritChance(cfg,'bleed');
 const mainCrit=damageCritChance(cfg,'white','main'),offCrit=damageCritChance(cfg,'white','off');
 return {weapon,ap,mainSpeed,offSpeed,mainNormalized,offNormalized,offhandPenalty,strikeBase,critMultiplier,critRate,mainCrit,offCrit,
  mainNormal:mainBase,offNormal:offBase*offhandPenalty,
  mainExpected:mainBase*(1+(critMultiplier-1)*mainCrit/100),offExpected:offBase*offhandPenalty*(1+(critMultiplier-1)*offCrit/100)};
}
function calculateDamage(sequence, simulation, cfg, settings=damageDefaults()){
 const defaults=damageDefaults();
 const number=(x,fallback)=>Number.isFinite(Number(x))?Number(x):fallback;
 const values={...defaults.values,...(settings.values||{})};
 const metrics=weaponMetrics(settings,cfg);
 const {weapon,ap,mainSpeed,offSpeed,mainNormalized,offNormalized,offhandPenalty,strikeBase,critMultiplier}=metrics;
 const window=Math.max(0.1,number(settings.burstWindow,5));
 const maxChance=x=>Math.min(100,Math.max(0,x));
 const critSkills=new Set(['ambush','ghost','hemo','mutilate','backstab','sinister','gouge','eviscerate','strike']);
 let total=0;
 const rows=[];
 const applications=[];
 for(const row of simulation.rows){
  if(row.error)break;
  const id=sequence[row.index]?.id;
  let amount=id==='strike'?strikeBase:critSkills.has(id)?Math.max(0,number(values[id],0)):0;
  // 刺骨值按每个消耗的连击点计算；实际值来自该动作执行时的星数。
  const cp=Math.max(0,number(row.cpBefore,0));
  let mainShare=0.5;
  if(settings.skillModel==='weapon'){
   const weaponAmounts={ambush:2.5*mainNormalized+290,backstab:1.5*mainNormalized+140,sinister:mainNormalized+68,ghost:1.8*mainNormalized,hemo:1.45*mainNormalized,gouge:75,mutilate:0.9*mainNormalized+79+(0.9*offNormalized+79)*offhandPenalty,eviscerate:cp>0?247+151*(cp-1)+ap*0.03*cp:0};
   if(Object.hasOwn(weaponAmounts,id))amount=weaponAmounts[id];
   if(id==='mutilate'&&amount>0)mainShare=(0.9*mainNormalized+79)/amount;
  }else if(id==='eviscerate') amount*=cp;
  let critMode='none', multiplier=1;
  if(amount>0&&critSkills.has(id)){
   const talentBonus=lethalitySkills.has(id)?0.1*Math.min(2,Math.max(0,number(cfg.lethalityRank,0))):0;
   const skillCritMultiplier=1+(critMultiplier-1)*(1+talentBonus);
   const outcome=row.critOutcome;
   if(outcome){
    const fraction=id==='mutilate'
     ? (outcome.main?mainShare:0)+(outcome.off?1-mainShare:0)
     : Number(outcome.critical);
    multiplier=1+(skillCritMultiplier-1)*fraction;
    critMode=outcome.critical?'rolled-crit':'rolled-normal';
   }else{
    const text=(row.notes||[]).join('；');
    const recorded=text.match(/暴击\s*[\d.]+%：([是否])/);
    const cold=/消耗冷血：本次暴击率提高 100%/.test(text);
    const chance=damageCritChance(cfg,id)/100;
    if(id==='mutilate'&&!cold){
     // 两手等权。记录为至少一手暴击时按条件期望计算，而不是整招必暴。
     const any=1-(1-chance)**2;
     const fraction=recorded?(recorded[1]==='是'&&any>0?chance/any:0):chance;
     multiplier=1+(skillCritMultiplier-1)*fraction;
     critMode=recorded?'conditional-expected':'expected';
    }else if(recorded||cold){const crit=cold||(recorded&&recorded[1]==='是');multiplier=crit?skillCritMultiplier:1;critMode=crit?'rolled-crit':'rolled-normal';}
    else{multiplier=1+(skillCritMultiplier-1)*chance;critMode='expected';}
   }
  }
  const damage=amount*multiplier;total+=damage;
  rows.push({index:row.index,time:row.time,directDamage:damage,bleedDamage:0,whiteDamage:0,damage,cumulative:0,critMode});
  if(id==='garrote'||id==='rupture')applications.push({id,index:row.index,time:row.time,cp:Math.max(0,number(row.cpBefore,0))});
 }
 const duration=Math.max(0,number(simulation.time,0));
 const bleedCritRate=(settings.bleedCritSource==='base'?metrics.critRate:maxChance(number(settings.bleedCritRate,defaults.bleedCritRate)))/100;
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
 // 白字从首次成功敌对动作开始计时；消失与脱战停止，下一次敌对动作重新起表。
 // 成功动作截止；同刻白字先于普通动作结算，但在消失/脱战时不结算。
 const whiteEvents=[];
 if(weapon.enabled){
  const self=new Set(['premed','preparation','coldblood','adrenaline','vanish','wait','leave','slice']);
  let nextMain=null,nextOff=null;
  const roll=settings.whiteCritMode==='random';
  const mainDamage=roll?metrics.mainNormal:metrics.mainExpected,offDamage=roll?metrics.offNormal:metrics.offExpected;
  for(const row of simulation.rows){
   if(row.error)break;
   const id=sequence[row.index]?.id;
   if(nextMain!==null){
    const inclusive=id!=='vanish'&&id!=='leave';
    const due=t=>inclusive?t<=row.time+1e-9:t<row.time-1e-9;
    while(due(nextMain)){if(mainDamage>0)whiteEvents.push({time:nextMain,type:'white',hand:'main',id:'mainhand',index:row.index,damage:mainDamage,crit:null});nextMain+=mainSpeed;}
    while(due(nextOff)){if(offDamage>0)whiteEvents.push({time:nextOff,type:'white',hand:'off',id:'offhand',index:row.index,damage:offDamage,crit:null});nextOff+=offSpeed;}
   }
   if(id==='vanish'||id==='leave'||id==='gouge'||id==='blind'){nextMain=null;nextOff=null;}
   else if(nextMain===null&&id&&!self.has(id)){nextMain=row.time+mainSpeed;nextOff=row.time+offSpeed;}
  }
  // 最后动作之后，若仍处于有效控制则继续白字直到控制结束；但停止攻击状态不恢复。
  const last=simulation.rows.filter(r=>!r.error).at(-1);
  const controlEnd=Math.max(0,number(last?.controlEnd,0));
  if(last&&nextMain!==null&&controlEnd>last.time+1e-9){
   while(nextMain<controlEnd-1e-9){if(mainDamage>0)whiteEvents.push({time:nextMain,type:'white',hand:'main',id:'mainhand',index:last.index,damage:mainDamage,crit:null});nextMain+=mainSpeed;}
   while(nextOff<controlEnd-1e-9){if(offDamage>0)whiteEvents.push({time:nextOff,type:'white',hand:'off',id:'offhand',index:last.index,damage:offDamage,crit:null});nextOff+=offSpeed;}
  }
 }
 whiteEvents.sort((a,b)=>a.time-b.time||a.index-b.index);
 if(settings.whiteCritMode==='random'){
  let whiteSeed=((Number(cfg.seed)||1)>>>0)^0xc2b2ae35;
  for(const event of whiteEvents){
   whiteSeed=(Math.imul(whiteSeed,1664525)+1013904223)>>>0;
   event.crit=whiteSeed/4294967296<(event.hand==='main'?metrics.mainCrit:metrics.offCrit)/100;
   if(event.crit)event.damage*=critMultiplier;
  }
 }
 const directEvents=rows.filter(r=>r.directDamage>0).map(r=>({time:r.time,type:'direct',id:sequence[r.index]?.id,index:r.index,damage:r.directDamage,critMode:r.critMode}));
 const order={bleed:0,white:1,direct:2};
 const events=[...bleedEvents,...whiteEvents,...directEvents].sort((a,b)=>a.time-b.time||(order[a.type]-order[b.type])||a.index-b.index);
 let cumulative=0,position=0,whitePosition=0;
 for(const row of rows){
  while(position<bleedEvents.length&&bleedEvents[position].time<=row.time+1e-9)row.bleedDamage+=bleedEvents[position++].damage;
  while(whitePosition<whiteEvents.length&&whiteEvents[whitePosition].time<=row.time+1e-9)row.whiteDamage+=whiteEvents[whitePosition++].damage;
  row.damage=row.directDamage+row.bleedDamage+row.whiteDamage;cumulative+=row.damage;row.cumulative=cumulative;
 }
 const tailDamage=bleedEvents.slice(position).reduce((n,e)=>n+e.damage,0);
 const directTotal=directEvents.reduce((n,e)=>n+e.damage,0),bleedTotal=bleedEvents.reduce((n,e)=>n+e.damage,0);
 const whiteTotal=whiteEvents.reduce((n,e)=>n+e.damage,0);
 const whiteTailDamage=whiteEvents.slice(whitePosition).reduce((n,e)=>n+e.damage,0);
 total=directTotal+bleedTotal+whiteTotal;
 const during=total-tailDamage-whiteTailDamage;
 const endTime=Math.max(duration,events.length?events[events.length-1].time:0);
 let peak={start:0,end:window,damage:0,dps:0},right=0,running=0;
 for(let left=0;left<events.length;){
  const start=events[left].time;
  while(right<events.length&&events[right].time<start+window)running+=events[right++].damage;
  if(running>peak.damage)peak={start,end:start+window,damage:running,dps:running/window};
  while(left<events.length&&events[left].time===start)running-=events[left++].damage;
 }

 return {rows,total,during,tailDamage,whiteTailDamage,directTotal,bleedTotal,whiteTotal,duration,endTime,dps:endTime>0?total/endTime:null,peak,events};
}
if(typeof module!=='undefined')module.exports={damageDefaults,weaponMetrics,calculateDamage};
