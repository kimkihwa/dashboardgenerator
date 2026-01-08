import { ref, computed } from 'vue';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export function useTableSort<T>(data: () => T[]) {
  const sortState = ref<SortState>({
    column: null,
    direction: null
  });

  const toggleSort = (column: string) => {
    if (sortState.value.column === column) {
      // 같은 컬럼 클릭: null → asc → desc → null
      if (sortState.value.direction === null) {
        sortState.value.direction = 'asc';
      } else if (sortState.value.direction === 'asc') {
        sortState.value.direction = 'desc';
      } else {
        sortState.value.direction = null;
        sortState.value.column = null;
      }
    } else {
      // 다른 컬럼 클릭: 새로운 정렬 시작
      sortState.value.column = column;
      sortState.value.direction = 'asc';
    }
  };

  const getSortIcon = (column: string): string => {
    if (sortState.value.column !== column) {
      return ''; // 정렬 안됨 - 아이콘 없음
    }
    if (sortState.value.direction === 'asc') {
      return '↑'; // 오름차순
    }
    if (sortState.value.direction === 'desc') {
      return '↓'; // 내림차순
    }
    return '';
  };

  const sortedData = computed(() => {
    const items = [...data()];
    
    if (!sortState.value.column || !sortState.value.direction) {
      return items;
    }

    const column = sortState.value.column;
    const direction = sortState.value.direction;

    return items.sort((a: any, b: any) => {
      let aVal = a[column];
      let bVal = b[column];

      // null/undefined 처리
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // 숫자 비교
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // 문자열 비교
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (direction === 'asc') {
        return aStr.localeCompare(bStr, 'ko-KR');
      } else {
        return bStr.localeCompare(aStr, 'ko-KR');
      }
    });
  });

  return {
    sortState,
    toggleSort,
    getSortIcon,
    sortedData
  };
}
