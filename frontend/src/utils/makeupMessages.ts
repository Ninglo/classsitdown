import type { MakeupOccurrence } from '../types/makeup';

export function generateParentMessage(
  _origin: MakeupOccurrence,
  target: MakeupOccurrence,
  _studentName: string,
): string {
  const weekMatch = target.week_label.match(/^(W\d+)/);
  const weekNum = weekMatch ? weekMatch[1] : 'WX';
  const modeStr = target.mode === '周末' ? '周末' : '周中';
  const location = (target.campus || '') + (target.room || '');
  return `亲爱的家长，请查收${weekNum}周${modeStr}临时补课
班级：${target.class_code}
班主任：${target.head_teacher || '待确认'}
⏰时间：${target.day}${target.time}
🏫地点：${location || '待确认'}

调课请务必携带姓名牌哦~`;
}

export function generateTeacherMessage(
  origin: MakeupOccurrence,
  target: MakeupOccurrence,
  studentName: string,
): string {
  const name = studentName.trim() || 'XXX【需手动填写】';
  const location = (target.campus || '') + (target.room || '');
  return `👩‍🎨亲爱的${target.head_teacher || 'XXX'}

本${target.day}您的${target.class_code}班会有个我们班${origin.class_code}去补课的孩子

我和你确认一下上课进度是${target.lesson}
⏰时间：${target.day}${target.time}
🏫地点：${location || '待确认'}

孩子叫${name}`;
}
