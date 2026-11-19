// Never return original error text, stack, properties, SQL, user names or addresses.
const codes=new Map([
 ['28P01','AUTH_REJECTED'],['28000','AUTH_REJECTED'],
 ['42501','PERMISSION'],['3D000','DATABASE_MISSING'],['53300','CAPACITY'],
 ['57P03','UNAVAILABLE'],['57014','TIMEOUT'],
 ['ENOTFOUND','DNS'],['EAI_AGAIN','DNS'],['ECONNREFUSED','REFUSED'],
 ['ETIMEDOUT','TIMEOUT'],['ECONNRESET','RESET'],['EPIPE','RESET'],
 ['ERR_TLS_CERT_ALTNAME_INVALID','TLS_CERT'],['CERT_HAS_EXPIRED','TLS_CERT'],
 ['DEPTH_ZERO_SELF_SIGNED_CERT','TLS_CERT'],['UNABLE_TO_VERIFY_LEAF_SIGNATURE','TLS_CERT'],
 ['ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE','TLS_HANDSHAKE']
]);
export function classify(error){
 try{
  if(codes.has(error?.code))return codes.get(error.code);
  if(error instanceof TypeError)return 'TYPE';
  if(error instanceof ReferenceError)return 'REFERENCE';
  return 'UNKNOWN';
 }catch{return 'UNKNOWN';}
}
