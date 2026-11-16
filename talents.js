// Talent names, maximum ranks, placement and prerequisites: wowhandbook.com, Forever client build 70790.
const talentTrees = [{"name":"奇袭","talents":[{"name":"强化凿击","max":3,"row":1,"col":1,"req":null},{"name":"冷酷攻击","max":2,"row":1,"col":2,"req":null},{"name":"恶意","max":5,"row":1,"col":3,"req":null},{"name":"无情","max":3,"row":2,"col":1,"req":null},{"name":"强化破甲","max":2,"row":2,"col":2,"req":null},{"name":"强化切割","max":3,"row":2,"col":4,"req":null},{"name":"精力","max":2,"row":3,"col":1,"req":null},{"name":"鲜血飞溅","max":1,"row":3,"col":2,"req":null},{"name":"致命偷袭","max":2,"row":3,"col":3,"req":2},{"name":"恶性毒药","max":5,"row":4,"col":1,"req":null},{"name":"冷血","max":1,"row":4,"col":2,"req":null},{"name":"强化毒药","max":5,"row":4,"col":3,"req":null},{"name":"无情打击","max":5,"row":5,"col":1,"req":null},{"name":"毒针","max":1,"row":5,"col":2,"req":null},{"name":"强化肾击","max":2,"row":5,"col":3,"req":null},{"name":"封印命运","max":3,"row":6,"col":3,"req":null},{"name":"毁伤","max":1,"row":7,"col":2,"req":13}]},{"name":"战斗","talents":[{"name":"致命一击","max":3,"row":1,"col":1,"req":null},{"name":"高效打击","max":2,"row":1,"col":2,"req":null},{"name":"闪电反射","max":5,"row":1,"col":3,"req":null},{"name":"穿刺之伤","max":3,"row":2,"col":1,"req":null},{"name":"偏斜","max":3,"row":2,"col":2,"req":null},{"name":"精确","max":3,"row":2,"col":3,"req":null},{"name":"强化疾跑","max":2,"row":2,"col":4,"req":null},{"name":"耐久","max":2,"row":3,"col":1,"req":null},{"name":"还击","max":1,"row":3,"col":2,"req":4},{"name":"沉着","max":2,"row":3,"col":4,"req":null},{"name":"强化脚踢","max":2,"row":4,"col":1,"req":null},{"name":"完美处刑","max":1,"row":4,"col":2,"req":null},{"name":"武器专家","max":2,"row":4,"col":3,"req":5},{"name":"侵略","max":3,"row":4,"col":4,"req":null},{"name":"双武器专精","max":2,"row":5,"col":1,"req":null},{"name":"剑刃乱舞","max":1,"row":5,"col":2,"req":null},{"name":"劈斩","max":5,"row":5,"col":3,"req":null},{"name":"刃光乍现","max":5,"row":6,"col":3,"req":null},{"name":"冲动","max":1,"row":7,"col":2,"req":15}]},{"name":"敏锐","talents":[{"name":"调整","max":3,"row":1,"col":1,"req":null},{"name":"欺诈高手","max":3,"row":1,"col":2,"req":null},{"name":"伺机而动","max":5,"row":1,"col":3,"req":null},{"name":"卑鄙","max":2,"row":2,"col":1,"req":null},{"name":"伪装","max":3,"row":2,"col":2,"req":null},{"name":"强化伏击","max":3,"row":2,"col":3,"req":null},{"name":"邪恶计谋","max":2,"row":2,"col":4,"req":null},{"name":"先发制人","max":3,"row":3,"col":1,"req":null},{"name":"预谋","max":1,"row":3,"col":2,"req":null},{"name":"锯齿利刃","max":3,"row":3,"col":3,"req":null},{"name":"飘忽不定","max":2,"row":4,"col":1,"req":null},{"name":"鬼魅攻击","max":1,"row":4,"col":2,"req":null},{"name":"迅捷脱身","max":2,"row":4,"col":4,"req":6},{"name":"察觉","max":2,"row":5,"col":1,"req":null},{"name":"伺机待发","max":1,"row":5,"col":2,"req":null},{"name":"出血","max":1,"row":5,"col":3,"req":9},{"name":"靴中剑","max":5,"row":6,"col":3,"req":null},{"name":"死亡印记","max":1,"row":7,"col":2,"req":14}]}];
const modeledTalents=new Set(['强化凿击','恶意','致命偷袭','无情','强化破甲','精力','冷血','无情打击','封印命运','毁伤','高效打击','穿刺之伤','劈斩','沉着','完美处刑','刃光乍现','冲动','卑鄙','强化伏击','邪恶计谋','先发制人','预谋','飘忽不定','鬼魅攻击','伺机待发','出血','靴中剑','死亡印记']);
function blankTalents(){return talentTrees.map(t=>t.talents.map(()=>0));}
function validateTalents(a){
 if(!Array.isArray(a)||a.length!==3)return '天赋数据格式不正确';
 let total=0;
 for(let x=0;x<3;x++){let tr=talentTrees[x],r=a[x]; if(!Array.isArray(r)||r.length!==tr.talents.length)return '天赋数据长度不正确';
  for(let i=0;i<r.length;i++){const n=r[i],t=tr.talents[i];if(!Number.isInteger(n)||n<0||n>t.max)return t.name+'的等级无效';total+=n;if(!n)continue;
   const below=r.reduce((s,v,j)=>s+(tr.talents[j].row<t.row?v:0),0);if(below<(t.row-1)*5)return t.name+'需要本系前面层级投入 '+((t.row-1)*5)+' 点';
   if(t.req!==null&&r[t.req]!==tr.talents[t.req].max)return t.name+'需要先点满'+tr.talents[t.req].name;
  }
 }
 return total>51?'总天赋点数不能超过 51 点':'';
}
function totalTalentPoints(build){
 return build.reduce((total,branch)=>total+branch.reduce((sum,rank)=>sum+rank,0),0);
}
function talentPointBudget(level,gift=0){return Math.min(51,Math.max(0,level-(9-gift)));}
function requiredTalentLevel(points,gift=0){return points?9-gift+points:1;}
function serializeTalentBuild(build){
 return build.map(branch=>branch.join('').replace(/0+$/,'')).join('-').replace(/-+$/,'');
}
function readTalentCode(source){
 let code=String(source).trim();
 if(/^https?:\/\//i.test(code)){
  const url=new URL(code);
  const handbook=url.hostname==='wowhandbook.com'&&/\/classes\/rogue\/talents\/?$/.test(url.pathname);
  const simulator=url.hostname==='jamstrak.github.io'&&/^\/rogue-combo-simulator\/?$/.test(url.pathname);
  if(!handbook&&!simulator)throw Error('请输入盗贼天赋模拟器或 WoW Handbook 的加点链接');
  code=url.hash;
 }
 return code.replace(/^#/,'').replace(/^talents\//,'');
}
function parseTalentBuild(code){
 const parts=code.split('-'),build=blankTalents();
 if(parts.length>3||parts.some(part=>!/^[0-5]*$/.test(part)))throw Error('天赋编码无效');
 parts.forEach((part,branch)=>{
  if(part.length>build[branch].length)throw Error('编码长度不正确');
  [...part].forEach((digit,index)=>build[branch][index]=Number(digit));
 });
 const error=validateTalents(build);
 if(error)throw Error(error);
 return build;
}
function parseTalentLink(source){
 const code=readTalentCode(source);
 if(!code)throw Error('请输入盗贼天赋链接或加点编码');
 return parseTalentBuild(code);
}
function parseTalentComparison(source){
 const parts=readTalentCode(source).split('~');
 if(parts.length!==2)throw Error('请输入同时包含 A 与 B 的天赋对比链接');
 return parts.map(parseTalentBuild);
}
function applyTalentConfig(a,c){const ranks={};talentTrees.forEach((tr,x)=>tr.talents.forEach((t,i)=>ranks[t.name]=a[x][i]));const r=n=>ranks[n]||0;
 const before=Number(c.appliedVigor||0), after=r('精力'), wasFull=Number(c.start)>=Number(c.max);c.max=Math.max(1,Number(c.max)+5*(after-before));if(wasFull)c.start=c.max;else c.start=Math.min(c.start,c.max);c.appliedVigor=after;
 Object.assign(c,{reduction:10*r('卑鄙'),composure:5*r('沉着'),exposeRank:r('强化破甲'),ruthlessRank:r('无情'),relentlessRank:r('无情打击'),initiativeRank:r('先发制人'),sealRank:r('封印命运'),bootRank:r('靴中剑'),flashRank:r('刃光乍现'),punctureRank:r('穿刺之伤'),ambushCritRank:r('强化伏击'),efficientRank:r('高效打击'),dirtyTricksRank:r('邪恶计谋'),flawlessReduction:15*r('完美处刑'),mutilate:!!r('毁伤'),adrenaline:!!r('冲动'),coldblood:!!r('冷血'),ghost:!!r('鬼魅攻击'),premedTalent:!!r('预谋'),preparationTalent:!!r('伺机待发'),hemoTalent:!!r('出血'),deathmarkTalent:!!r('死亡印记'),gougeRank:r('强化凿击'),elusivenessRank:r('飘忽不定'),maliceRank:r('恶意'),lethalityRank:r('致命偷袭'),slashRank:r('劈斩'),enforceTalents:true});return c;}
if(typeof module!=='undefined')module.exports={talentTrees,modeledTalents,blankTalents,validateTalents,parseTalentLink,parseTalentComparison,totalTalentPoints,talentPointBudget,requiredTalentLevel,serializeTalentBuild,applyTalentConfig};
