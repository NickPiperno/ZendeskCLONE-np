import { renderHook, act } from '@testing-library/react';
import { useConfirmation } from '../useConfirmation';

describe('useConfirmation', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useConfirmation());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.description).toBe('');
    expect(result.current.type).toBe('default');
    expect(result.current.confirmText).toBe('Confirm');
    expect(result.current.cancelText).toBe('Cancel');
  });

  it('opens confirmation dialog with provided options', async () => {
    const { result } = renderHook(() => useConfirmation());

    const confirmationPromise = act(() => {
      return result.current.confirm({
        title: 'Test Title',
        description: 'Test Description',
        type: 'warning',
        confirmText: 'Yes',
        cancelText: 'No'
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.title).toBe('Test Title');
    expect(result.current.description).toBe('Test Description');
    expect(result.current.type).toBe('warning');
    expect(result.current.confirmText).toBe('Yes');
    expect(result.current.cancelText).toBe('No');

    // Clean up
    act(() => {
      result.current.onClose();
    });
  });

  it('resolves with true when confirmed', async () => {
    const { result } = renderHook(() => useConfirmation());

    let confirmationResult: boolean | undefined;
    act(() => {
      result.current
        .confirm({
          title: 'Test',
          description: 'Test'
        })
        .then((value) => {
          confirmationResult = value;
        });
    });

    act(() => {
      result.current.onConfirm();
    });

    expect(confirmationResult).toBe(true);
    expect(result.current.isOpen).toBe(false);
  });

  it('resolves with false when closed', async () => {
    const { result } = renderHook(() => useConfirmation());

    let confirmationResult: boolean | undefined;
    act(() => {
      result.current
        .confirm({
          title: 'Test',
          description: 'Test'
        })
        .then((value) => {
          confirmationResult = value;
        });
    });

    act(() => {
      result.current.onClose();
    });

    expect(confirmationResult).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('resets state after confirmation', async () => {
    const { result } = renderHook(() => useConfirmation());

    act(() => {
      result.current.confirm({
        title: 'Test Title',
        description: 'Test Description'
      });
    });

    act(() => {
      result.current.onConfirm();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.description).toBe('');
  });

  it('resets state after closing', async () => {
    const { result } = renderHook(() => useConfirmation());

    act(() => {
      result.current.confirm({
        title: 'Test Title',
        description: 'Test Description'
      });
    });

    act(() => {
      result.current.onClose();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.title).toBe('');
    expect(result.current.description).toBe('');
  });
}); 