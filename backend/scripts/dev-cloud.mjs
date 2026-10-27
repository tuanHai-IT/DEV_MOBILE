import assert from 'node:assert/strict';
import {createLocalCloudContext} from './cloud-context.mjs';
import {createApp} from '../lib/src/app.js';
import {expireOrders} from '../lib/src/marketplace.js';

function reportFailure(error){
  // SDK errors may contain request headers or OAuth credentials. Only print fixed messages.
  const validationMessages=[
    'Invalid local backend port',
    'Remove FIRESTORE_EMULATOR_HOST before starting the cloud database backend',
    'Remove FIREBASE_AUTH_EMULATOR_HOST before starting the cloud database backend',
    'Remove FIREBASE_STORAGE_EMULATOR_HOST before starting the cloud database backend',
    'Use the emulator command for demo projects',
    'Project does not match google-services.json',
    'Spark mode requires Firestore media',
    'Sign in with Firebase CLI before starting the cloud database backend',
  ];
  const messages={
    EADDRINUSE:'Local API port is already in use; choose another PORT or stop the existing server.',
    ENOENT:'Required local configuration is missing; check app/google-services.json.',
    7:'Firebase permission denied; check access to this project for the Firebase CLI account.',
    16:'Firebase authentication failed; sign in with Firebase CLI again.',
    'auth/invalid-credential':'Firebase credentials are invalid; sign in with Firebase CLI again.',
    'auth/insufficient-permission':'Firebase permission denied; check access for the Firebase CLI account.',
  };
  const validation=error?.code==='ERR_ASSERTION'&&validationMessages.find(message=>message===error.message);
  const message=validation||(Object.hasOwn(messages,error?.code)?messages[error.code]:
    'Cloud backend failed; check Firebase CLI sign-in, project access, and local configuration.');
  console.error(message);
  process.exitCode=1;
}

async function main(){
  let ctx,server,timer;
  try{
    const context=await createLocalCloudContext();
    ctx=context.ctx;
    const {projectId}=context;
    const port=Number(process.env.PORT??5002);
    assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'Invalid local backend port');
    process.env.ALLOWED_ORIGINS=[
      'http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:5174','http://localhost:5174',
    ].join(',');
    process.env.ENABLED_PAYMENT_PROVIDERS='';
    process.env.ECOSHARE_LOCAL_CLOUD='true';
    // Verify connectivity without changing the cloud database.
    await ctx.db.listCollections();
    server=createApp(ctx).listen(port,'127.0.0.1');
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.once('listening',()=>{server.off('error',reject);resolve();});
    });
    console.log(`EcoShare Spark API http://127.0.0.1:${port}/v1`);
    console.log(`Firestore cloud: ${projectId}; media: Firestore, max 384 KiB; billing unchanged.`);
    let expiring=false;
    timer=setInterval(async()=>{
      if(expiring)return;expiring=true;
      try{await expireOrders(ctx);}catch{console.error('Order expiry check failed; it will retry on the next interval.');}
      finally{expiring=false;}
    },5*60*1000);
    timer.unref();
    let stopping=false;
    async function stop(){
      if(stopping)return;stopping=true;
      clearInterval(timer);server.close();
      try{await ctx.db.terminate();}catch(error){reportFailure(error);}
    }
    server.on('error',error=>{reportFailure(error);void stop();});
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
  }catch(error){
    clearInterval(timer);server?.close();
    if(ctx)try{await ctx.db.terminate();}catch{console.error('Could not close the cloud database connection.');}
    throw error;
  }
}

main().catch(reportFailure);
