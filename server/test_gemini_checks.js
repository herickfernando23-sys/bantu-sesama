(async ()=>{
  const urlBase='http://localhost:4001/api/chatbot/nlp';
  function now(){return Date.now();}
  // Concurrency test
  const concMsgs=Array.from({length:10},(_,i)=>'concurrency test '+(i+1));
  const concPromises=concMsgs.map((m,i)=>{const start=now();return fetch(`${urlBase}?message=${encodeURIComponent(m)}&sessionId=con-${i}`)
    .then(r=>r.json().then(b=>({status:r.status,body:b,time:Date.now()-start}))).catch(e=>({error:e.message,time:Date.now()-start}));});
  const concResults=await Promise.all(concPromises);
  console.log('---CONCURRENCY---');
  concResults.forEach((r,i)=>console.log(i+1, JSON.stringify(r).slice(0,200)));
  // Accuracy test
  const accMsgs=['berapa biaya admin','cara donasi','transparansi','apa metode pembayaran','bagaimana buat kampanye'];
  console.log('---ACCURACY---');
  for(let i=0;i<accMsgs.length;i++){
    const m=accMsgs[i]; const start=now();
    try{
      const res=await fetch(`${urlBase}?message=${encodeURIComponent(m)}&sessionId=acc-${i}`);
      const j=await res.json();
      console.log(m,'| source=',j.source,'| aiModel=',j.aiModel||'N/A','| time=',Date.now()-start);
    }catch(e){
      console.log(m,'| ERROR',e.message);
    }
  }
  const successCount=concResults.filter(r=>r.status===200 && r.body && (r.body.source==='nlp' || r.body.source==='kb')).length;
  console.log('---SUMMARY---');
  console.log('concurrency_requests=',concResults.length,'successful=',successCount);
})();
