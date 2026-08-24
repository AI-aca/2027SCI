const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXCEPTIONAL_STUDENTS = ['조현서', '장윤원', '정주훈', '이동현'];

// 15자리 난수 생성
function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for(let i=0; i<15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
    const students = await fetchAll('students');
    const teacherFb = await fetchAll('teacher_feedbacks');
    const aiFb = await fetchAll('ai_feedback_history');
    const ps = await fetchAll('personal_statements');
    
    let report = [];
    
    for (const targetName of EXCEPTIONAL_STUDENTS) {
      const student = students.find(s => (s.student_name || s.name || '').trim() === targetName);
      if (!student) {
        console.log(`${targetName} 학생을 찾을 수 없습니다.`);
        continue;
      }
      
      const link = student.student_link;
      const sTeacherFb = teacherFb.filter(f => f.student_link === link);
      const sAiFb = aiFb.filter(f => f.student_link === link);
      const sPs = ps.filter(p => p.student_link === link);
      
      const tSchool = (student.target_school || student.targetSchool || '').trim();

      // 정렬 헬퍼 함수
      const sorter = (a, b) => {
        // 1. 현재 지원학교 우선
        const aSchool = (a.version_label || '').trim();
        const bSchool = (b.version_label || '').trim();
        const aIsTarget = (aSchool === tSchool) ? 0 : 1;
        const bIsTarget = (bSchool === tSchool) ? 0 : 1;
        if (aIsTarget !== bIsTarget) return aIsTarget - bIsTarget;
        
        // 2. 학교명 가나다순 (구 학교들 간 정렬)
        if (aSchool !== bSchool) return aSchool.localeCompare(bSchool);

        // 3. 문항번호 정밀 오름차순 (1-1, 1-2 등 소문항 완벽 인식)
        let aQNum = a.question_no || '';
        let bQNum = b.question_no || '';
        if (a.type && a.type.includes('문항')) aQNum = a.type;
        if (b.type && b.type.includes('문항')) bQNum = b.type;
        
        const parseQNum = (q) => {
            const match = String(q).match(/(\d+)(?:-(\d+))?/);
            if (!match) return [999, 999];
            return [parseInt(match[1], 10), match[2] ? parseInt(match[2], 10) : 0];
        };
        
        const [aMain, aSub] = parseQNum(aQNum);
        const [bMain, bSub] = parseQNum(bQNum);
        if (aMain !== bMain) return aMain - bMain;
        if (aSub !== bSub) return aSub - bSub;

        // 4. 시간 흐름 오름차순 (오래된 과거 데이터가 먼저 -> 최근 데이터가 나중에)
        const aDate = new Date(a.updated_at || a.timestamp || 0).getTime();
        const bDate = new Date(b.updated_at || b.timestamp || 0).getTime();
        return aDate - bDate; // 과거 -> 최신
      };

      sPs.sort(sorter);
      sTeacherFb.sort(sorter);
      sAiFb.sort(sorter);

      const filename = generateId() + '.md';
      
      let mdContent = `# ${targetName} 학생 백업 (학생 링크: ${link})\n\n`;
      mdContent += `> 이 파일은 (구) 탭 데이터를 포함하는 예외 학생의 수동 복구를 위해 생성된 백업본입니다.\n`;
      mdContent += `> **[현재 지원학교]: ${tSchool || '지정 안됨'}**\n\n`;
      
      mdContent += `## 1. 자기소개서 내용 (personal_statements)\n`;
      sPs.forEach(p => {
        mdContent += `### 문항: ${p.question_no} | 학교: ${p.version_label || '(없음)'}\n`;
        mdContent += `- 갱신 일시: ${p.updated_at || '알 수 없음'}\n\n`;
        mdContent += `${p.content}\n\n---\n`;
      });
      
      mdContent += `## 2. 강사 수기 피드백 (teacher_feedbacks)\n`;
      sTeacherFb.forEach(f => {
        mdContent += `### 문항: ${f.question_no} | 학교: ${f.version_label || '(없음)'}\n`;
        mdContent += `- 갱신 일시: ${f.updated_at || '알 수 없음'}\n\n`;
        mdContent += `${f.feedback}\n\n---\n`;
      });
      
      mdContent += `## 3. AI 피드백 (ai_feedback_history)\n`;
      sAiFb.forEach(f => {
        mdContent += `### 타입: ${f.type}\n`;
        mdContent += `- 생성 일시: ${f.timestamp || '알 수 없음'}\n\n`;
        mdContent += `${f.feedback}\n\n---\n`;
      });
      
      const filepath = __dirname + '/' + filename;
      fs.writeFileSync(filepath, mdContent, 'utf8');
      report.push(`${filename} = ${targetName} 학생 백업본`);
    }
    
    console.log(report.join('\n'));
    
  } catch(e) {
    console.error(e);
  }
}

run();
