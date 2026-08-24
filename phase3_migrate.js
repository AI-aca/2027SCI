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
    console.log('[Phase 3] 수파베이스 데이터 마이그레이션 시작 (1,000행 페이징 적용)...');
    
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

    let teacherUpdated = 0;
    let aiUpdated = 0;

    // 1. 강사 수기 피드백 업데이트
    for (const f of teacherFeedbacks) {
      const sName = studentMap[f.student_link] || 'Unknown';
      if (EXCEPTIONAL_STUDENTS.includes(sName)) continue;

      const tSchool = targetSchoolMap[f.student_link];
      if (tSchool && (!f.version_label || f.version_label.trim() === '')) {
        const { error } = await supabase.from('teacher_feedbacks')
            .update({ version_label: tSchool })
            .eq('student_link', f.student_link)
            .eq('question_no', f.question_no);
        if (error) throw error;
        teacherUpdated++;
      }
    }

    // 2. AI 피드백 타입 변환
    for (const f of aiFeedbacks) {
      const sName = studentMap[f.student_link] || 'Unknown';
      if (EXCEPTIONAL_STUDENTS.includes(sName)) continue;

      const tSchool = targetSchoolMap[f.student_link];
      if (tSchool && !f.type.includes('[')) { // 낡은 방식
        // "문항1_체크리스트" -> "문항[학교명|문항1]_체크리스트"
        let qPart = f.type.split('_')[0]; // "문항1"
        let suffix = f.type.replace(qPart, ''); // "_체크리스트"
        // qPart에서 '문항' 제거 후 순수 번호 추출 (옵션) 하지만 프론트에서 "문항[학교|문항1]_체크리스트"를 씀
        // 스크립트의 compositeQNum은 "학교명|문항1" 형태임. 
        // 스크립트 1609: const newType = '문항[' + compositeQNum + ']_체크리스트';
        // 즉 "문항[인천과학고|문항1]_체크리스트" 형태임.
        
        const qNumOnly = qPart.replace('문항', '');
        const newType = `문항[${tSchool}|문항${qNumOnly}]${suffix}`;

        const { error } = await supabase.from('ai_feedback_history')
            .update({ type: newType })
            .eq('id', f.id);
        if (error) throw error;
        aiUpdated++;
      }
    }

    console.log(`\n✅ 마이그레이션 완료`);
    console.log(`- 강사 수기 피드백 업데이트: ${teacherUpdated} 건`);
    console.log(`- AI 피드백 업데이트: ${aiUpdated} 건`);

  } catch(e) {
    console.error('에러 발생:', e);
  }
}
run();
