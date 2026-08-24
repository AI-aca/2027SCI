const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXCEPTIONAL_STUDENTS = ['조현서', '장윤원', '정주훈', '이동현'];

async function fetchAll(table) {
  let allData = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < limit) break;
    from += limit;
  }
  return allData;
}

async function run() {
  try {
    console.log('[Dry Run] 수파베이스 데이터 스캔 시작 (1,000행 페이징 알고리즘 가동)...');
    
    const students = await fetchAll('students');
    const studentMap = {}; 
    const targetSchoolMap = {}; 
    
    students.forEach(s => {
      const name = (s.student_name || s.name || '').trim();
      studentMap[s.student_link] = name;
      targetSchoolMap[s.student_link] = (s.target_school || '').trim();
    });

    const teacherFeedbacks = await fetchAll('teacher_feedbacks');
    const aiFeedbacks = await fetchAll('ai_feedback_history');

    let normalTeacherFbCount = 0;
    let normalAiFbCount = 0;
    let exceptionTeacherFbCount = 0;
    let exceptionAiFbCount = 0;

    teacherFeedbacks.forEach(f => {
      const sName = studentMap[f.student_link] || 'Unknown';
      if (EXCEPTIONAL_STUDENTS.includes(sName)) {
        exceptionTeacherFbCount++;
      } else {
        normalTeacherFbCount++;
      }
    });

    aiFeedbacks.forEach(f => {
      const sName = studentMap[f.student_link] || 'Unknown';
      if (EXCEPTIONAL_STUDENTS.includes(sName)) {
        exceptionAiFbCount++;
      } else {
        // We only care about legacy types for normal students
        if (!f.type.includes('[')) {
            normalAiFbCount++;
        }
      }
    });

    console.log('\n--------------------------------------------------');
    console.log('✅ 스캔 완료. [단일 학교(99%) 학생 마이그레이션 대상]');
    console.log(`- 강사 수기 피드백 업데이트 대상: ${normalTeacherFbCount} 건 (현재 DB 상 빈 version_label에 학교명 부착 예정)`);
    console.log(`- AI 피드백 업데이트 대상: ${normalAiFbCount} 건 (과거 타입명을 신규 복합키로 치환 예정)`);
    console.log('\n✅ [수동 복구 4인방 (조현서, 장윤원, 정주훈, 이동현) 백업 대상]');
    console.log(`- 강사 수기 피드백 백업 대상: ${exceptionTeacherFbCount} 건 (수동 복구 후 기존 데이터는 유지)`);
    console.log(`- AI 피드백 현황: ${exceptionAiFbCount} 건`);
    console.log('--------------------------------------------------\n');
    console.log('결과를 대화창에 보고해 주십시오.');

  } catch(e) {
    console.error('에러 발생:', e);
  }
}
run();
