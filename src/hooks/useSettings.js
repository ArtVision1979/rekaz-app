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

export function useLang() {
  const [lang, setLang] = useState(() => localStorage.getItem('rekaz-lang') || 'en')

  useEffect(() => {
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
    localStorage.setItem('rekaz-lang', lang)
  }, [lang])

  function toggleLang() {
    setLang(l => l === 'en' ? 'ar' : 'en')
  }

  return { lang, toggleLang }
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
  }
}
