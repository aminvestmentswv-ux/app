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
// Exact static messages from installed pg sources and official provider docs.
// Never use substring extraction, interpolation, stack inspection or original text output.
const messages=new Map([
 ['Tenant or user not found','POOLER_ROUTING'],
 ['SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string','CREDENTIAL_FORMAT'],
 ['SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string','CREDENTIAL_FORMAT'],
 ['Password must be a string','CREDENTIAL_FORMAT'],
 ['SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate','SASL_MECHANISM'],
 ['SASL: Only mechanism(s) SCRAM-SHA-256 are supported','SASL_MECHANISM'],
 ['SASL: Only mechanism(s) SCRAM-SHA-256-PLUS and SCRAM-SHA-256 are supported','SASL_MECHANISM'],
 ['SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match','SASL_INTEGRITY'],
 ['Connection terminated','CONNECTION_CLOSED'],
 ['Connection terminated unexpectedly','CONNECTION_CLOSED'],
 ['timeout expired','TIMEOUT'],['Query read timeout','TIMEOUT'],
 ['The server does not support SSL connections','TLS_UNSUPPORTED'],
 ['There was an error establishing an SSL connection','TLS_HANDSHAKE'],
 ['startTls() is not supported on this connection.','TLS_UNSUPPORTED'],
 ['The connection was closed before startTls completed.','CONNECTION_CLOSED'],
 ['The connection was closed before startTls could be started.','CONNECTION_CLOSED']
]);
export function classify(error){
 try{
  if(codes.has(error?.code))return codes.get(error.code);
  if(messages.has(error?.message))return messages.get(error.message);
  if(error instanceof TypeError)return 'TYPE';
  if(error instanceof ReferenceError)return 'REFERENCE';
  return 'UNKNOWN';
 }catch{return 'UNKNOWN';}
}
