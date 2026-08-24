const fs = require('fs');
const path = require('path');

function patchIndexHtml() {
  const p = path.join(__dirname, 'index.html');
  let c = fs.readFileSync(p, 'utf8');
  
  const target = '<h3 id="register-modal-title">학생 정보 관리</h3>';
  const repl = `<div style="display: flex; align-items: center; gap: 15px;">
          <h3 id="register-modal-title" style="margin: 0;">학생 정보 관리</h3>
          <label style="font-size: 14px; font-weight: normal; display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--text-muted);">
            <input type="checkbox" id="reg-is-reference"> 참고용 학생
          </label>
        </div>`;
  if(c.includes(target)) {
      c = c.replace(target, repl);
      fs.writeFileSync(p, c, 'utf8');
      console.log('index.html 수정 성공');
  } else {
      console.log('index.html 수정 안됨 (타겟 못찾음)');
  }
}

function patchBackend() {
  const p = path.join(__dirname, 'backend_logic.js');
  let c = fs.readFileSync(p, 'utf8');
  
  const t1 = `student_memo: s.student_memo || ''\n        };`;
  const r1 = `student_memo: s.student_memo || '',\n          isReference: !!s.is_reference\n        };`;
  if (c.includes(t1)) { c = c.replace(t1, r1); }

  const t2 = `expected_questions_ai_ps: '',\n      expected_questions_ai_record: ''\n    };`;
  const r2 = `expected_questions_ai_ps: '',\n      expected_questions_ai_record: '',\n      is_reference: !!studentData.isReference\n    };`;
  if (c.includes(t2)) { c = c.replace(t2, r2); }

  const t3 = `updated_at: new Date().toISOString()\n    };`;
  const r3 = `updated_at: new Date().toISOString(),\n      is_reference: !!studentData.isReference\n    };`;
  if (c.includes(t3)) { c = c.replace(t3, r3); }

  fs.writeFileSync(p, c, 'utf8');
  console.log('backend_logic.js 수정 성공');
}

function patchScript() {
  const p = path.join(__dirname, 'script.js');
  let c = fs.readFileSync(p, 'utf8');

  const t1 = `const val = student[col.key];`;
  const r1 = `const val = student[col.key];
      
      if (student.isReference) {
        const blockedKeys = ['passGifted', 'passRound1', 'passRound2', 'passFinal', 'studentLink', 'studentSms', 'psStatus', 'psProgress', 'psViewer', 'interviewRecord', 'interviewPs', 'manage'];
        if (blockedKeys.includes(col.key)) {
          td.innerHTML = '<span class="text-muted">-</span>';
          tr.appendChild(td);
          return;
        }
      }`;
  if (c.includes(t1)) { c = c.replace(t1, r1); }

  const t2 = `} else if (col.key === 'name') {\n        td.innerHTML = \`<span class="badge" style="background-color: var(--color-primary); font-size: 14px;">\${val}\` + (student.student_memo ? \` <i class="fa-solid fa-comment-dots" style="color: var(--color-warning);" title="메모 있음"></i>\` : "") + \`</span>\`;\n      }`;
  const r2 = `} else if (col.key === 'name') {
        const nameBg = student.isReference ? 'rgba(0, 0, 0, 0.3)' : 'var(--color-primary)';
        const namePrefix = student.isReference ? '[참고] ' : '';
        td.innerHTML = \`<span class="badge" style="background-color: \${nameBg}; font-size: 14px;">\${namePrefix}\${val}\` + (student.student_memo ? \` <i class="fa-solid fa-comment-dots" style="color: var(--color-warning);" title="메모 있음"></i>\` : "") + \`</span>\`;
      }`;
  if (c.includes(t2)) { c = c.replace(t2, r2); }

  const t3 = `['center','name','school','target-school','parent-phone','student-phone','math-teacher','sci-teacher'].forEach(id => {\n      document.getElementById('reg-' + id).value = '';\n    });`;
  const r3 = `['center','name','school','target-school','parent-phone','student-phone','math-teacher','sci-teacher'].forEach(id => {\n      document.getElementById('reg-' + id).value = '';\n    });\n    const refCb = document.getElementById('reg-is-reference');\n    if(refCb) refCb.checked = false;`;
  if (c.includes(t3)) { c = c.replace(t3, r3); }

  const t4 = `document.getElementById('reg-sci-teacher').value = student.sciTeacher || '';`;
  const r4 = `document.getElementById('reg-sci-teacher').value = student.sciTeacher || '';\n  const refCb = document.getElementById('reg-is-reference');\n  if(refCb) refCb.checked = !!student.isReference;`;
  if (c.includes(t4)) { c = c.replace(t4, r4); }

  const t5 = `sciTeacher: document.getElementById('reg-sci-teacher').value\n    };`;
  const r5 = `sciTeacher: document.getElementById('reg-sci-teacher').value,\n      isReference: document.getElementById('reg-is-reference') ? document.getElementById('reg-is-reference').checked : false\n    };`;
  if (c.includes(t5)) { c = c.replace(t5, r5); }
  
  const t6 = `// 신규 학생 등록 버튼 (사이드바) 로직`;
  const r6 = `const refCb = document.getElementById('reg-is-reference');
  if(refCb) {
    refCb.addEventListener('change', (e) => {
      if(e.target.checked) {
        alert("이 체크박스를 선택하면 참고용 학생으로 등록되며 통계 및 관리 기능이 제한됩니다.");
      }
    });
  }
  
  // 신규 학생 등록 버튼 (사이드바) 로직`;
  if (c.includes(t6)) { c = c.replace(t6, r6); }

  fs.writeFileSync(p, c, 'utf8');
  console.log('script.js 수정 성공');
}

patchIndexHtml();
patchBackend();
patchScript();
