/**
 * DOM 복제 기반 HTML 내보내기 서비스
 * - 현재 렌더링된 DOM을 그대로 복제
 * - Computed Style을 Inline으로 변환
 * - Canvas(차트)를 이미지로 변환 + 호버 툴팁 추가
 */

export async function exportCurrentView(filename: string): Promise<void> {
  // 1. 모든 탭 내용을 보이게 설정
  const dashboard = document.querySelector('.dashboard') as HTMLElement;
  if (!dashboard) {
    alert('대시보드를 찾을 수 없습니다.');
    return;
  }

  // 2. 탭 내용 임시로 모두 표시
  const tabContents = document.querySelectorAll('.tab-content');
  const originalDisplays: string[] = [];

  tabContents.forEach((el, idx) => {
    const htmlEl = el as HTMLElement;
    originalDisplays[idx] = htmlEl.style.display;
  });

  // 3. DOM 복제 및 스타일 인라인화
  const clonedDashboard = await cloneWithInlineStyles(dashboard);

  // 4. 복제된 DOM에서 모든 탭 보이게 처리
  const clonedTabContents = clonedDashboard.querySelectorAll('.tab-content');
  clonedTabContents.forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.display = 'block';
  });

  // 5. 버튼/인터랙티브 요소 제거
  const buttonsToRemove = clonedDashboard.querySelectorAll('.header-actions, .tabs, .filter-bar select, .toggle-buttons, .date-selector select');
  buttonsToRemove.forEach(el => {
    // select는 현재 값만 표시하도록 변환
    if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement;
      const span = document.createElement('span');
      span.textContent = select.options[select.selectedIndex]?.text || '';
      span.style.cssText = getComputedStyleString(select);
      select.parentNode?.replaceChild(span, select);
    }
  });

  // 헤더 액션 버튼들 제거
  const headerActions = clonedDashboard.querySelector('.header-actions');
  headerActions?.remove();

  // 탭 네비게이션 제거 (대신 섹션 제목 추가)
  const tabs = clonedDashboard.querySelector('.tabs');
  tabs?.remove();

  // 토글 버튼들도 텍스트로 변환
  const toggleContainers = clonedDashboard.querySelectorAll('.view-toggle-container');
  toggleContainers.forEach(container => {
    const activeBtn = container.querySelector('.toggle-btn.active');
    if (activeBtn) {
      const label = document.createElement('p');
      label.textContent = `보기 모드: ${activeBtn.textContent}`;
      label.style.cssText = 'color: #8899a6; font-size: 0.9rem; margin-bottom: 12px;';
      container.parentNode?.replaceChild(label, container);
    }
  });

  // 필터 셀렉트도 텍스트로
  const filterSelects = clonedDashboard.querySelectorAll('.filter-bar select');
  filterSelects.forEach(select => {
    const sel = select as HTMLSelectElement;
    const span = document.createElement('span');
    span.textContent = sel.options[sel.selectedIndex]?.text || '';
    span.style.cssText = 'color: #e1e8ed; font-weight: 500;';
    sel.parentNode?.replaceChild(span, sel);
  });

  // 6. 섹션 구분선 추가
  const sections = clonedDashboard.querySelectorAll('.tab-content');
  const sectionTitles = ['📈 현황 개요', '⚠️ 리스크 매장', '💳 페이먼트 분석', '🆕 신규 매장 추적'];
  sections.forEach((section, idx) => {
    if (idx < sectionTitles.length) {
      const divider = document.createElement('div');
      divider.style.cssText = 'border-top: 3px solid #1da1f2; margin: 40px 0 20px; padding-top: 20px;';

      const title = document.createElement('h1');
      title.textContent = sectionTitles[idx] || '';
      title.style.cssText = 'color: #1da1f2; font-size: 1.5rem; margin-bottom: 24px;';

      section.insertBefore(title, section.firstChild);
      if (idx > 0) {
        section.insertBefore(divider, section.firstChild);
      }
    }
  });

  // 7. HTML 문서 생성
  const html = generateHTMLDocument(clonedDashboard.outerHTML, filename);

  // 8. 다운로드
  downloadHTML(html, filename);
}

/**
 * 요소를 복제하고 모든 computed style을 inline으로 변환
 */
async function cloneWithInlineStyles(element: HTMLElement): Promise<HTMLElement> {
  const clone = element.cloneNode(true) as HTMLElement;

  // 원본과 복제본의 모든 요소를 순회
  const originalElements = element.querySelectorAll('*');
  const clonedElements = clone.querySelectorAll('*');

  // 루트 요소 스타일 적용
  clone.style.cssText = getComputedStyleString(element);

  // 모든 자식 요소에 스타일 적용
  for (let i = 0; i < originalElements.length; i++) {
    const original = originalElements[i] as HTMLElement;
    const cloned = clonedElements[i] as HTMLElement;

    if (cloned && cloned.style) {
      cloned.style.cssText = getComputedStyleString(original);
    }

    // Canvas를 이미지로 변환 + 호버 툴팁 오버레이 추가
    if (original.tagName === 'CANVAS') {
      const canvas = original as HTMLCanvasElement;
      const chartWrapper = original.closest('.chart-wrapper') as HTMLElement;

      try {
        // 차트 데이터 읽기
        const labelsData = chartWrapper?.getAttribute('data-chart-labels');
        const datasetsData = chartWrapper?.getAttribute('data-chart-datasets');

        // 이미지 + 호버 오버레이 컨테이너 생성
        const container = createChartWithTooltips(
          canvas,
          labelsData ? JSON.parse(labelsData) : [],
          datasetsData ? JSON.parse(datasetsData) : []
        );

        cloned.parentNode?.replaceChild(container, cloned);
      } catch (e) {
        console.warn('Canvas 변환 실패:', e);
        // 폴백: 단순 이미지
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = getComputedStyleString(canvas);
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        cloned.parentNode?.replaceChild(img, cloned);
      }
    }
  }

  return clone;
}

/**
 * 차트 이미지 + CSS 호버 툴팁 오버레이 생성
 */
function createChartWithTooltips(
  canvas: HTMLCanvasElement,
  labels: string[],
  datasets: { label: string; data: number[]; borderColor: string }[]
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'chart-export-container';
  container.style.cssText = 'position: relative; width: 100%;';

  // 이미지
  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/png');
  img.style.cssText = 'width: 100%; height: auto; display: block;';
  container.appendChild(img);

  // 호버 핫스팟 영역 (차트 영역 대략 계산)
  const chartAreaLeft = 50; // 픽셀 (Y축 레이블 공간)
  const chartAreaTop = 40;  // 픽셀 (상단 여백)
  const chartAreaRight = 20;
  const chartAreaBottom = 30;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const chartWidth = canvasWidth - chartAreaLeft - chartAreaRight;
  const chartHeight = canvasHeight - chartAreaTop - chartAreaBottom;

  if (labels.length > 0 && datasets.length > 0) {
    const pointSpacing = chartWidth / Math.max(1, labels.length - 1);

    labels.forEach((label, idx) => {
      // 데이터 포인트별 툴팁 내용 생성
      let tooltipContent = `<strong>${label}</strong><br>`;
      datasets.forEach(ds => {
        const value = ds.data[idx];
        if (value !== undefined) {
          const formattedValue = formatTooltipValue(ds.label, value);
          tooltipContent += `<span style="color:${ds.borderColor}">●</span> ${ds.label}: ${formattedValue}<br>`;
        }
      });

      // 호버 영역 생성
      const hotspot = document.createElement('div');
      hotspot.className = 'chart-hotspot';
      const leftPercent = (chartAreaLeft + idx * pointSpacing) / canvasWidth * 100;
      const widthPercent = Math.max(8, pointSpacing / canvasWidth * 100);

      hotspot.style.cssText = `
        position: absolute;
        left: ${leftPercent - widthPercent/2}%;
        top: ${chartAreaTop / canvasHeight * 100}%;
        width: ${widthPercent}%;
        height: ${chartHeight / canvasHeight * 100}%;
        cursor: pointer;
        z-index: 10;
      `;

      // 툴팁 요소
      const tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.innerHTML = tooltipContent;
      tooltip.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: #1a1f2e;
        border: 1px solid #38444d;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 12px;
        color: #e1e8ed;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        z-index: 100;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;

      hotspot.appendChild(tooltip);
      container.appendChild(hotspot);
    });
  }

  return container;
}

/**
 * 툴팁 값 포맷팅
 */
function formatTooltipValue(label: string, value: number): string {
  if (label.includes('금액') || label.includes('액')) {
    return new Intl.NumberFormat('ko-KR').format(value) + '원';
  }
  if (label.includes('%') || label.includes('률') || label.includes('율')) {
    return value.toFixed(1) + '%';
  }
  return new Intl.NumberFormat('ko-KR').format(value);
}

/**
 * 요소의 computed style을 문자열로 반환
 */
function getComputedStyleString(element: HTMLElement): string {
  const computed = window.getComputedStyle(element);
  const styles: string[] = [];

  // 중요한 스타일 속성만 추출 (파일 크기 최적화)
  const importantProps = [
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border', 'border-radius', 'border-color', 'border-width', 'border-style',
    'border-top', 'border-right', 'border-bottom', 'border-left',
    'background', 'background-color', 'background-image',
    'color', 'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'text-align', 'text-decoration', 'text-transform',
    'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
    'grid', 'grid-template-columns', 'grid-template-rows', 'grid-gap',
    'overflow', 'overflow-x', 'overflow-y',
    'box-shadow', 'opacity', 'z-index',
    'white-space', 'word-wrap', 'word-break',
    'transition', 'transform'
  ];

  for (const prop of importantProps) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
      styles.push(`${prop}: ${value}`);
    }
  }

  return styles.join('; ');
}

/**
 * 완전한 HTML 문서 생성
 */
function generateHTMLDocument(bodyContent: string, title: string): string {
  const dateStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* 기본 리셋 */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* 페이지 기본 설정 */
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
      background: #0f1419;
      color: #e1e8ed;
      line-height: 1.6;
    }

    /* 인쇄용 스타일 */
    @media print {
      body {
        background: white !important;
        color: black !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print { display: none !important; }

      @page {
        size: A4;
        margin: 15mm;
      }
    }

    /* 이미지 반응형 */
    img {
      max-width: 100%;
      height: auto;
    }

    /* 테이블 스타일 보정 */
    table {
      border-collapse: collapse;
      width: 100%;
    }

    th, td {
      text-align: left;
      padding: 8px 12px;
    }

    /* 차트 호버 툴팁 */
    .chart-export-container {
      position: relative;
    }

    .chart-hotspot:hover .chart-tooltip {
      opacity: 1 !important;
      visibility: visible !important;
    }

    .chart-hotspot::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      background: transparent;
      border-radius: 50%;
      transition: background 0.2s;
    }

    .chart-hotspot:hover::after {
      background: rgba(29, 161, 242, 0.3);
      width: 100%;
      height: 100%;
      border-radius: 0;
    }
  </style>
</head>
<body>
  <div style="padding: 20px; max-width: 1400px; margin: 0 auto;">
    <header style="text-align: center; margin-bottom: 30px; padding: 20px; background: #1a1f2e; border-radius: 12px;">
      <p style="color: #8899a6; font-size: 0.9rem;">생성일: ${dateStr}</p>
    </header>
    ${bodyContent}
    <footer style="text-align: center; margin-top: 40px; padding: 20px; color: #657786; font-size: 0.85rem;">
      <p>© 매장 운영 대시보드 - 자동 생성된 보고서</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * HTML 파일 다운로드
 */
function downloadHTML(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * 모든 탭을 펼친 상태로 내보내기
 */
export async function exportAllTabs(selectedDate: string): Promise<void> {
  // 모든 탭 컨텐츠를 임시로 보이게
  const allTabContents = document.querySelectorAll('.tab-content');
  const originalStyles: Map<Element, string> = new Map();

  allTabContents.forEach(el => {
    const htmlEl = el as HTMLElement;
    originalStyles.set(el, htmlEl.style.display);
    htmlEl.style.display = 'block';
  });

  // 일별/누적 뷰 둘 다 표시하려면 추가 처리 필요
  // 여기서는 현재 선택된 뷰만 내보냄

  try {
    await exportCurrentView(`매장운영_대시보드_${selectedDate}`);
  } finally {
    // 원래 상태로 복원
    allTabContents.forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.display = originalStyles.get(el) || '';
    });
  }
}
