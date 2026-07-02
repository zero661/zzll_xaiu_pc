import ICAL from 'ical.js';

// 学期开始日期：2026年3月2日（周一）
export const SEMESTER_START = new Date(2026, 2, 2); // 月份从0开始，2表示3月

// 解析课程名称和地点
const parseSummary = (summary) => {
  const match = summary.match(/^([^★]+)[★]?\s+(.+?)\s+([^\s]+)\s+\((\d+)-(\d+)节\)/);
  if (match) {
    return {
      name: match[1].trim(),
      location: `${match[2]} ${match[3]}`,
      startSection: parseInt(match[4]),
      endSection: parseInt(match[5])
    };
  }
  return {
    name: summary.replace(/[★■]/g, '').trim(),
    location: '',
    startSection: null,
    endSection: null
  };
};

// 解析周次描述，支持单双周标记
const parseWeekDescription = (summary) => {
  const weekPartMatch = summary.match(/(\d+(-\d+)?周(?:\([单双]\))?(?:,\d+(-\d+)?周(?:\([单双]\))?)*)/);
  if (!weekPartMatch) return [];
  
  const weekStr = weekPartMatch[0];
  const segments = weekStr.split(',');
  const weekInfo = [];
  
  segments.forEach(seg => {
    seg = seg.trim();
    if (!seg) return;
    
    const parityMatch = seg.match(/\(([单双])\)/);
    let parity = null;
    if (parityMatch) {
      parity = parityMatch[1] === '单' ? 'odd' : 'even';
      seg = seg.replace(/\([单双]\)/, '');
    }
    
    const rangeMatch = seg.match(/^(\d+)(?:-(\d+))?周$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : start;
      weekInfo.push({ startWeek: start, endWeek: end, parity });
    }
  });
  
  return weekInfo;
};

// 判断给定周次是否在周次信息内
const isWeekInRange = (weekNum, weekInfo) => {
  if (!weekInfo || weekInfo.length === 0) return true;
  
  return weekInfo.some(info => {
    if (weekNum < info.startWeek || weekNum > info.endWeek) return false;
    if (info.parity) {
      const isOdd = weekNum % 2 === 1;
      return (info.parity === 'odd' && isOdd) || (info.parity === 'even' && !isOdd);
    }
    return true;
  });
};

// 解析 ICS 文件
export const parseICS = (icsContent) => {
  try {

    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const coursesMap = new Map();

    vevents.forEach((vevent) => {
      const event = new ICAL.Event(vevent);
      const summary = event.summary || '';

      if (summary.startsWith('第') && summary.endsWith('周')) {
        return;
      }

      const dtstart = vevent.getFirstPropertyValue('dtstart');
      if (!dtstart) return;

      const { name, location, startSection, endSection } = parseSummary(summary);

      const startDate = dtstart.toJSDate();
      const weekday = startDate.getDay();

      const startHour = startDate.getHours();
      const startMinute = startDate.getMinutes();
      const dtend = vevent.getFirstPropertyValue('dtend');
      let endHour = startHour + 2;
      let endMinute = startMinute;
      if (dtend) {
        const endDate = dtend.toJSDate();
        endHour = endDate.getHours();
        endMinute = endDate.getMinutes();
      }

      const course = {
        name: name,
        location: location,
        weekday: weekday,
        startTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
        endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
        startSection: startSection,
        endSection: endSection,
        weekInfo: parseWeekDescription(summary),
        rawSummary: summary
      };

      const courseKey = `${course.name}_${course.weekday}_${course.startTime}_${course.location}`;
      if (!coursesMap.has(courseKey)) {
        coursesMap.set(courseKey, course);
      }
    });

    const courses = Array.from(coursesMap.values());
    return courses;
  } catch (error) {
    console.error('[解析ICS] 解析失败:', error);
    return [];
  }
};

// 根据指定周次筛选课程
export const getCoursesByWeek = (courses, weekNum) => {
  return courses.filter(course => isWeekInRange(weekNum, course.weekInfo));
};

// 根据指定日期筛选当天课程
export const getCoursesByDate = (courses, date) => {
  const diffDays = Math.floor((date - SEMESTER_START) / (1000 * 60 * 60 * 24));
  const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
  
  let weekday = date.getDay();
  if (weekday === 0) weekday = 7;

  return courses.filter(course => {
    if (!isWeekInRange(weekNum, course.weekInfo)) return false;
    let courseWeekday = course.weekday;
    if (courseWeekday === 0) courseWeekday = 7;
    return courseWeekday === weekday;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));
};

// 获取今日课程
export const getTodayCourses = (courses) => {
  return getCoursesByDate(courses, new Date());
};

// 获取时间段显示
export const getTimeRange = (course) => {
  if (course.startSection && course.endSection) {
    const sectionMap = {
      1: '08:00-09:50',
      2: '08:00-09:50',
      3: '10:00-11:50',
      4: '10:00-11:50',
      5: '14:00-15:50',
      6: '14:00-15:50',
      7: '16:00-17:50',
      8: '16:00-17:50'
    };
    const timeRange = sectionMap[course.startSection];
    if (timeRange) {
      return `${course.startSection}-${course.endSection}节 (${timeRange})`;
    }
    return `${course.startSection}-${course.endSection}节`;
  }
  return `${course.startTime}-${course.endTime}`;
};

// 获取当前周数
export const getCurrentWeek = () => {
  const now = new Date();
  const diffTime = now - SEMESTER_START;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
};