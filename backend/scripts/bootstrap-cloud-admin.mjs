import assert from 'node:assert/strict';
import {createLocalCloudContext} from './cloud-context.mjs';

function reportFailure(error){
  // Never print the SDK error object/message: either can contain OAuth request details.
  const validationMessages=[
    'Unknown argument',
    'Specify the exact project from google-services.json',
    'The Firebase CLI owner must have a verified Google email',
    'Another administrator already exists; use the Admin panel',
    'The owner account is disabled',
    'Another administrator was created',
    'Firebase did not return a valid password setup code',
    'Remove FIRESTORE_EMULATOR_HOST before starting the cloud database backend',
    'Remove FIREBASE_AUTH_EMULATOR_HOST before starting the cloud database backend',
    'Remove FIREBASE_STORAGE_EMULATOR_HOST before starting the cloud database backend',
    'Use the emulator command for demo projects',
    'Project does not match google-services.json',
    'Spark mode requires Firestore media',
    'Sign in with Firebase CLI before starting the cloud database backend',
  ];
  const messages={
    ENOENT:'Required local configuration is missing; check app/google-services.json.',
    7:'Firebase permission denied; check access to this project for the Firebase CLI account.',
    16:'Firebase authentication failed; sign in with Firebase CLI again.',
    'auth/invalid-credential':'Firebase credentials are invalid; sign in with Firebase CLI again.',
    'auth/insufficient-permission':'Firebase permission denied; check access for the Firebase CLI account.',
    'auth/email-already-exists':'This email already has an account; rerun to review the existing account.',
  };
  const validation=error?.code==='ERR_ASSERTION'&&validationMessages.find(message=>message===error.message);
  const message=validation||(Object.hasOwn(messages,error?.code)?messages[error.code]:
    'Admin setup failed; check Firebase CLI sign-in, project access, and local configuration.');
  console.error(message);
  process.exitCode=1;
}

async function main(){
 let ctx;
 try{
  const args=process.argv.slice(2);
  const projectArg=args.find(value=>value.startsWith('--project='))?.slice(10);
  assert.ok(args.every(value=>value.startsWith('--project=')||['--apply','--reset-link'].includes(value)),'Unknown argument');
  const context=await createLocalCloudContext();
  ctx=context.ctx;
  const {projectId,ownerEmail,ownerEmailVerified}=context;
  assert.ok(projectArg===projectId,'Specify the exact project from google-services.json');
  assert.ok(ownerEmailVerified,'The Firebase CLI owner must have a verified Google email');
  let user;
  try{user=await ctx.auth.getUserByEmail(ownerEmail);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
  const admins=await ctx.db.collection('users').where('role','==','ADMIN').where('status','==','ACTIVE').limit(2).get();
  assert.ok(admins.empty||admins.docs.every(doc=>doc.id===user?.uid),'Another administrator already exists; use the Admin panel');
  if(!args.includes('--apply')){
    console.log(JSON.stringify({projectId,mode:'DRY_RUN',authAccountExists:!!user,adminExists:!admins.empty}));
  }else{
    user??=await ctx.auth.createUser({email:ownerEmail,emailVerified:true,displayName:'Quản trị viên EcoShare'});
    assert.ok(!user.disabled,'The owner account is disabled');
    await ctx.db.runTransaction(async tx=>{
      const ref=ctx.db.collection('users').doc(user.uid),previous=await tx.get(ref);
      const current=await tx.get(ctx.db.collection('users').where('role','==','ADMIN').where('status','==','ACTIVE').limit(2));
      assert.ok(current.empty||current.docs.every(doc=>doc.id===user.uid),'Another administrator was created');
      if(previous.data()?.role==='ADMIN'&&previous.data()?.status==='ACTIVE')return;
      const now=ctx.now();
      tx.set(ref,{...(previous.exists?{}:{id:user.uid,email:user.email,display_name:user.displayName??'Quản trị viên EcoShare',
        created_at:now,points_balance:0,_verification_id:null,_pending_verification_id:null}),role:'ADMIN',status:'ACTIVE',updated_at:now},{merge:true});
      const audit=ctx.db.collection('audit_logs').doc();
      tx.create(audit,{id:audit.id,actor_id:'bootstrap-admin-cli',action:'BOOTSTRAP_ADMIN',entity_type:'User',entity_id:user.uid,
        reason:'Khởi tạo admin đầu tiên từ tài khoản Google đã xác thực qua Firebase CLI; không xác minh mua bán',created_at:now});
    });
    const result={projectId,adminUid:user.uid,adminCreated:true,tradeVerificationCreated:false};
    if(args.includes('--reset-link')){
      // Generates a link only. No email is sent and no password is read or written here.
      const generatedLink=await ctx.auth.generatePasswordResetLink(ownerEmail);
      const code=new URL(generatedLink).searchParams.get('oobCode');
      assert.ok(typeof code==='string'&&code.length>=8&&code.length<=2048&&!/[\u0000-\u0020]/.test(code),
        'Firebase did not return a valid password setup code');
      const setupLink=new URL('http://127.0.0.1:5173/setup-password.html');
      setupLink.hash=new URLSearchParams({oobCode:code}).toString();
      result.passwordSetupLink=setupLink.href;
    }
    console.log(JSON.stringify(result));
  }
 }finally{
  if(ctx)await ctx.db.terminate();
 }
}

main().catch(reportFailure);
