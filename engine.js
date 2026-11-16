const skills = {
 premed:{name:'预谋', cost:0, gain:0, cp:2, cc:0, cd:120, self:true},
 preparation:{name:'伺机待发', cost:0, gain:0, cp:0, cc:0, cd:600, self:true},
 deathmark:{name:'死亡印记', cost:25, gain:0, cp:0, cc:0, cd:10, finish:true},
 cheap:{name:'偷袭', cost:60, gain:0, cp:2, cc:4, type:'stun', dr:'stun', cd:0, stealth:true},
 strike:{name:'刺击', cost:5, gain:25, cp:0, cc:0, cd:10, breaks:true},
 ghost:{name:'鬼魅攻击', cost:40, gain:0, cp:1, cc:0, cd:20, talent:true, breaks:true},
 ambush:{name:'伏击', cost:60, gain:0, cp:1, cc:0, cd:0, stealth:true, breaks:true},
 hemo:{name:'出血', cost:35, gain:0, cp:1, cc:0, cd:0, breaks:true},
 mutilate:{name:'毁伤', cost:60, gain:0, cp:2, cc:0, cd:0, talent:true, breaks:true},
 coldblood:{name:'冷血', cost:0, gain:0, cp:0, cc:0, cd:180, self:true},
 adrenaline:{name:'冲动', cost:0, gain:0, cp:0, cc:0, cd:300, self:true},
 backstab:{name:'背刺', cost:60, gain:0, cp:1, cc:0, cd:0, breaks:true},
 sinister:{name:'邪恶攻击', cost:45, gain:0, cp:1, cc:0, cd:0, breaks:true},
 gouge:{name:'凿击', cost:45, gain:0, cp:1, cc:4, type:'incap', dr:'incap', cd:10, breaks:true},
 kidney:{name:'肾击', cost:25, gain:0, cp:0, cc:0, type:'stun', dr:'stun', cd:20, finish:true},
 expose:{name:'破甲', cost:25, gain:0, cp:0, cc:0, cd:0, finish:true},
 eviscerate:{name:'刺骨', cost:35, gain:0, cp:0, cc:0, cd:0, finish:true, breaks:true},
 rupture:{name:'割裂', cost:25, gain:0, cp:0, cc:0, cd:0, finish:true, breaks:true},
 slice:{name:'切割', cost:25, gain:0, cp:0, cc:0, cd:0, finish:true},
 blind:{name:'致盲', cost:30, gain:0, cp:0, cc:10, type:'incap', dr:'blind', cd:300},
 garrote:{name:'绞喉', cost:50, gain:0, cp:1, cc:0, cd:0, stealth:true, breaks:true},
 vanish:{name:'消失', cost:0, gain:0, cp:0, cc:0, cd:300, vanish:true},
 wait:{name:'等待', cost:0, gain:0, cp:0, cc:0, cd:0, wait:true},
 leave:{name:'确认脱战', cost:0, gain:0, cp:0, cc:0, cd:0, leave:true}
};
function skillCost(id, cfg, book, energy, inCombat) {
 const base=Number(book[id].cost);
 const talent=(id==='cheap'||id==='garrote')?Number(cfg.reduction||0):id==='expose'?5*Number(cfg.exposeRank||0):(['sinister','hemo'].includes(id)?[0,3,5][Number(cfg.efficientRank||0)]:id==='eviscerate'?Number(cfg.flawlessReduction||0):id==='blind'?base*0.25*Number(cfg.dirtyTricksRank||0):0);
 const poised=!!cfg.prepared&&!inCombat&&energy+1e-8>=cfg.max&&base>0;
 const passive=poised?10+Number(cfg.composure||0):0;
 return {base,talent,passive,cost:Math.max(0,base-talent-passive)};
}
const damageCritSkills=new Set(['ambush','ghost','hemo','mutilate','backstab','sinister','gouge','eviscerate','strike']);
const sealFateSkills=new Set(['ambush','ghost','hemo','mutilate','backstab','sinister','gouge']);
function meleeCritChance(cfg,id,hand=id==='strike'?'off':'main'){
 const weapon=(hand==='off'?cfg.offWeaponType:cfg.mainWeaponType)||'dagger';
 const weaponBonus=id!=='bleed'&&['dagger','fist'].includes(weapon)?Number(cfg.slashRank)||0:0;
 const talentBonus={ambush:15*(Number(cfg.ambushCritRank)||0),backstab:10*(Number(cfg.punctureRank)||0),mutilate:5*(Number(cfg.punctureRank)||0)}[id]||0;
 return Math.max(0,Math.min(100,(Number(cfg.crit)||0)+(Number(cfg.maliceRank)||0)+weaponBonus+talentBonus));
}
function simulate(sequence, cfg, book=skills, options={}) {
 const max=cfg.max, regen=cfg.regen, gcd=cfg.gcd;
 let seed=(Number(cfg.seed)||1)>>>0;
 // 纯伤害暴击独立掷骰，避免改变原本的能量、连击点及控制分支。
 let damageSeed=seed^0x5bd1e995;
 const damageRandom=()=>{damageSeed=(Math.imul(damageSeed,1664525)+1013904223)>>>0;return damageSeed/4294967296;};
 const rollDamage=chance=>chance>=100||(chance>0&&damageRandom()<chance/100);
 const roll=(chance,mode,label)=>{chance=Math.max(0,Math.min(100,chance));if(chance<=0)return false;if(chance>=100)return true;if(options.roll)return options.roll(chance,mode,label);if(mode==='yes')return true;if(mode==='no')return false;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296<chance/100;};
 let premedPending=0, premedUntil=0, coldBloodActive=false, adrenalineUntil=0, t=0, energy=Math.min(cfg.start,max), cp=0, ready=0, controlEnd=0, controlType='', stealth=cfg.startStealth!==false, inCombat=!!cfg.startCombat, ghostUntil=-1, cooldowns={}, dr={}, activeDr='', rows=[], gap=0, controlled=0, totalEnergyWait=0, controlBroken=false, lastAction=null, stopped=false, gapReasons=[];
 const addEnergy = (dt)=>{ const before=energy; energy=Math.min(max,energy+regen*dt+regen*Math.max(0,Math.min(t+dt,adrenalineUntil)-t)); return energy-before; };
 const advance = (target,phase)=>{const d=Math.max(0,target-t); if(lastAction!==null){const uncovered=Math.max(0,target-Math.max(t,controlEnd)); gap+=uncovered;controlled+=d-uncovered;if(uncovered>1e-8)gapReasons.push({duration:uncovered,cause:controlBroken?'控制被伤害提前打破':controlEnd<=0?'此前没有有效控制':'控制已结束',phase});} let gained=addEnergy(d); t=target; if(premedPending&&t>=premedUntil){cp=Math.max(0,cp-premedPending);premedPending=0;} return gained;};
 const gapNote=()=>gapReasons.map(x=>`控制空档 ${fmt(x.duration)} 秒（${x.cause}，${x.phase}）`);
 for(let i=0;i<sequence.length;i++){
  const entry=sequence[i], s=book[entry.id]; if(!s){stopped=true;break;} const startGap=gap; gapReasons=[]; let energyWait=0, energyShortage=false;
  if(s.wait){ const d=Math.max(0,Number(entry.wait)||0), before=energy; advance(t+d,'主动等待期间'); rows.push({index:i,name:s.name,time:t,before,after:energy,cp,controlEnd,gap,notes:[`等待 ${d} 秒`,...gapNote()],wait:true,controlGap:gap-startGap,gapReasons}); continue; }
  if(s.leave){inCombat=false;rows.push({index:i,name:s.name,time:t,before:energy,after:energy,cp,controlEnd,gap,notes:['手动假设已脱战；并不保证游戏内可以脱战'],wait:true});continue;}
  let planned=entry.offGcd?t:Math.max(t,ready), since=energy; let recovered=advance(planned,'等待公共冷却期间');
  let costInfo=skillCost(entry.id,cfg,book,energy,inCombat), cost=costInfo.cost;
  const errors=[],notes=[];
  if(energy+1e-8<cost){ energyShortage=true;
   const fullCost=skillCost(entry.id,cfg,book,max,inCombat).cost;
   if(cfg.autoWait && regen>0 && fullCost<=max){const target=cost<=max?cost:max;const needed=target-energy, boostedWindow=Math.max(0,adrenalineUntil-t), boostedGain=2*regen*boostedWindow;const delay=needed<=boostedGain?needed/(2*regen):boostedWindow+(needed-boostedGain)/regen;energyWait=delay;totalEnergyWait+=delay;recovered+=advance(t+delay,'能量不足，等待回能期间');costInfo=skillCost(entry.id,cfg,book,energy,inCombat);cost=costInfo.cost;notes.push(`能量不足，等待 ${fmt(delay)} 秒`);} else errors.push(`能量不足：需要 ${fmt(cost)}，当前 ${fmt(energy)}`);
  }
  if((cooldowns[entry.id]||0)>t+1e-8) errors.push(`冷却中，还需 ${fmt(cooldowns[entry.id]-t)} 秒`);
  if(s.finish && cp<1) errors.push('需要至少 1 个连击点');
  if(s.stealth && !stealth && !(t<ghostUntil && (entry.id==='ambush'||entry.id==='garrote'))) errors.push('需要潜行或鬼魅攻击的有效窗口');
  if(cfg.enforceTalents && entry.id==='premed'&&!cfg.premedTalent) errors.push('需要预谋天赋');
  if(cfg.enforceTalents && entry.id==='preparation'&&!cfg.preparationTalent) errors.push('需要伺机待发天赋');
  if(cfg.enforceTalents && entry.id==='hemo'&&!cfg.hemoTalent) errors.push('需要出血天赋');
  if(cfg.enforceTalents && entry.id==='deathmark'&&!cfg.deathmarkTalent) errors.push('需要死亡印记天赋');
  if(entry.id==='ghost'&&!cfg.ghost) errors.push('需要鬼魅攻击天赋');
  if(entry.id==='mutilate'&&!cfg.mutilate) errors.push('需要毁伤天赋');
  if(entry.id==='adrenaline'&&!cfg.adrenaline) errors.push('需要冲动天赋');
  if(entry.id==='coldblood'&&!cfg.coldblood) errors.push('需要冷血天赋');
  if(errors.length){rows.push({index:i,name:s.name,time:t,before:energy,after:energy,cp,controlEnd,gap,notes:[...errors,...gapNote()],error:true,energyShortage,energyWait,controlGap:gap-startGap,gapReasons}); stopped=true;break;}
  const before=energy, oldCp=cp, previousEnd=controlEnd;
  let comboOverflow=0;const addCombo=amount=>{const total=cp+amount;comboOverflow+=Math.max(0,total-5);cp=Math.min(5,total);};
  if(s.breaks && controlType==='incap' && t<controlEnd){notes.push('伤害可能提前打破当前控制'); if(activeDr && dr[activeDr]) dr[activeDr].resetAt=t+cfg.drReset; controlEnd=t;controlBroken=true;}
  const gain=Number(s.gain)+(entry.id==='strike'?3*Number(cfg.flashRank||0):0);
  energy=Math.min(max,energy-cost+gain);
  if(s.finish) cp=0; else addCombo(Number(s.cp));
  const initiative=cfg.initiativeRank===undefined?(cfg.premeditation?3:0):Number(cfg.initiativeRank);
  if(['cheap','ambush','garrote'].includes(entry.id)&&initiative){const chance=[0,33,67,100][initiative];const hit=roll(chance,'random','先发制人');if(hit)addCombo(1);notes.push(`先发制人 ${chance}%：${hit?'触发 +1 星':'未触发'}`);}
  if(entry.id==='strike'&&cfg.bootRank){const chance=20*Number(cfg.bootRank);const hit=roll(chance,'random','靴中剑');if(hit)addCombo(2);notes.push(`靴中剑 ${chance}%：${hit?'触发 +2 星':'未触发'}`);}
  if(entry.id==='backstab'&&cfg.punctureRank){const chance=15*Number(cfg.punctureRank);const hit=roll(chance,'random','穿刺之伤');if(hit)addCombo(1);notes.push(`穿刺之伤 ${chance}%：${hit?'触发 +1 星':'未触发'}`);}
  const usesColdBlood=coldBloodActive&&['sinister','backstab','ambush','eviscerate','mutilate'].includes(entry.id);
  const sealRank=Number(cfg.sealRank)||0;
  const affectsSealFate=sealRank>0&&sealFateSkills.has(entry.id);
  let critOutcome=null;
  if(damageCritSkills.has(entry.id)&&(options.damageCrits!==false||affectsSealFate)){
   const bothHands=entry.id==='mutilate',offHandOnly=entry.id==='strike';
   const mainChance=offHandOnly?null:usesColdBlood?100:meleeCritChance(cfg,entry.id,'main');
   const offChance=bothHands||offHandOnly?(usesColdBlood?100:meleeCritChance(cfg,entry.id,'off')):null;
   const doubleChance=bothHands?mainChance*offChance/100:0;
   const chance=bothHands?100-(100-mainChance)*(100-offChance)/100:(mainChance??offChance);
   const critical=affectsSealFate?roll(chance,'random','暴击'):rollDamage(chance);
   if(options.damageCrits!==false){
    // 毁伤先判至少一手暴击，再按双手的独立概率确定是哪一手。
    // 封印命运只关心前一项，因此概率分析不为单手/双手伤害另开分支。
    const handRoll=bothHands&&critical?damageRandom()*chance:0;
    const main=mainChance===null?null:critical&&(!bothHands||handRoll<mainChance);
    const off=offChance===null?null:critical&&(!bothHands||handRoll<doubleChance||handRoll>=mainChance);
    critOutcome={chance,critical,mainChance,offChance,main,off};
   }
   const sealChance=[0,33,66,100][sealRank];
   const sealHit=affectsSealFate&&critical&&roll(sealChance,'random','封印命运');
   if(sealHit)addCombo(1);
   const sealNote=affectsSealFate?`；封印命运${sealHit?'触发 +1 星':'未触发'}`:'';
   notes.push(`暴击 ${fmt(chance)}%：${critical?'是':'否'}${sealNote}`);
  }
  if(usesColdBlood){coldBloodActive=false;notes.push('消耗冷血：本次暴击率提高 100%');}
  if(entry.id==='coldblood'){coldBloodActive=true;notes.push('冷血：下一次符合条件的技能暴击率提高 100%');}
  if(entry.id==='adrenaline'){adrenalineUntil=t+15;notes.push('冲动：15 秒内自然回能翻倍');}
  if(entry.id==='premed'){premedPending=cp-oldCp;premedUntil=t+20;notes.push('预谋连击点在 20 秒内未继续获得连击点或使用终结技会消失');}
  else if(premedPending&&(s.finish||cp>oldCp)){premedPending=0;notes.push('预谋连击点已固定');}
  if(entry.id==='preparation'){cooldowns={};notes.push('重置其他技能冷却');}
  if(s.finish){
   if(entry.id==='expose'&&oldCp===5&&cfg.exposeRank){addCombo(Number(cfg.exposeRank));notes.push(`强化破甲：5 星返还 ${cfg.exposeRank} 星`);}
   const rp=20*Number(cfg.ruthlessRank||0);
   if(rp){const hit=roll(rp,cfg.ruthlessMode,'无情');if(hit)addCombo(1);notes.push(`无情 ${rp}%：${hit?'触发 +1 星':'未触发'}${cfg.ruthlessMode==='yes'?'（假设触发）':cfg.ruthlessMode==='no'?'（假设未触发）':''}`);}
   const ep=Math.min(100,4*Number(cfg.relentlessRank||0)*oldCp);
   if(ep){const hit=roll(ep,cfg.relentlessMode,'无情打击');const gained=hit?Math.min(25,max-energy):0;energy+=gained;notes.push(`无情打击 ${ep}%：${hit?`触发，实际回能 ${fmt(gained)}`:'未触发'}${ep===100?'（必定触发）':cfg.relentlessMode==='yes'?'（假设触发）':cfg.relentlessMode==='no'?'（假设未触发）':''}`);}
  }
  if(s.cc || s.finish){let duration=s.finish?oldCp+1:Number(s.cc)+(entry.id==='gouge'?0.5*Number(cfg.gougeRank||0):0); if(s.type){
   if(cfg.dr && s.dr){let state=dr[s.dr]||{count:0,resetAt:0}; if(t>=state.resetAt && !(activeDr===s.dr && t<controlEnd)) state.count=0; let factor=[1,cfg.drSecond/100,cfg.drThird/100,0][Math.min(3,state.count)]; duration*=factor; state.count++; dr[s.dr]=state; notes.push(`递减 ${fmt(factor*100)}%（${({stun:'昏迷组',incap:'瘫痪组',blind:'致盲组'})[s.dr]||s.dr}）`);}
   if(duration>0){if(t<controlEnd){notes.push(`覆盖剩余 ${fmt(controlEnd-t)} 秒控制`); if(activeDr && dr[activeDr] && activeDr!==s.dr)dr[activeDr].resetAt=t+cfg.drReset;} controlEnd=t+duration;controlBroken=false;controlType=s.type; activeDr=s.dr||''; if(cfg.dr && activeDr)dr[activeDr].resetAt=controlEnd+cfg.drReset; notes.push(`控制 ${fmt(duration)} 秒`);} else notes.push('控制免疫，未覆盖原有控制');
  }}
  if(s.vanish) stealth=true; else if(!s.self&&entry.id!=='wait') {if(s.stealth && t<ghostUntil) ghostUntil=-1; stealth=false;}
  if(entry.id==='ghost') ghostUntil=t+7;
  if(comboOverflow)notes.push(`连击点溢出 ${comboOverflow} 点（超过 5 点上限）`);
  if(gain) notes.push(`技能恢复 ${gain} 能量`);
  if(['cheap','ambush','garrote','expose'].includes(entry.id)||costInfo.passive) notes.push(`消耗 ${fmt(costInfo.base)}${costInfo.talent?` − ${entry.id==='expose'?'强化破甲':['cheap','garrote'].includes(entry.id)?'卑鄙':'天赋'} ${fmt(costInfo.talent)}`:''}${costInfo.passive?` − 蓄势待发 ${fmt(costInfo.passive)}`:''} = ${fmt(cost)}`);
  if(['cheap','ambush','garrote'].includes(entry.id)&&!costInfo.passive)notes.push(`蓄势待发未生效（${!cfg.prepared?'未启用':inCombat?'战斗中':'能量未满'}）`);
  if(recovered>0)notes.push(`等待回能 ${fmt(recovered)}`);
  notes.push(...gapNote());
  cooldowns[entry.id]=t+Math.max(0,Number(s.cd)-(entry.id==='strike'?0.4*Number(cfg.flashRank||0):['vanish','blind'].includes(entry.id)?45*Number(cfg.elusivenessRank||0):0)); if(!entry.offGcd)ready=t+gcd; if(!s.self)lastAction=t; if(!s.vanish&&!s.self)inCombat=true;
  rows.push({index:i,name:s.name,time:t,before,after:energy,cp,cpBefore:oldCp,controlEnd,gap,notes,cost,comboOverflow,energyShortage,energyWait,controlGap:gap-startGap,gapReasons,critOutcome});
 }
 return {rows,stopped,gap,controlled:controlled+Math.max(0,controlEnd-t),energyWait:totalEnergyWait,time:t,energy,cp,controlEnd};
}
function fmt(n){return (Math.round(n*100)/100).toString();}
if(typeof module!=='undefined')module.exports={skills,simulate,fmt,skillCost,meleeCritChance};
