// react-native-webview 웹 대체: 아무것도 그리지 않는다. CatMascot은 ready 메시지를 못 받으니 정지 이미지 자리표시가 계속 보인다.
import {forwardRef} from 'react';
import {View} from 'react-native';

export const WebView = forwardRef((props, ref) => <View style={props.style} />);
export default WebView;
