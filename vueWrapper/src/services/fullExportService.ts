/**
 * Full HTML Export Service
 *
 * 현재 화면의 DOM을 복제하여 완전히 동작하는 standalone HTML을 생성합니다.
 * 탭 전환, Chart.js 호버 등 모든 인터랙션이 유지됩니다.
 */

import { dataService } from './dataService';
import type { LoadedData } from '../types';

export async function exportFullHTML(): Promise<void> {
  const rawData = dataService.getRawData();
  if (!rawData) {
    alert('내보낼 데이터가 없습니다.');
    return;
  }

  // 모든 탭을 순차적으로 렌더링
  const allTabContents = await renderAllTabsSequentially();

  // HTML 생성
  const html = generateStandaloneHTML(rawData, allTabContents);

  // 다운로드
  downloadHTML(html, `대시보드_${getDateString()}.html`);
}

interface TabContent {
  tabId: string;
  html: string;
  charts: ChartData[];
  filterVariants?: Map<number, string>; // 필터값 -> HTML
}

interface ChartData {
  labels: string;
  datasets: string;
  chartType: string;
}

async function renderAllTabsSequentially(): Promise<TabContent[]> {
  const tabButtons = document.querySelectorAll('[data-tab]');
  const allContents: TabContent[] = [];

  // 현재 활성 탭 저장
  const currentActiveTab = document.querySelector('[data-tab].active') as HTMLElement;
  const originalTabId = currentActiveTab?.getAttribute('data-tab') || 'overview';

  // 필터 옵션
  const filterOptions = [0, 4, 8, 12, 24, 52];

  // 각 탭을 순차적으로 활성화하고 콘텐츠 수집
  for (const tabBtn of Array.from(tabButtons)) {
    const tabId = tabBtn.getAttribute('data-tab');
    if (!tabId) continue;

    // 탭 클릭
    (tabBtn as HTMLElement).click();
    await new Promise(resolve => setTimeout(resolve, 300));

    const tabContent = document.querySelector(`[data-tab-content="${tabId}"]`);
    if (!tabContent) continue;

    // 필터가 있는 탭인지 확인
    const hasFilter = ['risk', 'promotion', 'agency'].includes(tabId);
    const filterVariants = new Map<number, string>();

    if (hasFilter) {
      // 필터 드롭다운 찾기
      const filterSelect = tabContent.querySelector('select') as HTMLSelectElement;

      if (filterSelect) {
        const originalValue = filterSelect.value;

        // 각 필터 옵션별로 렌더링
        for (const weeks of filterOptions) {
          // 필터 값 설정
          filterSelect.value = weeks.toString();
          filterSelect.dispatchEvent(new Event('change'));

          // Vue 재렌더링 대기
          await new Promise(resolve => setTimeout(resolve, 300));

          // 현재 탭의 모든 아코디언 열기 (내용 포함시키기 위해)
          const currentTabContent = document.querySelector(`[data-tab-content="${tabId}"]`);
          if (currentTabContent) {
            // 모든 아코디언 열기
            currentTabContent.querySelectorAll('.accordion-content').forEach(content => {
              (content as HTMLElement).style.display = 'block';
            });

            // 약간 대기 후 HTML 저장
            await new Promise(resolve => setTimeout(resolve, 100));
            filterVariants.set(weeks, currentTabContent.outerHTML);
          }
        }

        // 원래 값으로 복원
        filterSelect.value = originalValue;
        filterSelect.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } else {
      // 필터 없는 탭도 아코디언 열기
      tabContent.querySelectorAll('.accordion-content').forEach(content => {
        (content as HTMLElement).style.display = 'block';
      });

      // 페이먼트 분석 탭이면 모든 아코디언 클릭해서 내용 포함시키기
      if (tabId === 'payment') {
        const accordionHeaders = tabContent.querySelectorAll('.accordion-header');
        for (const header of Array.from(accordionHeaders)) {
          (header as HTMLElement).click();
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 차트 데이터 수집
    const charts: ChartData[] = [];
    tabContent.querySelectorAll('[data-chart-labels]').forEach(chartWrapper => {
      charts.push({
        labels: chartWrapper.getAttribute('data-chart-labels') || '[]',
        datasets: chartWrapper.getAttribute('data-chart-datasets') || '[]',
        chartType: chartWrapper.getAttribute('data-chart-type') || 'line'
      });
    });

    allContents.push({
      tabId,
      html: hasFilter && filterVariants.size > 0 ? filterVariants.get(0)! : tabContent.outerHTML,
      charts,
      filterVariants: hasFilter ? filterVariants : undefined
    });
  }

  // 원래 탭으로 복원
  const originalBtn = document.querySelector(`[data-tab="${originalTabId}"]`) as HTMLElement;
  if (originalBtn) originalBtn.click();

  return allContents;
}

function generateStandaloneHTML(data: LoadedData, tabContents: TabContent[]): string {
  const styles = extractStyles();
  const appElement = document.getElementById('app');

  if (!appElement) {
    alert('앱 요소를 찾을 수 없습니다.');
    return '';
  }

  // 현재 DOM 복제
  const clonedApp = appElement.cloneNode(true) as HTMLElement;

  // 기존 탭 콘텐츠들 제거
  clonedApp.querySelectorAll('[data-tab-content]').forEach(el => el.remove());

  // 수집된 모든 탭 콘텐츠를 main-content 영역에 추가
  const mainContent = clonedApp.querySelector('.main-content');
  if (mainContent) {
    tabContents.forEach((tab, index) => {
      // 필터 variants가 있으면 모두 추가
      if (tab.filterVariants && tab.filterVariants.size > 0) {
        tab.filterVariants.forEach((html, weeks) => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const tabElement = tempDiv.firstElementChild as HTMLElement;
          if (tabElement) {
            tabElement.setAttribute('data-filter-weeks', weeks.toString());
            tabElement.style.display = index === 0 && weeks === 0 ? 'block' : 'none';
            mainContent.appendChild(tabElement);
          }
        });
      } else {
        // 필터 없는 탭은 그대로
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tab.html;
        const tabElement = tempDiv.firstElementChild as HTMLElement;
        if (tabElement) {
          tabElement.style.display = index === 0 ? 'block' : 'none';
          mainContent.appendChild(tabElement);
        }
      }
    });
  }

  // 새로고침, 폴더선택 버튼 제거
  clonedApp.querySelectorAll('.btn-secondary, .btn-primary').forEach(btn => {
    if (btn.textContent?.includes('새로고침') || btn.textContent?.includes('폴더')) {
      btn.remove();
    }
  });

  // 내보내기 버튼 숨기기
  clonedApp.querySelectorAll('[data-export-button]').forEach(btn => {
    (btn as HTMLElement).style.display = 'none';
  });

  // 날짜 선택 드롭다운만 비활성화 (필터는 활성화)
  const dateSelector = clonedApp.querySelector('.date-selector select');
  if (dateSelector) {
    dateSelector.setAttribute('disabled', 'true');
  }

  // 아코디언 초기 상태: 모두 닫기 (HTML에는 포함되어 있지만 숨김)
  clonedApp.querySelectorAll('.accordion-content').forEach(content => {
    (content as HTMLElement).style.display = 'none';
  });

  // 대리점 실적의 확장 행들 초기 숨김 (HTML에는 포함되어 있지만 숨김)
  clonedApp.querySelectorAll('.expanded-row').forEach(row => {
    (row as HTMLElement).style.display = 'none';
  });

  // 차트 데이터 JSON 생성
  const chartDataJson = JSON.stringify(tabContents.flatMap((tab, tabIndex) =>
    tab.charts.map((chart, chartIndex) => ({
      tabId: tab.tabId,
      tabIndex,
      chartIndex,
      ...chart
    }))
  ));

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>대시보드 - ${dataService.formatDate(getDateString())}</title>

  <style>
${styles}

/* Export 전용 스타일 */
[data-tab-content] { display: none !important; }
[data-tab-content].active-export { display: block !important; }

/* 차트 그리드 오버플로우 방지 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 20px;
  max-width: 100%;
  overflow: hidden;
}
@media (max-width: 1100px) {
  .charts-grid { grid-template-columns: 1fr !important; }
}
.chart-wrapper {
  min-width: 0;
  max-width: 100%;
}
  </style>
</head>
<body>
  ${clonedApp.outerHTML}

  <!-- Preloaded Data -->
  <script>
    window.__PRELOADED_DATA__ = ${JSON.stringify(data)};
    window.__CHART_DATA__ = ${chartDataJson};
  <\/script>

  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"><\/script>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // 첫 번째 탭 활성화
      const firstTab = document.querySelector('[data-tab-content]');
      if (firstTab) firstTab.classList.add('active-export');

      initTabNavigation();
      initFilterDropdowns();
      initAgencyAccordion();
      initAccordions();
      initAllCharts();
    });

    function initTabNavigation() {
      const tabs = document.querySelectorAll('[data-tab]');
      const contents = document.querySelectorAll('[data-tab-content]');

      tabs.forEach(tab => {
        tab.addEventListener('click', function() {
          const targetTab = this.getAttribute('data-tab');

          // 탭 버튼 활성화
          tabs.forEach(t => t.classList.remove('active'));
          this.classList.add('active');

          // 탭 콘텐츠 전환
          contents.forEach(content => {
            const contentTab = content.getAttribute('data-tab-content');

            if (contentTab === targetTab) {
              // 필터가 있는 탭이면 현재 필터 값에 맞는 버전 표시
              const filterWeeks = content.getAttribute('data-filter-weeks');
              if (filterWeeks !== null) {
                // 같은 탭의 다른 필터 버전들 숨기기
                const allVersions = document.querySelectorAll('[data-tab-content="' + targetTab + '"]');
                allVersions.forEach(v => v.classList.remove('active-export'));

                // 현재 선택된 필터 값 가져오기
                const select = content.querySelector('select');
                const currentFilter = select ? select.value : '0';

                // 해당 필터 버전 찾아서 표시
                const matchingVersion = Array.from(allVersions).find(v =>
                  v.getAttribute('data-filter-weeks') === currentFilter
                );
                if (matchingVersion) {
                  matchingVersion.classList.add('active-export');
                } else {
                  content.classList.add('active-export');
                }
              } else {
                content.classList.add('active-export');
              }
            } else {
              content.classList.remove('active-export');
            }
          });
        });
      });
    }

    // 드롭다운 필터 기능 활성화
    function initFilterDropdowns() {
      // 필터가 있는 탭들의 select 요소
      ['risk', 'promotion', 'agency'].forEach(tabId => {
        const tabContents = document.querySelectorAll('[data-tab-content="' + tabId + '"]');

        tabContents.forEach(tabContent => {
          const select = tabContent.querySelector('select');
          if (select) {
            select.removeAttribute('disabled');

            select.addEventListener('change', function() {
              const selectedWeeks = this.value;

              // 같은 탭의 다른 필터 버전들 숨기기
              const allVersions = document.querySelectorAll('[data-tab-content="' + tabId + '"]');
              allVersions.forEach(version => {
                const versionWeeks = version.getAttribute('data-filter-weeks');
                if (versionWeeks === selectedWeeks) {
                  version.classList.add('active-export');

                  // 대리점 탭이면 아코디언과 이벤트 다시 초기화
                  if (tabId === 'agency') {
                    setTimeout(function() {
                      // 먼저 확장 행 모두 닫기
                      version.querySelectorAll('.expanded-row').forEach(function(row) {
                        row.style.display = 'none';
                      });
                      // 이벤트 다시 등록
                      initAgencyAccordionForElement(version);
                    }, 100);
                  }

                  // 아코디언이 있는 탭이면 다시 초기화
                  if (tabId === 'promotion') {
                    setTimeout(function() {
                      // 아코디언 모두 닫기
                      version.querySelectorAll('.accordion-content').forEach(function(content) {
                        content.style.display = 'none';
                      });
                      // 이벤트 다시 등록
                      initAccordionsForElement(version);
                    }, 100);
                  }
                } else {
                  version.classList.remove('active-export');
                }
              });
            });
          }
        });
      });
    }

    // 대리점 클릭 시 매장 목록 펼치기/접기
    function initAgencyAccordion() {
      initAgencyAccordionForElement(document);
    }

    function initAgencyAccordionForElement(container) {
      // 해당 컨테이너 내의 clickable-row만 찾기
      const agencyRows = container.querySelectorAll('.clickable-row');

      agencyRows.forEach(function(row, rowIndex) {
        // 기존 이벤트 리스너 제거를 위해 clone 사용
        const newRow = row.cloneNode(true);
        row.parentNode.replaceChild(newRow, row);

        newRow.style.cursor = 'pointer';

        newRow.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          // 다음 형제 요소(expanded-row) 찾기
          let expandedRow = this.nextElementSibling;

          // expanded-row가 없으면 동적으로 생성
          if (!expandedRow || !expandedRow.classList.contains('expanded-row')) {
            expandedRow = document.createElement('tr');
            expandedRow.className = 'expanded-row';
            expandedRow.style.display = 'none';
            this.parentNode.insertBefore(expandedRow, this.nextSibling);
          }

          // 토글
          const isCurrentlyVisible = expandedRow.style.display === 'table-row';

          if (isCurrentlyVisible) {
            // 닫기
            expandedRow.style.display = 'none';
          } else {
            // 열기 - 매장 리스트 생성
            const agencyName = this.cells[0].textContent.trim();

            // 현재 활성 탭의 필터 값 가져오기
            const activeTab = document.querySelector('[data-tab-content].active-export');
            const filterSelect = activeTab ? activeTab.querySelector('select') : null;
            const filterWeeks = filterSelect ? parseInt(filterSelect.value) : 0;

            // 데이터에서 해당 대리점 찾기
            const data = window.__PRELOADED_DATA__;
            if (!data || !data.orderData) {
              expandedRow.style.display = 'table-row';
              return;
            }

            // 대리점의 매장 리스트 필터링
            const targetDate = new Date(data.selectedDate);
            const cutoffDate = new Date(targetDate);
            if (filterWeeks > 0) {
              cutoffDate.setDate(cutoffDate.getDate() - (filterWeeks * 7));
            }

            // 해당 대리점의 매장 필터링
            const shops = data.orderData.filter(function(shop) {
              if (shop.shop_status === '종료') return false;

              const shopAgency = shop.prev_company && shop.prev_company !== '-' ? shop.prev_company : '직영업';
              if (shopAgency !== agencyName) return false;

              // 등록일 필터
              if (filterWeeks > 0 && shop.ins_datetime) {
                const insDate = new Date(shop.ins_datetime);
                if (insDate < cutoffDate) return false;
              }

              return true;
            });

            // 리스크 매장과 이탈 매장 Set 생성
            const riskShopCodes = new Set(data.riskShopList ? data.riskShopList.map(function(s) { return s.shop_code; }) : []);
            const churnedShopCodes = new Set(); // 이탈 매장은 별도 계산 필요

            // HTML 생성
            let html = '<td colspan="13" style="padding: 0; background: var(--bg-secondary);">';
            html += '<div style="padding: 16px; max-height: 400px; overflow-y: auto;">';
            html += '<h4 style="margin-bottom: 12px; color: var(--text-primary);">' + agencyName + ' - 매장 목록 (' + shops.length + '개)</h4>';
            html += '<table style="width: 100%; font-size: 13px;">';
            html += '<thead><tr style="background: var(--bg-card);">';
            html += '<th style="padding: 8px; text-align: left;">매장코드</th>';
            html += '<th style="padding: 8px; text-align: left;">매장명</th>';
            html += '<th style="padding: 8px; text-align: center;">상태</th>';
            html += '<th style="padding: 8px; text-align: center;">결제</th>';
            html += '<th style="padding: 8px; text-align: center;">활성화</th>';
            html += '<th style="padding: 8px; text-align: right;">메뉴판앱<br>주문수</th>';
            html += '<th style="padding: 8px; text-align: right;">디바이스</th>';
            html += '<th style="padding: 8px; text-align: right;">주차별<br>주문액</th>';
            html += '<th style="padding: 8px; text-align: left;">등록일</th>';
            html += '</tr></thead><tbody>';

            shops.forEach(function(shop) {
              const isRisk = riskShopCodes.has(shop.shop_code);
              const isChurned = churnedShopCodes.has(shop.shop_code);
              const rowClass = isRisk ? 'shop-risk' : (isChurned ? 'shop-churned' : '');

              html += '<tr class="' + rowClass + '" style="border-bottom: 1px solid var(--border-light);">';
              html += '<td style="padding: 8px;">' + shop.shop_code + '</td>';
              html += '<td style="padding: 8px;">' + shop.shop_name + '</td>';
              html += '<td style="padding: 8px; text-align: center;">';

              const statusClass = shop.shop_status === '이용' ? 'badge-green' : (shop.shop_status === '이용대기' ? 'badge-yellow' : 'danger');
              html += '<span class="badge ' + statusClass + '">' + shop.shop_status + '</span>';
              html += '</td>';
              html += '<td style="padding: 8px; text-align: center;">';

              const paymentClass = shop.pg_yn === '선불' ? 'badge-blue' : 'badge-purple';
              html += '<span class="badge ' + paymentClass + '">' + shop.pg_yn + '</span>';
              html += '</td>';
              html += '<td style="padding: 8px; text-align: center;">';

              if (shop.order_count_no_pos >= 1) {
                html += '<span style="color: var(--accent-green);">✓</span>';
              } else {
                html += '<span style="opacity: 0.3;">-</span>';
              }
              html += '</td>';
              html += '<td style="padding: 8px; text-align: right;">' + formatNumber(shop.order_count_no_pos) + '</td>';
              html += '<td style="padding: 8px; text-align: right;">' + formatNumber(shop.device_count) + '</td>';
              html += '<td style="padding: 8px; text-align: right;">' + formatCurrency(shop.price_no_pos) + '</td>';
              html += '<td style="padding: 8px;">' + (shop.ins_datetime ? shop.ins_datetime.split(' ')[0] : '-') + '</td>';
              html += '</tr>';
            });

            html += '</tbody></table></div></td>';

            expandedRow.innerHTML = html;
            expandedRow.style.display = 'table-row';
          }
        });
      });
    }

    // 아코디언 섹션 펼치기/접기
    function initAccordions() {
      initAccordionsForElement(document);
    }

    function initAccordionsForElement(container) {
      const accordionHeaders = container.querySelectorAll('.accordion-header');

      accordionHeaders.forEach(function(header) {
        // 기존 이벤트 제거를 위해 clone
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);

        newHeader.style.cursor = 'pointer';

        newHeader.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();

          const content = this.nextElementSibling;
          const arrow = this.querySelector('.accordion-arrow');

          if (content && content.classList.contains('accordion-content')) {
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';

            // 화살표 회전
            if (arrow) {
              if (isOpen) {
                arrow.classList.remove('open');
              } else {
                arrow.classList.add('open');
              }
            }
          }
        });
      });
    }

    function initAllCharts() {
      // 모든 탭의 차트 초기화
      document.querySelectorAll('[data-tab-content]').forEach(function(tabContent) {
        initChartsForElement(tabContent);
      });
    }

    function initChartsForElement(container) {
      const chartWrappers = container.querySelectorAll('[data-chart-labels]');

      chartWrappers.forEach(function(wrapper) {
        // 기존 차트 인스턴스 제거
        const existingCanvas = wrapper.querySelector('canvas');
        if (existingCanvas && existingCanvas.chart) {
          existingCanvas.chart.destroy();
        }

        // 기존 캔버스 제거하고 새로 생성
        wrapper.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        wrapper.appendChild(canvas);

        try {
          const labels = JSON.parse(wrapper.getAttribute('data-chart-labels') || '[]');
          const datasets = JSON.parse(wrapper.getAttribute('data-chart-datasets') || '[]');
          const chartType = wrapper.getAttribute('data-chart-type') || 'line';
          const showLegend = wrapper.getAttribute('data-chart-show-legend') !== 'false';

          const styledDatasets = datasets.map(function(ds) {
            return {
              label: ds.label,
              data: ds.data,
              borderColor: ds.borderColor,
              backgroundColor: ds.backgroundColor || (ds.borderColor + '20'),
              fill: ds.fill || false,
              tension: ds.tension !== undefined ? ds.tension : 0.3,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 2,
              yAxisID: ds.yAxisID || 'y'
            };
          });

          const chart = new Chart(canvas, {
              type: chartType,
              data: { labels: labels, datasets: styledDatasets },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false
                },
                plugins: {
                  tooltip: {
                    enabled: true,
                    backgroundColor: '#1a1f2e',
                    titleColor: '#e1e8ed',
                    bodyColor: '#8899a6',
                    borderColor: '#38444d',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                      label: function(context) {
                        var label = context.dataset.label || '';
                        var value = context.parsed.y;
                        if (label.indexOf('금액') >= 0 || label.indexOf('액') >= 0) {
                          return label + ': ' + new Intl.NumberFormat('ko-KR').format(value) + '원';
                        }
                        if (label.indexOf('%') >= 0 || label.indexOf('률') >= 0 || label.indexOf('율') >= 0) {
                          return label + ': ' + value.toFixed(1) + '%';
                        }
                        return label + ': ' + new Intl.NumberFormat('ko-KR').format(value);
                      }
                    }
                  },
                  legend: {
                    display: showLegend,
                    position: 'top',
                    labels: {
                      color: '#8899a6',
                      usePointStyle: true,
                      padding: 20
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { color: 'rgba(56, 68, 77, 0.25)' },
                    ticks: { color: '#8899a6' }
                  },
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(56, 68, 77, 0.25)' },
                    ticks: {
                      color: '#8899a6',
                      callback: function(value) {
                        return new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value);
                      }
                    }
                  },
                  y1: {
                    type: 'linear',
                    display: datasets.some(function(ds) { return ds.yAxisID === 'y1'; }),
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                      color: '#8899a6',
                      callback: function(value) {
                        return value.toFixed(1) + '%';
                      }
                    }
                  }
                }
              }
            });

          // 차트 인스턴스를 캔버스에 저장 (나중에 destroy 할 수 있도록)
          canvas.chart = chart;
        } catch (e) {
          console.error('Chart init error:', e);
        }
      });
    }
  <\/script>
</body>
</html>`;
}

function extractStyles(): string {
  const styles: string[] = [];

  // Inline <style> 태그들
  document.querySelectorAll('style').forEach(style => {
    if (style.textContent) {
      styles.push(style.textContent);
    }
  });

  // 외부 스타일시트 (같은 origin만)
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.cssRules) {
        const rules: string[] = [];
        for (const rule of Array.from(sheet.cssRules)) {
          rules.push(rule.cssText);
        }
        styles.push(rules.join('\n'));
      }
    } catch {
      // CORS 제한으로 접근 불가한 스타일시트 무시
    }
  }

  return styles.join('\n\n');
}

function getDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function downloadHTML(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
