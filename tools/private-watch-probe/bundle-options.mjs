const names=['crypto','dns','events','fs','net','path','stream','string_decoder','tls','util'];
const banner=names.map((n,i)=>"import builtin"+i+" from 'node:"+n+"';").join('\n')+
"\nconst builtins={"+names.map((n,i)=>JSON.stringify(n)+':builtin'+i).join(',')+"};\nconst require=(name)=>{if(Object.hasOwn(builtins,name))return builtins[name];throw Error('Unsupported module');};";
export const bundleOptions={bundle:true,platform:'node',format:'esm',conditions:['workerd'],external:['pg-native','cloudflare:sockets'],banner:{js:banner},logLevel:'silent'};
