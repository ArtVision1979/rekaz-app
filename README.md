# Rekaz Site Visit Manager

نظام إدارة زيارات المواقع — مكتب ركاز للهندسة

## التقنيات
- React + Vite
- Supabase (قاعدة البيانات + Auth + Storage)
- Capacitor (Android APK)
- Vercel (استضافة)
- PWA (تثبيت على الموبايل والديسكتوب)

---

## خطوات الإعداد

### 1. إعداد Supabase
1. اذهب إلى https://supabase.com وأنشئ مشروع جديد
2. من SQL Editor شغّل ملف `rekaz_database_schema.sql`
3. من Settings > API انسخ:
   - Project URL
   - anon public key

### 2. إعداد المشروع
```bash
# ثبّت المكتبات
npm install

# أضف مفاتيح Supabase في ملف .env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# شغّل المشروع
npm run dev
```

افتح المتصفح على: http://localhost:5173

### 3. إنشاء أول مستخدم
في Supabase > Authentication > Users > Invite User
أو عبر SQL:
```sql
-- بعد ما تسجل عبر Supabase Auth، أضف بيانات المستخدم:
INSERT INTO public.users (id, full_name, email, role)
VALUES ('YOUR_AUTH_USER_ID', 'Ahmed Al-Rashid', 'ahmed@rekaz.bh', 'admin');
```

### 4. رفع على Vercel
```bash
# ثبّت Vercel CLI
npm install -g vercel

# ارفع المشروع
vercel

# أضف متغيرات البيئة في Vercel Dashboard:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

---

## بناء APK للأندرويد

### المتطلبات
- Android Studio مثبّت
- Java 17+

### الخطوات
```bash
# 1. ابنِ المشروع
npm run build

# 2. أضف منصة Android
npm run cap:add

# 3. انسخ الملفات
npm run cap:sync

# 4. افتح Android Studio
npm run cap:open

# 5. في Android Studio: Build > Generate Signed Bundle/APK
```

---

## هيكل الملفات
```
rekaz-app/
├── src/
│   ├── lib/
│   │   └── supabase.js      ← كل API calls
│   ├── hooks/
│   │   └── useAuth.jsx      ← Auth context
│   ├── components/
│   │   └── Layout.jsx       ← Sidebar + Topbar
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Projects.jsx
│   │   ├── Visits.jsx
│   │   ├── Tasks.jsx
│   │   ├── Reports.jsx
│   │   └── Schedule.jsx
│   ├── App.jsx              ← Routing
│   ├── main.jsx             ← Entry point
│   └── index.css            ← Global styles
├── public/
├── .env                     ← Supabase keys (لا ترفعه على GitHub)
├── vite.config.js
├── capacitor.config.json
└── package.json
```

---

## الصفحات
| الصفحة | الوصف |
|--------|-------|
| Dashboard | إحصائيات + زيارات + مهام أخيرة |
| Projects | إدارة المشاريع |
| Site Visits | تسجيل الزيارات |
| Tasks | المهام والملاحظات |
| Reports | التقارير PDF |
| Schedule | الجدول الأسبوعي |

---

مكتب ركاز للهندسة © 2026
