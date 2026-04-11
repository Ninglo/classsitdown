import { APP_TITLE } from './appMeta';
import { disposeApp, initApp, setAppMountOptions, type AppMountOptions } from './app';
import styleText from './style.css?raw';
import { appTemplate } from './template';

export interface EmbedMountOptions extends Omit<AppMountOptions, 'queryRoot' | 'hostElement'> {
  setDocumentTitle?: boolean;
}

const normalizeStyleText = (css: string): string =>
  css.replace(/url\((['"]?)\/fonts\//g, "url($1/seating/fonts/");

export const mountSuperamberApp = (
  host: HTMLElement,
  options: EmbedMountOptions = {},
): (() => void) => {
  disposeApp();

  const queryRoot = options.embedded ? (host.shadowRoot || host.attachShadow({ mode: 'open' })) : host;
  queryRoot.innerHTML = `${options.embedded ? `<style>${normalizeStyleText(styleText)}</style>` : ''}${appTemplate}`;

  const shell = queryRoot.querySelector<HTMLElement>('#superamberShell');
  setAppMountOptions({
    launchClassName: options.launchClassName,
    embedded: options.embedded,
    queryRoot,
    hostElement: shell,
  });

  if (options.setDocumentTitle !== false) {
    document.title = APP_TITLE;
  }

  initApp();

  return () => {
    disposeApp();
    queryRoot.innerHTML = '';
  };
};
