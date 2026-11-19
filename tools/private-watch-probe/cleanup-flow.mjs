// Cleanup responsibilities must remain independent, including on read failures.
export async function cleanupFlow(restore,closeTail,finish){
 let failed=false;
 try{await restore();}catch{failed=true;}
 finally{try{await closeTail();}catch{failed=true;}}
 if(failed)throw Error('cleanup unverified');
 await finish();
}
