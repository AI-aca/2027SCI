const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase.from('students').select('*');
  const student = data.find(s => (s.student_name || s.name || '').includes('권현민'));
  if (student) {
    const link = student.student_link;
    const { data: aiData } = await supabase.from('ai_feedback_history').select('*').eq('student_link', link);
    console.log('권현민 타겟 학교:', student.target_school || student.targetSchool);
    console.log(aiData.map(d => d.type));
  } else {
    console.log('학생 못 찾음');
  }
}
run();
