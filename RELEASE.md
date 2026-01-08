# Dashboard Generator Release Guide

## 릴리즈 방법

### 1. 버전 업데이트
```bash
# package.json의 version을 수정 (예: 1.0.0 -> 1.1.0)
npm version patch  # 버그 수정: 1.0.0 -> 1.0.1
npm version minor  # 기능 추가: 1.0.0 -> 1.1.0
npm version major  # 큰 변경: 1.0.0 -> 2.0.0
```

### 2. Git 태그 생성 및 Push
```bash
# 태그 생성 (v 접두사 필수)
git tag v1.0.0

# 태그 push
git push origin v1.0.0
```

### 3. 자동 빌드 및 릴리즈
- 태그를 push하면 GitHub Actions가 자동으로:
  - Windows용 앱 빌드 (.exe)
  - macOS용 앱 빌드 (.dmg, .zip)
  - GitHub Release 페이지 생성
  - 빌드된 파일들 자동 업로드

### 4. 릴리즈 확인
- https://github.com/{owner}/{repo}/releases 에서 확인
- 자동 생성된 릴리즈 노트 확인 가능

## 수동 빌드 (로컬)

### Windows 빌드
```bash
npm run make
# out/make/ 폴더에 생성됨
```

### macOS 빌드 (macOS에서만 가능)
```bash
npm run make
# out/make/ 폴더에 생성됨
```

## 버전 관리 Best Practices

- **Patch (x.x.1)**: 버그 수정
- **Minor (x.1.x)**: 새 기능 추가 (하위 호환)
- **Major (1.x.x)**: 큰 변경 (하위 호환 안됨)

## GitHub 저장소 설정

1. GitHub 저장소 생성
2. Settings > Actions > General에서 "Read and write permissions" 활성화
3. 코드 push:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/{owner}/{repo}.git
git push -u origin main
```

## 예시: 첫 릴리즈

```bash
# 1. 버전 확인/수정
npm version 1.0.0 --no-git-tag-version

# 2. 커밋
git add package.json
git commit -m "Release v1.0.0"
git push

# 3. 태그 생성 및 push
git tag v1.0.0
git push origin v1.0.0

# 4. GitHub Actions에서 자동으로 빌드 및 릴리즈 생성됨
```
