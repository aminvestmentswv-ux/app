import {bundleOptions} from './bundle-options.mjs';
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const minute=Number(process.argv[2]??0);
if(!Number.isSafeInteger(minute)||minute<0||minute%60000!==0)throw Error('invalid minute');
const worker=(await readFile('worker.mjs','utf8')).replace('const minute=0; /* PROBE_MINUTE */','const minute='+minute+';');
await writeFile('worker-built-input.mjs',worker);
await build({...bundleOptions,entryPoints:['worker-built-input.mjs'],outfile:'bundle.mjs'});
