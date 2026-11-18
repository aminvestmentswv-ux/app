/** In-memory reference only; production must use the transaction SQL contract. */
export class ReferenceLimiter {
 private counters=new Map<string,{start:number;count:number}>();
 async consume(keys:readonly string[],now:number,windowMs:number,max:number):Promise<boolean>{
  if(!keys.length||!Number.isSafeInteger(now)||now<=0||windowMs<=0||max<=0)return false;
  const unique=[...new Set(keys)].sort();
  const rows=unique.map(key=>{const row=this.counters.get(key);return row&&now>=row.start&&now-row.start<windowMs?row:{start:now,count:0};});
  if(rows.some(row=>row.count>=max))return false;
  unique.forEach((key,i)=>this.counters.set(key,{...rows[i],count:rows[i].count+1}));return true;
 }
}
