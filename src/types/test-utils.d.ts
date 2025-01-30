/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom';
import { expect } from '@jest/globals';

declare module '@testing-library/jest-dom' {
  export interface Matchers<R = void, T = {}> {
    toBeInTheDocument(): R;
    toBeEmptyDOMElement(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(...classNames: string[]): R;
    toHaveStyle(css: string | object): R;
    toBeVisible(): R;
    toBeInvalid(): R;
    toBeRequired(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeEmpty(): R;
    toBePartiallyChecked(): R;
    toBeChecked(): R;
    toHaveValue(value?: string | string[] | number | null): R;
    toHaveDisplayValue(value: string | RegExp | (string | RegExp)[]): R;
    toHaveFocus(): R;
    toHaveFormValues(values: { [name: string]: any }): R;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): R;
  }
} 