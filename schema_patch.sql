-- 1. version_label 컬럼 추가
ALTER TABLE teacher_feedbacks 
ADD COLUMN version_label text;

-- 2. 기존 고유키(Unique Constraint) 제약조건 확인 및 삭제
-- (주의: 기존 고유키의 이름이 teacher_feedbacks_student_link_question_no_key 가 아닐 경우 대시보드에서 직접 확인 후 삭제해야 합니다)
ALTER TABLE teacher_feedbacks 
DROP CONSTRAINT IF EXISTS teacher_feedbacks_student_link_question_no_key;

-- 3. 새로운 3단 복합 고유키 생성 (student_link, question_no, version_label)
ALTER TABLE teacher_feedbacks 
ADD CONSTRAINT teacher_feedbacks_composite_key UNIQUE (student_link, question_no, version_label);
