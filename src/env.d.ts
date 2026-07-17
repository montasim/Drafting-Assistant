/// <reference types="wxt/vite-builder-env" />

declare module '*.module.css' {
  interface CssClasses {
    readonly shell: string;
    readonly wide: string;
    readonly header: string;
    readonly mark: string;
    readonly title: string;
    readonly subtle: string;
    readonly card: string;
    readonly warning: string;
    readonly error: string;
    readonly success: string;
    readonly field: string;
    readonly label: string;
    readonly input: string;
    readonly textarea: string;
    readonly select: string;
    readonly row: string;
    readonly between: string;
    readonly button: string;
    readonly secondary: string;
    readonly danger: string;
    readonly check: string;
    readonly switch: string;
    readonly thumb: string;
    readonly tabs: string;
    readonly tab: string;
    readonly list: string;
    readonly draft: string;
    readonly badge: string;
    readonly meta: string;
    readonly empty: string;
    readonly spinner: string;
  }
  const classes: CssClasses;
  export default classes;
}

declare module '*.html?raw' {
  const source: string;
  export default source;
}
