import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {initializeApp, getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {Firestore} from 'firebase-admin/firestore';
import {GoogleAuth} from 'google-auth-library';

const require=createRequire(import.meta.url);
const workspace=fileURLToPath(new URL('../../',import.meta.url));

/** Development only: use the already authorized Firebase CLI account, in memory. */
export async function createLocalCloudContext(){
  for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']){
    assert.ok(!process.env[name],`Remove ${name} before starting the cloud database backend`);
  }
  const config=JSON.parse(await readFile(new URL('../../app/google-services.json',import.meta.url),'utf8'));
  const projectId=config.project_info?.project_id;
  assert.match(projectId??'',/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
  assert.ok(!projectId.startsWith('demo-'),'Use the emulator command for demo projects');
  assert.ok(!process.env.GCLOUD_PROJECT||process.env.GCLOUD_PROJECT===projectId,'Project does not match google-services.json');
  assert.ok(!process.env.ECOSHARE_MEDIA_BACKEND||process.env.ECOSHARE_MEDIA_BACKEND==='firestore','Spark mode requires Firestore media');
  process.env.GCLOUD_PROJECT=projectId;
  process.env.ECOSHARE_MEDIA_BACKEND='firestore';
  const {logger}=require('firebase-tools/lib/logger.js');logger.silent=true;
  const cliAuth=require('firebase-tools/lib/auth.js');
  const cliApi=require('firebase-tools/lib/api.js');
  const cliHttp=require('firebase-tools/lib/apiv2.js');
  const account=cliAuth.getProjectDefaultAccount(workspace)??cliAuth.getGlobalDefaultAccount();
  assert.ok(account?.tokens?.refresh_token,'Sign in with Firebase CLI before starting the cloud database backend');
  const options={project:projectId,nonInteractive:true};
  cliAuth.setActiveAccount(options,account);
  await require('firebase-tools/lib/requireAuth.js').requireAuth(options);
  const googleAuth=new GoogleAuth({projectId,scopes:['https://www.googleapis.com/auth/cloud-platform'],credentials:{
    type:'authorized_user',client_id:cliApi.clientId(),client_secret:cliApi.clientSecret(),refresh_token:account.tokens.refresh_token,
  }});
  const credential={getAccessToken:async()=>({access_token:await cliHttp.getAccessToken(),expires_in:300})};
  const appName='ecoshare-local-cloud';
  const app=getApps().find(item=>item.name===appName)??initializeApp({projectId,credential},appName);
  const db=new Firestore({projectId,preferRest:true,auth:googleAuth});
  const bucket=new Proxy({name:config.project_info.storage_bucket??`${projectId}.firebasestorage.app`},{
    get(target,key){if(key==='name')return target.name;throw new Error('Cloud Storage is disabled in Spark mode');},
  });
  const ctx={db,auth:getAuth(app),bucket,
    emulator:false,now:()=>new Date().toISOString()};
  return {ctx,projectId,ownerEmail:account.user.email,ownerEmailVerified:account.user.email_verified===true};
}
