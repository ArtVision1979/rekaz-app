# Rekaz — Deployment Guide

## 1. نشر على Vercel

### الخطوات:
1. اذهب إلى https://github.com وأنشئ حساباً
2. أنشئ repository جديد باسم `rekaz-app`
3. في VS Code Terminal شغّل:

```powershell
git init
git add .
git commit -m "Rekaz Site Visit Manager v1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/rekaz-app.git
git push -u origin main
```

4. اذهب إلى https://vercel.com وسجّل بحساب GitHub
5. اضغط "Import Project" واختر `rekaz-app`
6. في Environment Variables أضف:
   - VITE_SUPABASE_URL = https://ieiowgdqdzbfkwbztncc.supabase.co
   - VITE_SUPABASE_ANON_KEY = eyJhbGci...
7. اضغط Deploy!

---

## 2. بناء APK للأندرويد

### المتطلبات:
- Android Studio مثبّت
- Java 17+

### الخطوات:
```powershell
# 1. ابنِ المشروع
npm run build

# 2. أضف Android
npx cap add android

# 3. انسخ الملفات
npx cap sync android

# 4. افتح Android Studio
npx cap open android
```

### في Android Studio:
- Build → Generate Signed Bundle/APK
- اختر APK
- أنشئ Keystore جديد
- اضغط Finish

---

## 3. Storage Policy في Supabase

في Supabase → Storage → Policies → New Policy على bucket "Rekaz":

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow uploads" ON storage.objects
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow public read
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (bucket_id = 'Rekaz');

-- Allow authenticated to delete own files
CREATE POLICY "Allow delete" ON storage.objects
FOR DELETE USING (auth.role() = 'authenticated');
```

شغّل هذا في SQL Editor في Supabase.
