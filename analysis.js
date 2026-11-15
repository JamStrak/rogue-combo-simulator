const simulateModel = typeof module !== 'undefined' ? require('./engine').simulate : simulate;
// 对已配置的单条技能队列枚举概率分支，分支过多时明确降级为抽样估计。
function analyzeProbability(sequence,cfg,book,options={}) {
 const maxLeaves=options.maxLeaves??4096, samples=options.samples??5000, tolerance=Math.max(0,Number(cfg.gapTolerance)||0);
 const settings={...cfg,ruthlessMode:'random',relentlessMode:'random'};
 const createStats=()=>({total:0,success:0,complete:0,energy:0,gap:0,blocked:0,energySteps:{},gapSteps:{},blockedSteps:{},sumEnergy:0,minEnergy:Infinity,maxEnergy:-Infinity,finalPoints:{},leaves:0});
 let stats=createStats(), calls=0;
 const add=(obj,index,weight)=>{obj[index]=(obj[index]||0)+weight;};
 function collect(result,weight){
  stats.total+=weight;stats.leaves++;stats.sumEnergy+=weight*result.energy;stats.minEnergy=Math.min(stats.minEnergy,result.energy);stats.maxEnergy=Math.max(stats.maxEnergy,result.energy);add(stats.finalPoints,result.cp,weight);
  if(!result.stopped)stats.complete+=weight;else stats.blocked+=weight;
  let shortage=result.rows.find(row=>row.energyShortage);
  let totalGap=0,gapRow=null;
  for(const row of result.rows){totalGap+=row.controlGap||0;if(!gapRow&&totalGap>tolerance+1e-8)gapRow=row;}
  if(shortage)stats.energy+=weight;
  for(const row of result.rows){if(row.energyShortage)add(stats.energySteps,row.index,weight);if((row.controlGap||0)>1e-8)add(stats.gapSteps,row.index,weight);}
  if(gapRow)stats.gap+=weight;
  if(result.stopped&&result.rows.length)add(stats.blockedSteps,result.rows.at(-1).index,weight);
  if(!result.stopped&&!shortage&&!gapRow)stats.success+=weight;
 }
 const tooMany={};
 function explore(path,weight){
  if(++calls>maxLeaves*16||stats.leaves>=maxLeaves)throw tooMany;
  let pos=0;
  try {const result=simulateModel(sequence,settings,book,{roll(chance,mode,label){if(pos<path.length)return path[pos++];throw {branch:true,chance,label};}});collect(result,weight);}
  catch(e){if(!e.branch)throw e;let p=e.chance/100;explore([...path,true],weight*p);explore([...path,false],weight*(1-p));}
 }
 try{explore([],1);stats.method='exact';}
 catch(e){
  if(e!==tooMany)throw e;
  stats=createStats();let seed=(Number(cfg.seed)||1)>>>0;
  for(let i=0;i<samples;i++){
   const result=simulateModel(sequence,settings,book,{roll(chance){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296<chance/100;}});
   collect(result,1/samples);
  }
  stats.method='sample';stats.samples=samples;
 }
 return stats;
}
if(typeof module!=='undefined')module.exports={analyzeProbability};
