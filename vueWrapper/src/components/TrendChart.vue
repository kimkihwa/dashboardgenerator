<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DatasetConfig {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
  yAxisID?: string;
}

const props = defineProps<{
  labels: string[];
  datasets: DatasetConfig[];
  title?: string;
  showLegend?: boolean;
  height?: number;
  yAxisLabel?: string;
  y2AxisLabel?: string;
  useSecondAxis?: boolean;
}>();

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map(ds => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.borderColor,
    backgroundColor: ds.backgroundColor || ds.borderColor + '20',
    fill: ds.fill ?? false,
    tension: ds.tension ?? 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2,
    yAxisID: ds.yAxisID || 'y'
  }))
}));

const chartOptions = computed(() => {
  const options: Record<string, unknown> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: props.showLegend ?? true,
        position: 'top' as const,
        labels: {
          color: '#8899a6',
          usePointStyle: true,
          padding: 20
        }
      },
      title: {
        display: !!props.title,
        text: props.title,
        color: '#1da1f2',
        font: {
          size: 14,
          weight: 'bold' as const
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: '#1a1f2e',
        titleColor: '#e1e8ed',
        bodyColor: '#8899a6',
        borderColor: '#38444d',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context: { dataset: { label: string }; parsed: { y: number } }) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            // 금액인 경우 포맷팅
            if (label.includes('금액') || label.includes('액')) {
              return `${label}: ${new Intl.NumberFormat('ko-KR').format(value)}원`;
            }
            // 퍼센트인 경우
            if (label.includes('%') || label.includes('률') || label.includes('율')) {
              return `${label}: ${value.toFixed(1)}%`;
            }
            return `${label}: ${new Intl.NumberFormat('ko-KR').format(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: '#38444d40',
        },
        ticks: {
          color: '#8899a6'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: '#38444d40',
        },
        ticks: {
          color: '#8899a6',
          callback: function(value: number) {
            return new Intl.NumberFormat('ko-KR', { notation: 'compact' }).format(value);
          }
        },
        title: {
          display: !!props.yAxisLabel,
          text: props.yAxisLabel,
          color: '#8899a6'
        }
      }
    }
  };

  // 두 번째 Y축 설정
  if (props.useSecondAxis) {
    (options.scales as Record<string, unknown>).y1 = {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      grid: {
        drawOnChartArea: false,
      },
      ticks: {
        color: '#8899a6',
        callback: function(value: number) {
          return value.toFixed(1) + '%';
        }
      },
      title: {
        display: !!props.y2AxisLabel,
        text: props.y2AxisLabel,
        color: '#8899a6'
      }
    };
  }

  return options;
});
</script>

<template>
  <div
    class="chart-wrapper"
    :style="{ height: (height || 300) + 'px' }"
    :data-chart-labels="JSON.stringify(labels)"
    :data-chart-datasets="JSON.stringify(datasets)"
    :data-chart-show-legend="showLegend ?? true"
    data-chart-type="line"
  >
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart-wrapper {
  position: relative;
  width: 100%;
}
</style>
