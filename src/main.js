import { createApp } from './ui/app.js';

createApp(document.getElementById('app'));

// 网络字体不阻塞首屏：界面先用系统字体（苹方 / 微软雅黑等）渲染，
// 首帧之后再插入字体表；字体服务不可达或挂起时，页面照常可用。
const FONTS = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@700;900&display=swap';
requestAnimationFrame(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS;
  document.head.append(link);
});
