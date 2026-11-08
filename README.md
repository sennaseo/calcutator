# calcutator — DietCalc 웹 미리보기

DietCalc(React Native) 앱의 UI를 **브라우저에서 고쳐 보기 위한 미리보기용 복사본**입니다.
안드로이드 에뮬레이터 대신 브라우저에서 바로 화면을 보면서 수정하고, 다 되면 앱으로 되돌려 복사합니다.

`react-native-web` + Vite로 앱 코드(`App.tsx`, `src/`)를 **고치지 않고 그대로** 돌립니다.
그래서 여기서 고친 파일을 앱에 그대로 붙여넣을 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

터미널에 나오는 주소(기본 http://localhost:5173)를 열면 폰 크기(390×844) 화면으로 앱이 뜹니다.
파일을 저장하면 바로 반영됩니다.

## 앱으로 되돌리기

`App.tsx`와 `src/` 아래에서 바꾼 파일을 `DietCalc/DietCalc`의 같은 경로에 그대로 복사하면 됩니다.

- **`src/secrets.js`는 절대 복사하지 마세요.** 여기 있는 건 빈 키만 든 스텁이고, 진짜 키는 앱의 `.env`에서 만들어집니다.
- `vite.config.js`, `index.html`, `web-shims/`, `package.json`, `.npmrc`는 웹 미리보기 전용이라 앱에는 필요 없습니다.

## 한계

- **3D 고양이 마스코트는 정지 이미지**로만 나옵니다 (WebView/three.js 대신 `web-shims/WebView.jsx`가 빈 칸을 그림).
- **API 키가 없어서** 건강 탭의 약·영양제 검색(공공 API 호출)은 동작하지 않습니다.
- **데이터는 브라우저 localStorage**에 저장됩니다 (앱 기기 데이터와 별개).
- 안드로이드 뒤로가기 등 기기 기능은 웹에서 동작하지 않습니다(콘솔에 `BackHandler is not supported on web` 경고가 뜨는 건 정상). 글꼴·그림자 등은 실제 기기와 조금 다를 수 있으니 마지막 확인은 앱에서 하세요.
