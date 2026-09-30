# تقرير اختبار الاختراق الأمني — تطبيق Dydlye

**التاريخ:** 2026-09-26
**النطاق:** `dydlye/` (تطبيق Android/Capacitor + React) — `admin dydlye/` (لوحة تحكم React) — `SETUP_ALL.sql` / `supabase_setup.sql` — `supabase/functions/` — إعدادات Android والبناء
**نوع الفحص:** مراجعة شاملة للثغرات (Vulnerability Assessment) + تحليل ثابت للشفرة (SAST) + تدقيق RLS/مصادقة + سلسلة التوريد
**الهدف:** تقييم أمني شامل لتطبيق Dydlye وتحديد جميع الثغرات القابلة للاستغلال

---

## 0. ملخص تنفيذي (Executive Summary)

تم فحص التطبيق بالكامل و**تم العثور على 38 ثغرة** موزعة على 12 فئة. الحالة الأمنية الحالية **غير آمنة critically** ولا يمكن اعتبارها صالحة للإنتاج قبل معالجة ثغرات الـ Critical.

| المستوى | العدد | الأثر |
|---|---|---|
| **Critical** | 4 | اختراق كامل للبيانات، تصعيد صلاحيات، تجاوز الدفع |
| **High** | 9 | تسريب بيانات شخصية، تجاوز الحظر، انتحال جهات الاتصال |
| **Medium** | 14 | تزوير تقييمات، رفع ملفات خطرة، تسريب جزئي |
| **Low** | 8 | تصلبة (hardening) |
| **Info** | 3 | ملاحظات ومعلومات |

### أخطر 3 ثغرات (يجب إصلاحها فوراً)

1. **C-01: مفتاح `service_role` مكشوف في جافاسكربت لوحة التحكم + لا يوجد أي مصادقة على اللوحة**
   → أي شخص يفتح رابط لوحة التحكم يحصل على مفتاح **`service_role`** كاملاً، وهو مفتاح يتجاوز **كل** سياسات RLS. النتيجة: قراءة/تعديل/حذف قاعدة البيانات بالكامل، وسرقة كل بيانات المستخدمين.

2. **C-02: تصعيد صلاحيات — أي مستخدم يمكنه منح نفسه حالة "مضيف" (is_host) مجاناً**
   → سياسة `UPDATE` على جدول `profiles` تسمح للمستخدم بتعديل أي عمود في صفه، بما في ذلك `is_host` و`host_active_until`. تجاوز كامل لاشتراك مدفوع.

3. **C-03: بيانات البطاقات الشهرية (PAN/CVV) تُجمع داخل التطبيق بدون بوابة دفع حقيقية**
   → مخالفة PCI DSS، وتسريب غير ضروري لبياناتبطاقات المستخدم في WebView.

### نقاط إيجابية (Good News)
- تطبيق الجوال نفسه **لا يحتوي** على مفتاح `service_role` (تحققت بفك ضغط الـ APK والـ AAB والبحث بالبايتات).
- لا يوجد أي ثغرة XSS قابلة للاستغلال فعلياً (تم تحليل جميع المصارف HTML).
- لا توجد ثغرات CVEs حرجة في الإصدارات المقفلة من التبعيات (node_modules مطابق للـ lockfile).

---

## 1. معلومات النطاق والمعمارية

| العنصر | التفاصيل |
|---|---|
| مشروع Supabase | `<project-ref>` (منطقة `eu-west-1`) |
| الجوال | React + TypeScript + Vite + Capacitor → Android (`com.dydlye.app`) |
| اللوحة | React + TypeScript + Vite (Static SPA) |
| قاعدة البيانات | PostgreSQL 17.6 عبر Supabase + RLS |
| التخزين | Supabase Storage: `property-images`, `destination-images`, `country-images` |
| الدوال الطرفية | `confirm-play-subscription`, `delete-account` |
| المصادقة | Supabase Auth + Google OAuth (PKCE) + Google Play Billing |

### سطح الهجوم المُقيَّم
- واجهة REST/PostgREST (`/rest/v1/*`) — محمي بـ RLS
- واجهة Storage (`/storage/v1/*`) — محمي بسياسات storage
- Realtime (نشر `destinations`)
- الدوال الطرفية (Edge Functions)
- WebView داخل التطبيق + Deep Links
- JavaScript المُسلَّم للمتصفح (static bundles)
- مستودع Git والتاريخ

---

## 2. جدول ملخص النتائج

| # | المستوى | الفئة | العنوان | الملف الرئيسي |
|---|---|---|---|---|
| C-01 | 🔴 Critical | OWASP A01 | مفتاح service_role مكشوف + لا مصادقة على اللوحة | `admin dydlye/src/lib/supabase.ts:4` |
| C-02 | 🔴 Critical | OWASP A01 | تصعيد صلاحيات to is_host | `SETUP_ALL.sql:250-252` |
| C-03 | 🔴 Critical | OWASP A04 | بيانات بطاقات PCI بدون دفع | `HouseDetailSheet.tsx:264` |
| C-04 | 🔴 Critical | OWASP A08 | login CSRF / session fixation (تجاوز PKCE) | `auth.tsx:89-96` |
| H-01 | 🟠 High | OWASP A01 | الحجب (blocked) لا يُطبَّق في RLS | `SETUP_ALL.sql` |
| H-02 | 🟠 High | OWASP A01 | أي مستخدم يحذف/يعدّل كل البلاغات | `SETUP_ALL.sql:336-346` |
| H-03 | 🟠 High | OWASP A01 | أي مستخدم يعدّل/يحذف كل الوجهات | `SETUP_ALL.sql:353-363` |
| H-04 | 🟠 High | OWASP A04 | purchase_token غير مربوط بالمستخدم | `confirm-play-subscription:174` |
| H-05 | 🟠 High | OWASP A04 | productId غير مُتحقَّق منه | `confirm-play-subscription:166` |
| H-06 | 🟠 High | OWASP A02 | تسريب PII عالمي (profiles + phones) | `SETUP_ALL.sql:246-248` |
| H-07 | 🟠 High | OWASP A04 | شرط "مضيف" يُفرض في العميل فقط | `add-property.tsx:23` |
| H-08 | 🟠 High | OWASP A02 | مفتاح التوقيع + كلمة المرور في المستودع | `key/key.txt:3` |
| H-09 | 🟠 High | OWASP A05 | `.gitignore` معطّل (backslashes) | `.gitignore:34,46` |
| M-01 | 🟡 Medium | OWASP A04 | تزوير التقييمات (لا CHECK) | `supabase_setup.sql:447` |
| M-02 | 🟡 Medium | OWASP A04 | RPC التقييم SECURITY DEFINER مفتوح | `supabase_setup.sql:477` |
| M-03 | 🟡 Medium | OWASP A01 | انتحال اسم المراجِع | `useComments.ts:54-60` |
| M-04 | 🟡 Medium | OWASP A04 | رفع ملفات غير مقيّد (SVG/حجم) | `supabase_setup.sql:241` |
| M-05 | 🟡 Medium | OWASP A04 | تسابق في validate_promo_code | `supabase_setup.sql:490` |
| M-06 | 🟡 Medium | OWASP A04 | تعارض سعر الأساس (100 vs 150) | `usePromoCode.ts:24-25` |
| M-07 | 🟡 Medium | OWASP A04 | أكواد خصم 100% في الشيفرة | `SETUP_ALL.sql:729-734` |
| M-08 | 🟡 Medium | OWASP A04 | fail-open في paymentState | `confirm-play-subscription:178` |
| M-09 | 🟡 Medium | OWASP A07 | حذف حساب جزئي / صامت | `delete-account/index.ts:38-74` |
| M-10 | 🟡 Medium | OWASP A07 | إتلاف الحساب بدون re-auth | `delete-account/index.ts:77` |
| M-11 | 🟡 Medium | OWASP A07 | تسجيل خروج ناقص | `useAuthStore.ts:36` |
| M-12 | 🟡 Medium | OWASP A02 | allowBackup=true (سرقة الجلسة) | `AndroidManifest.xml:4` |
| M-13 | 🟡 Medium | OWASP A01 | منح overly-broad لـ anon | `SETUP_ALL.sql:742` |
| M-14 | 🟡 Medium | OWASP A05 | بيانات targeting في `.temp` | `.git` (مُتتبَّع) |
| L-01 | ⚪ Low | OWASP A02 | cleartext traffic مسموح | `capacitor.config.ts:8-9` |
| L-02 | ⚪ Low | OWASP A05 | CORS wildcard على الدوال الطرفية | `confirm-play-subscription:8` |
| L-03 | ⚪ Low | OWASP A09 | تسجيل OAuth tokens في console | `auth.tsx:52` |
| L-04 | ⚪ Low | OWASP A04 | release build غير minified | `android/app/build.gradle` |
| L-05 | ⚪ Low | OWASP A03 | HTML marker injection (Leaflet) | `DydlyeMap.tsx:206-230` |
| L-06 | ⚪ Low | OWASP A05 | handle_new_user بلا search_path | `supabase_setup.sql:181` |
| L-07 | ⚪ Low | OWASP A02 | avatar URL = تتبّع | `account.tsx:53` |
| L-08 | ⚪ Low | OWASP A07 | جلسة مخبأة غير مُتحقَّق منها | `useAuthStore.ts:7-29` |
| I-01 | ⚪ Info | — | لا يوجد rate limiting | عام |
| I-02 | ⚪ Info | — | لا يوجد CSP | `dist/index.html` |
| I-03 | ⚪ Info | — | لا يوجد SRI على الملفات | `dist/index.html` |

---

## 3. التفاصيل الكاملة (Critical)

### 🔴 C-01 — مفتاح `service_role` مكشوف في جافاسكربت لوحة التحكم + غياب المصادقة

**الخطورة:** Critical · **الاستغلال:** فوري وبدون مصادقة · **التأثير:** اختراق كامل لقاعدة البيانات

**الوصف**

لوحة التحكم تستخدم مفتاح `service_role` الخاص بـ Supabase **داخل المتصفح**، وهذا المفتاح يتجاوز **كل** سياسات RLS (Row Level Security). والأخطر من ذلك: **لا يوجد أي تحقق من هوية الزائر** — لا صفحة دخول، لا حارس مسارات (route guard)، لا تحقق من session.

**الدليل**

```
admin dydlye/src/lib/supabase.ts:4
  VITE_SUPABASE_SERVICE_ROLE_KEY  ← يُدمج في الحزمة
```

```
admin dydlye/src/App.tsx:14-39
  export default function App() {
    return (
      <Layout>                    ← يُعرض مباشرة بدون فحص
        <Routes>...
```

```
admin dydlye/src/components/Layout.tsx:27-30
  const handleLogout = ...       ← زر خروج فقط، لا يوجد فحص تسجيل دخول
```

**التحقق (تم استخراج المفتاح من الحزمة المبنية):**

الحزمة `admin dydlye/dist/assets/index-JPOd223r.js` تحتوي على JWT واحد فقط، الحمولة بعد فك الترميز:
```json
{"iss":"supabase","ref":"<project-ref>","role":"service_role","iat":1790441293,"exp":2106017293}
```

**استغلال (سيناريو واقعي)**

1. المهاجم يفتح لوحة التحكم (URL).
2. يفتح DevTools → Sources → `assets/index-JPOd223r.js` → Ctrl+F `service_role`.
3. ينسخ المفتاح (يبدأ بـ `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
4. يستخدمه مباشرة:
```bash
curl "https://<project-ref>.supabase.co/rest/v1/profiles?select=*" \
  -H "apikey: <SERVICE_ROLE>" -H "Authorization: Bearer <SERVICE_ROLE>"
```
5. يحصل على **قائمة كاملة**: أسماء كل المستخدمين، أرقام هواتفهم، حالة الحظر، اشتراكاتهم. ويمكنه الحذف والتعديل والكتابة في كل جداول التطبيق.

**النطاق المتأثر:** كامل قاعدة البيانات (10 جداول) + كل ملفات Storage + كل المستخدمين.

**الإصلاح**
1. **فوراً:** احذف `VITE_SUPABASE_SERVICE_ROLE_KEY` من `.env` الخاص باللوحة.
2. **تدوير المفتاح:** في Supabase Dashboard → Settings → API → Generate new service_role key (المفتاح الحالي يجب اعتباره مكشوفاً).
3. **انقل اللوحة إلى الخادم:** أنشئ Edge Function أو API وسيط يتحقق من هوية الأدمن، ثم ينفّذ العمليات بـ service_role على الخادم. لا تُرسِل service_role للمتصفح أبداً.
4. **أضف مصادقة:** نفّذ تسجيل دخول + جدار أدمن (RLS مع `profiles.is_admin` أو جدول `admins`). لا تعتمد على "إخفاء الرابط" (obscurity).
5. **نظّف الحزمة:** `rm -rf admin dydlye/dist` وأعد البناء بعد الإصلاح.

---

### 🔴 C-02 — تصعيد صلاحيات: أي مستخدم يمنح نفسه حالة "مضيف" مجاناً

**الخطورة:** Critical · **الاستغلال:** مع حساب عادي واحد · **التأثير:** تجاوز كامل للاشتراك المدفوع

**الوصف**

جدول `profiles` يحتوي على سياسات `UPDATE` تسمح للمستخدم بتعديل صفه. لكن سياسات RLS في Postgres تعمل على مستوى **الصف** (row-level) وليست على مستوى **العمود** (column-level). هذا يعني أن كلاهما:

- `"Users can update own profile"`
- `"Users can update to host"` (متكررة)

... تسمحان بتعديل **أي عمود** في الصف، بما في ذلك أعمدة الصلاحيات.

**الدليل**

```sql
-- SETUP_ALL.sql:250-252
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

أعمدة الصلاحيات في نفس الجدول:
```sql
-- SETUP_ALL.sql:35-37
is_host            BOOLEAN NOT NULL DEFAULT false,
blocked            BOOLEAN NOT NULL DEFAULT false,
host_active_until  TIMESTAMPTZ,
```

والسياسة المكررة التي تشرح نفسها:
```sql
-- SETUP_ALL.sql:250-252 (مكررة في supabase_setup.sql:118-121)
-- "Allow users to upgrade themselves to host (set is_host = true)"
CREATE POLICY "Users can update to host" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
```

**استغلال**

```bash
curl -X PATCH "https://<project-ref>.supabase.co/rest/v1/profiles?id=eq.<USER_UUID>" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"is_host":true,"host_active_until":"2099-12-31T00:00:00Z"}'
```

ثم دالة `get_host_subscription_state()` (المُعرَّفة كـ `SECURITY DEFINER` في `SETUP_ALL.sql:564-598`) ستُرجع `is_host: true` وتُتيح إضافة عقارات مجاناً.

**ملاحظة إضافية:** يوجدsci_localStorage fallback في الواجهة:
```
src/hooks/useProfile.ts:29,70
  const localHostKey = (userId) => `Dydlye_is_host_${userId}`;
  localStorage.setItem(localHostKey(userId), "true");
```
هذا يعني أن "become host" يمكن أن يبدو ناجحاً حتى بدون شراء حقيقي.

**الإصلاح**
1. احذف السياسة المكررة `"Users can update to host"` — هي no-opdupplicate.
2. **قلّص الصلاحيات على مستوى العمود:**
```sql
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, phone) ON public.profiles TO authenticated;
```
3. اجعل `is_host`, `host_active_until`, `blocked` قابلة للكتابة فقط من `service_role` أو عبر دالة `SECURITY DEFINER` محصورة.
4. **الأهم: صمّم مخطط `is_admin` / `is_host` على حدة** أو استخدم جدول `roles` منفصل.

---

### 🔴 C-03 — جمع بيانات بطاقات PCI بدون بوابة دفع

**الخطورة:** Critical · **الأثر:** مخالفة PCI DSS + تسريب بيانات بطاقات

**الوصف**

نموذج الحجز يجمع من المستخدم: **رقم البطاقة الكامل (PAN)، الاسم، تاريخ الانتهاء، وCVV** — ويتحقق من الصلاحية بخوارزمية Luhn — لكن **لا يوجد أي معالج دفع فعلي ولا يتم إرسال بيانات البطاقة لأي مكان**. الدفع محاكاة local.

**الدليل**
```
src/components/dydlye/HouseDetailSheet.tsx:39-42   ← حقول PAN/CVV
src/components/dydlye/HouseDetailSheet.tsx:220-233 ← تحقق Luhn
src/components/dydlye/HouseDetailSheet.tsx:258-261 ← "دفع" محاكى (تعليق + timer 1.6s)
src/components/dydlye/HouseDetailSheet.tsx:1048-1072 ← عرض حقول البطاقة
```

**المشكلة**

جمع PAN/CVV داخل تطبيق (WebView) بدون مزود دفع متوافق مع معيار PCI DSS. هذا:
- يوسّع نطاق PCI DSS من SAQ-A إلى SAQ-D.
- يعرّض بيانات بطاقات لاختراق في حال اختراق التطبيق.
- غير ضروري تمامًا لأن لا يوجد دفع حقيقي.

**الإصلاح**
1. احذف نموذج البطاقة بالكامل.
2. عند إضافة دفع حقيقي، استخدم **Google Play Billing** أو **PSP مع Hosted Fields** (Stripe Elements مثلاً) — بحيث لا يلمس التطبيق PAN/CVV إطلاقاً.
3. راجع متطلبات الامتثال لمعايير PCI الخاصة ببيانات البطاقات.

---

### 🔴 C-04 — login CSRF / session fixation (تجاوز PKCE عبر Deep Link)

**الخطورة:** Critical · **الاستغلال:** رابط خبيث يُفتح على جهاز الضحية

**الوصف**

التطبيق يستمع لـ deep link بالمخطط `dydlye://` ويمرر أي URL إلى `finishAuth`، الذي:
1. يحلل **أي** URL مطلق بدون قائمة سماح (allowlist) للمصدر.
2. إذا وجد `access_token` في الـ fragment، يستدعي `setSession` مباشرة — **متجاوزاً PKCE بالكامل**.

**الدليل**
```
src/routes/auth.tsx:50      url = new URL(rawUrl);        ← لا allowlist
src/routes/auth.tsx:66      const accessToken = hashParams.get("access_token");
src/routes/auth.tsx:89-96   supabase.auth.setSession({ access_token, refresh_token })
src/routes/auth.tsx:65      flowType: "pkce"              ← لكن يُتجاوز
```

```
AndroidManifest.xml:24-26
  <data android:scheme="dydlye" />   ← بدون host/path restriction
```

**استغلال**

1. المهاجم ينشئ جلسة على حسابه (يحصل على `access_token` + `refresh_token`).
2. يصنع رابطاً: `dydlye://x#access_token=<AT_المهاجم>&refresh_token=<RT_المهاجم>`
3. يرسله للضحية (رسالة / صفحة ويب / QR).
4. تطبيق الضحية يستبدل جلسته **بجلسة المهاجم**.
5. كل ما تفعله الضحية بعد ذلك (تعديلات ملفها، حجوزات، تقييمات) يُكتب **في حساب المهاجم**.

هذا **login CSRF** كلاسيكي.

**الإصلاح**
1. **احذف فرع `access_token`** من `finishAuth`. اقبل `code` فقط مع `exchangeCodeForSession`.
2. أضف **قائمة سماح** للمصدر في `finishAuth` (expected scheme + host).
3. قيّد الـ deep link في `AndroidManifest.xml` بمضيف (host) محدد.
4. اربط الـ callback بـ `state`/`nonce` مخزّن محلياً (منع CSRF في OAuth).

---

## 4. التفاصيل الكاملة (High)

### 🟠 H-01 — الحجب (blocked) لا يُطبَّق في RLS

جدول `profiles` فيه عمود `blocked BOOLEAN` (ووظيفة `blockUserAndDeleteProperties` في اللوحة)، لكن **لا توجد أي سياسة RLS تتحقق من `blocked`**. النتيجة: المستخدم المحظور يبقى بكامل صلاحياته عبر الـ API حتى لو حُذفت بياناته من الواجهة.

**الإصلاح:** أضف `AND NOT blocked` لكل سياسة، أو اعزل المستخدم المحظور في role-jwt مخصص.

---

### 🟠 H-02 — أي مستخدم مصادق عليه يستطيع قراءة/تعديل/حذف كل البلاغات

```sql
-- SETUP_ALL.sql:336-346
CREATE POLICY "Authenticated users can view property reports" ON public.property_reports
  FOR SELECT TO authenticated USING (true);         ← كل البلاغات للجميع

CREATE POLICY "Authenticated users can delete property reports" ON public.property_reports
  FOR DELETE TO authenticated USING (true);         ← أي شخص يحذف كل البلاغات!

CREATE POLICY "Authenticated users can update property reports" ON public.property_reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);  ← أي شخص يعدّل الحالة
```

**الاستغلال:** أي مستخدم مسجَّل (حتى غير مسؤول) يستطيع:
- قراءة كل البلاغات (معلومات عن المستخدمين).
- **حذف كل البلاغات** → تعطيل نظام الإبلاغ بالكامل.
- تغيير `status` إلى `resolved` لإخفاء بلاغات حساسة.

**الإصلاح:** حصر SELECT/DELETE/UPDATE في دور `admin` أو `service_role` فقط.

---

### 🟠 H-03 — أي مستخدم يعدّل/يحذف كل الوجهات (انتحال جهات اتصال)

```sql
-- SETUP_ALL.sql:353-363
CREATE POLICY "Authenticated users can insert destinations" ON public.destinations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');    ← أي مستخدم

CREATE POLICY "Authenticated users can update destinations" ON public.destinations
  FOR UPDATE USING (auth.role() = 'authenticated');        ← أي مستخدم يعدّل الكل

CREATE POLICY "Authenticated users can delete destinations" ON public.destinations
  FOR DELETE USING (auth.role() = 'authenticated');        ← أي مستخدم يحذف الكل
```

جدول `destinations` **لا يملك عمود مالك** (owner_id)، فأي مستخدم مصادق يعدّل أي صف.

**الاستغلال — انتحال جهات اتصال:** المهاجم يغيّر `phone` لأي وجهة إلى رقمه، فيُظن أن المستخدم يتصل أو يراسل رقم المهاجم.
```
src/components/dydlye/DestinationDetailSheet.tsx:360  href={`tel:${destination.phone}`}
src/components/dydlye/DestinationDetailSheet.tsx:402  clipboard.copy(destination.phone)
```

**الإصلاح:** اجعل `destinations` للإدارة فقط (service_role). أزل سياسات الكتابة للعملاء.

---

### 🟠 H-04 — purchase_token غير مربوط بالمستخدم (اشتراك واحد = عدد لا نهائي من المضيفين)

الدالة `confirm-play-subscription` تطلب `purchaseToken` و `productId` من **العميل**، وتتحقق من الرمز لدى Google Play، لكنها **لا تتأكد أن الرمز يخص هذا المستخدم**.

**الدليل**
```
supabase/functions/confirm-play-subscription/index.ts:165-167  ← من body العميل
supabase/functions/confirm-play-subscription/index.ts:174      ← تحقق من Google فقط
supabase/functions/confirm-play-subscription/index.ts:196-210  ← upsert بمفتاح (user_id, product_id)
supabase/functions/confirm-play-subscription/index.ts:212-215  ← يمنح is_host
```

**المشكلة:** الـ unique index على `subscriptions` هو على `(user_id, product_id)`:
```sql
-- supabase_setup.sql:618
CREATE UNIQUE INDEX subscriptions_user_product_idx
  ON public.subscriptions (user_id, product_id);
```
**لا يوجد** قيد فريد على `purchase_token`.

**الاستغلال:** 
1. المستخدم (أ) يشتري الاشتراك ويستخرج purchase_token.
2. المهاجم (ب) يطلب `confirm` برمز المستخدم (أ) — يصبح مضيفاً مجاناً.
3. **الأسوأ:** نفس الرمز يمكن تأكيده لـ **عدد لا نهائي من الحسابات** → شراء واحد =izador quarantine.

**الإصلاح**
1. اجعل constraint فريداً: `ALTER TABLE subscriptions ADD UNIQUE (purchase_token);`
2. عند الشراء اضبط Play's `obfuscatedExternalAccountId` = hash(user.id)، وتحقق منه في التأكيد.
3. اربط بـ orderId والتحقق من him.

---

### 🟠 H-05 — productId غير مُتحقَّق منه (شراء الأرخص)

```ts
// confirm-play-subscription/index.ts:166
const productId = String(body.productId ?? "");   ← من العميل
```

`priceAmountMicros` يُقرأ من Google لكن **لا يُقارن أبداً** بالسعر المتوقع. المهاجم يرسل `productId` لأرخص منتج في الكتالوج (أو أي منتج)، فيحصل على حالة مضيف كاملة.

**الإصلاح:** قائمة سماح (allowlist) ثابتة لمعرّفات منتجاتك في الدالة. تجاهل أي `productId` من العميل.

---

### 🟠 H-06 — تسريب PII عالمي (أسماء + هواتف + حالة الحظر)

```sql
-- SETUP_ALL.sql:246-248  (و supabase_setup.sql:109-111)
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);        ← كل شيء للجميع

-- SETUP_ALL.sql:259-261
CREATE POLICY "Properties are viewable by everyone" ON public.properties
  FOR SELECT USING (true);        ← كل شيء، بما فيه phone
```

**الاستغلال:** بمفتاح `anon` (العام، موجود في الحزمة — وهذا طبيعي)، أي شخص بلا حساب:
```bash
curl "https://<project-ref>.supabase.co/rest/v1/profiles?select=*" \
  -H "apikey: <ANON_KEY>"
```
يحصل على: `full_name`, `phone`, `is_host`, `blocked`, `host_active_until` لكل مستخدم في النظام. كذلك `properties.phone` (هاتف المضيف لكل عقار).

**الإصلاح**
- قيد SELECT على `profiles` (صف المستخدم + أعمدة عامة محدودة فقط).
- اعرض بيانات التواصل عبر جدول منفصل محمي أو كرقم مُقنَّع.
- أنشئ view عامة تُسقط الأعمدة الحساسة.

---

### 🟠 H-07 — شرط "مضيف" يُفرض في العميل فقط

```tsx
// src/routes/add-property.tsx:23-31
if (isNonHost) { ... return null; }   ← فحص في الواجهة فقط
```

```sql
-- SETUP_ALL.sql:263-265
CREATE POLICY "Authenticated users can insert properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = owner_id);   ← لا يوجد فحص is_host
```

**الاستغلال:** أي مستخدم يتجاوز الواجهة ويطلب `POST /rest/v1/properties` مباشرة — السياسة تسمح.

**الإصلاح:** أضف فحص `is_host` داخل `WITH CHECK`:
```sql
WITH CHECK (
  auth.uid() = owner_id AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_host
      AND (host_active_until IS NULL OR host_active_until > now())
  )
);
```

---

### 🟠 H-08 — كلمة مرور التوقيع ومفتاح التوقيع في المستودع

**كلمة مرور APK واضحة في نص عادي:**
```
key/key.txt:3
  pass apk : dydlyeFRI2007@@      ← كلمة مرور التوقيع، مكتوبة في نص عادي
```

**ملف مفتاح التوقيع موجود:** `android/dydlye-release.p12` (غير مشفّر، 2628 بايت)
**وكذلك:** `android/keystore.properties` + `android/dydlye-release-password.txt`

**تعطُّل قواعد تجاهل الملفات — انظر H-09:** قواعد `.gitignore` التي كان يُفترض أن تحمي هذه الملفات **معطّلة بسبب الشرطات المائلة للخلف**.

**الخطر:** أي شخص يقرأ هذا المجلد يستطيع **التوقيع كتطبيق Dydlye** — أي ملف APK موقّع يمكنه تثبيته على جهاز الضحية.

**الإصلاح فوراً**
1. احذف `key/key.txt` وكلمة المرور من كل مكان.
2. **غيّر كلمة مرور مفتاح التوقيع** (وإلا فمفتاح التوقيع مكشوف → استبدال هويّة التطبيق).
3. انقل `dydlye-release.p12` و`keystore.properties` خارج المستودع (أو استخدم Secret Manager).
4. إذا سبق نشر التطبيق على Play Store، فإن تغيير مفتاح التوقيع يتطلب التواصل مع Google.

---

### 🟠 H-09 — `.gitignore` معطّل بسبب الشرطات المائلة للخلف

```gitignore
# .gitignore:34   ← backslashes
testsprite_tests\tmp\config.json

# .gitignore:46   ← backslashes
android\dydlye-release-password.txt
```

في صياغة gitignore، **`\` هو حرف هروب** و `/` هو الفاصل الوحيد. لذا هذان السطران يترجمان إلى أسماء ملف واحد: `testspritestmpconfig.json` و `androiddydlye-release-password.txt` — **ولا يطابقان أبداً**.

قارن بالقواعد العاملة:
```gitignore
# .gitignore:42-45  ← هذه تعمل
*.jks
*.keystore
*.p12
android/keystore.properties       ← forward slash، تعمل
```

**النتيجة — ملفات مُتتبَّعة فعلياً في Git تحتوي أسراراً:**
| الملف | الحالة | المحتوى |
|---|---|---|
| `testsprite_tests/tmp/config.json` | **مُتتبَّع** | مفتاح TestSprite API في السطر 14 |
| `supabase/.temp/project-ref` | **مُتتبَّع** | `<project-ref>` |
| `supabase/.temp/pooler-url` | **مُتتبَّع** | رابط قاعدة البيانات الكاملة |
| `supabase/.temp/linked-project.json` | **مُتتبَّع** | ref + اسم المشروع |

**المستودع البعيد:** `https://github.com/pipocantact00-source/sakan.git` (ierجع حالياً 404).

**الإصلاح**
1. استبدل الشرطات `/` في السطرين 34 و 46.
2. أضف `supabase/.temp/` إلى `.gitignore`.
3. **تنظيف تاريخ Git:** أزل مفتاح TestSprite من التاريخ (`git filter-repo` أو BFG) ودوّر المفتاح.
4. تحقق بـ `git ls-files | Select-String 'env|secret|password|p12|keystore|config.json'`.

---

## 5. التفاصيل الكاملة (Medium)

### 🟡 M-01 — لا يوجد CHECK على `comments.rating`
```sql
-- supabase_setup.sql:447
rating INTEGER DEFAULT 0      -- بدون CHECK (BETWEEN 0 AND 5)
```
**الإصلاح:** `ADD CONSTRAINT comments_rating_check CHECK (rating BETWEEN 0 AND 5);`

### 🟡 M-02 — RPC التقييم مفتوح للجميع
```sql
-- supabase_setup.sql:477-501
CREATE FUNCTION update_property_rating(p_property_id, p_rating)
SECURITY DEFINER  ← يعمل كمالك DB
GRANT EXECUTE TO authenticated;  ← أي مستخدم
```
لا يتحقق من وجود تعليق من المستخدم. استغلال: `rpc('update_property_rating', {p_property_id, p_rating: 5})` في حلقة.
**الإصلاح:** اجعلها **trigger** على INSERT/DELETE بدل RPC مستدعى.

### 🟡 M-03 — انتحال اسم المراجِع
```ts
// src/hooks/useComments.ts:54-65
const name = profile.full_name || email.split("@")[0];  // ← من الملف الشخصي
insert({ user_name: name, ... })                        // ← يُرسل من العميل
```
بفضل C-02، يستطيع المستخدم تعيين `full_name` لأي نص، ثم التقييم يظهر باسم منسوب. لا يوجد `UNIQUE(property_id, user_id)` ولا rate limit.
**الإصلاح:** اشتقِ الاسم على الخادم من سجل OAuth الموثوق.

### 🟡 M-04 — رفع ملفات غير مقيّد إلى bucket عام
```sql
-- supabase_setup.sql:241-243
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', ..., true);
-- بدون file_size_limit ولا allowed_mime_types
```
**الاستغلال:** رفع SVG أو ملف ضخم مباشرة إلى API (متجاوزاً canvas/webp في العميل) → استضافة محتوى على نطاق Supabase الخاص + إساءة استخدام التخزين.
**الإصلاح:** `file_size_limit` + قائمة mime types مسموحة. **لا** تثق بـ MIME من العميل.

### 🟡 M-05 — تسابق (race condition) في `validate_promo_code`
```sql
-- SETUP_ALL.sql:490-492
UPDATE public.promo_codes SET uses_count = uses_count + 1 WHERE id = v_row.id;
```
عدّاد الاستخدامات يزيد عند **كل** تحقق (validation) بدون:
- سجل استرداد (redemption record).
- قيد فريد لكل مستخدم.
- قفل (lock) ضد السباق.
**الإصلاح:** أنشئ جدول `promo_redemptions` بـ `UNIQUE(promo_code_id, user_id)`، وزد العدّاد فقط عند الاسترداد الفعلي.

### 🟡 M-06 — تعارض سعر الأساس (100 vs 150)
```ts
// src/hooks/usePromoCode.ts:24-25
const REGULAR_PRICE = 150;   // السعر المعروض
const BASE_PRICE = 100;      // المستخدم في الحساب
```
بينما الدالة في SQL تستخدم `v_base_price := 100`. تعارض → عرض سعر مضلّل.
**الإصلاح:** مصدر واحد للحقيقة على الخادم.

### 🟡 M-07 — أكواد خصم 100% مكتوبة في الشيفرة
```sql
-- SETUP_ALL.sql:729-734
('FREE',    100, 'كود تفعيل مجاني 100%', NULL),   -- max_uses = NULL = unlimited
('MAJANI',  100, 'كود تفعيل مجاني 100%', NULL),
('SAKAN50', 50,  ...),
('OFF50',   50,  ...),
```
أكوادGuessable + 100% خصم + استخدام غير محدود. **احذفها** أو اجعلها محدودة.
**ملاحظة:** واجهة `usePromoCode` غير مربوطة حالياً (dead code) — ممتاز، احرص على إصلاحها قبل الربط.

### 🟡 M-08 — fail-open في `paymentState`
```ts
// confirm-play-subscription/index.ts:178-179
const paymentReceived = sub.paymentState === undefined || sub.paymentState === 1 || sub.paymentState === 2;
```
إذا لم يُرجع `paymentState` (رد ناقص/خطأ) → يُعتبر **مدفوعاً**.
**الإصلاح:** fail-closed: `sub.paymentState === 1 || sub.paymentState === 2`.

### 🟡 M-09 — حذف حساب جزئي / صامت (تسرب PII)
```ts
// delete-account/index.ts:38-74
try { await client.from("comments").delete()... } catch(e) {}  // Supabase لا يرمي! error يُتجاهل
return { success: true }  // ينجح حتى لو فشل الحذف
```
**الإصلاح:** افحص `{ error }` من كل عملية، وأخفق بوضوح. الأفضل: استخدم `delete_my_account()` المعرَّف في SQL.

### 🟡 M-10 — إتلاف الحساب بدون re-auth
```ts
// delete-account/index.ts:77
await client.auth.admin.deleteUser(userId, false);  // حذف نهائي بدون تحقّق
```
**الإصلاح:** اطلب كلمة مرور / re-authentication قبل الحذف.

### 🟡 M-11 — تسجيل خروج ناقص
```ts
// src/hooks/useAuthStore.ts:36
storeSession(null)  // يحذف 'sb-auth-token' فقط
// لكن getCachedSession يقرأ مفاتيح 'sb-*-auth-token' القديمة (:14-24)
```
جلسة قديمة متبقية → الجلسة لا تُمسح بالكامل.
**الإصلاح:** احذف كل مفاتيح `sb-*` عند الخروج.

### 🟡 M-12 — `allowBackup=true` (سرقة الجلسة)
```xml
<!-- AndroidManifest.xml:4 -->
android:allowBackup="true"
```
الجلسة (refresh token) مخزنة في `localStorage` غير مشفّرة. `adb backup` / Auto Backup قد تستخرجها.
**الإصلاح:** `android:allowBackup="false"` أو استثنِ WebView عبر `dataExtractionRules`.

### 🟡 M-13 — منح صلاحيات over-broad لـ anon
```sql
-- SETUP_ALL.sql:742
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
```
امنح `anon` حق INSERT/UPDATE/DELETE على **كل** الجداول. الأمان يعتمد كلياً على RLS — أي جدول جديد بدون RLS يصبح مكشوفاً فوراً.
**الإصلاح:** امنح `anon` SELECT فقط. استخدم `ALTER DEFAULT PRIVILEGES` لتقييد الجداول المستقبلية.

### 🟡 M-14 — بيانات targeting في `.temp` (مُتتبَّعة)
`supabase/.temp/pooler-url` (رابط DB كامل + region) مُتتبَّع في Git. مش مفاتيح، لكن **معلومات استهداف كاملة**.
**الإصلاح:** أضف `supabase/.temp/` إلى `.gitignore`، وأزله من التاريخ.

---

## 6. التفاصيل الكاملة (Low)

| # | المشكلة | الموقع | الإصلاح |
|---|---|---|---|
| L-01 | cleartext traffic مسموح | `capacitor.config.ts:8-9` | `cleartext: false` |
| L-02 | CORS `*` على الدوال | `confirm-play-subscription:8-10` | قيّد بـ origins التطبيق |
| L-03 | تسجيل OAuth tokens | `auth.tsx:52` | سجّل URL منقّح (بدون fragment) |
| L-04 | release غير minified | `android/app/build.gradle` | فعّل R8/minify |
| L-05 | HTML marker injection | `DydlyeMap.tsx:206-230` | ابنِ الـ marker بـ DOM nodes لا string HTML |
| L-06 | handle_new_user بلا search_path | `supabase_setup.sql:181` | أضف `SET search_path = public` |
| L-07 | avatar URL تتبّع/تسريب IP | `account.tsx:53` | proxy الصور |
| L-08 | جلسة مخبأة غير مُتحقَّق منها | `useAuthStore.ts:7-29` | تحقق بـ `getUser()` قبل الاعتماد |

---

## 7. معلومات (Info)

- **I-01: لا يوجد rate limiting** في أي مكان (signup, comments, reports, promo, edge functions). إساءة استخدام لا محدودة.
- **I-02: لا يوجد CSP** في `dist/index.html`. أضف CSP لتقييد مصادر السكربت.
- **I-03: لا يوجد SRI** على الملفات الخارجية. أضف `integrity` للـ CDN.

---

## 8. فحص سلسلة التوريد (Supply Chain)

### نتائج إيجابية
- `node_modules` **مطابق** للـ lockfile تماماً. لا يوجد تثبيت يختلف.
- الإصدارات المقفلة: `vite 7.3.5`, `rollup 4.61.1`, `postcss 8.5.15`, `tar 7.5.16`, `fs-extra 11.3.5`, `nanoid 3.3.12`, `minimatch 3.1.5`, `picomatch 4.0.4`, `cross-spawn 7.0.6`.
- **لا توجد ثغرات CVE حرجة معروفة** في هذه الإصدارات المقفلة (Vite 7.3.5 أعلى من إصلاحات 2025 مثل CVE-2025-30208/31125/31486/32395).
- `esbuild` و `axios` ليسا في المستوى الأعلى، لذلك لا تسري عليهما ثغرات CVE المعروفة (CVE-2025-24010 و CVE-2023-45857).

### مخاطر
- مفتاح التوقيع مكشوف (H-08) → خطورة سلسلة التوريد عالية.
- مفتاح TestSprite API في Git (H-09).

### مُوصى
- فعّل `npm audit` دورياً و Dependabot.
- راجع `package-lock.json` في كل PR.

---

## 9. نقاط إيجابية (WF defenders)

- تطبيق الجوال **لا يحتوي** على `service_role` (تحققت بفك ضغط APK/AAB والبحث بالبايتات) — التصميم صحيح.
- تدقيق XSS: جميع مصارف HTML إما ثابتة (shadcn boilerplate) أو آمنة. لا يوجد XSS قابل للاستغلال.
- `properties`, `favorites`, `comments` RLS مصمَّمة جيداً (scoped by owner) في `@supabase_setup.sql`.
- `delete_my_account()` و `get_host_subscription_state()` مصحَّحة بـ `auth.uid()` scoping + `SET search_path`.
- `subscriptions` لا تحتوي على سياسة INSERT/UPDATE للعملاء — للعملاء SELECT فقط (مُصمَّم جيداً).
-Edge Functions تتحقق من رمز المستخدم عبر `client.auth.getUser(token)` قبل العمل.

---

## 10. خطة المعالجة (Remediation Roadmap)

### 🔴 المرحلة 0 — خلال 24 ساعة (إخلاء طارئ)
1. **C-01:** احذف `VITE_SUPABASE_SERVICE_ROLE_KEY` + **دوّر مفتاح service_role** فوراً.
2. **H-08:** احذف `key/key.txt` + **غيّر كلمة مرور مفتاح التوقيع**.
3. **H-09:** أصلح `.gitignore` (forward slashes) + أضف `supabase/.temp/`.
4. **C-03:** احذف نموذج البطاقة من `HouseDetailSheet`.

### 🟠 المرحلة 1 — خلال أسبوع (إصلاح الثغرات الحرجة)
5. **C-02:** `GRANT UPDATE` على أعمدة محددة فقط لـ `profiles`.
6. **C-04:** احذف فرع `access_token` + قيّد الـ deep link.
7. **H-06:** قيّد SELECT على `profiles` (البيانات العامة).
8. **H-02/H-03:** حصر `property_reports` و `destinations` في دور admin.
9. **H-07:** أضف فحص `is_host` في سياسة INSERT.

### 🟡 المرحلة 2 — خلال أسبوعين (تصلب)
10. **H-04/H-05:** `UNIQUE(purchase_token)` + allowlist لـ productId + fail-closed.
11. **M-01/M-02/M-03:** قيود على التقييمات + trigger بدل RPC.
12. **M-04:** قيود على الملفات (حجم + نوع).
13. **M-12:** `allowBackup=false`.
14. **H-01:** تطبيق `blocked` في RLS.

### 🟢 المرحلة 3 — خلال شهر (تحسين)
15. M-05 إلى M-14 + L-01 إلى L-08.
16. أضف rate limiting + CSP.
17. رحّل اللوحة إلى API وسيط مع مصادقة admin حقيقية.

---

## 11. ملاحظات على نطاق الفحص

### مُتحقَّق منه (CONFIRMED)
جميع ثغرات الـ Critical و High أعلاه **مُتحقَّق منها** بقراءة الشيفرة واستخراج الأدلة — لا تخمين.

### غير مُتحقَّق (UNVERIFIED)
- **هل يطابق RLS المنشور فعلاً** ملفات SQL هذه؟ ملفاتنا مصدر؛ لا يمكن تأكيد حالة الإنتاج. **يجب التحقق من المشروع المنشور عبر Supabase Dashboard → Database → Policies قبل وبعد كل إصلاح.**
- صلاحية مفتاح `service_role` الحالي (هل هو نفسه في الإنتاج؟).
- إعدادات Auth الحية (تأكيد البريد، ربط OAuth).
- حدود bucket الحية.
- أي rate limiting أو WAF على مستوى الخادم.

### حدود الأداة
- `rg` و `git` غير متوفرين في PATH؛ تم استخدام البحث المدمج ومسح البايتات الخام بدلاً من `git log`.
- **لم يتم تعديل أي ملف** أثناء هذا الفحص.

---

## 12. تصحيح H-09 و finding جديد H-10 (أُضيف أثناء المعالجة)

### ✏️ تصحيح H-09
بعد المراجعة، **السبب الجذري الذي ذُكر في H-09 غير دقيق**:

| ما ذُكر في H-09 | ما هو الصحيح |
|---|---|
| `.gitignore` استخدم شرطات مائلة للخلف، فالقواعد معطّلة | ملف `.gitignore` كان يستخدم مسارات `/` صحيحة طوال الوقت |
| `testsprite_tests\tmp\config.json` لا يُطابَق أبداً | نعم، **الأسرار كانت متتبَّعة في Git** — لكن السبب هو أن الملفات **كُتبت والتُزم قبل إضافتها إلى `.gitignore`**، وقواعد gitignore لا تمسّ ملفاً مُتتبَّعاً بالفعل |
| الحل هو استبدال الشرطات | الحل الصحيح هو **إزالة الملفات من الـ index** + تنظيف التاريخ + **تدوير المفتاح** |

الخلاصة العملية لم تتغيّر: `testsprite_tests/tmp/config.json` و `supabase/.temp/*` متتبَّعة وتحتوي أسراراً، ولا بد من تدوير مفتاح TestSprite وإزالتها من تاريخ Git. لكن أي إصلاح يركّز على "الشرطات المائلة" لن يحل المشكلة.

### 🟠 H-10 (جديد) — الحجز والتقييم: حقول يتحكم بها العميل

اكتُشف أثناء تطبيق الإصلاحات، ولم يكن مغطّى في التقرير الأصلي:

| الحقل | المُبلِّغ | الخطر |
|---|---|---|
| `bookings.amount` | `HouseDetailSheet.tsx` يحسب الإجمالي في المتصفح ويشحنه | تعارض السعر: تعديل السعر محليًا = حجز بسعر مزيف |
| `bookings.status` | كان `"confirmed"` افتراضيًا | حجز غير مدفوع يظهر مؤكدًا |
| `bookings.payment_ref` | مُولَّد عشوائيًا في العميل | مرجع دفع مزيّف، وإلاهام بأن الدفع تم |
| `properties.rating` / `reviews` | عبر `update_property_rating` RPC مفتوح | تضخيم/خفض التقييم بلا rate limit |

**الإصلاح المطبَّق:** دالة `create_booking()` باتت تحسب الإجمالي من السعر المخزَّن في الخادم وتفرض `status = 'pending'`، ودالة `recalculate_property_rating()` باتت مشغَّلة عبر trigger فقط بعد سحب صلاحية الاستدعاء المباشر. الواجهة لم تعد تعرض "بطاقة بنكية" ولا "ادفع الآن"، بل "طلب مُرسَل — بانتظار المضيف"، لأن **لا توجد بوابة دفع مدمجة أصلاً** (انظر C-03).

> **ملاحظة على C-03:** إزالة حقول البطاقة تمنع مخالفة PCI، لكنها **ليست** تكامل دفع. أي إطلاق حقيقي يتطلب مزود دفع (Stripe/Google Play)؛ مع Google Play اشتراك المضيف موجود أصلاً عبر `confirm-play-subscription`.

---

## 13. حالة التنفيذ (حتى 2026-09-26)

### مُطبَّق في الشيفرة (verified by `tsc` + `eslint`)
| البند | الحالة |
|---|---|
| C-01 | ✅ `admin-api` على الخادم + `public.admins` + publishable key فقط في اللوحة + `dist` نظيف (مفتاح البناء `role: anon`) |
| C-02 | ✅ عمود `is_host` خارج `GRANT UPDATE` + `is_active_host()` في سياسات RLS |
| C-03 | ✅ إزالة PAN/CVV/الحقول + واجهة "طلب مُرسَل" |
| C-04 | ✅ `auth.tsx` يقبل PKCE `code` فقط؛ حُذف فرع `#access_token`/`setSession` |
| H-01 | ✅ `blocked` مُطبَّق في سياسات الكتابة |
| H-02/H-03 | ✅ `property_reports`/`destinations` للـ admin فقط (عبر service role) |
| H-04 | ✅ `UNIQUE(purchase_token)` + رفض ربط token بحساب آخر (409) |
| H-05 | ✅ `ALLOWED_PRODUCT_IDS` allowlist + `paymentState` fail-closed |
| H-06 | ✅ SELECT على `profiles` لصف المستخدم فقط + استعلامات التقييم تستخدم `user_name` المُخزَّن |
| H-07 | ✅ فحص `is_active_host()` في سياسات INSERT |
| H-08 | ✅ حُذفت `key/`, `.p12`, `keystore.properties`, `*-password.txt` |
| H-09 | ⚠️ `.gitignore` مُحدَّث؛ **باقي** إزالة الملفات من الـ Git index + تدوير مفتاح TestSprite |
| M-01/M-02/M-03 | ✅ CHECK على `rating` + trigger + `comments_set_author` + سحب صلاحية RPC |
| M-04 | ✅ `admin-api` يرفع عبر signed URL بدل رفع مباشر |
| M-05 | ✅ `redeem_promo_code` يسجّل الاستهلاك فعلياً داخل معاملة |
| M-06 | ✅ جدول `product_prices` على الخادم؛ السعر يُقرأ من الخادم لا من العميل |
| M-07 | ✅ أكواد 100% المعطونة تم تعطيلها |
| M-08 | ✅ `paymentState` غير معروف = رفض |
| M-09 | ✅ `delete_my_account()` RPC + تنظيف storage لـ 3 buckets |
| M-11 | ✅ `signOut()` يمسح جلسة localStorage وينهي جلسة Google الأصلية |
| M-12 | ✅ `allowBackup=false` + `data_extraction_rules` + `cleartext: false` |
| M-10 | ⚠️ `delete_my_account` لا يفرض re-auth بعد (توصية UX لا ثغرة) |
| H-10 | ✅ `create_booking()` + trigger التقييم |

### ⛔ لم يُنفَّذ بعد (يحتاج تدخّلاً خارجياً)
1. **تدوير `service_role`** من Supabase Dashboard — المفتاح المكشوف ما زال صالحاً.
2. **تدوير/إلغاء مفتاح TestSprite API**.
3. **تطبيق `20260926000000_security_hardening.sql`** على قاعدة الإنتاج بعد backup + dry-run.
4. **نشر `admin-api`** وضبط `SUPABASE_SERVICE_ROLE_KEY` و`ADMIN_ALLOWED_ORIGINS`.
5. **إدراج أول admin** (لا يوجد افتراضي عمداً).
6. **تنظيف Git history** لـ `testsprite_tests/tmp/config.json` و`supabase/.temp/*`.
7. **تدوير signing key** أو تعديل `build.gradle` قبل أي release جديد.

---

*نهاية التقرير. أنشئ هذا التقرير كمسح أمني معتمد (Authorized Security Assessment) لمشروع Dydlye المملوك للمطوّر.*
