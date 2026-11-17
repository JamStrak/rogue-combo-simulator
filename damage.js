// 这些数字是可修改的相对伤害基准，不是无限服实测技能伤害。
function damageDefaults(){return {values:{ambush:300,ghost:120,hemo:110,mutilate:180,backstab:200,sinister:100,gouge:50,eviscerate:100},critMultiplier:2,burstWindow:5,bleedCritRate:20,bleedCritMode:'expected',weapon:{enabled:false,attackPower:0,mainMin:0,mainMax:0,mainSpeed:2.6,offMin:0,offMax:0,offSpeed:1.8,offhandPenalty:0.5,strikeCoefficient:0.5},bleeds:{garrote:{tickDamage:92,duration:18,interval:3},rupture:{tickDamageBase:35,tickDamagePerCombo:4.73,durationBase:6,durationPerCombo:2,interval:2}}};}
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
 // 单手匕首归一化 1.7 秒，其他单手武器按 2.4 秒；缺省保持原匕首配置。
 const normalized=(min,max,type)=>weaponBase(min,max,type&&type!=='dagger'?2.4:1.7);
 const mainNormalized=normalized(weapon.mainMin,weapon.mainMax,cfg.mainWeaponType),offNormalized=normalized(weapon.offMin,weapon.offMax,cfg.offWeaponType);
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
  if(row.error){rows.push({index:row.index,time:row.time,directDamage:0,bleedDamage:0,whiteDamage:0,damage:0,cumulative:0,critMode:'none'});break;}
  const id=sequence[row.index]?.id;
  let amount=id==='strike'?strikeBase:critSkills.has(id)?Math.max(0,number(values[id],0)):0;
  // 刺骨值按每个消耗的连击点计算；实际值来自该动作执行时的星数。
  const cp=Math.max(0,number(row.cpBefore,0));
  let mainShare=0.5;
  if(settings.skillModel==='weapon'){
   const dagger=!cfg.mainWeaponType||cfg.mainWeaponType==='dagger';
   const weaponAmounts={ambush:2.5*mainNormalized+290,backstab:1.5*mainNormalized+140,sinister:mainNormalized+68,ghost:(dagger?1.8:1.25)*mainNormalized,hemo:(dagger?1.45:1)*mainNormalized,gouge:75,mutilate:0.9*mainNormalized+79+(0.9*offNormalized+79)*offhandPenalty,eviscerate:cp>0?247+151*(cp-1)+ap*0.03*cp:0};
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
 // 出血使目标在 15 秒内受到的绞喉和割裂伤害增加 15%；按跳伤时状态结算。
 // 同时刻流血先于技能落地，刷新前一跳仍使用旧窗口。
 const hemoTimes=simulation.rows.filter(row=>!row.error&&(row.id??sequence[row.index]?.id)==='hemo').map(row=>row.time);
 for(let i=0;i<applications.length;i++){
  const app=applications[i],spec=bleeds[app.id],next=applications.slice(i+1).find(a=>a.id===app.id);
  const interval=Math.max(0.1,number(spec.interval,app.id==='garrote'?3:2));
  const life=Math.min(3600,Math.max(0,app.id==='garrote'?number(spec.duration,18):number(spec.durationBase,6)+number(spec.durationPerCombo,2)*app.cp));
  let base=Math.max(0,app.id==='garrote'?number(spec.tickDamage,92):number(spec.tickDamageBase,35)+number(spec.tickDamagePerCombo,4.73)*app.cp);
  // 可选的社区怀旧公式估算，尚未由无限服实测验证；不修改用户保存的流血基础值。
  if(settings.bleedAttackPower===true){
   const rupturePerTick=[0,0.04/4,0.10/5,0.18/6,0.21/7,0.24/8];
   const stars=Math.max(0,Math.min(5,Math.floor(app.cp)));
   base+=ap*(app.id==='garrote'?0.03:rupturePerTick[stars]);
  }
  const count=Math.floor(life/interval+1e-9);
  for(let j=1;j<=count;j++){
   const time=app.time+j*interval;
   // 同刻跳伤先于重施，旧效果在刷新时刻之后消失。
   if(next&&time>next.time+1e-9)break;
   const enhanced=hemoTimes.some(t=>time>t+1e-9&&time<t+15-1e-9);
   if(base>0)bleedEvents.push({time,type:'bleed',id:app.id,index:app.index,damage:base*(enhanced?1.15:1),crit:null});
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
 // 双手白字按推演中的自动攻击状态分别计时，停手后由下一次成功敌对动作重新起表。
 const whiteEvents=[];
 if(weapon.enabled){
  const self=new Set(['premed','preparation','coldblood','adrenaline','wait','slice','stealth']);
  const timedPause=new Set(['stop','evade']);
  const pauses=new Set(['vanish','leave','gouge','blind',...timedPause]);
  const idOf=row=>row.id??sequence[row.index]?.id;
  const actions=simulation.rows;
  // 停手动作从区间开头生效，也要拦截恰好落在上一行结束时刻的白字。
  const timedPauseTimes=new Set(actions.filter(row=>!row.error&&timedPause.has(idOf(row))).map(row=>row.startTime??row.time));
  let nextMain=null,nextOff=null;
  const roll=settings.whiteCritMode==='random';
  const mainDamage=roll?metrics.mainNormal:metrics.mainExpected,offDamage=roll?metrics.offNormal:metrics.offExpected;
  function addSwingsThrough(time,index,inclusive){
   const due=scheduled=>inclusive?scheduled<=time+1e-9:scheduled<time-1e-9;
   while(due(nextMain)){if(mainDamage>0)whiteEvents.push({time:nextMain,type:'white',hand:'main',id:'mainhand',index,damage:mainDamage,crit:null});nextMain+=mainSpeed;}
   while(due(nextOff)){if(offDamage>0)whiteEvents.push({time:nextOff,type:'white',hand:'off',id:'offhand',index,damage:offDamage,crit:null});nextOff+=offSpeed;}
  }
  for(const row of actions){
   const id=idOf(row);
   const running=nextMain!==null;
   // 失败的技能没有生效，但此前等待公共 CD 或能量的时间已经经过。
   if(row.error){if(running)addSwingsThrough(row.time,row.index,true);break;}
   const active=row.autoAttacking??(!pauses.has(id)&&(running||Boolean(id&&!self.has(id))));
   if(running){
    const pauseTime=row.autoAttackChangedAt??(timedPause.has(id)?row.startTime:undefined);
    const until=active?row.time:pauseTime??row.time;
    const inclusive=!timedPauseTimes.has(until)&&id!=='vanish'&&id!=='leave';
    addSwingsThrough(until,row.index,inclusive);
   }
   if(!active){nextMain=null;nextOff=null;}
   else if(!running){const start=row.autoAttackChangedAt??row.time;nextMain=start+mainSpeed;nextOff=start+offSpeed;}
  }
  const last=actions.at(-1);
  const controlEnd=Math.max(0,number(last?.controlEnd??(last?.error?actions.at(-2)?.controlEnd:0),0));
  // 末步后印记还在时，如果角色仍在自动攻击，应继续到印记结算时刻。
  const markEnd=Math.max(0,...actions.filter(row=>!row.error&&idOf(row)==='deathmark'&&row.cpBefore>0).map(row=>row.time+6));
  const tailEnd=Math.max(controlEnd,markEnd);
  if(last&&nextMain!==null&&tailEnd>last.time+1e-9)addSwingsThrough(tailEnd,last.index,markEnd>=controlEnd&&markEnd>last.time+1e-9);
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
 // 以已模拟的命中构建印记；6 秒到期后单独结算，不追加未建模的攻击。
 const marks=simulation.rows.filter(row=>!row.error&&(row.id??sequence[row.index]?.id)==='deathmark'&&row.cpBefore>0);
 const rank=Math.max(0,Math.min(3,Math.floor(number(cfg.deadlyStrikeRank,0))));
 const talentMultiplier=1+[0,0.07,0.13,0.20][rank];
 // 提前刷新时按新印记覆盖旧印记，覆盖是否触发旧印记需游戏内验证。
 const markWindows=marks.map(mark=>{
  const cp=Math.max(1,Math.min(5,Math.floor(number(mark.cpBefore,0))));
  const cap=([0,165,267,369,471,573][cp]+ap*0.04*cp)*(1+metrics.critRate/100);
  return {index:mark.index,time:mark.time,expiry:mark.time+6,ratio:0.12*cp*talentMultiplier,cap,talentMultiplier};
 });
 const deathmarkEvents=markWindows.filter((mark,i)=>!markWindows[i+1]||markWindows[i+1].time>=mark.expiry-1e-9).map(mark=>{
  const {expiry,ratio,cap}=mark;
  // 同刻已排定的流血/平砍先于施法；到期时它们先结算，技能后结算。
  const eligible=event=>(event.time>mark.time+1e-9||(event.type==='direct'&&Math.abs(event.time-mark.time)<=1e-9&&event.index>mark.index))&&
   (event.time<expiry-1e-9||(event.type!=='direct'&&Math.abs(event.time-expiry)<=1e-9));
  const stored=[...bleedEvents,...whiteEvents,...directEvents].filter(eligible).reduce((sum,event)=>sum+event.damage*(event.type==='bleed'?2:1)*ratio,0);
  // 暴击率对上限的系数为客户端技能公式；致命一击对最终伤害的作用仍需实测。
  return {time:expiry,type:'deathmark',id:'deathmark',name:'死亡印记结算',index:mark.index,damage:Math.min(stored,cap)*talentMultiplier,stored,cap,crit:null};
 });
 const order={bleed:0,white:1,deathmark:2,direct:3};
 const events=[...bleedEvents,...whiteEvents,...deathmarkEvents,...directEvents].sort((a,b)=>a.time-b.time||(order[a.type]-order[b.type])||a.index-b.index);
 let cumulative=0,position=0,whitePosition=0,markPosition=0;
 for(const row of rows){
  while(position<bleedEvents.length&&bleedEvents[position].time<=row.time+1e-9)row.bleedDamage+=bleedEvents[position++].damage;
  while(whitePosition<whiteEvents.length&&whiteEvents[whitePosition].time<=row.time+1e-9)row.whiteDamage+=whiteEvents[whitePosition++].damage;
  row.markDamage=0;
  while(markPosition<deathmarkEvents.length&&deathmarkEvents[markPosition].time<=row.time+1e-9)row.markDamage+=deathmarkEvents[markPosition++].damage;
  row.damage=row.directDamage+row.bleedDamage+row.whiteDamage+row.markDamage;cumulative+=row.damage;row.cumulative=cumulative;
 }
 const tailDamage=bleedEvents.slice(position).reduce((n,e)=>n+e.damage,0);
 const directTotal=directEvents.reduce((n,e)=>n+e.damage,0),bleedTotal=bleedEvents.reduce((n,e)=>n+e.damage,0);
 const whiteTotal=whiteEvents.reduce((n,e)=>n+e.damage,0);
 const whiteTailDamage=whiteEvents.slice(whitePosition).reduce((n,e)=>n+e.damage,0);
 const markTotal=deathmarkEvents.reduce((n,e)=>n+e.damage,0);
 const markTailDamage=deathmarkEvents.slice(markPosition).reduce((n,e)=>n+e.damage,0);
 total=directTotal+bleedTotal+whiteTotal+markTotal;
 const during=total-tailDamage-whiteTailDamage-markTailDamage;
 const endTime=Math.max(duration,events.length?events[events.length-1].time:0);
 let peak={start:0,end:window,damage:0,dps:0},right=0,running=0;
 for(let left=0;left<events.length;){
  const start=events[left].time;
  while(right<events.length&&events[right].time<start+window)running+=events[right++].damage;
  if(running>peak.damage)peak={start,end:start+window,damage:running,dps:running/window};
  while(left<events.length&&events[left].time===start)running-=events[left++].damage;
 }

 return {rows,total,during,tailDamage,whiteTailDamage,markTailDamage,markTotal,directTotal,bleedTotal,whiteTotal,duration,endTime,dps:endTime>0?total/endTime:null,peak,events,markWindows};
}
if(typeof module!=='undefined')module.exports={damageDefaults,weaponMetrics,calculateDamage};
