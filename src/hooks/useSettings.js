import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rekaz-theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rekaz-theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  return { theme, toggleTheme }
}

// ─────────────────────────────────────────────────────────────────────
//  اللغة — مخزن واحد يشترك فيه كل المكوّنات.
//
//  كانت useLang تُنشئ حالة مستقلة داخل كل مكوّن، فزرّ «عربي» في الشريط
//  العلوي يغيّر لغة Layout وحده، وتبقى بقية الصفحات بالإنجليزية حتى
//  يُعاد تحميل الصفحة. الآن التبديل يُبثّ إلى كل المشتركين فوراً.
// ─────────────────────────────────────────────────────────────────────
const LANG_KEY = 'rekaz-lang'
const langSubs = new Set()

function readLang() {
  try { return localStorage.getItem(LANG_KEY) || 'en' } catch { return 'en' }
}
let currentLang = readLang()

function applyLang(l) {
  document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', l)
}

export function useLang() {
  const [lang, setLangState] = useState(currentLang)

  useEffect(() => {
    const sub = l => setLangState(l)
    langSubs.add(sub)
    // لو تغيّرت اللغة قبل أن يُركَّب هذا المكوّن
    if (currentLang !== lang) setLangState(currentLang)
    applyLang(currentLang)
    return () => { langSubs.delete(sub) }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  function setLang(l) {
    if (l === currentLang) return
    currentLang = l
    try { localStorage.setItem(LANG_KEY, l) } catch { /* وضع التصفح الخاص */ }
    applyLang(l)
    langSubs.forEach(fn => fn(l))
  }

  function toggleLang() { setLang(currentLang === 'en' ? 'ar' : 'en') }

  return { lang, toggleLang, setLang }
}

// Arabic translations
export const T = {
  en: {
    dashboard: 'Dashboard', projects: 'Projects', siteVisits: 'Site Visits',
    tasks: 'Tasks', milestones: 'Milestones', dailyLogs: 'Daily Logs',
    photos: 'Photos', drawings: 'Drawings', reports: 'Reports',
    schedule: 'Schedule', users: 'Users', signOut: 'Sign Out',
    newProject: '+ New Project', newVisit: '+ New Visit',
    newTask: '+ New Task', newReport: '+ New Report',
    newMilestone: '+ New Milestone', newLog: '+ New Log',
    edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
    create: 'Create', loading: 'Loading...', saving: 'Saving...',
    noData: 'No data yet.', search: 'Search...',
    totalProjects: 'Total Projects', openTasks: 'Open Tasks',
    siteVisitsLabel: 'Site Visits', reportsLabel: 'Reports',
    recentVisits: 'Recent Visits', viewAll: 'View all',
    active: 'active', overdue: 'overdue', recorded: 'Recorded', generated: 'Generated',
    projectName: 'Project Name', projectNo: 'Project No', location: 'Location',
    clientName: 'Client Name', status: 'Status', progress: 'Progress',
    allStatus: 'All Status', signIn: 'Sign In', email: 'Email', password: 'Password',
    siteVisitManager: 'Site Visit Manager',
    upcomingMilestones: 'Upcoming Milestones',
    addVisit: '+ Add Visit', addSchedule: 'Add Scheduled Visit',
    selectProject: 'Select project...', visitDate: 'Visit Date',
    severity: 'Severity', notes: 'Notes', generateReport: 'Generate Report',
    selectVisit: 'Select visit...', printPDF: 'Print / PDF',
    taskTitle: 'Task Title', assignedTo: 'Assigned To', dueDate: 'Due Date',
    description: 'Description', weather: 'Weather', workers: 'Workers Count',
    activities: 'Activities', issues: 'Issues',
    // الجدول
    schWeekOf: 'Week of', schVisit: 'visit', schVisits: 'visits',
    schPrev: '‹ Prev', schNext: 'Next ›', schThisWeek: 'This week',
    schViewList: 'List', schViewGrid: 'Grid',
    schNoVisits: 'No visits scheduled this week.',
    schToday: 'Today', schUnassigned: 'Unassigned',
    schOpenProject: 'Open project',
    schRemindersOn: 'Reminders On', schEnableReminders: 'Enable Reminders',
    schReminderSet: 'Reminder on',
    schBefore15: '15 min before', schBefore30: '30 min before',
    schBefore60: '1 hour before', schBefore120: '2 hours before',
    schNotifBlocked: 'Notifications blocked. Enable them in browser settings.',
    schNotifUnsupported: 'Reminders are not supported on this device.',
    schPushUnsupported: 'This browser does not support web notifications. Reminders will arrive by email only.',
    schReminderSaveFailed: 'Could not save the reminder time. Please try again.',
    consultations: 'Consultations',
  },
  ar: {
    dashboard: 'لوحة التحكم', projects: 'المشاريع', siteVisits: 'زيارات المواقع',
    tasks: 'المهام', milestones: 'مراحل المشروع', dailyLogs: 'السجل اليومي',
    photos: 'الصور', drawings: 'المخططات', reports: 'التقارير',
    schedule: 'الجدول', users: 'المستخدمون', signOut: 'تسجيل الخروج',
    newProject: '+ مشروع جديد', newVisit: '+ زيارة جديدة',
    newTask: '+ مهمة جديدة', newReport: '+ تقرير جديد',
    newMilestone: '+ مرحلة جديدة', newLog: '+ سجل جديد',
    edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
    create: 'إنشاء', loading: 'جاري التحميل...', saving: 'جاري الحفظ...',
    noData: 'لا توجد بيانات بعد.', search: 'بحث...',
    totalProjects: 'إجمالي المشاريع', openTasks: 'المهام المفتوحة',
    siteVisitsLabel: 'زيارات المواقع', reportsLabel: 'التقارير',
    recentVisits: 'الزيارات الأخيرة', viewAll: 'عرض الكل',
    active: 'نشط', overdue: 'متأخر', recorded: 'مسجّل', generated: 'منشأ',
    projectName: 'اسم المشروع', projectNo: 'رقم المشروع', location: 'الموقع',
    clientName: 'اسم العميل', status: 'الحالة', progress: 'التقدم',
    allStatus: 'كل الحالات', signIn: 'تسجيل الدخول', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    siteVisitManager: 'نظام إدارة زيارات المواقع',
    upcomingMilestones: 'المراحل القادمة',
    addVisit: '+ إضافة زيارة', addSchedule: 'إضافة زيارة مجدولة',
    selectProject: 'اختر مشروع...', visitDate: 'تاريخ الزيارة',
    severity: 'الخطورة', notes: 'الملاحظات', generateReport: 'إنشاء تقرير',
    selectVisit: 'اختر زيارة...', printPDF: 'طباعة / PDF',
    taskTitle: 'عنوان المهمة', assignedTo: 'مسند إلى', dueDate: 'تاريخ التسليم',
    description: 'الوصف', weather: 'الطقس', workers: 'عدد العمال',
    activities: 'الأنشطة', issues: 'المشاكل',
    // الجدول
    schWeekOf: 'أسبوع', schVisit: 'زيارة', schVisits: 'زيارات',
    schPrev: '› السابق', schNext: 'التالي ‹', schThisWeek: 'هذا الأسبوع',
    schViewList: 'قائمة', schViewGrid: 'شبكة',
    schNoVisits: 'لا زيارات مجدولة هذا الأسبوع.',
    schToday: 'اليوم', schUnassigned: 'بلا مهندس',
    schOpenProject: 'فتح المشروع',
    schRemindersOn: 'التذكيرات مفعّلة', schEnableReminders: 'تفعيل التذكيرات',
    schReminderSet: 'تذكير مفعّل',
    schBefore15: 'قبل ١٥ دقيقة', schBefore30: 'قبل ٣٠ دقيقة',
    schBefore60: 'قبل ساعة', schBefore120: 'قبل ساعتين',
    schNotifBlocked: 'الإشعارات محظورة. فعّلها من إعدادات المتصفح.',
    schNotifUnsupported: 'التذكيرات غير مدعومة على هذا الجهاز.',
    schPushUnsupported: 'هذا المتصفح لا يدعم إشعارات الويب. ستصلك التذكيرات بالبريد الإلكتروني فقط.',
    schReminderSaveFailed: 'تعذّر حفظ مدة التذكير. حاول مرة أخرى.',
    consultations: 'الاستشارات الهندسية',
  }
}
