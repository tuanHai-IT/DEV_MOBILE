package com.example.recyclingshareapp.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;

/** Decorative SCAN guide. The capture button opens the device camera. */
final class ScanOverlayView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

    ScanOverlayView(Context context) {
        super(context);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private float sp(float value) {
        return value * getResources().getDisplayMetrics().scaledDensity;
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth(), height = getHeight();
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new LinearGradient(0, 0, width, height,
                0xFF050B06, 0xFF0E1C10, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, width, height, paint);
        paint.setShader(null);

        paint.setColor(0x1735683E);
        paint.setStrokeWidth(dp(0.6f));
        float grid = dp(74);
        for (float x = grid / 2; x < width; x += grid) canvas.drawLine(x, 0, x, height, paint);
        for (float y = grid / 2; y < height; y += grid) canvas.drawLine(0, y, width, y, paint);

        float side = Math.min(dp(206), width * 0.54f);
        float centerX = width / 2f, centerY = height * 0.36f;
        float left = centerX - side / 2f, top = centerY - side / 2f;
        float right = centerX + side / 2f, bottom = centerY + side / 2f;
        float segment = dp(28), radius = dp(4);
        paint.setStyle(Paint.Style.STROKE);
        paint.setColor(0xFF15C879);
        paint.setStrokeWidth(dp(1.5f));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        Path corners = new Path();
        corners.moveTo(left + segment, top);
        corners.lineTo(left + radius, top);
        corners.quadTo(left, top, left, top + radius);
        corners.lineTo(left, top + segment);
        corners.moveTo(right - segment, top);
        corners.lineTo(right - radius, top);
        corners.quadTo(right, top, right, top + radius);
        corners.lineTo(right, top + segment);
        corners.moveTo(left, bottom - segment);
        corners.lineTo(left, bottom - radius);
        corners.quadTo(left, bottom, left + radius, bottom);
        corners.lineTo(left + segment, bottom);
        corners.moveTo(right, bottom - segment);
        corners.lineTo(right, bottom - radius);
        corners.quadTo(right, bottom, right - radius, bottom);
        corners.lineTo(right - segment, bottom);
        canvas.drawPath(corners, paint);

        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(Typeface.DEFAULT_BOLD);
        paint.setColor(0xFF50C993);
        paint.setTextSize(sp(34));
        canvas.drawText("♻", centerX, centerY - dp(4), paint);
        paint.setTypeface(Typeface.DEFAULT);
        paint.setColor(Color.WHITE);
        paint.setTextSize(sp(11));
        canvas.drawText("Đưa sản phẩm vào khung", centerX, centerY + dp(24), paint);
    }
}
