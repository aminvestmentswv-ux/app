import pg from 'pg';
import {handler} from './probe.mjs';
// Replaced with exact future UTC minute by reviewed deployment driver.
const minute=0; /* PROBE_MINUTE */
export default handler(env=>new pg.Client({
 host:'aws-1-us-east-1.pooler.supabase.com',port:6543,
 user:'property_watch_runtime.dhjgxsphgdmqxiibkiqx',database:'postgres',
 password:env.WATCH_DB_PASSWORD,
 ssl:{rejectUnauthorized:true,servername:'aws-1-us-east-1.pooler.supabase.com'},
 connectionTimeoutMillis:8000,query_timeout:8000,
 application_name:'am-watch-private-readiness'
}),minute,message=>console.log(message));
