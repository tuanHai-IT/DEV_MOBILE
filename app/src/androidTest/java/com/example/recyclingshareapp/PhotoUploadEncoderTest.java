package com.example.recyclingshareapp;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.example.recyclingshareapp.ui.PhotoUploadEncoder;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Random;
import static org.junit.Assert.*;

/** Local bitmap processing only: no account creation or Firebase network writes. */
@RunWith(AndroidJUnit4.class)
public class PhotoUploadEncoderTest {
    @Test public void largeDetailedPhotoFitsFirestoreQuotaAndKeepsImageDimensionsBounded() throws Exception {
        Bitmap source=Bitmap.createBitmap(2048,1536,Bitmap.Config.ARGB_8888);
        Random random=new Random(2917);int[] row=new int[source.getWidth()];
        for(int y=0;y<source.getHeight();y++){for(int x=0;x<row.length;x++)row[x]=Color.rgb(random.nextInt(256),random.nextInt(256),random.nextInt(256));source.setPixels(row,0,row.length,0,y,row.length,1);}
        byte[] original;try(ByteArrayOutputStream out=new ByteArrayOutputStream()){assertTrue(source.compress(Bitmap.CompressFormat.JPEG,95,out));original=out.toByteArray();}finally{source.recycle();}
        assertTrue("Fixture should require compression",original.length>PhotoUploadEncoder.MAX_BYTES);
        PhotoUploadEncoder.Photo result=PhotoUploadEncoder.forFirestore(original);
        assertEquals("image/jpeg",result.mime);assertTrue(result.bytes.length>0);assertTrue(result.bytes.length<=384*1024);
        BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(result.bytes,0,result.bytes.length,dimensions);
        assertTrue(dimensions.outWidth>0&&dimensions.outHeight>0);assertTrue(Math.max(dimensions.outWidth,dimensions.outHeight)<=1024);
    }
    @Test public void transparentPhotoGetsWhiteBackgroundAndInvalidFilesAreRejected() throws Exception {
        Bitmap source=Bitmap.createBitmap(64,64,Bitmap.Config.ARGB_8888);source.eraseColor(Color.TRANSPARENT);
        byte[] png;try(ByteArrayOutputStream out=new ByteArrayOutputStream()){assertTrue(source.compress(Bitmap.CompressFormat.PNG,100,out));png=out.toByteArray();}finally{source.recycle();}
        PhotoUploadEncoder.Photo photo=PhotoUploadEncoder.forFirestore(png);Bitmap decoded=BitmapFactory.decodeByteArray(photo.bytes,0,photo.bytes.length);
        assertNotNull(decoded);int corner=decoded.getPixel(0,0);decoded.recycle();assertTrue(Color.red(corner)>230&&Color.green(corner)>230&&Color.blue(corner)>230);
        assertThrows(IOException.class,()->PhotoUploadEncoder.forFirestore(new byte[]{1,2,3,4}));
    }
}
