import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const minute=Number(process.argv[2]??0);
if(!Number.isSafeInteger(minute)||minute<0||minute%60000!==0)throw Error('invalid minute');
const worker=(await readFile('worker.mjs','utf8')).replace('const minute=0; /* PROBE_MINUTE */','const minute='+minute+';');
await writeFile('worker-built-input.mjs',worker);
const names=['crypto','dns','events','fs','net','path','stream','string_decoder','tls','util'];
const banner=names.map((n,i)=>"import builtin"+i+" from 'node:"+n+"';").join('\n')+
"\nconst builtins={"+names.map((n,i)=>JSON.stringify(n)+':builtin'+i).join(',')+"};\nconst require=(name)=>{if(Object.hasOwn(builtins,name))return builtins[name];throw Error('Unsupported module');};";
await build({entryPoints:['worker-built-input.mjs'],bundle:true,platform:'node',format:'esm',external:['pg-native'],banner:{js:banner},outfile:'bundle.mjs',logLevel:'silent'});
