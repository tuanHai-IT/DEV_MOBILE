/**
 * Create-only cloud samples for the real, already bootstrapped CLI owner.
 * Default: read-only dry run. Never creates Auth users, KYC, orders or payments.
 * node backend/scripts/seed-cloud.mjs --project PROJECT --owner-uid UID [--apply]
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLocalCloudContext} from './cloud-context.mjs';

const MAX_IMAGE_BYTES=384*1024;
const SEED_MARKER='ecoshare-cloud-community-v1';
class SeedError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
function check(condition,code,message){if(!condition)throw new SeedError(code,message);}
function options(args){
  const result={apply:false};
  for(let i=0;i<args.length;i++){
    const argument=args[i];
    if(argument==='--help')return {help:true};
    if(argument==='--apply'){
      check(!result.apply,'DUPLICATE_ARGUMENT','Chỉ dùng --apply một lần.');result.apply=true;continue;
    }
    const match=/^--(project|owner-uid)(?:=(.*))?$/.exec(argument);
    check(match,'INVALID_ARGUMENT','Chỉ nhận --project, --owner-uid và --apply.');
    const key=match[1]==='project'?'project':'ownerUid';
    check(!Object.hasOwn(result,key),'DUPLICATE_ARGUMENT','Tham số bị lặp.');
    const value=match[2]??args[++i];
    check(typeof value==='string'&&value.length>0&&!value.startsWith('--'),'VALUE_REQUIRED','Cần project và UID thật.');
    result[key]=value;
  }
  check(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(result.project??'')&&!result.project.startsWith('demo-'),
    'PROJECT_REQUIRED','Đặt --project bằng project thật trong google-services.json.');
  check(/^[A-Za-z0-9_-]{1,128}$/.test(result.ownerUid??''),'OWNER_UID_REQUIRED','Đặt --owner-uid bằng UID Auth của chính chủ Admin.');
  return result;
}
const email=value=>String(value??'').trim().toLowerCase();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function marker(project,ownerUid){
  return {_seed_marker:SEED_MARKER,_seed_project_id:project,_seed_owner_uid:ownerUid};
}
function owned(row,project,ownerUid){
  return row?._seed_marker===SEED_MARKER&&row?._seed_project_id===project&&row?._seed_owner_uid===ownerUid;
}
function validateOwner(snapshot,ownerUid,ownerEmail){
  const row=snapshot.data();
  check(snapshot.exists&&snapshot.id===ownerUid&&row.role==='ADMIN'&&row.status==='ACTIVE',
    'ACTIVE_ADMIN_REQUIRED','UID phải có hồ sơ ADMIN/ACTIVE đã được bootstrap.');
  check(email(row.email)===email(ownerEmail),'PROFILE_OWNER_MISMATCH','Email hồ sơ Admin không khớp chủ tài khoản CLI.');
}
function validateExisting(snapshots,project,ownerUid){
  for(const row of snapshots)if(row.exists){
    check(owned(row.data(),project,ownerUid),'SAMPLE_ID_COLLISION',`Dừng vì ID không thuộc bộ mẫu này: ${row.ref.path}`);
    check(row.data().id===row.id,'INVALID_SAMPLE_ID',`ID trong bản ghi không khớp: ${row.ref.path}`);
  }
}
async function plan(project,ownerUid,now){
  const rows=new Map(),marks=marker(project,ownerUid);
  function add(collection,id,body){
    check(id.startsWith('cloud-sample-'),'INVALID_SAMPLE_ID','Mọi ID mẫu phải có prefix cloud-sample-.');
    const key=`${collection}/${id}`;
    check(!rows.has(key),'DUPLICATE_SAMPLE_ID','ID mẫu bị lặp trong manifest.');
    rows.set(key,{id,...body,...marks});
  }
  const ago=minutes=>new Date(Date.parse(now)-minutes*60_000).toISOString();
  function entry(id,kind,title,body,materials,weight_kg,tags,minutes){
    check(body.length<=500,'INVALID_SAMPLE_BODY','Nội dung bài mẫu vượt 500 ký tự.');
    add('content_entries',id,{author_id:ownerUid,parent_id:null,kind,title,body,materials,weight_kg,tags,
      status:kind==='SCAN'?'PRIVATE':'PUBLISHED',like_count:0,saved_count:0,comment_count:0,
      starts_at:null,ends_at:null,points_cost:0,metadata_json:'{}',created_at:ago(minutes),updated_at:ago(minutes),_social:true});
  }
  entry('cloud-sample-post-planters','POST','Vườn treo từ lon cũ · Mẫu',
    'Một ý tưởng tái sử dụng lon thiếc: làm sạch, xử lý cạnh sắc, tạo lỗ thoát nước rồi trồng cây nhỏ. Bài mẫu này dùng để kiểm tra ảnh, bình luận, thích/lưu và chỉnh sửa dữ liệu thật trên Admin.',
    ['Kim loại'],1.5,['MẫuKiểmThử','DIY','VườnXanh'],30);
  entry('cloud-sample-post-glass','POST','Lọ hoa từ chai thủy tinh · Mẫu',
    'Chai thủy tinh đã dùng có thể trở thành lọ hoa khi được làm sạch và trang trí bằng dây đay. Đây là bài mẫu minh họa để kiểm tra dữ liệu Firestore; không phải sản phẩm đang được chào bán.',
    ['Thủy tinh'],0.8,['MẫuKiểmThử','Decor','TáiSửDụng'],60);
  entry('cloud-sample-post-corks','POST','Chuông gió nút chai · Mẫu',
    'Gợi ý dùng nút chai, dây và một mảnh gỗ để tạo món trang trí thủ công. Đây là nội dung mẫu: bạn có thể sửa bài trên Admin, tải lại ứng dụng và kiểm tra nội dung đã được lưu trong database.',
    ['Gỗ','Hỗn hợp'],0.4,['MẫuKiểmThử','Handmade','Upcycle'],90);
  entry('cloud-sample-tip-clean','TIP','Làm sạch chai trước khi tái chế · Mẫu',
    'Đổ hết chất lỏng còn lại, súc nhẹ chai và để ráo. Tách vật liệu nếu điểm thu gom yêu cầu. Không cho pin hay vật sắc nhọn vào cùng túi chai lọ. Mẹo mẫu để kiểm tra mục Khám phá và chỉnh sửa trên Admin.',
    ['Nhựa','Thủy tinh'],null,['MẫuKiểmThử','PhânLoại','MẹoHay'],120);
  entry('cloud-sample-tip-planters','TIP','Tái sử dụng lon làm chậu cây · Mẫu',
    'Làm sạch lon, xử lý cạnh sắc an toàn và tạo lỗ thoát nước trước khi thêm đất. Chọn cây nhỏ, đặt chậu ở nơi chắc chắn, có ánh sáng phù hợp. Đây là mẹo mẫu minh họa trong database.',
    ['Kim loại'],null,['MẫuKiểmThử','DIY','ChậuCây'],150);
  entry('cloud-sample-scan-glass','SCAN','Ảnh SCAN thử nghiệm',
    'Ảnh mẫu được lưu dưới dạng bytes trong Firestore để kiểm tra chế độ Spark. Bản ghi này riêng tư, chỉ chủ ảnh và Admin được xem; không có kết quả nhận diện vật liệu tự động.',
    [],null,[],10);
  const categoryId='cloud-sample-category-reuse';
  add('categories',categoryId,{name:'Đồ tái sử dụng · Mẫu',description:'Danh mục cho các bài bán mẫu đang chờ duyệt; không tự xác minh tài khoản.',active:true});
  for(const [id,title,description,material,price] of [
    ['cloud-sample-sale-planters','Chậu treo từ lon · Mẫu','Bài bán mẫu đang chờ duyệt để kiểm tra database và Admin. Chưa được niêm yết hoặc nhận giao dịch.','Kim loại',90000],
    ['cloud-sample-sale-glass','Lọ hoa dây đay · Mẫu','Lọ hoa minh họa từ chai thủy tinh tái sử dụng. Bài mẫu chờ duyệt; không có đơn hàng hay thanh toán được tạo.','Thủy tinh',35000],
    ['cloud-sample-sale-corks','Chuông gió nút chai · Mẫu','Đồ trang trí minh họa từ nút chai và dây còn dư. Bài mẫu chờ người bán xác minh và người có quyền xét duyệt.','Gỗ',60000],
  ]){
    add('listings',id,{seller_id:ownerUid,kind:'SALE',title,description,city:'TP.HCM',status:'PENDING',
      latitude:null,longitude:null,tags_json:'["MẫuKiểmThử","TáiSửDụng"]',created_at:ago(180),updated_at:ago(180),
      moderator_id:null,moderation_reason:null});
    add('listing_items',`${id}-item`,{listing_id:id,category_id:categoryId,name:title,material,
      condition:'GOOD',price_vnd:price,stock:5,unit:'cái',_reserved:0});
  }
  const photos=new Map();
  for(const filename of ['reuse-plants.jpg','reuse-glass.jpg','reuse-corks.jpg']){
    const bytes=await readFile(new URL(`../fixtures/${filename}`,import.meta.url));
    check(bytes.length>0&&bytes.length<=MAX_IMAGE_BYTES&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
      'INVALID_FIXTURE','Ảnh mẫu phải là JPEG thật, tối đa 384 KiB.');
    photos.set(filename,bytes);
  }
  for(const [id,parentKind,parentId,filename] of [
    ['cloud-sample-photo-post-planters','CONTENT','cloud-sample-post-planters','reuse-plants.jpg'],
    ['cloud-sample-photo-post-glass','CONTENT','cloud-sample-post-glass','reuse-glass.jpg'],
    ['cloud-sample-photo-post-corks','CONTENT','cloud-sample-post-corks','reuse-corks.jpg'],
    ['cloud-sample-photo-tip-clean','CONTENT','cloud-sample-tip-clean','reuse-glass.jpg'],
    ['cloud-sample-photo-tip-planters','CONTENT','cloud-sample-tip-planters','reuse-plants.jpg'],
    ['cloud-sample-photo-scan-glass','SCAN','cloud-sample-scan-glass','reuse-glass.jpg'],
    ['cloud-sample-photo-sale-planters','LISTING','cloud-sample-sale-planters','reuse-plants.jpg'],
    ['cloud-sample-photo-sale-glass','LISTING','cloud-sample-sale-glass','reuse-glass.jpg'],
    ['cloud-sample-photo-sale-corks','LISTING','cloud-sample-sale-corks','reuse-corks.jpg'],
  ]){
    const bytes=photos.get(filename);
    add('media_assets',id,{uploader_id:ownerUid,storage_key:`firestore/media_assets/${id}`,mime_type:'image/jpeg',
      visibility:parentKind==='SCAN'?'PRIVATE':'PUBLIC',listing_id:parentKind==='LISTING'?parentId:null,
      content_id:parentKind!=='LISTING'?parentId:null,message_id:null,report_id:null,verification_id:null,
      _parent_type:parentKind,_parent_id:parentId,_status:'READY',_max_bytes:MAX_IMAGE_BYTES,
      _storage_backend:'FIRESTORE',_inline_bytes:bytes,_inline_sha256:digest(bytes),_inline_uploaded_at:now,
      size_bytes:bytes.length,created_at:now,completed_at:now});
  }
  add('audit_logs','cloud-sample-audit-community-v1',{actor_id:ownerUid,action:'CLOUD_SAMPLE_SEEDED',entity_type:'ContentEntry',
    entity_id:'cloud-sample-post-planters',reason:'Tạo mẫu bằng chính UID Admin đã xác thực; không tạo Auth, KYC, đơn hàng hay thanh toán.',created_at:now});
  const allowed=new Set(['content_entries','categories','listings','listing_items','media_assets','audit_logs']);
  check([...rows.keys()].every(path=>allowed.has(path.split('/')[0])),'INVALID_COLLECTION','Manifest chứa collection ngoài phạm vi dữ liệu mẫu.');
  return rows;
}
async function main(){
  const input=options(process.argv.slice(2));
  if(input.help){console.log('node backend/scripts/seed-cloud.mjs --project PROJECT --owner-uid UID [--apply]\nDefault: read-only dry run; --apply only creates missing, marker-owned sample records.');return;}
  let ctx;
  try{
    const cloud=await createLocalCloudContext();ctx=cloud.ctx;
    check(input.project===cloud.projectId,'PROJECT_MISMATCH','Project không khớp google-services.json.');
    check(cloud.ownerEmailVerified===true&&email(cloud.ownerEmail),'VERIFIED_CLI_OWNER_REQUIRED','Chủ tài khoản CLI phải có email Google đã xác thực.');
    const account=await ctx.auth.getUser(input.ownerUid);
    check(!account.disabled&&account.emailVerified===true&&email(account.email)===email(cloud.ownerEmail),
      'AUTH_OWNER_MISMATCH','UID Auth phải là chính chủ email CLI đã xác thực, đang hoạt động.');
    const ownerRef=ctx.db.collection('users').doc(input.ownerUid);
    validateOwner(await ownerRef.get(),input.ownerUid,cloud.ownerEmail);
    const manifest=await plan(cloud.projectId,input.ownerUid,ctx.now());
    const records=[...manifest.entries()].map(([path,data])=>({ref:ctx.db.doc(path),data}));
    const previous=await ctx.db.getAll(...records.map(row=>row.ref));
    validateExisting(previous,cloud.projectId,input.ownerUid);
    const summary={projectId:cloud.projectId,mode:input.apply?'APPLY':'DRY_RUN',
      planned:records.length,missing:previous.filter(row=>!row.exists).length,existingOwned:previous.filter(row=>row.exists).length,
      ids:records.map(row=>row.ref.path),created:0,unchanged:0};
    if(input.apply){
      const result=await ctx.db.runTransaction(async tx=>{
        validateOwner(await tx.get(ownerRef),input.ownerUid,cloud.ownerEmail);
        const snapshots=await tx.getAll(...records.map(row=>row.ref));
        validateExisting(snapshots,cloud.projectId,input.ownerUid);
        let created=0;
        for(let i=0;i<records.length;i++)if(!snapshots[i].exists){tx.create(records[i].ref,records[i].data);created++;}
        return {created,unchanged:records.length-created};
      });
      Object.assign(summary,result);
    }
    console.log(JSON.stringify(summary,null,2));
  }finally{if(ctx)await ctx.db.terminate();}
}
main().catch(error=>{
  const code=String(error?.code??'CLOUD_SERVICE_ERROR').replace(/[^A-Za-z0-9_-]/g,'').slice(0,100);
  console.error(JSON.stringify({error:'CLOUD_SAMPLE_SEED_FAILED',code,
    message:error instanceof SeedError?error.message:'Chưa hoàn tất thao tác cloud. Kiểm tra quyền, phiên CLI và cấu hình project; không có tài khoản hoặc giao dịch giả được tạo.'}));
  process.exitCode=1;
});
