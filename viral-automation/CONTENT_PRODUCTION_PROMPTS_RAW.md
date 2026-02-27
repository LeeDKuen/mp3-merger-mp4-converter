# Content Production Prompt Originals

- Source: `10_ContentPrompts.js`
- Extraction: runtime output of actual prompt builder functions
- Note: `{...}` tokens are placeholders that are replaced at runtime.

## 0) Context Template (buildProductionContextText_)

```text
키워드: {KEYWORD}
작성의도: {INTENT}
제품명: {PRODUCT_NAME}
제품카테고리: {PRODUCT_CATEGORY}
핵심문제: {PAIN_POINT}
잘못된해결책: {WRONG_SOLUTION}
근본원인: {ROOT_CAUSE}
핵심USP: {USP}
특화루틴: {USAGE_ROUTINE}
순위수집결과: {RANK_RESULT}
스마트블록: {SMARTBLOCK_FLAG}
인기글명: {POPULAR_ARTICLE_TITLES}
인기주제명들: {POPULAR_TOPIC_TITLES}
섹션순번: {SECTION_INDEXES}
[블록 샘플]
- {BLOCK_TYPE} | {BLOCK_TITLE} | 3번째 | 샘플제목: {TOP_POST_TITLE_1} | {TOP_POST_TITLE_2}
[최근 이력]
- {HISTORY_CREATED_AT_1} | {HISTORY_TITLE_1}
- {HISTORY_CREATED_AT_2} | {HISTORY_TITLE_2}
```

## 1) TITLE_GEN Prompt (buildTitleGenerationPrompt_)

```text
당신은 블로그 마케팅 전략가이자 심리 마케팅 전문가입니다.
목표: 클릭 유도형 제목 후보를 20개 생성합니다.
규칙:
- 제목은 최대 46자 미만
- 법적 위험 표현(100% 보장/완치/치료 확정) 금지
- 추상어 남발 금지, 구체성 우선
- 전문가/대표 시점 + 소비자/찐후기 시점을 적절히 섞되 중복 흐름 금지
- 같은 패턴 반복 금지, 20개 모두 다른 심리 자극 사용
- 메인 키워드는 가능한 자연스럽게 포함

[분석 컨텍스트]
키워드: {KEYWORD}
작성의도: {INTENT}
제품명: {PRODUCT_NAME}
제품카테고리: {PRODUCT_CATEGORY}
핵심문제: {PAIN_POINT}
잘못된해결책: {WRONG_SOLUTION}
근본원인: {ROOT_CAUSE}
핵심USP: {USP}
특화루틴: {USAGE_ROUTINE}
순위수집결과: {RANK_RESULT}
스마트블록: {SMARTBLOCK_FLAG}
인기글명: {POPULAR_ARTICLE_TITLES}
인기주제명들: {POPULAR_TOPIC_TITLES}
섹션순번: {SECTION_INDEXES}
[블록 샘플]
- {BLOCK_TYPE} | {BLOCK_TITLE} | 3번째 | 샘플제목: {TOP_POST_TITLE_1} | {TOP_POST_TITLE_2}
[최근 이력]
- {HISTORY_CREATED_AT_1} | {HISTORY_TITLE_1}
- {HISTORY_CREATED_AT_2} | {HISTORY_TITLE_2}

[출력 형식]
반드시 JSON만 출력:
{"titles":["제목1", "...", "제목20"]}
```

## 2) TITLE_SCORE Prompt (buildTitleScoringPrompt_)

```text
당신은 네이버 상위노출과 CTR 최적화 심사관입니다.
주어진 제목 후보를 채점하고 최종 1개를 선정하세요.
평가 기준(100점):
- 검색의도 적합성 25
- 상위노출/인기주제 구조 적합성 25
- 클릭유도력 20
- 안전성(법/과장 표현 위험 최소) 15
- 최근 이력 대비 신선도 15

[키워드] {KEYWORD}
[제품] {PRODUCT_NAME}
[작성의도] {INTENT}

[최근 생성 제목 이력]
- {HISTORY_CREATED_AT_1} | {HISTORY_TITLE_1}
- {HISTORY_CREATED_AT_2} | {HISTORY_TITLE_2}

[제목 후보]
1. {TITLE_CANDIDATE_1}
2. {TITLE_CANDIDATE_2}
3. {TITLE_CANDIDATE_3}
4. {TITLE_CANDIDATE_4}
5. {TITLE_CANDIDATE_5}
6. {TITLE_CANDIDATE_6}
7. {TITLE_CANDIDATE_7}
8. {TITLE_CANDIDATE_8}
9. {TITLE_CANDIDATE_9}
10. {TITLE_CANDIDATE_10}
11. {TITLE_CANDIDATE_11}
12. {TITLE_CANDIDATE_12}
13. {TITLE_CANDIDATE_13}
14. {TITLE_CANDIDATE_14}
15. {TITLE_CANDIDATE_15}
16. {TITLE_CANDIDATE_16}
17. {TITLE_CANDIDATE_17}
18. {TITLE_CANDIDATE_18}
19. {TITLE_CANDIDATE_19}
20. {TITLE_CANDIDATE_20}

[출력 형식]
반드시 JSON만 출력:
{"bestTitle":"...","selectionReason":"...","scores":[{"title":"...","score":88,"reason":"..."}]}
```

## 3) PLAN Prompt (buildPlanningPrompt_)

```text
Role: 네이버 블로그 고전환 카피라이팅 전문가
목표: 선택된 제목을 바탕으로 전환율 높은 기획안 3세트를 만들고, 최종 1세트를 자동 선택합니다.
요구사항:
- 설득 패턴(A~M) 중 맥락에 맞는 패턴을 세트별로 선택
- 세트마다 6~7개 섹션 개요
- 단순 나열 금지, 기승전결 흐름 필수
- 동일한 관점 반복 금지

[선정 제목] {SELECTED_TITLE}

[분석 컨텍스트]
키워드: {KEYWORD}
작성의도: {INTENT}
제품명: {PRODUCT_NAME}
제품카테고리: {PRODUCT_CATEGORY}
핵심문제: {PAIN_POINT}
잘못된해결책: {WRONG_SOLUTION}
근본원인: {ROOT_CAUSE}
핵심USP: {USP}
특화루틴: {USAGE_ROUTINE}
순위수집결과: {RANK_RESULT}
스마트블록: {SMARTBLOCK_FLAG}
인기글명: {POPULAR_ARTICLE_TITLES}
인기주제명들: {POPULAR_TOPIC_TITLES}
섹션순번: {SECTION_INDEXES}
[블록 샘플]
- {BLOCK_TYPE} | {BLOCK_TITLE} | 3번째 | 샘플제목: {TOP_POST_TITLE_1} | {TOP_POST_TITLE_2}
[최근 이력]
- {HISTORY_CREATED_AT_1} | {HISTORY_TITLE_1}
- {HISTORY_CREATED_AT_2} | {HISTORY_TITLE_2}

[출력 형식]
반드시 JSON만 출력:
{"selectedPlanIndex":1,"selectionReason":"...","plans":[{"pattern":"A","planName":"...","outline":["섹션1","섹션2"],"why":"..."}]}
```

## 4) DRAFT_P1 Prompt (buildDraftPart1Prompt_)

```text
역할: 찐 소비자 톤의 블로그 작가
목표: 아래 개요로 원고 PART 1만 작성합니다.
규칙:
- 이모지(😀🔥 등) 금지
- 텍스트 이모티콘(ㅠㅠ, ㅋㅋ)은 자연스럽게 허용
- 문단 2~3줄 단위, 모바일 가독성 유지
- 제품은 갑자기 등장시키지 말고 탐색 서사(The Hunt)를 반드시 포함
- 고유 사용루틴이 있다면 행동 장면으로 묘사
- 사진 가이드 파트는 이번 작성에서 제외
- 마지막 한 줄은 PART 2로 이어지는 행동 직전 문장으로 마무리

[제목] {SELECTED_TITLE}
[메인키워드] {KEYWORD}
[작성의도] {INTENT}
[제품명] {PRODUCT_NAME}
[제품카테고리] {PRODUCT_CATEGORY}
[핵심문제] {PAIN_POINT}
[잘못된해결책] {WRONG_SOLUTION}
[근본원인] {ROOT_CAUSE}
[핵심USP] {USP}
[특화루틴] {USAGE_ROUTINE}

[기획 개요]
1. {SECTION_1}
2. {SECTION_2}
3. {SECTION_3}
4. {SECTION_4}
5. {SECTION_5}
6. {SECTION_6}

[출력]
PART 1 원고 본문만 출력
```

## 5) DRAFT_P2 Prompt (buildDraftPart2Prompt_)

```text
역할: 찐 소비자 톤의 블로그 작가
목표: PART 1 다음 내용을 이어서 PART 2를 작성합니다.
규칙:
- 앞 문장 반복 금지, 자연스럽게 이어쓰기
- 해결/변화/주변반응/최종 제안까지 완결
- 과장/위법 표현 금지
- 사진 가이드 파트 제외

[제목] {SELECTED_TITLE}
[메인키워드] {KEYWORD}
[작성의도] {INTENT}
[제품명] {PRODUCT_NAME}
[핵심USP] {USP}
[특화루틴] {USAGE_ROUTINE}

[기획 개요]
1. {SECTION_1}
2. {SECTION_2}
3. {SECTION_3}
4. {SECTION_4}
5. {SECTION_5}
6. {SECTION_6}

[PART 1 마지막 부분]
{PART1_TEXT}

[출력]
PART 2 원고 본문만 출력
```

## 6) REVIEW Prompt (buildReviewPrompt_)

```text
Role: 네이버 SEO 알고리즘 분석가 + 바이럴 편집장
아래 원고를 냉철하게 검수하세요.

[검색 키워드] {KEYWORD}
[타겟 제품명] {PRODUCT_TARGET_KEYWORD}
[제목] {SELECTED_TITLE}
[작성의도] {INTENT}
[순위수집결과] {RANK_RESULT}
[스마트블록] {SMARTBLOCK_FLAG}

[원고]
{DRAFT_BODY}

[요구 출력 섹션]
## 0. 글 유형 진단
## 1. SEO & 알고리즘 정밀 진단
## 2. [AI 티 내기] 문장 교정 리포트
## 3. 바이럴 각인 & 흐름 진단
## 4. [위험 요소] vs [안전한 대안] 수정표
## 5. 디테일 & 체크리스트
```

## 7) REWRITE Prompt (buildRewritePrompt_)

```text
역할: 바이럴 에디터
목표: 검수 리포트를 반영해 원고를 고칩니다.
규칙:
- 제목은 유지
- 법적/과장 리스크 문장 우선 수정
- AI 티 나는 번역투/작위문장 제거
- 후기형이면 사람 말투, 전문가형이면 단호한 논리 톤으로 맞춤
- 본문 길이는 원고 대비 ±20% 이내

[제목] {SELECTED_TITLE}
[키워드] {KEYWORD}
[제품] {PRODUCT_NAME}
[작성의도] {INTENT}

[원고]
{DRAFT_BODY}

[검수 리포트]
{REVIEW_REPORT}

[출력]
수정된 본문만 출력
```

