package com.example.recyclingshareapp.ui;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.media.ExifInterface;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/** Bounded photo payloads for the free Firestore media store; call on an image worker thread. */
public final class PhotoUploadEncoder {
    public static final int MAX_BYTES = 384 * 1024;
    public static final int MAX_DIMENSION = 1024;
    private PhotoUploadEncoder() { }

    public static final class Photo {
        public final byte[] bytes;
        public final String mime = "image/jpeg";
        private Photo(byte[] bytes) { this.bytes = bytes; }
    }

    public static Photo forFirestore(byte[] source) throws IOException {
        if(source==null||source.length==0)throw new IOException("Ảnh trống.");
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(source,0,source.length,bounds);
        if(bounds.outWidth<=0||bounds.outHeight<=0)throw new IOException("Không đọc được định dạng ảnh.");
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=1;
        while(Math.max(bounds.outWidth,bounds.outHeight)/options.inSampleSize>2048)options.inSampleSize*=2;
        Bitmap decoded=BitmapFactory.decodeByteArray(source,0,source.length,options);
        if(decoded==null)throw new IOException("Không đọc được ảnh.");
        Bitmap oriented=decoded,scaled=null,rgb=null;
        try {
            Matrix transform=orientation(source);
            if(!transform.isIdentity())oriented=Bitmap.createBitmap(decoded,0,0,decoded.getWidth(),decoded.getHeight(),transform,true);
            float ratio=Math.min(1f,(float)MAX_DIMENSION/Math.max(oriented.getWidth(),oriented.getHeight()));
            int width=Math.max(1,Math.round(oriented.getWidth()*ratio)),height=Math.max(1,Math.round(oriented.getHeight()*ratio));
            scaled=Bitmap.createScaledBitmap(oriented,width,height,true);
            rgb=Bitmap.createBitmap(width,height,Bitmap.Config.RGB_565);
            Canvas canvas=new Canvas(rgb);canvas.drawColor(Color.WHITE);canvas.drawBitmap(scaled,0,0,new Paint(Paint.FILTER_BITMAP_FLAG));
            try(ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                while(true) {
                    for(int quality:new int[]{85,70,55,40,25,15}) {
                        output.reset();if(!rgb.compress(Bitmap.CompressFormat.JPEG,quality,output))throw new IOException("Không nén được ảnh.");
                        if(output.size()<=MAX_BYTES)return new Photo(output.toByteArray());
                    }
                    if(Math.max(rgb.getWidth(),rgb.getHeight())<=128)throw new IOException("Không nén được ảnh xuống dưới 384 KB.");
                    Bitmap smaller=Bitmap.createScaledBitmap(rgb,Math.max(1,Math.round(rgb.getWidth()*0.75f)),Math.max(1,Math.round(rgb.getHeight()*0.75f)),true);rgb.recycle();rgb=smaller;
                }
            }
        } finally {
            if(rgb!=null&&!rgb.isRecycled())rgb.recycle();
            if(scaled!=null&&scaled!=oriented&&scaled!=decoded&&!scaled.isRecycled())scaled.recycle();
            if(oriented!=decoded&&!oriented.isRecycled())oriented.recycle();
            if(!decoded.isRecycled())decoded.recycle();
        }
    }

    private static Matrix orientation(byte[] bytes) {
        Matrix matrix=new Matrix();
        try(ByteArrayInputStream input=new ByteArrayInputStream(bytes)) {
            int value=new ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);
            switch(value) {
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1,1);break;
                case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180);break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1,-1);break;
                case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90);matrix.postScale(-1,1);break;
                case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90);break;
                case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(-90);matrix.postScale(-1,1);break;
                case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(-90);break;
                default: break;
            }
        } catch(IOException ignored) { /* PNG/WebP images without EXIF use their decoded orientation. */ }
        return matrix;
    }
}
